import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { AuthorizationDenialSink } from "@/authorization/denial-audit";
import { getDb } from "@/db/client";
import {
  communities,
  communityAuditEvents,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export type CommunityGmRequestResult =
  | { status: "pending"; requestId: string; communityId: string }
  | { status: "not-found" };

/** Creates one approved-only GM request for an active member. */
export async function requestCommunityGmAdmission(
  actor: AuthenticatedActor,
  slug: string,
  options: { database?: Database; denialSink?: AuthorizationDenialSink; now?: Date } = {},
): Promise<CommunityGmRequestResult> {
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();

  return database.transaction(async (transaction) => {
    const authorization = await authorizeCommunityBySlug({
      actor,
      slug,
      operation: "gm.request",
      resolveAccess: (candidate, personId) =>
        resolveCommunityAccessBySlug(candidate, personId, transaction),
      denialSink: options.denialSink,
    });
    if (authorization.status !== "authorized") return { status: "not-found" };
    const communityId = authorization.access.community.id;

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${communityId}:${actor.personId}:gm`}, 0))`,
    );
    const [community] = await transaction
      .select({ gmAdmission: communities.gmAdmission })
      .from(communities)
      .where(and(eq(communities.id, communityId), eq(communities.lifecycleStatus, "active")))
      .limit(1);
    // Self-service promotion is a separate policy path; this workflow snapshots
    // and processes only requests requiring owner approval.
    if (community?.gmAdmission !== "approved_only") return { status: "not-found" };

    const [existingGrant] = await transaction
      .select({ status: communityRoleGrants.status })
      .from(communityRoleGrants)
      .where(
        and(
          eq(communityRoleGrants.communityId, communityId),
          eq(communityRoleGrants.personId, actor.personId),
          eq(communityRoleGrants.role, "gm"),
          isNull(communityRoleGrants.revokedAt),
        ),
      )
      .limit(1);
    // An existing non-revoked GM grant cannot create another request.
    if (existingGrant) return { status: "not-found" };

    const [pending] = await transaction
      .select({ id: communityGmRequests.id })
      .from(communityGmRequests)
      .where(
        and(
          eq(communityGmRequests.communityId, communityId),
          eq(communityGmRequests.personId, actor.personId),
          eq(communityGmRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (pending) return { status: "pending", requestId: pending.id, communityId };

    const requestId = randomUUID();
    await transaction.insert(communityGmRequests).values({
      id: requestId,
      communityId,
      personId: actor.personId,
      status: "pending",
      admissionPolicy: "approved_only",
      requestedAt: now,
      updatedAt: now,
    });
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId,
      actorPersonId: actor.personId,
      eventType: "community.gm.requested",
      details: { requestId },
      occurredAt: now,
    });
    return { status: "pending", requestId, communityId };
  });
}

export type CommunityGmCancellationResult =
  | { status: "cancelled"; requestId: string }
  | { status: "not-found" };

export async function cancelCommunityGmAdmission(
  actor: Pick<AuthenticatedActor, "personId">,
  requestId: string,
  options: { database?: Database; now?: Date } = {},
): Promise<CommunityGmCancellationResult> {
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`);
    const [request] = await transaction
      .select({ communityId: communityGmRequests.communityId })
      .from(communityGmRequests)
      .where(
        and(
          eq(communityGmRequests.id, requestId),
          eq(communityGmRequests.personId, actor.personId),
          eq(communityGmRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (!request) return { status: "not-found" };
    const [currentAccess] = await transaction
      .select({ membershipId: communityMemberships.id })
      .from(communityMemberships)
      .innerJoin(
        communities,
        and(
          eq(communities.id, communityMemberships.communityId),
          eq(communities.lifecycleStatus, "active"),
        ),
      )
      .where(
        and(
          eq(communityMemberships.communityId, request.communityId),
          eq(communityMemberships.personId, actor.personId),
          eq(communityMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!currentAccess) return { status: "not-found" };
    const [cancelled] = await transaction
      .update(communityGmRequests)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(
        and(
          eq(communityGmRequests.id, requestId),
          eq(communityGmRequests.personId, actor.personId),
          eq(communityGmRequests.status, "pending"),
        ),
      )
      .returning({ id: communityGmRequests.id, communityId: communityGmRequests.communityId });
    if (!cancelled) return { status: "not-found" };

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId: cancelled.communityId,
      actorPersonId: actor.personId,
      eventType: "community.gm.cancelled",
      details: { requestId },
      occurredAt: now,
    });
    return { status: "cancelled", requestId };
  });
}

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional().transform((value) => value || null),
});

export type CommunityGmDecisionResult =
  | { status: "approved" | "rejected"; requestId: string }
  | { status: "not-found" };

/** Applies an owner decision using current membership and authority state. */
export async function decideCommunityGmAdmission(
  actor: AuthenticatedActor,
  slug: string,
  requestId: string,
  input: z.input<typeof decisionSchema>,
  options: { database?: Database; denialSink?: AuthorizationDenialSink; now?: Date } = {},
): Promise<CommunityGmDecisionResult> {
  const parsed = decisionSchema.parse(input);
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
    const communityId = authorization.access.community.id;

    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`);
    const [request] = await transaction
      .select({ personId: communityGmRequests.personId })
      .from(communityGmRequests)
      .where(
        and(
          eq(communityGmRequests.id, requestId),
          eq(communityGmRequests.communityId, communityId),
          eq(communityGmRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (!request) return { status: "not-found" };

    const [membership] = await transaction
      .select({ id: communityMemberships.id })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.personId, request.personId),
          eq(communityMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (!membership) return { status: "not-found" };

    const [grant] =
      parsed.decision === "approve"
        ? await transaction
            .select({ id: communityRoleGrants.id, status: communityRoleGrants.status })
            .from(communityRoleGrants)
            .where(
              and(
                eq(communityRoleGrants.communityId, communityId),
                eq(communityRoleGrants.personId, request.personId),
                eq(communityRoleGrants.role, "gm"),
              ),
            )
            .orderBy(desc(communityRoleGrants.grantedAt))
            .limit(1)
        : [];
    if (grant && grant.status !== "revoked") return { status: "not-found" };

    const terminalStatus = parsed.decision === "approve" ? "approved" : "rejected";
    const [updated] = await transaction
      .update(communityGmRequests)
      .set({
        status: terminalStatus,
        decidedByPersonId: actor.personId,
        decisionReason: parsed.reason,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(communityGmRequests.id, requestId),
          eq(communityGmRequests.communityId, communityId),
          eq(communityGmRequests.status, "pending"),
        ),
      )
      .returning({ id: communityGmRequests.id });
    if (!updated) return { status: "not-found" };

    if (terminalStatus === "approved") {
      if (!grant || grant.status === "revoked") {
        await transaction.insert(communityRoleGrants).values({
          id: randomUUID(),
          communityId,
          personId: request.personId,
          role: "gm",
          status: "active",
          grantedByPersonId: actor.personId,
          grantedAt: now,
          updatedAt: now,
        });
      }
    }

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId,
      actorPersonId: actor.personId,
      eventType:
        terminalStatus === "approved" ? "community.gm.approved" : "community.gm.rejected",
      details: { requestId },
      occurredAt: now,
    });
    return { status: terminalStatus, requestId };
  });
}
