import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import {
  redeemCommunityInvitationAdmission,
  requestCommunityAdmission,
} from "@/community/request-community-admission";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityInvitations,
  communityMembershipRequests,
  communityMemberships,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const communityIds: string[] = [];
const authUserIds: string[] = [];
let applicantPersonId: string;
let applicantAuthUserId: string;
let deciderPersonId: string;

async function addCommunity(
  label: string,
  options: { visibility?: "public" | "private"; approval?: "manual" | "automatic" } = {},
) {
  const id = `${label}-${suffix}`;
  const slug = `${label}-${suffix}`;
  communityIds.push(id);
  await getDb().insert(communities).values({
    id,
    name: label,
    slug,
    visibility: options.visibility ?? "public",
    membershipApproval: options.approval ?? "manual",
  });
  return { id, slug };
}

describeWithDatabase("community admission orchestration", () => {
  beforeAll(async () => {
    const [applicant, decider] = await Promise.all([
      createTestIdentity({
        subject: `admission-applicant-${suffix}`,
        email: `admission-applicant-${suffix}@fixture.invalid`,
        sessions: 0,
      }),
      createTestIdentity({
        subject: `admission-decider-${suffix}`,
        email: `admission-decider-${suffix}@fixture.invalid`,
        sessions: 0,
      }),
    ]);
    applicantPersonId = applicant.person.id;
    applicantAuthUserId = applicant.authUser.id;
    deciderPersonId = decider.person.id;
    authUserIds.push(applicant.authUser.id, decider.authUser.id);
  });

  afterAll(async () => {
    await getDb()
      .delete(communityMembershipRequests)
      .where(inArray(communityMembershipRequests.communityId, communityIds));
    await getDb()
      .delete(communityAuditEvents)
      .where(inArray(communityAuditEvents.communityId, communityIds));
    await getDb()
      .delete(communityInvitations)
      .where(inArray(communityInvitations.communityId, communityIds));
    await getDb()
      .delete(communityMemberships)
      .where(inArray(communityMemberships.communityId, communityIds));
    await getDb().delete(communities).where(inArray(communities.id, communityIds));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("creates one idempotent manual request without granting access and snapshots policy", async () => {
    const community = await addCommunity("manual-admission");

    const first = await requestCommunityAdmission(
      { personId: applicantPersonId },
      community.slug,
    );
    await getDb()
      .update(communities)
      .set({ membershipApproval: "automatic" })
      .where(eq(communities.id, community.id));
    const retry = await requestCommunityAdmission(
      { personId: applicantPersonId },
      community.slug,
    );

    expect(first).toMatchObject({ status: "pending", communityId: community.id });
    expect(retry).toEqual(first);
    const requests = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.communityId, community.id));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ status: "pending", approvalPolicy: "manual" });
    expect(
      await getDb()
        .select()
        .from(communityMemberships)
        .where(eq(communityMemberships.communityId, community.id)),
    ).toHaveLength(0);
    const [requestedAudit] = await getDb()
      .select()
      .from(communityAuditEvents)
      .where(
        and(
          eq(communityAuditEvents.communityId, community.id),
          eq(communityAuditEvents.eventType, "community.membership.requested"),
        ),
      );
    expect(requestedAudit?.details).toEqual({ requestId: requests[0]?.id });
    expect(JSON.stringify(requestedAudit?.details)).not.toContain(applicantPersonId);
  });

  it("atomically approves automatic admission and treats retries as already-member", async () => {
    const community = await addCommunity("automatic-admission", { approval: "automatic" });

    const first = await requestCommunityAdmission(
      { personId: applicantPersonId },
      community.slug,
    );
    const retry = await requestCommunityAdmission(
      { personId: applicantPersonId },
      community.slug,
    );

    expect(first).toMatchObject({ status: "admitted", communityId: community.id });
    expect(retry).toEqual({ status: "already-member", communityId: community.id });
    const [request] = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.communityId, community.id));
    expect(request).toMatchObject({
      status: "approved",
      approvalPolicy: "automatic",
      decidedByPersonId: null,
    });
    expect(request?.decidedAt).toBeInstanceOf(Date);
    const [membership] = await getDb()
      .select()
      .from(communityMemberships)
      .where(eq(communityMemberships.communityId, community.id));
    expect(membership?.status).toBe("active");
    const audits = await getDb()
      .select({ eventType: communityAuditEvents.eventType, details: communityAuditEvents.details })
      .from(communityAuditEvents)
      .where(eq(communityAuditEvents.communityId, community.id));
    expect(audits).toEqual(
      expect.arrayContaining([
        { eventType: "community.membership.requested", details: { requestId: request?.id } },
        {
          eventType: "community.membership.approved",
          details: { requestId: request?.id, policy: "automatic" },
        },
      ]),
    );
  });

  it("does not disclose private or archived communities through public admission", async () => {
    const privateCommunity = await addCommunity("private-admission", { visibility: "private" });
    const archivedCommunity = await addCommunity("archived-admission");
    await getDb()
      .update(communities)
      .set({ lifecycleStatus: "archived" })
      .where(eq(communities.id, archivedCommunity.id));

    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, privateCommunity.slug),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, archivedCommunity.slug),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, `missing-${suffix}`),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("redeems a private invitation and applies admission in the same transaction", async () => {
    const community = await addCommunity("private-invited", {
      visibility: "private",
      approval: "automatic",
    });
    const rawToken = `admission_invitation_${crypto.randomUUID().replaceAll("-", "")}`;
    const invitationId = crypto.randomUUID();
    await getDb().insert(communityInvitations).values({
      id: invitationId,
      communityId: community.id,
      recipientEmail: `admission-applicant-${suffix}@fixture.invalid`,
      tokenHash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
      createdByPersonId: deciderPersonId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const actor = {
      personId: applicantPersonId,
      authUserId: applicantAuthUserId,
      sessionId: `admission-session-${suffix}`,
    };

    const first = await redeemCommunityInvitationAdmission(actor, rawToken);
    const retry = await redeemCommunityInvitationAdmission(actor, rawToken);

    expect(first).toMatchObject({ status: "admitted", communityId: community.id });
    expect(retry).toEqual({ status: "already-member", communityId: community.id });
    const [invitation] = await getDb()
      .select()
      .from(communityInvitations)
      .where(eq(communityInvitations.id, invitationId));
    expect(invitation).toMatchObject({
      status: "accepted",
      acceptedByPersonId: applicantPersonId,
    });
    const [request] = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.invitationId, invitationId));
    expect(request).toMatchObject({
      status: "approved",
      approvalPolicy: "automatic",
      invitationId,
    });
  });

  it("cannot admit after a concurrent revocation claims the invitation row", async () => {
    const community = await addCommunity("revocation-race", {
      visibility: "private",
      approval: "automatic",
    });
    const rawToken = `revocation_race_${crypto.randomUUID().replaceAll("-", "")}`;
    const invitationId = crypto.randomUUID();
    await getDb().insert(communityInvitations).values({
      id: invitationId,
      communityId: community.id,
      recipientEmail: `admission-applicant-${suffix}@fixture.invalid`,
      tokenHash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
      createdByPersonId: deciderPersonId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const actor = {
      personId: applicantPersonId,
      authUserId: applicantAuthUserId,
      sessionId: `race-session-${suffix}`,
    };
    let redemption!: ReturnType<typeof redeemCommunityInvitationAdmission>;

    await getDb().transaction(async (transaction) => {
      await transaction
        .update(communityInvitations)
        .set({
          status: "revoked",
          revokedAt: new Date(),
          revokedByPersonId: deciderPersonId,
        })
        .where(eq(communityInvitations.id, invitationId));
      redemption = redeemCommunityInvitationAdmission(actor, rawToken);
      // Keep the revocation row lock long enough for redemption to contend on
      // the conditional acceptance update, then commit the winning state.
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await expect(redemption).resolves.toEqual({ status: "invalid" });
    expect(
      await getDb()
        .select()
        .from(communityMembershipRequests)
        .where(eq(communityMembershipRequests.invitationId, invitationId)),
    ).toHaveLength(0);
    expect(
      await getDb()
        .select()
        .from(communityMemberships)
        .where(eq(communityMemberships.communityId, community.id)),
    ).toHaveLength(0);
  });

  it("honors active, suspended, left, and previously decided state", async () => {
    const active = await addCommunity("existing-active", { approval: "automatic" });
    const suspended = await addCommunity("existing-suspended", { approval: "automatic" });
    const left = await addCommunity("existing-left", { approval: "automatic" });
    const decided = await addCommunity("previously-decided");
    await getDb().insert(communityMemberships).values([
      { id: crypto.randomUUID(), communityId: active.id, personId: applicantPersonId, status: "active" },
      { id: crypto.randomUUID(), communityId: suspended.id, personId: applicantPersonId, status: "suspended" },
      { id: crypto.randomUUID(), communityId: left.id, personId: applicantPersonId, status: "left" },
    ]);
    await getDb().insert(communityMembershipRequests).values({
      id: crypto.randomUUID(),
      communityId: decided.id,
      personId: applicantPersonId,
      status: "rejected",
      approvalPolicy: "manual",
      decidedByPersonId: deciderPersonId,
      decidedAt: new Date(),
    });

    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, active.slug),
    ).resolves.toEqual({ status: "already-member", communityId: active.id });
    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, suspended.slug),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, left.slug),
    ).resolves.toMatchObject({ status: "admitted", communityId: left.id });
    await expect(
      requestCommunityAdmission({ personId: applicantPersonId }, decided.slug),
    ).resolves.toMatchObject({ status: "pending", communityId: decided.id });

    const decidedRequests = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(
        and(
          eq(communityMembershipRequests.communityId, decided.id),
          eq(communityMembershipRequests.personId, applicantPersonId),
        ),
      );
    expect(decidedRequests.map(({ status }) => status).sort()).toEqual(["pending", "rejected"]);
  });
});
