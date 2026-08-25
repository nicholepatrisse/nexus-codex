import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCommunity } from "@/community/create-community";
import { revokeCommunityGmGrant } from "@/community/revoke-community-gm-grant";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
  communitySupportedPrograms,
  contentItems,
  gameSystems,
  organizedPlayPrograms,
  rulesets,
  sessions,
} from "@/db/schema";
import {
  createSessionDraft,
  inspectFutureGmSessions,
  SessionDraftValidationError,
  updateSessionDraft,
} from "@/session/session-drafts";
import { publishSession } from "@/session/publish-session";
import { cancelPublishedSession, updatePublishedSession } from "@/session/published-session";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const authUserIds: string[] = [];
let owner: AuthenticatedActor;
let gmOne: AuthenticatedActor;
let gmTwo: AuthenticatedActor;
let selfServiceMember: AuthenticatedActor;
let community: { id: string; slug: string };
const systemId = `session-system-${suffix}`;
const rulesetId = `session-rules-${suffix}`;
const programId = `session-program-${suffix}`;
const unsupportedProgramId = `session-other-program-${suffix}`;
const scenarioId = `session-scenario-${suffix}`;
const unsupportedScenarioId = `session-other-scenario-${suffix}`;
const grantIds: string[] = [];

async function identity(label: string): Promise<AuthenticatedActor> {
  const created = await createTestIdentity({
    subject: `session-${label}-${suffix}`,
    email: `session-${label}-${suffix}@fixture.invalid`,
    sessions: 0,
  });
  authUserIds.push(created.authUser.id);
  return { personId: created.person.id, authUserId: created.authUser.id, sessionId: `session-${label}` };
}

const draftInput = () => ({
  contentItemId: scenarioId,
  startsAt: "2030-09-01T18:00:00-07:00",
  endsAt: "2030-09-01T22:00:00-07:00",
  displayTimeZone: "America/Phoenix",
  locationType: "physical" as const,
  notes: "Table near the entrance",
});

describeWithDatabase("session drafts", () => {
  beforeAll(async () => {
    [owner, gmOne, gmTwo, selfServiceMember] = await Promise.all([
      identity("owner"), identity("gm-one"), identity("gm-two"), identity("self-service"),
    ]);
    community = await createCommunity(owner, { name: `Session drafts ${suffix}` });
    await getDb().update(communities).set({ gmAdmission: "self_service" }).where(eq(communities.id, community.id));
    await getDb().insert(communityMemberships).values([gmOne, gmTwo, selfServiceMember].map((actor) => ({
      id: crypto.randomUUID(), communityId: community.id, personId: actor.personId, status: "active",
    })));
    for (const gm of [gmOne, gmTwo]) {
      const id = crypto.randomUUID();
      grantIds.push(id);
      await getDb().insert(communityRoleGrants).values({
        id, communityId: community.id, personId: gm.personId, role: "gm", grantedByPersonId: owner.personId,
      });
    }
    await getDb().insert(gameSystems).values({ id: systemId, code: systemId, name: "Session Test" });
    await getDb().insert(rulesets).values({ id: rulesetId, gameSystemId: systemId, code: "test", name: "Test", edition: "2" });
    await getDb().insert(organizedPlayPrograms).values([
      { id: programId, rulesetId, code: "SFS2", name: "Supported" },
      { id: unsupportedProgramId, rulesetId, code: "OTHER", name: "Unsupported" },
    ]);
    await getDb().insert(contentItems).values([
      { id: scenarioId, programId, code: "1-01", normalizedCode: "1-01", title: "Supported scenario", normalizedTitle: "supported scenario", contentType: "scenario", minimumLevel: 1, maximumLevel: 4 },
      { id: unsupportedScenarioId, programId: unsupportedProgramId, code: "2-01", normalizedCode: "2-01", title: "Unsupported scenario", normalizedTitle: "unsupported scenario", contentType: "scenario", minimumLevel: 1, maximumLevel: 4 },
    ]);
    await getDb().insert(communitySupportedPrograms).values({ id: crypto.randomUUID(), communityId: community.id, programId });
  });

  afterAll(async () => {
    await getDb().delete(sessions).where(eq(sessions.communityId, community.id));
    await getDb().delete(communityAuditEvents).where(eq(communityAuditEvents.communityId, community.id));
    await getDb().delete(communityGmRequests).where(eq(communityGmRequests.communityId, community.id));
    await getDb().delete(communityRoleGrants).where(eq(communityRoleGrants.communityId, community.id));
    await getDb().delete(communityMemberships).where(eq(communityMemberships.communityId, community.id));
    await getDb().delete(communitySupportedPrograms).where(eq(communitySupportedPrograms.communityId, community.id));
    await getDb().delete(communities).where(eq(communities.id, community.id));
    await getDb().delete(contentItems).where(inArray(contentItems.id, [scenarioId, unsupportedScenarioId]));
    await getDb().delete(organizedPlayPrograms).where(inArray(organizedPlayPrograms.id, [programId, unsupportedProgramId]));
    await getDb().delete(rulesets).where(eq(rulesets.id, rulesetId));
    await getDb().delete(gameSystems).where(eq(gameSystems.id, systemId));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("lets an owner create, edit, and reassign a six-seat draft", async () => {
    const created = await createSessionDraft(owner, community.slug, { ...draftInput(), gmPersonId: gmOne.personId });
    expect(created.status).toBe("created");
    if (created.status !== "created") throw new Error("draft was not created");
    const [stored] = await getDb().select().from(sessions).where(eq(sessions.id, created.sessionId));
    expect(stored).toMatchObject({ gmPersonId: gmOne.personId, playerCapacity: 6, status: "draft" });
    expect(stored?.startsAt.toISOString()).toBe("2030-09-02T01:00:00.000Z");

    await expect(updateSessionDraft(owner, community.slug, created.sessionId, {
      ...draftInput(), gmPersonId: gmTwo.personId, displayTimeZone: "UTC",
    })).resolves.toMatchObject({ status: "updated" });
    const [updated] = await getDb().select().from(sessions).where(eq(sessions.id, created.sessionId));
    expect(updated).toMatchObject({ gmPersonId: gmTwo.personId, displayTimeZone: "UTC" });
    expect(updated?.startsAt.toISOString()).toBe(stored?.startsAt.toISOString());

    await expect(updateSessionDraft(gmOne, community.slug, created.sessionId, draftInput()))
      .resolves.toEqual({ status: "forbidden" });
    await expect(updateSessionDraft(gmTwo, community.slug, created.sessionId, draftInput()))
      .resolves.toMatchObject({ status: "updated" });
  });

  it("treats the owner as an assignable GM without an explicit GM grant", async () => {
    const [explicitOwnerGmGrant] = await getDb().select({ id: communityRoleGrants.id })
      .from(communityRoleGrants).where(and(
        eq(communityRoleGrants.communityId, community.id),
        eq(communityRoleGrants.personId, owner.personId),
        eq(communityRoleGrants.role, "gm"),
      ));
    expect(explicitOwnerGmGrant).toBeUndefined();

    const created = await createSessionDraft(owner, community.slug, {
      ...draftInput(), gmPersonId: owner.personId,
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") throw new Error("owner GM draft was not created");

    const [stored] = await getDb().select({ gmPersonId: sessions.gmPersonId })
      .from(sessions).where(eq(sessions.id, created.sessionId));
    expect(stored?.gmPersonId).toBe(owner.personId);
    await expect(publishSession(owner, community.slug, created.sessionId))
      .resolves.toMatchObject({ status: "published", sessionId: created.sessionId });
    await expect(updatePublishedSession(owner, community.slug, created.sessionId, {
      ...draftInput(), gmPersonId: owner.personId, notes: "Managed by the owner GM",
    })).resolves.toEqual({ status: "updated", sessionId: created.sessionId });
    await expect(cancelPublishedSession(owner, community.slug, created.sessionId))
      .resolves.toMatchObject({ status: "cancelled", sessionId: created.sessionId });
  });

  it("keeps a GM self-assigned and rejects unsupported scenarios", async () => {
    await expect(createSessionDraft(gmOne, community.slug, { ...draftInput(), gmPersonId: gmTwo.personId }))
      .resolves.toEqual({ status: "forbidden" });
    await expect(createSessionDraft(owner, community.slug, {
      ...draftInput(), contentItemId: unsupportedScenarioId, gmPersonId: gmOne.personId,
    })).rejects.toBeInstanceOf(SessionDraftValidationError);
  });

  it("atomically promotes a self-service member with their first draft", async () => {
    const result = await createSessionDraft(selfServiceMember, community.slug, draftInput());
    expect(result).toMatchObject({ status: "created", promoted: true });
    const [grant] = await getDb().select().from(communityRoleGrants).where(and(
      eq(communityRoleGrants.communityId, community.id),
      eq(communityRoleGrants.personId, selfServiceMember.personId),
      eq(communityRoleGrants.status, "active"),
    ));
    expect(grant?.role).toBe("gm");
  });

  it("blocks revocation while a future draft remains assigned", async () => {
    const created = await createSessionDraft(owner, community.slug, { ...draftInput(), gmPersonId: gmOne.personId });
    expect(created.status).toBe("created");
    await expect(revokeCommunityGmGrant(owner, community.slug, grantIds[0]!, {}, {
      inspectFutureSessions: inspectFutureGmSessions,
    })).resolves.toMatchObject({ status: "blocked", impact: { status: "affected" } });
  });

  it("preserves drafts while archive blocks writes and restore re-enables them", async () => {
    const created = await createSessionDraft(owner, community.slug, { ...draftInput(), gmPersonId: gmTwo.personId });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    await getDb().update(communities).set({ lifecycleStatus: "archived" }).where(eq(communities.id, community.id));
    await expect(updateSessionDraft(owner, community.slug, created.sessionId, { ...draftInput(), gmPersonId: gmTwo.personId }))
      .resolves.toEqual({ status: "not-found" });
    expect(await getDb().select().from(sessions).where(eq(sessions.id, created.sessionId))).toHaveLength(1);
    await getDb().update(communities).set({ lifecycleStatus: "active" }).where(eq(communities.id, community.id));
    await expect(updateSessionDraft(owner, community.slug, created.sessionId, { ...draftInput(), gmPersonId: gmTwo.personId }))
      .resolves.toMatchObject({ status: "updated" });
  });

  it("publishes a complete draft for its owner or assigned GM", async () => {
    const ownerDraft = await createSessionDraft(owner, community.slug, {
      ...draftInput(), gmPersonId: gmOne.personId,
    });
    const gmDraft = await createSessionDraft(owner, community.slug, {
      ...draftInput(), gmPersonId: gmOne.personId,
    });
    if (ownerDraft.status !== "created" || gmDraft.status !== "created") {
      throw new Error("publication fixtures were not created");
    }
    await expect(publishSession(owner, community.slug, ownerDraft.sessionId))
      .resolves.toEqual({ status: "published", sessionId: ownerDraft.sessionId, replayed: false });
    await expect(publishSession(gmOne, community.slug, gmDraft.sessionId))
      .resolves.toEqual({ status: "published", sessionId: gmDraft.sessionId, replayed: false });

    const stored = await getDb().select({ id: sessions.id, status: sessions.status })
      .from(sessions).where(inArray(sessions.id, [ownerDraft.sessionId, gmDraft.sessionId]));
    expect(stored).toEqual(expect.arrayContaining([
      { id: ownerDraft.sessionId, status: "published" },
      { id: gmDraft.sessionId, status: "published" },
    ]));
  });

  it("rejects unauthorized publication while allowing a draft with location intent only", async () => {
    const created = await createSessionDraft(owner, community.slug, {
      ...draftInput(), gmPersonId: gmOne.personId,
    });
    if (created.status !== "created") throw new Error("publication fixture was not created");

    await expect(publishSession(gmTwo, community.slug, created.sessionId))
      .resolves.toEqual({ status: "forbidden" });
    await expect(publishSession(owner, community.slug, created.sessionId))
      .resolves.toEqual({ status: "published", sessionId: created.sessionId, replayed: false });

    const [stored] = await getDb().select({ status: sessions.status })
      .from(sessions).where(eq(sessions.id, created.sessionId));
    expect(stored?.status).toBe("published");
  });

  it("makes publication replay and concurrency produce one audit event", async () => {
    const created = await createSessionDraft(owner, community.slug, {
      ...draftInput(), gmPersonId: gmOne.personId,
    });
    if (created.status !== "created") throw new Error("publication fixture was not created");
    const results = await Promise.all([
      publishSession(owner, community.slug, created.sessionId),
      publishSession(owner, community.slug, created.sessionId),
    ]);
    expect(results).toEqual(expect.arrayContaining([
      { status: "published", sessionId: created.sessionId, replayed: false },
      { status: "published", sessionId: created.sessionId, replayed: true },
    ]));
    await expect(publishSession(owner, community.slug, created.sessionId))
      .resolves.toEqual({ status: "published", sessionId: created.sessionId, replayed: true });

    const events = await getDb().select({ details: communityAuditEvents.details })
      .from(communityAuditEvents).where(and(
        eq(communityAuditEvents.communityId, community.id),
        eq(communityAuditEvents.eventType, "session.published"),
      ));
    expect(events.filter(({ details }) => details.sessionId === created.sessionId))
      .toEqual([{ details: { sessionId: created.sessionId } }]);
  });

  it("rechecks community lifecycle and the assigned GM's current grant", async () => {
    const created = await createSessionDraft(owner, community.slug, {
      ...draftInput(), gmPersonId: gmOne.personId,
    });
    if (created.status !== "created") throw new Error("publication fixture was not created");
    await getDb().update(communities).set({ lifecycleStatus: "archived" })
      .where(eq(communities.id, community.id));
    await expect(publishSession(owner, community.slug, created.sessionId))
      .resolves.toEqual({ status: "not-found" });
    await getDb().update(communities).set({ lifecycleStatus: "active" })
      .where(eq(communities.id, community.id));

    await getDb().update(communityRoleGrants).set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByPersonId: owner.personId,
      revocationReason: "Publication authorization regression test",
    }).where(eq(communityRoleGrants.id, grantIds[0]!));
    await expect(publishSession(gmOne, community.slug, created.sessionId))
      .resolves.toEqual({ status: "forbidden" });

    const [stored] = await getDb().select({ status: sessions.status })
      .from(sessions).where(eq(sessions.id, created.sessionId));
    expect(stored?.status).toBe("draft");
  });

  it("edits a published session without changing its stable identity", async () => {
    const created = await createSessionDraft(owner, community.slug, { ...draftInput(), gmPersonId: gmTwo.personId });
    if (created.status !== "created") throw new Error("fixture was not created");
    await publishSession(owner, community.slug, created.sessionId);
    await expect(updatePublishedSession(gmTwo, community.slug, created.sessionId, {
      ...draftInput(), notes: "Updated after publication",
    })).resolves.toEqual({ status: "updated", sessionId: created.sessionId });
    const [stored] = await getDb().select({ id: sessions.id, status: sessions.status, notes: sessions.notes })
      .from(sessions).where(eq(sessions.id, created.sessionId));
    expect(stored).toEqual({ id: created.sessionId, status: "published", notes: "Updated after publication" });
    await expect(updatePublishedSession(gmOne, community.slug, created.sessionId, draftInput()))
      .resolves.toEqual({ status: "forbidden" });
  });

  it("cancels without deleting identity and makes cancellation idempotent", async () => {
    const created = await createSessionDraft(owner, community.slug, { ...draftInput(), gmPersonId: gmTwo.personId });
    if (created.status !== "created") throw new Error("fixture was not created");
    await publishSession(owner, community.slug, created.sessionId);
    await expect(cancelPublishedSession(gmTwo, community.slug, created.sessionId))
      .resolves.toEqual({ status: "cancelled", sessionId: created.sessionId, replayed: false });
    await expect(cancelPublishedSession(owner, community.slug, created.sessionId))
      .resolves.toEqual({ status: "cancelled", sessionId: created.sessionId, replayed: true });
    const [stored] = await getDb().select({ id: sessions.id, status: sessions.status })
      .from(sessions).where(eq(sessions.id, created.sessionId));
    expect(stored).toEqual({ id: created.sessionId, status: "cancelled" });
  });
});
