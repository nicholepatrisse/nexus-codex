import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { CommunityCreationError, createCommunity } from "@/community/create-community";
import { findCommunityForActiveMember } from "@/community/repository";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const createdCommunityIds: string[] = [];
let authUserId: string;
let personId: string;

describeWithDatabase("community creation service", () => {
  beforeAll(async () => {
    const identity = await createTestIdentity({
      subject: `community-creator-${suffix}`,
      email: `community-creator-${suffix}@fixture.invalid`,
      sessions: 0,
    });
    authUserId = identity.authUser.id;
    personId = identity.person.id;
  });

  afterAll(async () => {
    if (createdCommunityIds.length > 0) {
      await getDb()
        .delete(communityRoleGrants)
        .where(inArray(communityRoleGrants.communityId, createdCommunityIds));
      await getDb()
        .delete(communityMemberships)
        .where(inArray(communityMemberships.communityId, createdCommunityIds));
      await getDb().delete(communities).where(inArray(communities.id, createdCommunityIds));
    }
    await getDb().delete(authUsers).where(eq(authUsers.id, authUserId));
  });

  it("atomically creates a private community, active membership, and owner grant", async () => {
    const created = await createCommunity(
      { personId },
      { name: `Absalom Station ${suffix}`, requestedSlug: `Absalom Station ${suffix}` },
    );
    createdCommunityIds.push(created.id);

    const [community] = await getDb()
      .select()
      .from(communities)
      .where(eq(communities.id, created.id));
    const [membership] = await getDb()
      .select()
      .from(communityMemberships)
      .where(eq(communityMemberships.communityId, created.id));
    const [grant] = await getDb()
      .select()
      .from(communityRoleGrants)
      .where(eq(communityRoleGrants.communityId, created.id));

    expect(community).toMatchObject({
      visibility: "private",
      scheduleVisibility: "members",
      membershipApproval: "manual",
      gmAdmission: "approved_only",
      lifecycleStatus: "active",
    });
    expect(membership).toMatchObject({ personId, status: "active" });
    expect(grant).toMatchObject({ personId, role: "owner", grantedByPersonId: personId });
    expect(await findCommunityForActiveMember(created.slug, personId)).toMatchObject({
      id: created.id,
      name: created.name,
    });
    expect(await findCommunityForActiveMember(created.slug, crypto.randomUUID())).toBeNull();
  });

  it("lets one person own independent communities and allocates collisions deterministically", async () => {
    const name = `Drift Lodge ${suffix}`;
    const first = await createCommunity({ personId }, { name });
    const second = await createCommunity({ personId }, { name });
    createdCommunityIds.push(first.id, second.id);

    expect(second.slug).toBe(`${first.slug}-2`);
    const memberships = await getDb()
      .select()
      .from(communityMemberships)
      .where(inArray(communityMemberships.communityId, [first.id, second.id]));
    const grants = await getDb()
      .select()
      .from(communityRoleGrants)
      .where(inArray(communityRoleGrants.communityId, [first.id, second.id]));
    expect(memberships).toHaveLength(2);
    expect(grants).toHaveLength(2);
    expect(grants.every((grant) => grant.role === "owner")).toBe(true);
  });

  it("keeps collision suffixes within the slug length limit", async () => {
    const requestedSlug = "a".repeat(80);
    const first = await createCommunity({ personId }, { name: "Long Slug One", requestedSlug });
    const second = await createCommunity({ personId }, { name: "Long Slug Two", requestedSlug });
    createdCommunityIds.push(first.id, second.id);

    expect(first.slug).toBe(requestedSlug);
    expect(second.slug).toBe(`${"a".repeat(78)}-2`);
    expect(second.slug).toHaveLength(80);
  });

  it("serializes concurrent allocations for the same slug base", async () => {
    const requestedSlug = `concurrent-${suffix}`;
    const created = await Promise.all([
      createCommunity({ personId }, { name: "Concurrent One", requestedSlug }),
      createCommunity({ personId }, { name: "Concurrent Two", requestedSlug }),
    ]);
    createdCommunityIds.push(...created.map(({ id }) => id));

    expect(created.map(({ slug }) => slug).sort()).toEqual([
      requestedSlug,
      `${requestedSlug}-2`,
    ]);
  });

  it("rolls back the community when membership creation fails", async () => {
    const requestedSlug = `rollback-${suffix}`;

    await expect(
      createCommunity({ personId: crypto.randomUUID() }, { name: "Rollback Test", requestedSlug }),
    ).rejects.toBeInstanceOf(CommunityCreationError);

    expect(
      await getDb().select().from(communities).where(eq(communities.slug, requestedSlug)),
    ).toHaveLength(0);
  });
});
