import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { acceptInvitationForAdmission } from "@/community/community-invitations";
import { getDb } from "@/db/client";
import {
  communities,
  communityAuditEvents,
  communityMembershipRequests,
  communityMemberships,
} from "@/db/schema";

export type CommunityAdmissionResult =
  | { status: "admitted"; communityId: string; requestId: string }
  | { status: "pending"; communityId: string; requestId: string | null }
  | { status: "already-member"; communityId: string }
  | { status: "unavailable" };

type Database = ReturnType<typeof getDb>;
export type AdmissionTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type AdmissionTarget = Readonly<{
  communityId: string;
  invitationId?: string;
}>;

class AdmissionUnavailableRollback extends Error {}

/**
 * Applies the community's current admission policy inside the caller's
 * transaction. Invitation services use this after validating a bearer token;
 * callers must never pass an unvalidated invitation id.
 */
export async function processCommunityAdmission(
  actor: Pick<AuthenticatedActor, "personId">,
  target: AdmissionTarget,
  transaction: AdmissionTransaction,
): Promise<CommunityAdmissionResult> {
  // Serialize all admission attempts for this person/community. This makes
  // retries deterministic and closes the gap between request and membership
  // uniqueness checks.
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${target.communityId}:${actor.personId}`}, 0))`,
  );

  const [community] = await transaction
    .select({
      id: communities.id,
      membershipApproval: communities.membershipApproval,
    })
    .from(communities)
    .where(
      and(
        eq(communities.id, target.communityId),
        eq(communities.lifecycleStatus, "active"),
      ),
    )
    .limit(1);
  if (!community) return { status: "unavailable" };

  const [membership] = await transaction
    .select({ id: communityMemberships.id, status: communityMemberships.status })
    .from(communityMemberships)
    .where(
      and(
        eq(communityMemberships.communityId, community.id),
        eq(communityMemberships.personId, actor.personId),
      ),
    )
    .limit(1);

  if (membership?.status === "active") {
    return { status: "already-member", communityId: community.id };
  }
  // Suspensions are an administrative denial, while an old pending membership
  // remains pending and must not gain access merely because policy changed.
  if (membership?.status === "suspended") return { status: "unavailable" };

  if (target.invitationId) {
    const [invitationRequest] = await transaction
      .select({ id: communityMembershipRequests.id, status: communityMembershipRequests.status })
      .from(communityMembershipRequests)
      .where(
        and(
          eq(communityMembershipRequests.invitationId, target.invitationId),
          eq(communityMembershipRequests.personId, actor.personId),
        ),
      )
      .limit(1);
    if (invitationRequest) {
      return invitationRequest.status === "pending"
        ? { status: "pending", communityId: community.id, requestId: invitationRequest.id }
        : { status: "unavailable" };
    }
  }

  const [existingRequest] = await transaction
    .select({ id: communityMembershipRequests.id, status: communityMembershipRequests.status })
    .from(communityMembershipRequests)
    .where(
      and(
        eq(communityMembershipRequests.communityId, community.id),
        eq(communityMembershipRequests.personId, actor.personId),
      ),
    )
    .orderBy(desc(communityMembershipRequests.requestedAt))
    .limit(1);

  if (existingRequest?.status === "pending" || membership?.status === "pending") {
    return {
      status: "pending",
      communityId: community.id,
      requestId: existingRequest?.id ?? null,
    };
  }

  const requestId = randomUUID();
  const automatic = community.membershipApproval === "automatic";
  const now = new Date();

  await transaction.insert(communityMembershipRequests).values({
    id: requestId,
    communityId: community.id,
    personId: actor.personId,
    invitationId: target.invitationId,
    status: automatic ? "approved" : "pending",
    // This is an immutable snapshot: later settings changes do not rewrite the
    // decision or the historical policy under which it was made.
    approvalPolicy: automatic ? "automatic" : "manual",
    // Automatic decisions are attributed to policy, not to the applicant.
    decidedByPersonId: null,
    decisionReason: automatic ? "Automatic admission policy" : null,
    decidedAt: automatic ? now : null,
    updatedAt: now,
  });

  await transaction.insert(communityAuditEvents).values({
    id: randomUUID(),
    communityId: community.id,
    actorPersonId: actor.personId,
    eventType: "community.membership.requested",
    details: { requestId },
    occurredAt: now,
  });

  if (!automatic) {
    return { status: "pending", communityId: community.id, requestId };
  }

  if (membership) {
    await transaction
      .update(communityMemberships)
      .set({ status: "active", updatedAt: now })
      .where(eq(communityMemberships.id, membership.id));
  } else {
    await transaction.insert(communityMemberships).values({
      id: randomUUID(),
      communityId: community.id,
      personId: actor.personId,
      status: "active",
    });
  }

  await transaction.insert(communityAuditEvents).values({
    id: randomUUID(),
    communityId: community.id,
    actorPersonId: actor.personId,
    eventType: "community.membership.approved",
    details: { requestId, policy: "automatic" },
    occurredAt: now,
  });

  return { status: "admitted", communityId: community.id, requestId };
}

/** Requests admission through a public, active community profile. */
export async function requestCommunityAdmission(
  actor: Pick<AuthenticatedActor, "personId">,
  slug: string,
  database: Database = getDb(),
): Promise<CommunityAdmissionResult> {
  return database.transaction(async (transaction) => {
    const [community] = await transaction
      .select({ id: communities.id })
      .from(communities)
      .where(
        and(
          eq(communities.slug, slug),
          eq(communities.visibility, "public"),
          eq(communities.lifecycleStatus, "active"),
        ),
      )
      .limit(1);

    if (!community) return { status: "unavailable" };
    return processCommunityAdmission(actor, { communityId: community.id }, transaction);
  });
}

/** Redeems a recipient-bound invitation without exposing why a token failed. */
export async function redeemCommunityInvitationAdmission(
  actor: AuthenticatedActor,
  rawToken: string,
  options: { database?: Database; now?: Date } = {},
): Promise<CommunityAdmissionResult | { status: "invalid" }> {
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();

  try {
    return await database.transaction(async (transaction) => {
      const acceptance = await acceptInvitationForAdmission(rawToken, actor, transaction, now);
      if (acceptance.status === "invalid") return { status: "invalid" } as const;

      const result = await processCommunityAdmission(
        actor,
        {
          communityId: acceptance.invitation.communityId,
          invitationId: acceptance.invitation.id,
        },
        transaction,
      );
      // Returning normally commits. Throw a private sentinel so an admission
      // denial cannot consume a token claimed earlier in this transaction.
      if (result.status === "unavailable") throw new AdmissionUnavailableRollback();
      return result;
    });
  } catch (error) {
    if (error instanceof AdmissionUnavailableRollback) return { status: "unavailable" };
    throw error;
  }
}
