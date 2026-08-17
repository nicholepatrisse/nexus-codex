import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCommunity } from "@/community/create-community";
import {
  CommunitySettingsUpdateError,
  updateCommunitySettings,
} from "@/community/update-community-settings";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityMemberships,
  communityRoleGrants,
  communitySupportedPrograms,
  gameSystems,
  organizedPlayPrograms,
  rulesets,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const communityIds: string[] = [];
const authUserIds: string[] = [];
const systemId = `settings-system-${suffix}`;
const rulesetId = `settings-ruleset-${suffix}`;
const programId = `settings-program-${suffix}`;
let ownerPersonId: string;
let gmPersonId: string;
let outsiderPersonId: string;
let communityId: string;
let communitySlug: string;

function settings(overrides: Record<string, unknown> = {}) {
  return {
    name: `Updated Lodge ${suffix}`,
    requestedSlug: `updated-lodge-${suffix}`,
    description: "Games every other Starday.",
    defaultTimeZone: "America/Phoenix",
    supportedProgramIds: [programId, programId],
    visibility: "private" as const,
    membershipApproval: "manual" as const,
    gmAdmission: "approved_only" as const,
    scheduleVisibility: "public" as const,
    ...overrides,
  };
}

describeWithDatabase("community settings service", () => {
  beforeAll(async () => {
    const [owner, gm, outsider] = await Promise.all([
      createTestIdentity({ subject: `settings-owner-${suffix}`, email: `settings-owner-${suffix}@fixture.invalid`, sessions: 0 }),
      createTestIdentity({ subject: `settings-gm-${suffix}`, email: `settings-gm-${suffix}@fixture.invalid`, sessions: 0 }),
      createTestIdentity({ subject: `settings-outsider-${suffix}`, email: `settings-outsider-${suffix}@fixture.invalid`, sessions: 0 }),
    ]);
    authUserIds.push(owner.authUser.id, gm.authUser.id, outsider.authUser.id);
    ownerPersonId = owner.person.id;
    gmPersonId = gm.person.id;
    outsiderPersonId = outsider.person.id;

    await getDb().insert(gameSystems).values({ id: systemId, code: systemId, name: "Settings System" });
    await getDb().insert(rulesets).values({ id: rulesetId, gameSystemId: systemId, code: rulesetId, name: "Settings Rules", edition: "test" });
    await getDb().insert(organizedPlayPrograms).values({ id: programId, rulesetId, code: programId, name: "Settings Program" });

    const created = await createCommunity({ personId: ownerPersonId }, { name: `Settings Lodge ${suffix}` });
    communityId = created.id;
    communitySlug = created.slug;
    communityIds.push(created.id);
    await getDb().insert(communityMemberships).values({ id: crypto.randomUUID(), communityId, personId: gmPersonId, status: "active" });
    await getDb().insert(communityRoleGrants).values({ id: crypto.randomUUID(), communityId, personId: gmPersonId, role: "gm", grantedByPersonId: ownerPersonId });
  });

  afterAll(async () => {
    if (communityIds.length) {
      await getDb().delete(communityAuditEvents).where(inArray(communityAuditEvents.communityId, communityIds));
      await getDb().delete(communitySupportedPrograms).where(inArray(communitySupportedPrograms.communityId, communityIds));
      await getDb().delete(communityRoleGrants).where(inArray(communityRoleGrants.communityId, communityIds));
      await getDb().delete(communityMemberships).where(inArray(communityMemberships.communityId, communityIds));
      await getDb().delete(communities).where(inArray(communities.id, communityIds));
    }
    await getDb().delete(organizedPlayPrograms).where(eq(organizedPlayPrograms.id, programId));
    await getDb().delete(rulesets).where(eq(rulesets.id, rulesetId));
    await getDb().delete(gameSystems).where(eq(gameSystems.id, systemId));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("atomically updates settings, supported programs, and a privacy-safe audit event", async () => {
    const result = await updateCommunitySettings(
      { personId: ownerPersonId, authUserId: authUserIds[0]!, sessionId: "test" },
      communitySlug,
      settings(),
    );
    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("expected update");
    communitySlug = result.community.slug;

    const [community] = await getDb().select().from(communities).where(eq(communities.id, communityId));
    expect(community).toMatchObject({
      name: `Updated Lodge ${suffix}`,
      slug: `updated-lodge-${suffix}`,
      description: "Games every other Starday.",
      defaultTimeZone: "America/Phoenix",
      visibility: "private",
      scheduleVisibility: "public",
    });
    expect(await getDb().select().from(communitySupportedPrograms).where(eq(communitySupportedPrograms.communityId, communityId))).toHaveLength(1);
    const [audit] = await getDb().select().from(communityAuditEvents).where(eq(communityAuditEvents.communityId, communityId));
    expect(audit).toMatchObject({ actorPersonId: ownerPersonId, eventType: "community.settings.updated" });
    expect(JSON.stringify(audit?.details)).not.toContain(communitySlug);
    expect(JSON.stringify(audit?.details)).not.toContain(ownerPersonId);
  });

  it("keeps a public-schedule preference stored while private", async () => {
    const [community] = await getDb().select({ visibility: communities.visibility, scheduleVisibility: communities.scheduleVisibility }).from(communities).where(eq(communities.id, communityId));
    expect(community).toEqual({ visibility: "private", scheduleVisibility: "public" });
  });

  it("rejects GMs and private-community outsiders without changing settings", async () => {
    const before = await getDb().select().from(communities).where(eq(communities.id, communityId));
    const gmResult = await updateCommunitySettings(
      { personId: gmPersonId, authUserId: authUserIds[1]!, sessionId: "test" },
      communitySlug,
      settings({ name: "GM mutation" }),
      { denialSink: () => undefined },
    );
    const outsiderResult = await updateCommunitySettings(
      { personId: outsiderPersonId, authUserId: authUserIds[2]!, sessionId: "test" },
      communitySlug,
      settings({ name: "Outsider mutation" }),
      { denialSink: () => undefined },
    );
    expect(gmResult).toEqual({ status: "forbidden" });
    expect(outsiderResult).toEqual({ status: "not-found" });
    expect(await getDb().select().from(communities).where(eq(communities.id, communityId))).toEqual(before);
  });

  it("rolls back all changes when a supported program is unknown", async () => {
    const before = await getDb().select().from(communities).where(eq(communities.id, communityId));
    const auditCount = (await getDb().select().from(communityAuditEvents).where(eq(communityAuditEvents.communityId, communityId))).length;
    await expect(updateCommunitySettings(
      { personId: ownerPersonId, authUserId: authUserIds[0]!, sessionId: "test" },
      communitySlug,
      settings({ name: "Must roll back", supportedProgramIds: ["missing-program"] }),
    )).rejects.toBeInstanceOf(CommunitySettingsUpdateError);
    expect(await getDb().select().from(communities).where(eq(communities.id, communityId))).toEqual(before);
    expect((await getDb().select().from(communityAuditEvents).where(eq(communityAuditEvents.communityId, communityId))).length).toBe(auditCount);
  });

  it("validates IANA time zones before writing", async () => {
    await expect(updateCommunitySettings(
      { personId: ownerPersonId, authUserId: authUserIds[0]!, sessionId: "test" },
      communitySlug,
      settings({ defaultTimeZone: "Mars/Olympus_Mons" }),
    )).rejects.toMatchObject({ name: "ZodError" });
  });

  it("allocates a safe deterministic slug when the requested slug is occupied", async () => {
    const collision = await createCommunity({ personId: ownerPersonId }, { name: "Occupied", requestedSlug: `occupied-${suffix}` });
    communityIds.push(collision.id);
    const result = await updateCommunitySettings(
      { personId: ownerPersonId, authUserId: authUserIds[0]!, sessionId: "test" },
      communitySlug,
      settings({ requestedSlug: collision.slug }),
    );
    expect(result).toMatchObject({ status: "updated", community: { slug: `${collision.slug}-2` } });
    if (result.status === "updated") communitySlug = result.community.slug;
  });
});
