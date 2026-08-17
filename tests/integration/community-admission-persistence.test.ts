import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityInvitations,
  communityMembershipRequests,
  people,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const ownerAuthUserId = `admission-owner-auth-${suffix}`;
const requesterAuthUserId = `admission-requester-auth-${suffix}`;
const communityId = `admission-community-${suffix}`;
const otherCommunityId = `admission-other-community-${suffix}`;
let ownerPersonId: string;
let requesterPersonId: string;

describeWithDatabase("community admission persistence", () => {
  beforeAll(async () => {
    await getDb().insert(authUsers).values([
      {
        id: ownerAuthUserId,
        name: "Admission Owner",
        email: `admission-owner-${suffix}@example.test`,
      },
      {
        id: requesterAuthUserId,
        name: "Admission Requester",
        email: `admission-requester-${suffix}@example.test`,
      },
    ]);
    const createdPeople = await getDb()
      .select()
      .from(people)
      .where(eq(people.authUserId, ownerAuthUserId));
    const [owner] = createdPeople;
    const [requester] = await getDb()
      .select()
      .from(people)
      .where(eq(people.authUserId, requesterAuthUserId));
    if (!owner || !requester) throw new Error("Expected auth triggers to create people.");
    ownerPersonId = owner.id;
    requesterPersonId = requester.id;
    await getDb().insert(communities).values([
      {
        id: communityId,
        name: "Admission Test Community",
        slug: `admission-${suffix}`,
      },
      {
        id: otherCommunityId,
        name: "Other Admission Test Community",
        slug: `admission-other-${suffix}`,
      },
    ]);
  });

  afterAll(async () => {
    await getDb()
      .delete(communityMembershipRequests)
      .where(eq(communityMembershipRequests.communityId, communityId));
    await getDb()
      .delete(communityInvitations)
      .where(eq(communityInvitations.communityId, communityId));
    await getDb().delete(communities).where(eq(communities.id, communityId));
    await getDb().delete(communities).where(eq(communities.id, otherCommunityId));
    await getDb().delete(authUsers).where(eq(authUsers.id, ownerAuthUserId));
    await getDb().delete(authUsers).where(eq(authUsers.id, requesterAuthUserId));
  });

  it("stores only a token digest and prevents duplicate live invitations", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    await getDb().insert(communityInvitations).values({
      id: `invitation-a-${suffix}`,
      communityId,
      recipientEmail: `admission-requester-${suffix}@example.test`,
      tokenHash: `sha256-digest-a-${suffix}`,
      createdByPersonId: ownerPersonId,
      expiresAt,
    });

    const [stored] = await getDb()
      .select()
      .from(communityInvitations)
      .where(eq(communityInvitations.id, `invitation-a-${suffix}`));
    expect(stored).toMatchObject({ tokenHash: `sha256-digest-a-${suffix}`, status: "pending" });
    expect(stored).not.toHaveProperty("token");

    await expect(
      getDb().insert(communityInvitations).values({
        id: `invitation-duplicate-recipient-${suffix}`,
        communityId,
        recipientEmail: `admission-requester-${suffix}@example.test`,
        tokenHash: `sha256-digest-b-${suffix}`,
        createdByPersonId: ownerPersonId,
        expiresAt,
      }),
    ).rejects.toBeDefined();

    await expect(
      getDb().insert(communityInvitations).values({
        id: `invitation-duplicate-token-${suffix}`,
        communityId,
        recipientEmail: `different-${suffix}@example.test`,
        tokenHash: `sha256-digest-a-${suffix}`,
        createdByPersonId: ownerPersonId,
        expiresAt,
      }),
    ).rejects.toBeDefined();
  });

  it("preserves terminal invitation history with the responsible actor", async () => {
    await getDb()
      .update(communityInvitations)
      .set({
        status: "revoked",
        revokedByPersonId: ownerPersonId,
        revocationReason: "Sent to the wrong address",
        revokedAt: new Date(),
      })
      .where(eq(communityInvitations.id, `invitation-a-${suffix}`));

    const [revoked] = await getDb()
      .select()
      .from(communityInvitations)
      .where(eq(communityInvitations.id, `invitation-a-${suffix}`));
    expect(revoked).toMatchObject({
      status: "revoked",
      revokedByPersonId: ownerPersonId,
      revocationReason: "Sent to the wrong address",
    });

    await expect(
      getDb().insert(communityInvitations).values({
        id: `invalid-revocation-${suffix}`,
        communityId,
        recipientEmail: `invalid-${suffix}@example.test`,
        tokenHash: `invalid-digest-${suffix}`,
        status: "revoked",
        createdByPersonId: ownerPersonId,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toBeDefined();
  });

  it("allows only one pending admission attempt while retaining decided history", async () => {
    await getDb().insert(communityMembershipRequests).values({
      id: `request-a-${suffix}`,
      communityId,
      personId: requesterPersonId,
      approvalPolicy: "manual",
    });

    await expect(
      getDb().insert(communityMembershipRequests).values({
        id: `request-duplicate-${suffix}`,
        communityId,
        personId: requesterPersonId,
        approvalPolicy: "automatic",
      }),
    ).rejects.toBeDefined();

    await getDb()
      .update(communityMembershipRequests)
      .set({
        status: "rejected",
        decidedAt: new Date(),
        decidedByPersonId: ownerPersonId,
        decisionReason: "Not a fit right now",
      })
      .where(eq(communityMembershipRequests.id, `request-a-${suffix}`));

    await getDb().insert(communityMembershipRequests).values({
      id: `request-b-${suffix}`,
      communityId,
      personId: requesterPersonId,
      approvalPolicy: "automatic",
    });

    const history = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(
        and(
          eq(communityMembershipRequests.communityId, communityId),
          eq(communityMembershipRequests.personId, requesterPersonId),
        ),
      );
    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "rejected",
          approvalPolicy: "manual",
          decidedByPersonId: ownerPersonId,
          decisionReason: "Not a fit right now",
        }),
        expect.objectContaining({ status: "pending", approvalPolicy: "automatic" }),
      ]),
    );

    await getDb()
      .update(communityMembershipRequests)
      .set({ status: "approved", decidedAt: new Date() })
      .where(eq(communityMembershipRequests.id, `request-b-${suffix}`));
    const [automaticallyApproved] = await getDb()
      .select()
      .from(communityMembershipRequests)
      .where(eq(communityMembershipRequests.id, `request-b-${suffix}`));
    expect(automaticallyApproved).toMatchObject({
      status: "approved",
      approvalPolicy: "automatic",
      decidedByPersonId: null,
    });
  });

  it("cannot attach an invitation to a request for a different community", async () => {
    await expect(
      getDb().insert(communityMembershipRequests).values({
        id: `cross-community-request-${suffix}`,
        communityId: otherCommunityId,
        personId: requesterPersonId,
        invitationId: `invitation-a-${suffix}`,
        approvalPolicy: "manual",
      }),
    ).rejects.toBeDefined();
  });
});
