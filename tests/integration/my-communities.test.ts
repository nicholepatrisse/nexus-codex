import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { listCommunitiesForActiveMember } from "@/community/repository";
import { getDb } from "@/db/client";
import { authUsers, communities, communityMemberships } from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const communityIds = ["active", "pending", "suspended", "left", "other"].map(
  (status) => `${status}-community-${suffix}`,
);
let authUserIds: string[] = [];
let personId: string;

describeWithDatabase("my communities", () => {
  beforeAll(async () => {
    const [person, other] = await Promise.all([
      createTestIdentity({ subject: `member-${suffix}`, sessions: 0 }),
      createTestIdentity({ subject: `other-member-${suffix}`, sessions: 0 }),
    ]);
    authUserIds = [person.authUser.id, other.authUser.id];
    personId = person.person.id;

    await getDb().insert(communities).values(
      communityIds.map((id, index) => ({
        id,
        name: ["Active Lodge", "Pending Lodge", "Suspended Lodge", "Left Lodge", "Other Lodge"][
          index
        ]!,
        slug: `${id}`,
      })),
    );
    await getDb().insert(communityMemberships).values([
      { id: `active-membership-${suffix}`, communityId: communityIds[0]!, personId, status: "active" },
      { id: `pending-membership-${suffix}`, communityId: communityIds[1]!, personId, status: "pending" },
      {
        id: `suspended-membership-${suffix}`,
        communityId: communityIds[2]!,
        personId,
        status: "suspended",
      },
      { id: `left-membership-${suffix}`, communityId: communityIds[3]!, personId, status: "left" },
      {
        id: `other-membership-${suffix}`,
        communityId: communityIds[4]!,
        personId: other.person.id,
        status: "active",
      },
    ]);
  });

  afterAll(async () => {
    await getDb()
      .delete(communityMemberships)
      .where(inArray(communityMemberships.communityId, communityIds));
    await getDb().delete(communities).where(inArray(communities.id, communityIds));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("returns only active communities for the requested person", async () => {
    expect(await listCommunitiesForActiveMember(personId)).toEqual([
      expect.objectContaining({ id: communityIds[0], name: "Active Lodge" }),
    ]);
  });

  it("returns no private names, slugs, or counts for an unrelated person", async () => {
    expect(await listCommunitiesForActiveMember(crypto.randomUUID())).toEqual([]);
  });
});
