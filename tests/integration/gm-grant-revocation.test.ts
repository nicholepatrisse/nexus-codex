import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { createTestIdentity } from "@/auth/test-fixture";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { createCommunity } from "@/community/create-community";
import {
  noPersistedFutureGmSessions,
  revokeCommunityGmGrant,
} from "@/community/revoke-community-gm-grant";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const authUserIds: string[] = [];
const communityIds: string[] = [];
let owner: AuthenticatedActor;
let otherOwner: AuthenticatedActor;
let gm: AuthenticatedActor;
let outsider: AuthenticatedActor;
let community: { id: string; slug: string };
let otherCommunity: { id: string; slug: string };
let grantId: string;

async function identity(label: string): Promise<AuthenticatedActor> {
  const created = await createTestIdentity({
    subject: `gm-revoke-${label}-${suffix}`,
    email: `gm-revoke-${label}-${suffix}@fixture.invalid`,
    sessions: 0,
  });
  authUserIds.push(created.authUser.id);
  return {
    personId: created.person.id,
    authUserId: created.authUser.id,
    sessionId: `session-${label}-${suffix}`,
  };
}

describeWithDatabase("GM grant revocation", () => {
  beforeAll(async () => {
    [owner, otherOwner, gm, outsider] = await Promise.all([
      identity("owner"), identity("other-owner"), identity("gm"), identity("outsider"),
    ]);
    community = await createCommunity(owner, { name: `GM Revoke ${suffix}` });
    otherCommunity = await createCommunity(otherOwner, { name: `Other GM Revoke ${suffix}` });
    communityIds.push(community.id, otherCommunity.id);
    await getDb().insert(communityMemberships).values({
      id: crypto.randomUUID(), communityId: community.id, personId: gm.personId, status: "active",
    });
    grantId = crypto.randomUUID();
    await getDb().insert(communityRoleGrants).values({
      id: grantId,
      communityId: community.id,
      personId: gm.personId,
      role: "gm",
      status: "active",
      grantedByPersonId: owner.personId,
    });
  });

  afterAll(async () => {
    await getDb().delete(communityAuditEvents).where(inArray(communityAuditEvents.communityId, communityIds));
    await getDb().delete(communityRoleGrants).where(inArray(communityRoleGrants.communityId, communityIds));
    await getDb().delete(communityMemberships).where(inArray(communityMemberships.communityId, communityIds));
    await getDb().delete(communities).where(inArray(communities.id, communityIds));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("fails closed until future sessions are resolved", async () => {
    await expect(
      revokeCommunityGmGrant(owner, community.slug, grantId, {}, {
        inspectFutureSessions: async () => { throw new Error("unavailable"); },
      }),
    ).resolves.toEqual({ status: "blocked", impact: { status: "unavailable" } });
    await expect(
      revokeCommunityGmGrant(owner, community.slug, grantId, {}, {
        inspectFutureSessions: async () => ({ status: "affected", futureSessionIds: ["future"] }),
      }),
    ).resolves.toEqual({
      status: "blocked",
      impact: { status: "affected", futureSessionIds: ["future"] },
    });
  });

  it("does not mutate a grant for an inactive member", async () => {
    await getDb().insert(communityMemberships).values({
      id: crypto.randomUUID(),
      communityId: community.id,
      personId: outsider.personId,
      status: "left",
    });
    const inactiveGrantId = crypto.randomUUID();
    await getDb().insert(communityRoleGrants).values({
      id: inactiveGrantId,
      communityId: community.id,
      personId: outsider.personId,
      role: "gm",
      status: "active",
      grantedByPersonId: owner.personId,
    });

    await expect(
      revokeCommunityGmGrant(owner, community.slug, inactiveGrantId, {}, {
        inspectFutureSessions: noPersistedFutureGmSessions,
      }),
    ).resolves.toEqual({ status: "not-found" });
    const [grant] = await getDb()
      .select({ status: communityRoleGrants.status })
      .from(communityRoleGrants)
      .where(eq(communityRoleGrants.id, inactiveGrantId));
    expect(grant?.status).toBe("active");
  });

  it("allows one race-safe terminal transition, retains history, and removes authority immediately", async () => {
    const now = new Date(Date.now() + 1_000);
    const results = await Promise.all([
      revokeCommunityGmGrant(owner, community.slug, grantId, { reason: "  Access ended  " }, {
        inspectFutureSessions: noPersistedFutureGmSessions,
        now,
      }),
      revokeCommunityGmGrant(owner, community.slug, grantId, { reason: "Access ended" }, {
        inspectFutureSessions: noPersistedFutureGmSessions,
        now,
      }),
    ]);
    expect(results.filter(({ status }) => status === "revoked")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "unchanged")).toHaveLength(1);
    const [grant] = await getDb().select().from(communityRoleGrants).where(eq(communityRoleGrants.id, grantId));
    expect(grant).toMatchObject({
      status: "revoked",
      revokedAt: now,
      revokedByPersonId: owner.personId,
      revocationReason: "Access ended",
    });
    const access = await resolveCommunityAccessBySlug(community.slug, gm.personId);
    expect(access.status === "available" ? access.roles : []).not.toContain("gm");
    const audits = await getDb()
      .select()
      .from(communityAuditEvents)
      .where(
        and(
          eq(communityAuditEvents.communityId, community.id),
          eq(communityAuditEvents.eventType, "community.gm.revoked"),
        ),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.details).toEqual({ grantId });
    expect(JSON.stringify(audits[0]?.details)).not.toContain("Access ended");
    expect(JSON.stringify(audits[0]?.details)).not.toContain(gm.personId);
  });

  it("collapses unauthorized and cross-community operations", async () => {
    await expect(
      revokeCommunityGmGrant(outsider, community.slug, grantId, {}, {
        inspectFutureSessions: noPersistedFutureGmSessions,
      }),
    ).resolves.toEqual({ status: "not-found" });
    await expect(
      revokeCommunityGmGrant(otherOwner, otherCommunity.slug, grantId, {}, {
        inspectFutureSessions: noPersistedFutureGmSessions,
      }),
    ).resolves.toEqual({ status: "not-found" });
  });
});
