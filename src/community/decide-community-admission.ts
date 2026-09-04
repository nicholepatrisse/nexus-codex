import { randomUUID } from "node:crypto";
import { deliverMembershipStatus } from "@/notifications/deliveries";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { AuthorizationDenialSink } from "@/authorization/denial-audit";
import { getDb } from "@/db/client";
import {
  communityAuditEvents,
  communityMembershipRequests,
  communityMemberships,
} from "@/db/schema";

const decisionInputSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional().transform((value) => value || null),
});

type Database = ReturnType<typeof getDb>;

export type CommunityAdmissionDecisionResult =
  | { status: "approved" | "rejected"; requestId: string }
  | { status: "not-found" };

/** Owner-only decision over a currently pending request. */
export async function decideCommunityAdmission(
  actor: AuthenticatedActor,
  slug: string,
  requestId: string,
  input: z.input<typeof decisionInputSchema>,
  options: { database?: Database; denialSink?: AuthorizationDenialSink; now?: Date } = {},
): Promise<CommunityAdmissionDecisionResult> {
  const parsed = decisionInputSchema.parse(input);
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();

  return database.transaction(async (transaction) => {
    const authorization = await authorizeCommunityBySlug({
      actor,
      slug,
      operation: "membership.manage",
      resolveAccess: (candidate, personId) =>
        resolveCommunityAccessBySlug(candidate, personId, transaction),
      denialSink: options.denialSink,
    });
    // Private resource absence, a cross-community request id, and insufficient
    // authority deliberately share the same external result.
    if (authorization.status !== "authorized") return { status: "not-found" };

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`,
    );
    const communityId = authorization.access.community.id;
    const [request] = await transaction
      .select({ personId: communityMembershipRequests.personId })
      .from(communityMembershipRequests)
      .where(
        and(
          eq(communityMembershipRequests.id, requestId),
          eq(communityMembershipRequests.communityId, communityId),
          eq(communityMembershipRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (!request) return { status: "not-found" };

    if (parsed.decision === "approve") {
      const [membership] = await transaction
        .select({ id: communityMemberships.id, status: communityMemberships.status })
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.communityId, communityId),
            eq(communityMemberships.personId, request.personId),
          ),
        )
        .limit(1);
      // Never let request approval silently undo an administrative suspension.
      if (membership?.status === "suspended") return { status: "not-found" };

      if (membership) {
        if (membership.status !== "active") {
          await transaction
            .update(communityMemberships)
            .set({ status: "active", updatedAt: now })
            .where(eq(communityMemberships.id, membership.id));
        }
      } else {
        await transaction.insert(communityMemberships).values({
          id: randomUUID(),
          communityId,
          personId: request.personId,
          status: "active",
        });
      }
    }

    const terminalStatus = parsed.decision === "approve" ? "approved" : "rejected";
    const updated = await transaction
      .update(communityMembershipRequests)
      .set({
        status: terminalStatus,
        decidedByPersonId: actor.personId,
        decisionReason: parsed.reason,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(communityMembershipRequests.id, requestId),
          eq(communityMembershipRequests.communityId, communityId),
          eq(communityMembershipRequests.status, "pending"),
        ),
      )
      .returning({ id: communityMembershipRequests.id });
    if (updated.length !== 1) return { status: "not-found" };

    const auditEventId = randomUUID();
    await transaction.insert(communityAuditEvents).values({
      id: auditEventId,
      communityId,
      actorPersonId: actor.personId,
      eventType:
        terminalStatus === "approved"
          ? "community.membership.approved"
          : "community.membership.rejected",
      // The internal reason and requester identity are intentionally excluded.
      details: { requestId },
      occurredAt: now,
    });
    await deliverMembershipStatus(transaction as Database, request.personId, auditEventId, now);
    return { status: terminalStatus, requestId };
  });
}

export type CommunityAdmissionCancellationResult =
  | { status: "cancelled"; requestId: string }
  | { status: "not-found" };

/** Cancels only the actor's own currently pending request. */
export async function cancelCommunityAdmission(
  actor: Pick<AuthenticatedActor, "personId">,
  requestId: string,
  options: { database?: Database; now?: Date } = {},
): Promise<CommunityAdmissionCancellationResult> {
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();

  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`,
    );
    const [cancelled] = await transaction
      .update(communityMembershipRequests)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(
        and(
          eq(communityMembershipRequests.id, requestId),
          eq(communityMembershipRequests.personId, actor.personId),
          eq(communityMembershipRequests.status, "pending"),
        ),
      )
      .returning({
        id: communityMembershipRequests.id,
        communityId: communityMembershipRequests.communityId,
      });
    if (!cancelled) return { status: "not-found" };

    const auditEventId = randomUUID();
    await transaction.insert(communityAuditEvents).values({
      id: auditEventId,
      communityId: cancelled.communityId,
      actorPersonId: actor.personId,
      eventType: "community.membership.cancelled",
      details: { requestId },
      occurredAt: now,
    });
    await deliverMembershipStatus(transaction as Database, actor.personId, auditEventId, now);
    return { status: "cancelled", requestId };
  });
}
