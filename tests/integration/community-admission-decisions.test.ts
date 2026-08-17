import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCommunity } from "@/community/create-community";
import {
  cancelCommunityAdmission,
  decideCommunityAdmission,
} from "@/community/decide-community-admission";
import { requestCommunityAdmission } from "@/community/request-community-admission";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityMembershipRequests,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const authUserIds: string[] = [];
const communityIds: string[] = [];
let owner: AuthenticatedActor;
let otherOwner: AuthenticatedActor;
let applicantActors: AuthenticatedActor[];
let community: { id: string; slug: string };
let otherCommunity: { id: string; slug: string };

async function identity(label: string): Promise<AuthenticatedActor> {
  const created = await createTestIdentity({
    subject: `decision-${label}-${suffix}`,
    email: `decision-${label}-${suffix}@fixture.invalid`,
    sessions: 0,
  });
  authUserIds.push(created.authUser.id);
  return {
    personId: created.person.id,
    authUserId: created.authUser.id,
    sessionId: `session-${label}-${suffix}`,
  };
}

async function pendingRequest(actor: AuthenticatedActor) {
  const result = await requestCommunityAdmission(actor, community.slug);
  if (result.status !== "pending" || !result.requestId) {
    throw new Error("Expected a pending request.");
  }
  return result.requestId;
}

describeWithDatabase("community admission decisions", () => {
  beforeAll(async () => {
    [owner, otherOwner, ...applicantActors] = await Promise.all([
      identity("owner"),
      identity("other-owner"),
      identity("approve"),
      identity("reject"),
      identity("cancel"),
      identity("unauthorized"),
      identity("revoked-owner"),
      identity("race"),
    ]);
    community = await createCommunity(owner, { name: `Decision Lodge ${suffix}` });
    otherCommunity = await createCommunity(otherOwner, { name: `Other Decision Lodge ${suffix}` });
    communityIds.push(community.id, otherCommunity.id);
    await getDb()
      .update(communities)
      .set({ visibility: "public", membershipApproval: "manual" })
      .where(inArray(communities.id, communityIds));
  });

  afterAll(async () => {
    await getDb()
      .delete(communityAuditEvents)
      .where(inArray(communityAuditEvents.communityId, communityIds));
    await getDb()
      .delete(communityMembershipRequests)
      .where(inArray(communityMembershipRequests.communityId, communityIds));
    await getDb()
      .delete(communityRoleGrants)
      .where(inArray(communityRoleGrants.communityId, communityIds));
    await getDb()
      .delete(communityMemberships)
      .where(inArray(communityMemberships.communityId, communityIds));
    await getDb().delete(communities).where(inArray(communities.id, communityIds));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("approves a pending request, creates membership atomically, and is repeat-safe", async () => {
    const applicant = applicantActors[0]!;
    const requestId = await pendingRequest(applicant);
    const now = new Date("2026-08-17T20:00:00.000Z");

    const result = await decideCommunityAdmission(
      owner,
      community.slug,
      requestId,
      { decision: "approve", reason: "  Verified organizer  " },
      { now },
    );
    const repeated = await decideCommunityAdmission(owner, community.slug, requestId, {
      decision: "reject",
    });

    expect(result).toEqual({ status: "approved", requestId });
    expect(repeated).toEqual({ status: "not-found" });
    const [request] = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.id, requestId));
    expect(request).toMatchObject({
      status: "approved",
      decidedByPersonId: owner.personId,
      decisionReason: "Verified organizer",
      decidedAt: now,
    });
    const [membership] = await getDb()
      .select()
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, community.id),
          eq(communityMemberships.personId, applicant.personId),
        ),
      );
    expect(membership?.status).toBe("active");
    const [audit] = await getDb()
      .select()
      .from(communityAuditEvents)
      .where(
        and(
          eq(communityAuditEvents.communityId, community.id),
          eq(communityAuditEvents.eventType, "community.membership.approved"),
        ),
      );
    expect(audit?.details).toEqual({ requestId });
    expect(JSON.stringify(audit)).not.toContain("Verified organizer");
    expect(JSON.stringify(audit)).not.toContain(applicant.personId);
  });

  it("rejects a pending request with a bounded internal reason and no membership", async () => {
    const applicant = applicantActors[1]!;
    const requestId = await pendingRequest(applicant);

    await expect(
      decideCommunityAdmission(owner, community.slug, requestId, {
        decision: "reject",
        reason: "x".repeat(501),
      }),
    ).rejects.toBeDefined();
    await expect(
      decideCommunityAdmission(owner, community.slug, requestId, {
        decision: "reject",
        reason: "Incomplete application",
      }),
    ).resolves.toEqual({ status: "rejected", requestId });

    const [request] = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.id, requestId));
    expect(request).toMatchObject({
      status: "rejected",
      decisionReason: "Incomplete application",
      decidedByPersonId: owner.personId,
    });
    expect(
      await getDb()
        .select()
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.communityId, community.id),
            eq(communityMemberships.personId, applicant.personId),
          ),
        ),
    ).toHaveLength(0);
  });

  it("lets only the requester cancel a pending request", async () => {
    const applicant = applicantActors[2]!;
    const stranger = applicantActors[3]!;
    const requestId = await pendingRequest(applicant);

    await expect(cancelCommunityAdmission(stranger, requestId)).resolves.toEqual({
      status: "not-found",
    });
    await expect(cancelCommunityAdmission(applicant, requestId)).resolves.toEqual({
      status: "cancelled",
      requestId,
    });
    await expect(cancelCommunityAdmission(applicant, requestId)).resolves.toEqual({
      status: "not-found",
    });
    const [request] = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.id, requestId));
    expect(request?.status).toBe("cancelled");
    expect(request?.cancelledAt).toBeInstanceOf(Date);
  });

  it("does not reveal requests across communities or to unauthorized actors", async () => {
    const requestId = await pendingRequest(applicantActors[3]!);

    await expect(
      decideCommunityAdmission(otherOwner, otherCommunity.slug, requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "not-found" });
    await expect(
      decideCommunityAdmission(applicantActors[3]!, community.slug, requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("observes owner revocation on the next decision request", async () => {
    const requestId = await pendingRequest(applicantActors[4]!);
    await getDb()
      .update(communityRoleGrants)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(communityRoleGrants.communityId, community.id),
          eq(communityRoleGrants.personId, owner.personId),
          eq(communityRoleGrants.role, "owner"),
          isNull(communityRoleGrants.revokedAt),
        ),
      );

    await expect(
      decideCommunityAdmission(owner, community.slug, requestId, { decision: "approve" }),
    ).resolves.toEqual({ status: "not-found" });
    const [request] = await getDb()
      .select({ status: communityMembershipRequests.status })
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.id, requestId));
    expect(request?.status).toBe("pending");
  });

  it("allows only one terminal transition when decisions race", async () => {
    // Use the other community because the first owner's grant is revoked by the
    // preceding revocation test.
    const applicant = applicantActors[5]!;
    const pending = await requestCommunityAdmission(applicant, otherCommunity.slug);
    if (pending.status !== "pending" || !pending.requestId) {
      throw new Error("Expected a pending request.");
    }

    const results = await Promise.all([
      decideCommunityAdmission(otherOwner, otherCommunity.slug, pending.requestId, {
        decision: "approve",
      }),
      decideCommunityAdmission(otherOwner, otherCommunity.slug, pending.requestId, {
        decision: "reject",
      }),
    ]);

    expect(results.filter(({ status }) => status === "not-found")).toHaveLength(1);
    expect(
      results.filter(({ status }) => status === "approved" || status === "rejected"),
    ).toHaveLength(1);
    const [request] = await getDb()
      .select({ status: communityMembershipRequests.status })
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.id, pending.requestId));
    expect(["approved", "rejected"]).toContain(request?.status);
  });
});
