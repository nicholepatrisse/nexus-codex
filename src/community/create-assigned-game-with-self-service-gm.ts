import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import {
  communities,
  communityAuditEvents,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

type Database = ReturnType<typeof getDb>;
export type SelfServiceGmTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type AssignedGameContext = Readonly<{
  communityId: string;
  gmPersonId: string;
}>;

export type SelfServiceGmResult<T> =
  | { status: "created"; value: T; promoted: boolean }
  | { status: "unavailable" };

/**
 * M0-11 seam for atomically creating an assigned game and, only when needed,
 * granting its active member creator GM authority under the current policy.
 *
 * This intentionally exposes no standalone promotion operation. The supplied
 * callback must persist the triggering game through the provided transaction;
 * callback failure rolls the grant and audit event back with the game.
 */
export async function createAssignedGameWithSelfServiceGm<T>(
  actor: Pick<AuthenticatedActor, "personId">,
  communityId: string,
  createAssignedGame: (
    transaction: SelfServiceGmTransaction,
    context: AssignedGameContext,
  ) => Promise<T>,
  database: Database = getDb(),
): Promise<SelfServiceGmResult<T>> {
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${communityId}:${actor.personId}:gm-self-service`}, 0))`,
    );

    const [community] = await transaction
      .select({ id: communities.id })
      .from(communities)
      .where(
        and(
          eq(communities.id, communityId),
          eq(communities.lifecycleStatus, "active"),
          eq(communities.gmAdmission, "self_service"),
        ),
      )
      .limit(1);
    if (!community) return { status: "unavailable" };

    const [membership] = await transaction
      .select({ id: communityMemberships.id })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, community.id),
          eq(communityMemberships.personId, actor.personId),
          eq(communityMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!membership) return { status: "unavailable" };

    const [currentGrant] = await transaction
      .select({ id: communityRoleGrants.id, status: communityRoleGrants.status })
      .from(communityRoleGrants)
      .where(
        and(
          eq(communityRoleGrants.communityId, community.id),
          eq(communityRoleGrants.personId, actor.personId),
          eq(communityRoleGrants.role, "gm"),
          isNull(communityRoleGrants.revokedAt),
        ),
      )
      .limit(1);

    // Owner lifecycle decisions cannot be bypassed by creating a game. Only a
    // Revocation remains terminal for member self-service.
    if (currentGrant && currentGrant.status !== "active") return { status: "unavailable" };

    const [revokedGrant] = currentGrant
      ? []
      : await transaction
          .select({ id: communityRoleGrants.id })
          .from(communityRoleGrants)
          .where(
            and(
              eq(communityRoleGrants.communityId, community.id),
              eq(communityRoleGrants.personId, actor.personId),
              eq(communityRoleGrants.role, "gm"),
              eq(communityRoleGrants.status, "revoked"),
            ),
          )
          .limit(1);
    if (revokedGrant) return { status: "unavailable" };

    const promoted = !currentGrant;
    const now = new Date();
    const requestId = promoted ? randomUUID() : null;
    if (promoted) {
      await transaction.insert(communityGmRequests).values({
        id: requestId!,
        communityId: community.id,
        personId: actor.personId,
        status: "approved",
        admissionPolicy: "self_service",
        requestedAt: now,
        decidedAt: now,
        updatedAt: now,
      });
      await transaction.insert(communityRoleGrants).values({
        id: randomUUID(),
        communityId: community.id,
        personId: actor.personId,
        role: "gm",
        grantedByPersonId: actor.personId,
        status: "active",
        grantedAt: now,
        updatedAt: now,
      });
    }

    const value = await createAssignedGame(transaction, {
      communityId: community.id,
      gmPersonId: actor.personId,
    });

    if (promoted) {
      await transaction.insert(communityAuditEvents).values({
        id: randomUUID(),
        communityId: community.id,
        actorPersonId: actor.personId,
        eventType: "community.gm.self_service_promoted",
        // Avoid game details or other operational metadata in this authority audit.
        details: { requestId },
        occurredAt: now,
      });
    }

    return { status: "created", value, promoted };
  });
}
