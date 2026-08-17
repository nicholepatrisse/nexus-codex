import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communitySupportedPrograms,
  gameSystems,
  organizedPlayPrograms,
  people,
  rulesets,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const authUserId = `settings-auth-${suffix}`;
const communityId = `settings-community-${suffix}`;
const gameSystemId = `settings-system-${suffix}`;
const rulesetId = `settings-ruleset-${suffix}`;
const programId = `settings-program-${suffix}`;

describeWithDatabase("community settings persistence", () => {
  let actorPersonId: string;

  beforeAll(async () => {
    await getDb().insert(authUsers).values({
      id: authUserId,
      name: "Settings Owner",
      email: `settings-${suffix}@example.test`,
    });
    const [person] = await getDb().select().from(people).where(eq(people.authUserId, authUserId));
    if (!person) throw new Error("The auth-person trigger did not create a person.");
    actorPersonId = person.id;

    await getDb().insert(gameSystems).values({
      id: gameSystemId,
      code: `settings-${suffix}`,
      name: "Settings Test System",
    });
    await getDb().insert(rulesets).values({
      id: rulesetId,
      gameSystemId,
      code: "test-rules",
      name: "Test Rules",
      edition: "test",
    });
    await getDb().insert(organizedPlayPrograms).values({
      id: programId,
      rulesetId,
      code: "TEST",
      name: "Test Program",
    });
  });

  afterAll(async () => {
    await getDb()
      .delete(communityAuditEvents)
      .where(eq(communityAuditEvents.communityId, communityId));
    await getDb()
      .delete(communitySupportedPrograms)
      .where(eq(communitySupportedPrograms.communityId, communityId));
    await getDb().delete(communities).where(eq(communities.id, communityId));
    await getDb().delete(organizedPlayPrograms).where(eq(organizedPlayPrograms.id, programId));
    await getDb().delete(rulesets).where(eq(rulesets.id, rulesetId));
    await getDb().delete(gameSystems).where(eq(gameSystems.id, gameSystemId));
    await getDb().delete(authUsers).where(eq(authUsers.id, authUserId));
  });

  it("stores profile settings with a safe default time zone", async () => {
    const [community] = await getDb()
      .insert(communities)
      .values({
        id: communityId,
        name: "Settings Community",
        slug: `settings-${suffix}`,
        description: "A private organized-play community.",
      })
      .returning();

    expect(community).toMatchObject({
      description: "A private organized-play community.",
      defaultTimeZone: "UTC",
    });

    const [updated] = await getDb()
      .update(communities)
      .set({ defaultTimeZone: "America/Phoenix" })
      .where(eq(communities.id, communityId))
      .returning();
    expect(updated?.defaultTimeZone).toBe("America/Phoenix");
  });

  it("rejects malformed time zones and oversized descriptions", async () => {
    await expect(
      getDb()
        .update(communities)
        .set({ defaultTimeZone: "Phoenix" })
        .where(eq(communities.id, communityId)),
    ).rejects.toBeDefined();

    await expect(
      getDb()
        .update(communities)
        .set({ description: "x".repeat(2001) })
        .where(eq(communities.id, communityId)),
    ).rejects.toBeDefined();
  });

  it("stores each supported program at most once", async () => {
    await getDb().insert(communitySupportedPrograms).values({
      id: `supported-program-${suffix}`,
      communityId,
      programId,
    });

    await expect(
      getDb().insert(communitySupportedPrograms).values({
        id: `duplicate-supported-program-${suffix}`,
        communityId,
        programId,
      }),
    ).rejects.toBeDefined();
  });

  it("persists attributable settings and lifecycle audit events", async () => {
    const [event] = await getDb()
      .insert(communityAuditEvents)
      .values({
        id: `settings-audit-${suffix}`,
        communityId,
        actorPersonId,
        eventType: "community.settings.updated",
        details: { changedFields: ["defaultTimeZone"] },
      })
      .returning();

    expect(event).toMatchObject({
      communityId,
      actorPersonId,
      eventType: "community.settings.updated",
      details: { changedFields: ["defaultTimeZone"] },
    });

    await expect(
      getDb().insert(communityAuditEvents).values({
        id: `invalid-audit-${suffix}`,
        communityId,
        actorPersonId,
        eventType: "deleted",
      }),
    ).rejects.toBeDefined();
  });

  it("protects retained audit history from community deletion", async () => {
    await expect(getDb().delete(communities).where(eq(communities.id, communityId))).rejects.toBeDefined();
  });
});
