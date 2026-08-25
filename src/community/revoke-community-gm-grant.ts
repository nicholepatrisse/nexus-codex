import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { AuthorizationDenialSink } from "@/authorization/denial-audit";
import { getDb } from "@/db/client";
import { communityAuditEvents, communityMemberships, communityRoleGrants } from "@/db/schema";

const revocationInputSchema = z.object({
  reason: z.string().trim().max(500).optional().transform((value) => value || null),
});

type Database = ReturnType<typeof getDb>;
export type GmGrantRevocationTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type FutureGmSessionImpact =
  | { status: "clear" }
  | { status: "affected"; futureSessionIds: string[] }
  | { status: "unavailable" };

export type InspectFutureGmSessionImpact = (input: {
  communityId: string;
  gmPersonId: string;
  transaction: GmGrantRevocationTransaction;
}) => Promise<FutureGmSessionImpact>;

export type GmGrantRevocationResult =
  | { status: "revoked" | "unchanged"; grantId: string }
  | { status: "blocked"; impact: Exclude<FutureGmSessionImpact, { status: "clear" }> }
  | { status: "not-found" };

/** Explicit pre-M0-11 adapter for the known absence of persisted sessions. */
export const noPersistedFutureGmSessions: InspectFutureGmSessionImpact = async () => ({
  status: "clear",
});

/** Permanently revokes an active member's GM grant without deleting history. */
export async function revokeCommunityGmGrant(
  actor: AuthenticatedActor,
  slug: string,
  grantId: string,
  input: z.input<typeof revocationInputSchema>,
  options: {
    database?: Database;
    denialSink?: AuthorizationDenialSink;
    inspectFutureSessions: InspectFutureGmSessionImpact;
    now?: Date;
  },
): Promise<GmGrantRevocationResult> {
  const parsed = revocationInputSchema.parse(input);
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();

  return database.transaction(async (transaction) => {
    const authorization = await authorizeCommunityBySlug({
      actor,
      slug,
      operation: "gm.manage",
      resolveAccess: (candidate, personId) =>
        resolveCommunityAccessBySlug(candidate, personId, transaction),
      denialSink: options.denialSink,
    });
    if (authorization.status !== "authorized") return { status: "not-found" };

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${grantId}, 0))`,
    );
    const communityId = authorization.access.community.id;
    const [grant] = await transaction
      .select({
        id: communityRoleGrants.id,
        personId: communityRoleGrants.personId,
        status: communityRoleGrants.status,
      })
      .from(communityRoleGrants)
      .where(
        and(
          eq(communityRoleGrants.id, grantId),
          eq(communityRoleGrants.communityId, communityId),
          eq(communityRoleGrants.role, "gm"),
        ),
      )
      .limit(1)
      .for("update");
    if (!grant) return { status: "not-found" };
    if (grant.status === "revoked") return { status: "unchanged", grantId };
    if (grant.status !== "active") return { status: "not-found" };

    const [activeMembership] = await transaction
      .select({ id: communityMemberships.id })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.personId, grant.personId),
          eq(communityMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!activeMembership) return { status: "not-found" };

    const [ownerGrant] = await transaction
      .select({ id: communityRoleGrants.id })
      .from(communityRoleGrants)
      .where(and(
        eq(communityRoleGrants.communityId, communityId),
        eq(communityRoleGrants.personId, grant.personId),
        eq(communityRoleGrants.role, "owner"),
        eq(communityRoleGrants.status, "active"),
        isNull(communityRoleGrants.revokedAt),
      ))
      .limit(1)
      .for("update");

    // Removing a redundant explicit GM grant cannot strand an owner's sessions:
    // ownership itself continues to provide GM authority.
    if (!ownerGrant) {
      let impact: FutureGmSessionImpact;
      try {
        impact = await options.inspectFutureSessions({
          communityId,
          gmPersonId: grant.personId,
          transaction,
        });
      } catch {
        impact = { status: "unavailable" };
      }
      if (impact.status !== "clear") return { status: "blocked", impact };
    }

    const [revoked] = await transaction
      .update(communityRoleGrants)
      .set({
        status: "revoked",
        revokedAt: now,
        revokedByPersonId: actor.personId,
        revocationReason: parsed.reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(communityRoleGrants.id, grantId),
          eq(communityRoleGrants.status, "active"),
        ),
      )
      .returning({ id: communityRoleGrants.id });
    if (!revoked) return { status: "not-found" };

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId,
      actorPersonId: actor.personId,
      eventType: "community.gm.revoked",
      details: { grantId },
      occurredAt: now,
    });
    return { status: "revoked", grantId };
  });
}
