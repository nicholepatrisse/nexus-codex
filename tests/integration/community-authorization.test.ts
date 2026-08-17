import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityMemberships,
  communityRoleGrants,
  people,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const ids = {
  owner: `authorization-owner-${suffix}`,
  gm: `authorization-gm-${suffix}`,
  member: `authorization-member-${suffix}`,
  inactive: `authorization-inactive-${suffix}`,
  outsider: `authorization-outsider-${suffix}`,
};
const privateCommunityId = `authorization-private-${suffix}`;
const otherCommunityId = `authorization-other-${suffix}`;
const publicCommunityId = `authorization-public-${suffix}`;
const privateSlug = `authorization-private-${suffix}`;
const otherSlug = `authorization-other-${suffix}`;
const publicSlug = `authorization-public-${suffix}`;
let personIds: Record<keyof typeof ids, string>;

describeWithDatabase("community authorization queries", () => {
  beforeAll(async () => {
    await getDb().insert(authUsers).values(
      Object.entries(ids).map(([kind, id]) => ({
        id,
        name: `Authorization ${kind}`,
        email: `${id}@example.test`,
      })),
    );

    const createdPeople = await getDb()
      .select({ id: people.id, authUserId: people.authUserId })
      .from(people)
      .where(inArray(people.authUserId, Object.values(ids)));
    personIds = Object.fromEntries(
      Object.entries(ids).map(([kind, authUserId]) => {
        const person = createdPeople.find((candidate) => candidate.authUserId === authUserId);
        if (!person) throw new Error(`Missing person for ${kind}.`);
        return [kind, person.id];
      }),
    ) as Record<keyof typeof ids, string>;

    await getDb().insert(communities).values([
      { id: privateCommunityId, name: "Private Society", slug: privateSlug },
      { id: otherCommunityId, name: "Other Society", slug: otherSlug },
      {
        id: publicCommunityId,
        name: "Public Society",
        slug: publicSlug,
        visibility: "public",
      },
    ]);

    await getDb().insert(communityMemberships).values([
      {
        id: `authorization-membership-owner-${suffix}`,
        communityId: privateCommunityId,
        personId: personIds.owner,
        status: "active",
      },
      {
        id: `authorization-membership-gm-${suffix}`,
        communityId: privateCommunityId,
        personId: personIds.gm,
        status: "active",
      },
      {
        id: `authorization-membership-member-${suffix}`,
        communityId: privateCommunityId,
        personId: personIds.member,
        status: "active",
      },
      {
        id: `authorization-membership-inactive-${suffix}`,
        communityId: privateCommunityId,
        personId: personIds.inactive,
        status: "suspended",
      },
      {
        id: `authorization-membership-other-${suffix}`,
        communityId: otherCommunityId,
        personId: personIds.outsider,
        status: "active",
      },
    ]);

    await getDb().insert(communityRoleGrants).values([
      {
        id: `authorization-owner-grant-${suffix}`,
        communityId: privateCommunityId,
        personId: personIds.owner,
        role: "owner",
        grantedByPersonId: personIds.owner,
      },
      {
        id: `authorization-gm-grant-${suffix}`,
        communityId: privateCommunityId,
        personId: personIds.gm,
        role: "gm",
        grantedByPersonId: personIds.owner,
      },
      {
        id: `authorization-other-owner-grant-${suffix}`,
        communityId: otherCommunityId,
        personId: personIds.outsider,
        role: "owner",
        grantedByPersonId: personIds.outsider,
      },
    ]);
  });

  afterAll(async () => {
    await getDb()
      .delete(communityRoleGrants)
      .where(inArray(communityRoleGrants.communityId, [privateCommunityId, otherCommunityId]));
    await getDb()
      .delete(communityMemberships)
      .where(
        inArray(communityMemberships.communityId, [privateCommunityId, otherCommunityId]),
      );
    await getDb()
      .delete(communities)
      .where(inArray(communities.id, [privateCommunityId, otherCommunityId, publicCommunityId]));
    await getDb().delete(authUsers).where(inArray(authUsers.id, Object.values(ids)));
  });

  it("resolves owner, GM, and active-member access independently", async () => {
    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.owner)).resolves.toMatchObject({
      status: "available",
      isActiveMember: true,
      roles: ["owner"],
    });
    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.gm)).resolves.toMatchObject({
      status: "available",
      isActiveMember: true,
      roles: ["gm"],
    });
    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.member)).resolves.toMatchObject({
      status: "available",
      isActiveMember: true,
      roles: [],
    });
  });

  it("returns the same nonrevealing result for private visitors, inactive members, and unknown slugs", async () => {
    const unavailable = { status: "unavailable" };
    await expect(resolveCommunityAccessBySlug(privateSlug, null)).resolves.toEqual(unavailable);
    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.outsider)).resolves.toEqual(
      unavailable,
    );
    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.inactive)).resolves.toEqual(
      unavailable,
    );
    await expect(
      resolveCommunityAccessBySlug(`missing-${suffix}`, personIds.outsider),
    ).resolves.toEqual(unavailable);
  });

  it("allows public visitors without treating them as members", async () => {
    await expect(resolveCommunityAccessBySlug(publicSlug, null)).resolves.toMatchObject({
      status: "available",
      community: { id: publicCommunityId, slug: publicSlug },
      isActiveMember: false,
      roles: [],
    });
  });

  it("never carries membership or authority across communities", async () => {
    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.outsider)).resolves.toEqual({
      status: "unavailable",
    });
    await expect(resolveCommunityAccessBySlug(otherSlug, personIds.owner)).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("applies membership and role revocation on the next query", async () => {
    await getDb()
      .update(communityRoleGrants)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(communityRoleGrants.communityId, privateCommunityId),
          eq(communityRoleGrants.personId, personIds.gm),
          eq(communityRoleGrants.role, "gm"),
        ),
      );

    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.gm)).resolves.toMatchObject({
      status: "available",
      isActiveMember: true,
      roles: [],
    });

    await getDb()
      .update(communityMemberships)
      .set({ status: "left", updatedAt: new Date() })
      .where(
        and(
          eq(communityMemberships.communityId, privateCommunityId),
          eq(communityMemberships.personId, personIds.member),
        ),
      );

    await expect(resolveCommunityAccessBySlug(privateSlug, personIds.member)).resolves.toEqual({
      status: "unavailable",
    });
  });
});
