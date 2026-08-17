import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import {
  changeCommunityLifecycle,
  CommunityLifecycleError,
} from "@/community/change-community-lifecycle";
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
const communityIds = [`lifecycle-${suffix}`, `other-lifecycle-${suffix}`];
const slug = `lifecycle-${suffix}`;
const peopleByRole: Record<string, string> = {};
const authUserIds: string[] = [];

describeWithDatabase("community lifecycle service", () => {
  beforeAll(async () => {
    for (const role of ["owner", "gm", "member", "outsider", "revokedOwner"] as const) {
      const identity = await createTestIdentity({
        subject: `${role}-${suffix}`,
        email: `${role}-${suffix}@fixture.invalid`,
        sessions: 0,
      });
      peopleByRole[role] = identity.person.id;
      authUserIds.push(identity.authUser.id);
    }

    await getDb().insert(communities).values([
      { id: communityIds[0]!, name: "Lifecycle Lodge", slug },
      { id: communityIds[1]!, name: "Other Lodge", slug: `other-${slug}` },
    ]);
    await getDb().insert(communityMemberships).values(
      ["owner", "gm", "member", "revokedOwner"].map((role) => ({
        id: `${role}-membership-${suffix}`,
        communityId: communityIds[0]!,
        personId: peopleByRole[role]!,
        status: "active",
      })),
    );
    await getDb().insert(communityRoleGrants).values([
      {
        id: `owner-grant-${suffix}`,
        communityId: communityIds[0]!,
        personId: peopleByRole.owner!,
        role: "owner",
        grantedByPersonId: peopleByRole.owner!,
      },
      {
        id: `gm-grant-${suffix}`,
        communityId: communityIds[0]!,
        personId: peopleByRole.gm!,
        role: "gm",
        grantedByPersonId: peopleByRole.owner!,
      },
      {
        id: `revoked-owner-grant-${suffix}`,
        communityId: communityIds[0]!,
        personId: peopleByRole.revokedOwner!,
        role: "owner",
        grantedByPersonId: peopleByRole.owner!,
        grantedAt: new Date(Date.now() - 1_000),
        revokedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await getDb().delete(communityAuditEvents).where(inArray(communityAuditEvents.communityId, communityIds));
    await getDb().delete(communityRoleGrants).where(inArray(communityRoleGrants.communityId, communityIds));
    await getDb().delete(communityMemberships).where(inArray(communityMemberships.communityId, communityIds));
    await getDb().delete(communities).where(inArray(communities.id, communityIds));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("requires explicit confirmation without changing state", async () => {
    await expect(
      changeCommunityLifecycle(
        { personId: peopleByRole.owner! },
        { slug, action: "archive", confirmed: false },
      ),
    ).rejects.toMatchObject({ code: "confirmation-required" });

    const [community] = await getDb().select().from(communities).where(eq(communities.id, communityIds[0]!));
    expect(community?.lifecycleStatus).toBe("active");
  });

  it("archives and restores while preserving relationships and writing safe audit events", async () => {
    await expect(
      changeCommunityLifecycle(
        { personId: peopleByRole.owner! },
        { slug, action: "archive", confirmed: true },
      ),
    ).resolves.toMatchObject({ lifecycleStatus: "archived" });

    expect(
      await getDb().select().from(communityMemberships).where(eq(communityMemberships.communityId, communityIds[0]!)),
    ).toHaveLength(4);
    expect(
      await getDb().select().from(communityRoleGrants).where(eq(communityRoleGrants.communityId, communityIds[0]!)),
    ).toHaveLength(3);

    await expect(
      changeCommunityLifecycle(
        { personId: peopleByRole.owner! },
        { slug, action: "restore", confirmed: true },
      ),
    ).resolves.toMatchObject({ lifecycleStatus: "active" });

    const events = await getDb()
      .select()
      .from(communityAuditEvents)
      .where(eq(communityAuditEvents.communityId, communityIds[0]!));
    expect(events.map(({ eventType }) => eventType)).toEqual([
      "community.archived",
      "community.restored",
    ]);
    expect(events.map(({ details }) => details)).toEqual([
      { from: "active", to: "archived" },
      { from: "archived", to: "active" },
    ]);
    expect(JSON.stringify(events.map(({ details }) => details))).not.toContain(slug);
  });

  it.each(["gm", "member", "outsider", "revokedOwner"])(
    "denies %s with the same nonrevealing error",
    async (role) => {
      await expect(
        changeCommunityLifecycle(
          { personId: peopleByRole[role]! },
          { slug, action: "archive", confirmed: true },
        ),
      ).rejects.toEqual(expect.objectContaining<Partial<CommunityLifecycleError>>({ code: "unavailable" }));
    },
  );

  it("does not allow ownership in another community to cross the boundary", async () => {
    await getDb().insert(communityMemberships).values({
      id: `other-owner-membership-${suffix}`,
      communityId: communityIds[1]!,
      personId: peopleByRole.outsider!,
      status: "active",
    });
    await getDb().insert(communityRoleGrants).values({
      id: `other-owner-grant-${suffix}`,
      communityId: communityIds[1]!,
      personId: peopleByRole.outsider!,
      role: "owner",
      grantedByPersonId: peopleByRole.outsider!,
    });

    await expect(
      changeCommunityLifecycle(
        { personId: peopleByRole.outsider! },
        { slug, action: "archive", confirmed: true },
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("does not expose a permanent-delete operation", async () => {
    const lifecycleModule = await import("@/community/change-community-lifecycle");
    expect(Object.keys(lifecycleModule)).not.toContain("deleteCommunity");
  });
});
