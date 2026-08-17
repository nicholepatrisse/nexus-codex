import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  authUsers,
  communities,
  communityMemberships,
  communityRoleGrants,
  people,
} from "@/db/schema";
import { getDb } from "@/db/client";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const authUserId = `community-auth-${suffix}`;
const communityId = `community-${suffix}`;

describeWithDatabase("community persistence", () => {
  beforeAll(async () => {
    await getDb().insert(authUsers).values({
      id: authUserId,
      name: "Community Creator",
      email: `community-${suffix}@example.test`,
    });
    const [person] = await getDb().select().from(people).where(eq(people.authUserId, authUserId));
    if (!person) throw new Error("The auth-person trigger did not create a person.");
    expect(person.id).toBeTruthy();
  });

  afterAll(async () => {
    const [person] = await getDb().select().from(people).where(eq(people.authUserId, authUserId));
    if (person) {
      await getDb().delete(communityRoleGrants).where(eq(communityRoleGrants.personId, person.id));
      await getDb().delete(communityMemberships).where(eq(communityMemberships.personId, person.id));
    }
    await getDb().delete(communities).where(eq(communities.id, communityId));
    await getDb().delete(authUsers).where(eq(authUsers.id, authUserId));
  });

  it("applies the privacy-preserving ADR 0002 defaults", async () => {
    const [community] = await getDb()
      .insert(communities)
      .values({ id: communityId, name: "  Test Community  ", slug: `test-${suffix}` })
      .returning();

    expect(community).toMatchObject({
      visibility: "private",
      scheduleVisibility: "members",
      membershipApproval: "manual",
      gmAdmission: "approved_only",
      lifecycleStatus: "active",
    });
  });

  it("rejects unsafe and duplicate slugs", async () => {
    await expect(
      getDb().insert(communities).values({
        id: `unsafe-community-${suffix}`,
        name: "Unsafe Community",
        slug: "Unsafe Slug!",
      }),
    ).rejects.toBeDefined();

    await expect(
      getDb().insert(communities).values({
        id: `duplicate-community-${suffix}`,
        name: "Duplicate Community",
        slug: `test-${suffix}`,
      }),
    ).rejects.toBeDefined();
  });

  it("scopes memberships and fixed role grants to one community", async () => {
    const [person] = await getDb().select().from(people).where(eq(people.authUserId, authUserId));
    if (!person) throw new Error("Expected a person for the test auth user.");

    await getDb().insert(communityMemberships).values({
      id: `membership-${suffix}`,
      communityId,
      personId: person.id,
      status: "active",
    });
    await getDb().insert(communityRoleGrants).values({
      id: `owner-grant-${suffix}`,
      communityId,
      personId: person.id,
      role: "owner",
      grantedByPersonId: person.id,
    });

    await expect(
      getDb().insert(communityRoleGrants).values({
        id: `duplicate-owner-grant-${suffix}`,
        communityId,
        personId: person.id,
        role: "owner",
        grantedByPersonId: person.id,
      }),
    ).rejects.toBeDefined();

    await expect(
      getDb().insert(communityRoleGrants).values({
        id: `invalid-role-grant-${suffix}`,
        communityId,
        personId: person.id,
        role: "organizer",
        grantedByPersonId: person.id,
      }),
    ).rejects.toBeDefined();
  });
});
