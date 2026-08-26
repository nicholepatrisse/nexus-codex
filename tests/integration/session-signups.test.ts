import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCommunity } from "@/community/create-community";
import { getDb } from "@/db/client";
import { listNotificationsForPerson } from "@/notifications/repository";
import {
  authUsers,
  characters,
  communities,
  communityAuditEvents,
  communityMemberships,
  communityRoleGrants,
  communitySupportedPrograms,
  contentItems,
  gameSystems,
  organizedPlayPrograms,
  rulesets,
  sessionSignups,
  sessions,
} from "@/db/schema";
import { createSessionDraft } from "@/session/session-drafts";
import { publishSession } from "@/session/publish-session";
import { cancelPublishedSession, updatePublishedSession } from "@/session/published-session";
import {
  assignSignupCharacterAsGm,
  cancelOwnSessionSignup,
  listAllSignedUpGames,
  listUnreportedGmGames,
  listUpcomingSignedUpGames,
  signupForSession,
  updateOwnSessionSignup,
} from "@/session/session-signups";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const authUserIds: string[] = [];
const actors: AuthenticatedActor[] = [];
let owner: AuthenticatedActor;
let gm: AuthenticatedActor;
let community: { id: string; slug: string };
let publishedSessionId: string;
const systemId = `signup-system-${suffix}`;
const rulesetId = `signup-rules-${suffix}`;
const programId = `signup-program-${suffix}`;
const scenarioId = `signup-scenario-${suffix}`;
const characterIdFor = (actor: AuthenticatedActor) => `signup-character-${actor.personId}`;

async function identity(label: string) {
  const created = await createTestIdentity({
    subject: `signup-${label}-${suffix}`,
    email: `signup-${label}-${suffix}@fixture.invalid`,
    sessions: 0,
  });
  authUserIds.push(created.authUser.id);
  const actor = {
    personId: created.person.id,
    authUserId: created.authUser.id,
    sessionId: `signup-${label}`,
  };
  actors.push(actor);
  return actor;
}

describeWithDatabase("session signups", () => {
  beforeAll(async () => {
    [owner, gm] = await Promise.all([identity("owner"), identity("gm")]);
    await Promise.all(Array.from({ length: 8 }, (_, index) => identity(`player-${index + 1}`)));
    community = await createCommunity(owner, { name: `Signup community ${suffix}` });
    await getDb().update(communities).set({ visibility: "public", scheduleVisibility: "public" })
      .where(eq(communities.id, community.id));
    await getDb().insert(communityMemberships).values({
      id: crypto.randomUUID(), communityId: community.id, personId: gm.personId, status: "active",
    });
    await getDb().insert(communityRoleGrants).values({
      id: crypto.randomUUID(), communityId: community.id, personId: gm.personId, role: "gm",
      grantedByPersonId: owner.personId,
    });
    await getDb().insert(gameSystems).values({ id: systemId, code: systemId, name: "Signup Test" });
    await getDb().insert(characters).values(actors.map((actor, index) => ({
      id: characterIdFor(actor), personId: actor.personId, gameSystemId: systemId,
      name: `Signup character ${index + 1}`, societyNumber: `${index + 1}-1`,
    })));
    await getDb().insert(rulesets).values({
      id: rulesetId, gameSystemId: systemId, code: "test", name: "Test", edition: "2",
    });
    await getDb().insert(organizedPlayPrograms).values({
      id: programId, rulesetId, code: "SFS2", name: "Signup program",
    });
    await getDb().insert(contentItems).values({
      id: scenarioId, programId, code: "1-01", normalizedCode: "1-01", title: "Signup scenario",
      normalizedTitle: "signup scenario", contentType: "scenario", minimumLevel: 1, maximumLevel: 4,
    });
    await getDb().insert(communitySupportedPrograms).values({
      id: crypto.randomUUID(), communityId: community.id, programId,
    });
    const draft = await createSessionDraft(owner, community.slug, {
      contentItemId: scenarioId,
      gmPersonId: gm.personId,
      startsAt: "2030-09-01T18:00:00-07:00",
      endsAt: "2030-09-01T22:00:00-07:00",
      displayTimeZone: "America/Phoenix",
      locationType: "physical",
    });
    if (draft.status !== "created") throw new Error("signup session was not created");
    publishedSessionId = draft.sessionId;
    await publishSession(owner, community.slug, publishedSessionId);
  });

  afterAll(async () => {
    await getDb().delete(sessionSignups).where(eq(sessionSignups.sessionId, publishedSessionId));
    await getDb().delete(sessions).where(eq(sessions.communityId, community.id));
    await getDb().delete(communityAuditEvents).where(eq(communityAuditEvents.communityId, community.id));
    await getDb().delete(communityRoleGrants).where(eq(communityRoleGrants.communityId, community.id));
    await getDb().delete(communityMemberships).where(eq(communityMemberships.communityId, community.id));
    await getDb().delete(communitySupportedPrograms).where(eq(communitySupportedPrograms.communityId, community.id));
    await getDb().delete(communities).where(eq(communities.id, community.id));
    await getDb().delete(contentItems).where(eq(contentItems.id, scenarioId));
    await getDb().delete(organizedPlayPrograms).where(eq(organizedPlayPrograms.id, programId));
    await getDb().delete(rulesets).where(eq(rulesets.id, rulesetId));
    await getDb().delete(characters).where(eq(characters.gameSystemId, systemId));
    await getDb().delete(gameSystems).where(eq(gameSystems.id, systemId));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("rejects a character owned by another player", async () => {
    await expect(signupForSession(
      actors[2]!, community.slug, publishedSessionId, characterIdFor(actors[3]!),
    )).resolves.toEqual({ status: "unavailable" });
    await expect(getDb().select().from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, publishedSessionId),
      eq(sessionSignups.personId, actors[2]!.personId),
    ))).resolves.toEqual([]);
  });

  it("confirms only capacity seats and orders concurrent overflow on the waitlist", async () => {
    const results = await Promise.all(actors.slice(2, 9).map((actor) =>
      signupForSession(actor, community.slug, publishedSessionId, characterIdFor(actor))));
    expect(results.filter(({ status }) => status === "confirmed")).toHaveLength(6);
    expect(results.filter(({ status }) => status === "waitlisted")).toHaveLength(1);
    const waitlisted = results.find(({ status }) => status === "waitlisted");
    expect(waitlisted).toMatchObject({ status: "waitlisted", waitlistPosition: 1, replayed: false });
    const persisted = await getDb().select({ personId: sessionSignups.personId, characterId: sessionSignups.characterId })
      .from(sessionSignups).where(eq(sessionSignups.sessionId, publishedSessionId));
    expect(persisted.every((signup) => signup.characterId === characterIdFor(actors.find(({ personId }) => personId === signup.personId)!))).toBe(true);
  });

  it("replays a live signup without creating a duplicate", async () => {
    const [confirmed] = await getDb().select().from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, publishedSessionId),
      eq(sessionSignups.status, "confirmed"),
    ));
    const confirmedActor = actors.find(({ personId }) => personId === confirmed?.personId)!;
    const result = await signupForSession(confirmedActor, community.slug, publishedSessionId, characterIdFor(confirmedActor));
    expect(result).toMatchObject({ status: "confirmed", replayed: true });
    const rows = await getDb().select().from(sessionSignups).where(eq(sessionSignups.personId, confirmedActor.personId));
    expect(rows).toHaveLength(1);
  });

  it("lets the assigned GM select a missing character only from that player's eligible characters", async () => {
    const [signup] = await getDb().select().from(sessionSignups).where(and(eq(sessionSignups.sessionId, publishedSessionId), eq(sessionSignups.status, "confirmed"))).limit(1);
    const player = actors.find(({ personId }) => personId === signup?.personId)!;
    await getDb().update(sessionSignups).set({ characterId: null }).where(eq(sessionSignups.id, signup!.id));

    await expect(assignSignupCharacterAsGm(player, community.slug, publishedSessionId, signup!.id, characterIdFor(player))).resolves.toEqual({ status: "unavailable" });
    await expect(assignSignupCharacterAsGm(gm, community.slug, publishedSessionId, signup!.id, characterIdFor(actors.find(({ personId }) => personId !== player.personId)!))).resolves.toEqual({ status: "unavailable" });
    await expect(assignSignupCharacterAsGm(gm, community.slug, publishedSessionId, signup!.id, characterIdFor(player))).resolves.toEqual({ status: "updated", signupId: signup!.id });
    await expect(getDb().select({ characterId: sessionSignups.characterId }).from(sessionSignups).where(eq(sessionSignups.id, signup!.id))).resolves.toEqual([{ characterId: characterIdFor(player) }]);
  });

  it("updates a live signup and records the audit event", async () => {
    const [signup] = await getDb().select().from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, publishedSessionId),
      eq(sessionSignups.status, "confirmed"),
    )).limit(1);
    const actor = actors.find(({ personId }) => personId === signup?.personId)!;
    const alternateCharacterId = `alternate-${characterIdFor(actor)}`;
    await getDb().insert(characters).values({
      id: alternateCharacterId, personId: actor.personId, gameSystemId: systemId,
      name: "Alternate signup character", societyNumber: "99-1",
    });

    await expect(updateOwnSessionSignup(actor, community.slug, publishedSessionId, alternateCharacterId))
      .resolves.toEqual({ status: "updated", signupId: signup!.id });
    await expect(getDb().select().from(sessionSignups).where(eq(sessionSignups.id, signup!.id)))
      .resolves.toEqual([expect.objectContaining({ characterId: alternateCharacterId })]);
    await expect(getDb().select().from(communityAuditEvents).where(and(
      eq(communityAuditEvents.communityId, community.id),
      eq(communityAuditEvents.eventType, "session.signup.updated"),
    ))).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ actorPersonId: actor.personId })]));
  });

  it("lists only the person's authorized upcoming games in chronological order", async () => {
    const [confirmed] = await getDb().select({ personId: sessionSignups.personId })
      .from(sessionSignups).where(and(
        eq(sessionSignups.sessionId, publishedSessionId),
        eq(sessionSignups.status, "confirmed"),
      )).limit(1);
    const laterSessionId = `later-session-${suffix}`;
    const laterSignupId = `later-signup-${suffix}`;
    await getDb().insert(sessions).values({
      id: laterSessionId,
      communityId: community.id,
      contentItemId: scenarioId,
      gmPersonId: gm.personId,
      status: "published",
      startsAt: new Date("2030-09-03T01:00:00Z"),
      endsAt: new Date("2030-09-03T05:00:00Z"),
      displayTimeZone: "America/Phoenix",
      locationType: "physical",
      createdByPersonId: owner.personId,
      updatedByPersonId: owner.personId,
    });
    await getDb().insert(sessionSignups).values({
      id: laterSignupId,
      sessionId: laterSessionId,
      personId: confirmed!.personId,
      status: "confirmed",
    });
    await getDb().insert(sessionSignups).values({
      id: `gm-later-signup-${suffix}`,
      sessionId: laterSessionId,
      personId: gm.personId,
      status: "confirmed",
    });

    const games = await listUpcomingSignedUpGames(
      confirmed!.personId,
      new Date("2030-01-01T00:00:00Z"),
    );
    expect(games.map(({ sessionId }) => sessionId)).toEqual([publishedSessionId, laterSessionId]);
    expect(games[0]).toMatchObject({
      communityName: expect.any(String),
      scenarioTitle: "Signup scenario",
      participationRole: "player",
      signupStatus: "confirmed",
    });
    await expect(listUpcomingSignedUpGames(gm.personId, new Date("2030-01-01T00:00:00Z")))
      .resolves.toEqual([
        expect.objectContaining({
          sessionId: publishedSessionId,
          participationRole: "gm",
          signupStatus: null,
        }),
        expect.objectContaining({
          sessionId: laterSessionId,
          participationRole: "gm",
          signupStatus: "confirmed",
        }),
      ]);
    await expect(listUpcomingSignedUpGames(crypto.randomUUID(), new Date("2030-01-01T00:00:00Z")))
      .resolves.toEqual([]);

    await getDb().update(communities).set({ visibility: "private", scheduleVisibility: "members" })
      .where(eq(communities.id, community.id));
    await expect(listUpcomingSignedUpGames(confirmed!.personId, new Date("2030-01-01T00:00:00Z")))
      .resolves.toEqual([]);
    await getDb().update(communities).set({ visibility: "public", scheduleVisibility: "public" })
      .where(eq(communities.id, community.id));

    await getDb().delete(sessionSignups).where(eq(sessionSignups.sessionId, laterSessionId));
    await getDb().delete(sessions).where(eq(sessions.id, laterSessionId));
  });

  it("promotes the first waitlisted user when a confirmed player cancels", async () => {
    const [waitlistedBefore] = await getDb().select().from(sessionSignups)
      .where(and(
        eq(sessionSignups.sessionId, publishedSessionId),
        eq(sessionSignups.status, "waitlisted"),
      ));
    const [confirmedBefore] = await getDb().select().from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, publishedSessionId),
      eq(sessionSignups.status, "confirmed"),
    ));
    const confirmedActor = actors.find(({ personId }) => personId === confirmedBefore?.personId)!;
    const cancelled = await cancelOwnSessionSignup(confirmedActor, community.slug, publishedSessionId);
    expect(cancelled).toMatchObject({ status: "cancelled", promotedSignupId: waitlistedBefore?.id });
    const [promoted] = await getDb().select().from(sessionSignups)
      .where(eq(sessionSignups.id, waitlistedBefore!.id));
    expect(promoted).toMatchObject({ status: "confirmed", waitlistPosition: null });
  });

  it("puts the next signup into the newly available waitlist position only when full", async () => {
    const result = await signupForSession(actors[9]!, community.slug, publishedSessionId, characterIdFor(actors[9]!));
    expect(result).toMatchObject({ status: "waitlisted", waitlistPosition: 1, replayed: false });
  });

  it("notifies confirmed and waitlisted users, but not unrelated members, when a game changes", async () => {
    const [confirmedSignup] = await getDb().select({ personId: sessionSignups.personId })
      .from(sessionSignups).where(and(eq(sessionSignups.sessionId, publishedSessionId), eq(sessionSignups.status, "confirmed"))).limit(1);
    const [waitlistedSignup] = await getDb().select({ personId: sessionSignups.personId })
      .from(sessionSignups).where(and(eq(sessionSignups.sessionId, publishedSessionId), eq(sessionSignups.status, "waitlisted"))).limit(1);
    await expect(updatePublishedSession(owner, community.slug, publishedSessionId, {
      contentItemId: scenarioId,
      gmPersonId: gm.personId,
      startsAt: "2030-09-01T19:00:00-07:00",
      endsAt: "2030-09-01T23:00:00-07:00",
      displayTimeZone: "America/Phoenix",
      locationType: "physical",
      notes: "Start time changed",
    })).resolves.toMatchObject({ status: "updated" });

    const confirmedNotifications = await listNotificationsForPerson(confirmedSignup!.personId);
    const waitlistedNotifications = await listNotificationsForPerson(waitlistedSignup!.personId);
    const gmNotifications = await listNotificationsForPerson(gm.personId);
    expect(confirmedNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "session.changed", href: `/communities/${community.slug}/sessions/${publishedSessionId}` }),
    ]));
    expect(waitlistedNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "session.changed" }),
    ]));
    expect(gmNotifications).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "session.changed" }),
    ]));
  });

  it("lists past published games only for their assigned GM until they are completed or cancelled", async () => {
    await expect(listUnreportedGmGames(gm.personId, new Date("2031-01-01T00:00:00Z"))).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ sessionId: publishedSessionId, scenarioTitle: "Signup scenario" })]));
    await expect(listUnreportedGmGames(actors[2]!.personId, new Date("2031-01-01T00:00:00Z"))).resolves.toEqual([]);
    await expect(listUnreportedGmGames(gm.personId, new Date("2030-01-01T00:00:00Z"))).resolves.toEqual([]);
    await expect(listAllSignedUpGames(gm.personId)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ sessionId: publishedSessionId, participationRole: "gm" })]));
  });

  it("notifies confirmed and waitlisted users when their game is cancelled", async () => {
    const [confirmedSignup] = await getDb().select({ personId: sessionSignups.personId })
      .from(sessionSignups).where(and(eq(sessionSignups.sessionId, publishedSessionId), eq(sessionSignups.status, "confirmed"))).limit(1);
    const [waitlistedSignup] = await getDb().select({ personId: sessionSignups.personId })
      .from(sessionSignups).where(and(eq(sessionSignups.sessionId, publishedSessionId), eq(sessionSignups.status, "waitlisted"))).limit(1);
    await expect(cancelPublishedSession(owner, community.slug, publishedSessionId))
      .resolves.toMatchObject({ status: "cancelled" });
    await expect(listNotificationsForPerson(confirmedSignup!.personId)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "session.cancelled" })]),
    );
    await expect(listNotificationsForPerson(waitlistedSignup!.personId)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "session.cancelled" })]),
    );
  });
});
