import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { createTestIdentity } from "@/auth/test-fixture";
import {
  cancelCommunityGmAdmission,
  decideCommunityGmAdmission,
  requestCommunityGmAdmission,
} from "@/community/community-gm-admission";
import { createCommunity } from "@/community/create-community";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const authUserIds: string[] = [];
const communityIds: string[] = [];
let owner: AuthenticatedActor;
let otherOwner: AuthenticatedActor;
let members: AuthenticatedActor[];
let community: { id: string; slug: string };
let otherCommunity: { id: string; slug: string };

async function identity(label: string): Promise<AuthenticatedActor> {
  const created = await createTestIdentity({
    subject: `gm-admission-${label}-${suffix}`,
    email: `gm-admission-${label}-${suffix}@fixture.invalid`,
    sessions: 0,
  });
  authUserIds.push(created.authUser.id);
  return {
    personId: created.person.id,
    authUserId: created.authUser.id,
    sessionId: `gm-session-${label}-${suffix}`,
  };
}

async function request(actor: AuthenticatedActor, slug = community.slug) {
  const result = await requestCommunityGmAdmission(actor, slug);
  if (result.status !== "pending") throw new Error("Expected pending GM request.");
  return result;
}

describeWithDatabase("approved-only GM admission", () => {
  beforeAll(async () => {
    [owner, otherOwner, ...members] = await Promise.all([
      identity("owner"),
      identity("other-owner"),
      identity("approve"),
      identity("reject"),
      identity("cancel"),
      identity("unauthorized"),
      identity("reactivate"),
      identity("revoked-owner"),
      identity("race"),
    ]);
    community = await createCommunity(owner, { name: `GM Admission ${suffix}` });
    otherCommunity = await createCommunity(otherOwner, { name: `Other GM Admission ${suffix}` });
    communityIds.push(community.id, otherCommunity.id);
    await getDb().insert(communityMemberships).values(
      members.flatMap((member) => [
        {
          id: crypto.randomUUID(),
          communityId: community.id,
          personId: member.personId,
          status: "active",
        },
        {
          id: crypto.randomUUID(),
          communityId: otherCommunity.id,
          personId: member.personId,
          status: "active",
        },
      ]),
    );
  });

  afterAll(async () => {
    await getDb()
      .delete(communityAuditEvents)
      .where(inArray(communityAuditEvents.communityId, communityIds));
    await getDb()
      .delete(communityGmRequests)
      .where(inArray(communityGmRequests.communityId, communityIds));
    await getDb()
      .delete(communityRoleGrants)
      .where(inArray(communityRoleGrants.communityId, communityIds));
    await getDb()
      .delete(communityMemberships)
      .where(inArray(communityMemberships.communityId, communityIds));
    await getDb().delete(communities).where(inArray(communities.id, communityIds));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("creates one pending request, snapshots policy, and activates a GM grant", async () => {
    const member = members[0]!;
    const first = await request(member);
    const retry = await requestCommunityGmAdmission(member, community.slug);
    expect(retry).toEqual(first);

    await getDb()
      .update(communities)
      .set({ gmAdmission: "self_service" })
      .where(eq(communities.id, community.id));
    await expect(
      decideCommunityGmAdmission(owner, community.slug, first.requestId, {
        decision: "approve",
        reason: "  Experienced GM  ",
      }),
    ).resolves.toEqual({ status: "approved", requestId: first.requestId });
    await getDb()
      .update(communities)
      .set({ gmAdmission: "approved_only" })
      .where(eq(communities.id, community.id));

    const [stored] = await getDb()
      .select()
      .from(communityGmRequests)
      .where(eq(communityGmRequests.id, first.requestId));
    expect(stored).toMatchObject({
      status: "approved",
      admissionPolicy: "approved_only",
      decidedByPersonId: owner.personId,
      decisionReason: "Experienced GM",
    });
    const [grant] = await getDb()
      .select()
      .from(communityRoleGrants)
      .where(
        and(
          eq(communityRoleGrants.communityId, community.id),
          eq(communityRoleGrants.personId, member.personId),
          eq(communityRoleGrants.role, "gm"),
          eq(communityRoleGrants.status, "active"),
        ),
      );
    expect(grant?.grantedByPersonId).toBe(owner.personId);
  });

  it("supports owner rejection and requester-only cancellation", async () => {
    const rejected = await request(members[1]!);
    await expect(
      decideCommunityGmAdmission(owner, community.slug, rejected.requestId, {
        decision: "reject",
        reason: "More table experience needed",
      }),
    ).resolves.toEqual({ status: "rejected", requestId: rejected.requestId });
    await expect(
      decideCommunityGmAdmission(owner, community.slug, rejected.requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "not-found" });

    const cancelled = await request(members[2]!);
    await expect(cancelCommunityGmAdmission(members[3]!, cancelled.requestId)).resolves.toEqual({
      status: "not-found",
    });
    await expect(cancelCommunityGmAdmission(members[2]!, cancelled.requestId)).resolves.toEqual({
      status: "cancelled",
      requestId: cancelled.requestId,
    });

    const stale = await request(members[2]!);
    await getDb()
      .update(communityMemberships)
      .set({ status: "left" })
      .where(
        and(
          eq(communityMemberships.communityId, community.id),
          eq(communityMemberships.personId, members[2]!.personId),
        ),
      );
    await expect(cancelCommunityGmAdmission(members[2]!, stale.requestId)).resolves.toEqual({
      status: "not-found",
    });
  });

  it("reactivates a previously revoked GM with a new attributable grant", async () => {
    const member = members[4]!;
    const revokedGrantId = crypto.randomUUID();
    const revokedAt = new Date(Date.now() - 1_000);
    await getDb().insert(communityRoleGrants).values({
      id: revokedGrantId,
      communityId: community.id,
      personId: member.personId,
      role: "gm",
      status: "revoked",
      grantedByPersonId: owner.personId,
      grantedAt: new Date(revokedAt.getTime() - 1_000),
      revokedAt,
      revokedByPersonId: owner.personId,
      revocationReason: "Prior lifecycle ended",
    });
    const pending = await request(member);
    await expect(
      decideCommunityGmAdmission(owner, community.slug, pending.requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "approved", requestId: pending.requestId });

    const grants = await getDb()
      .select()
      .from(communityRoleGrants)
      .where(
        and(
          eq(communityRoleGrants.communityId, community.id),
          eq(communityRoleGrants.personId, member.personId),
          eq(communityRoleGrants.role, "gm"),
        ),
      );
    expect(grants).toHaveLength(2);
    expect(grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: revokedGrantId, status: "revoked" }),
        expect.objectContaining({ status: "active", grantedByPersonId: owner.personId }),
      ]),
    );
  });

  it("keeps unauthorized and cross-community request ids nonrevealing", async () => {
    const pending = await request(members[3]!);
    await expect(
      decideCommunityGmAdmission(otherOwner, otherCommunity.slug, pending.requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "not-found" });
    await expect(
      decideCommunityGmAdmission(members[3]!, community.slug, pending.requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("observes owner revocation on the next decision", async () => {
    const pending = await request(members[5]!);
    await getDb()
      .update(communityRoleGrants)
      // Ownership still uses the legacy revokedAt boundary; GM lifecycle state
      // is intentionally separate.
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
      decideCommunityGmAdmission(owner, community.slug, pending.requestId, {
        decision: "approve",
      }),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("allows only one terminal result when owner decisions race", async () => {
    const pending = await request(members[6]!, otherCommunity.slug);
    const results = await Promise.all([
      decideCommunityGmAdmission(otherOwner, otherCommunity.slug, pending.requestId, {
        decision: "approve",
      }),
      decideCommunityGmAdmission(otherOwner, otherCommunity.slug, pending.requestId, {
        decision: "reject",
      }),
    ]);

    expect(results.filter(({ status }) => status === "not-found")).toHaveLength(1);
    expect(
      results.filter(({ status }) => status === "approved" || status === "rejected"),
    ).toHaveLength(1);
  });
});
