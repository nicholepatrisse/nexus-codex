import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCommunity } from "@/community/create-community";
import { getDb } from "@/db/client";
import {
  authUsers,
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
import { cancelOwnSessionSignup, signupForSession } from "@/session/session-signups";

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
    await getDb().delete(gameSystems).where(eq(gameSystems.id, systemId));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("confirms only capacity seats and orders concurrent overflow on the waitlist", async () => {
    const results = await Promise.all(actors.slice(2, 9).map((actor) =>
      signupForSession(actor, community.slug, publishedSessionId)));
    expect(results.filter(({ status }) => status === "confirmed")).toHaveLength(6);
    expect(results.filter(({ status }) => status === "waitlisted")).toHaveLength(1);
    const waitlisted = results.find(({ status }) => status === "waitlisted");
    expect(waitlisted).toMatchObject({ status: "waitlisted", waitlistPosition: 1, replayed: false });
  });

  it("replays a live signup without creating a duplicate", async () => {
    const [confirmed] = await getDb().select().from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, publishedSessionId),
      eq(sessionSignups.status, "confirmed"),
    ));
    const confirmedActor = actors.find(({ personId }) => personId === confirmed?.personId)!;
    const result = await signupForSession(confirmedActor, community.slug, publishedSessionId);
    expect(result).toMatchObject({ status: "confirmed", replayed: true });
    const rows = await getDb().select().from(sessionSignups).where(eq(sessionSignups.personId, confirmedActor.personId));
    expect(rows).toHaveLength(1);
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
    const result = await signupForSession(actors[9]!, community.slug, publishedSessionId);
    expect(result).toMatchObject({ status: "waitlisted", waitlistPosition: 1, replayed: false });
  });
});
