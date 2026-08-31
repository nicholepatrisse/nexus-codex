import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, or } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { defaultPregenLevel, SFS2_PREGENS } from "@/character/sfs2-pregens";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import {
  communities,
  characters,
  communityAuditEvents,
  communityMemberships,
  contentItems,
  sessionSignups,
  sessions,
  organizedPlayPrograms,
  rulesets,
} from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export type SessionSignupResult =
  | { status: "confirmed" | "waitlisted"; signupId: string; replayed: boolean; waitlistPosition?: number }
  | { status: "not-found" | "unavailable" };

export type CancelSessionSignupResult =
  | { status: "cancelled"; promotedSignupId?: string }
  | { status: "not-found" | "unavailable" };

export type UpdateSessionSignupResult =
  | { status: "updated"; signupId: string }
  | { status: "not-found" | "unavailable" };

export type SessionSignupChoice =
  | { kind: "character"; characterId: string }
  | { kind: "pregen"; pregenName: string; pregenLevel: number; creditRecipientCharacterId: string };

async function validateChoice(choice: SessionSignupChoice, personId: string, gameSystemId: string, minimumLevel: number, maximumLevel: number, database: Database) {
  const characterId = choice.kind === "character" ? choice.characterId : choice.creditRecipientCharacterId;
  const [character] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, personId), eq(characters.gameSystemId, gameSystemId))).limit(1);
  if (!character) return null;
  if (choice.kind === "pregen" && !SFS2_PREGENS.includes(choice.pregenName as typeof SFS2_PREGENS[number])) return null;
  const scenarioPregenLevel = defaultPregenLevel(minimumLevel, maximumLevel);
  return choice.kind === "character"
    ? { characterId: character.id, pregenName: null, pregenLevel: null, creditRecipientCharacterId: null }
    : { characterId: null, pregenName: choice.pregenName, pregenLevel: scenarioPregenLevel, creditRecipientCharacterId: character.id };
}

export async function updateOwnSessionSignup(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  rawChoice: SessionSignupChoice | string,
  database: Database = getDb(),
): Promise<UpdateSessionSignupResult> {
  const choice: SessionSignupChoice = typeof rawChoice === "string" ? { kind: "character", characterId: rawChoice } : rawChoice;
  return database.transaction(async (transaction) => {
    const [session] = await transaction.select({
      id: sessions.id,
      communityId: sessions.communityId,
      gameSystemId: rulesets.gameSystemId,
      minimumLevel: contentItems.minimumLevel,
      maximumLevel: contentItems.maximumLevel,
    }).from(sessions)
      .innerJoin(communities, eq(communities.id, sessions.communityId))
      .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
      .innerJoin(organizedPlayPrograms, eq(organizedPlayPrograms.id, contentItems.programId))
      .innerJoin(rulesets, eq(rulesets.id, organizedPlayPrograms.rulesetId))
      .where(and(
        eq(sessions.id, sessionId),
        eq(communities.slug, slug),
        eq(sessions.status, "published"),
        gte(sessions.startsAt, new Date()),
      )).limit(1).for("update");
    if (!session) return { status: "unavailable" };

    const values = await validateChoice(choice, actor.personId, session.gameSystemId, session.minimumLevel, session.maximumLevel, transaction as Database);
    if (!values) return { status: "unavailable" };

    const [signup] = await transaction.select({ id: sessionSignups.id }).from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, session.id),
      eq(sessionSignups.personId, actor.personId),
      inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
    )).limit(1).for("update");
    if (!signup) return { status: "not-found" };

    const now = new Date();
    await transaction.update(sessionSignups).set({ ...values, updatedAt: now })
      .where(eq(sessionSignups.id, signup.id));
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(), communityId: session.communityId, actorPersonId: actor.personId,
      eventType: "session.signup.updated",
      details: { sessionId: session.id, signupId: signup.id, ...values }, occurredAt: now,
    });
    return { status: "updated", signupId: signup.id };
  });
}

/** Lets the assigned GM or community owner repair a signup that is missing a character. */
export async function assignSignupCharacterAsGm(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  signupId: string,
  characterId: string,
  database: Database = getDb(),
): Promise<UpdateSessionSignupResult> {
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction as Database);
    if (access.status !== "available") return { status: "not-found" };
    const [session] = await transaction.select({ id: sessions.id, communityId: sessions.communityId, gmPersonId: sessions.gmPersonId, gameSystemId: rulesets.gameSystemId })
      .from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(organizedPlayPrograms, eq(organizedPlayPrograms.id, contentItems.programId)).innerJoin(rulesets, eq(rulesets.id, organizedPlayPrograms.rulesetId))
      .where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id), eq(sessions.status, "published"))).limit(1).for("update");
    if (!session || (!access.roles.includes("owner") && session.gmPersonId !== actor.personId)) return { status: "unavailable" };
    const [signup] = await transaction.select({ id: sessionSignups.id, personId: sessionSignups.personId }).from(sessionSignups)
      .where(and(eq(sessionSignups.id, signupId), eq(sessionSignups.sessionId, session.id), eq(sessionSignups.status, "confirmed"))).limit(1).for("update");
    if (!signup) return { status: "not-found" };
    const [character] = await transaction.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, signup.personId), eq(characters.gameSystemId, session.gameSystemId))).limit(1);
    if (!character) return { status: "unavailable" };
    const now = new Date();
    await transaction.update(sessionSignups).set({ characterId: character.id, updatedAt: now }).where(eq(sessionSignups.id, signup.id));
    await transaction.insert(communityAuditEvents).values({ id: randomUUID(), communityId: session.communityId, actorPersonId: actor.personId, eventType: "session.signup.updated", details: { sessionId, signupId, characterId, assignedByGm: true }, occurredAt: now });
    return { status: "updated", signupId };
  });
}

export interface SignedUpGame {
  sessionId: string;
  communityName: string;
  communitySlug: string;
  scenarioCode: string;
  scenarioTitle: string;
  startsAt: Date;
  displayTimeZone: string;
  sessionStatus: "published" | "completed" | "cancelled";
  participationRole: "gm" | "player";
  signupStatus: "confirmed" | "waitlisted" | null;
  waitlistPosition: number | null;
  characterName?: string | null;
  paizoReportedAt?: Date | null;
}

export interface UnreportedGmGame {
  sessionId: string;
  communityName: string;
  communitySlug: string;
  scenarioCode: string;
  scenarioTitle: string;
  startsAt: Date;
  endsAt: Date;
  displayTimeZone: string;
}

/** Published games assigned to this GM whose scheduled end has passed without completion. */
export async function listUnreportedGmGames(personId: string, now: Date = new Date(), database: Database = getDb()): Promise<UnreportedGmGame[]> {
  return database.select({ sessionId: sessions.id, communityName: communities.name, communitySlug: communities.slug, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, endsAt: sessions.endsAt, displayTimeZone: sessions.displayTimeZone })
    .from(sessions).innerJoin(communities, eq(communities.id, sessions.communityId)).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .where(and(eq(sessions.gmPersonId, personId), eq(sessions.status, "published"), lt(sessions.endsAt, now), eq(communities.lifecycleStatus, "active")))
    .orderBy(desc(sessions.endsAt), desc(sessions.id));
}

/** Upcoming games the person can still open, either as the GM or as a signed-up player. */
export async function listUpcomingSignedUpGames(
  personId: string,
  now: Date = new Date(),
  database: Database = getDb(),
): Promise<SignedUpGame[]> {
  const rows = await database.select({
    sessionId: sessions.id,
    gmPersonId: sessions.gmPersonId,
    communityName: communities.name,
    communitySlug: communities.slug,
    scenarioCode: contentItems.code,
    scenarioTitle: contentItems.title,
    startsAt: sessions.startsAt,
    displayTimeZone: sessions.displayTimeZone,
    sessionStatus: sessions.status,
    signupStatus: sessionSignups.status,
    waitlistPosition: sessionSignups.waitlistPosition,
    characterName: characters.name,
    pregenName: sessionSignups.pregenName,
    paizoReportedAt: sessions.paizoReportedAt,
  }).from(sessions)
    .leftJoin(sessionSignups, and(
      eq(sessionSignups.sessionId, sessions.id),
      eq(sessionSignups.personId, personId),
      inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
    ))
    .leftJoin(characters, eq(characters.id, sessionSignups.characterId))
    .innerJoin(communities, eq(communities.id, sessions.communityId))
    .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .leftJoin(communityMemberships, and(
      eq(communityMemberships.communityId, communities.id),
      eq(communityMemberships.personId, personId),
      eq(communityMemberships.status, "active"),
    ))
    .where(and(
      or(eq(sessions.gmPersonId, personId), isNotNull(sessionSignups.id)),
      inArray(sessions.status, ["published", "cancelled"]),
      eq(communities.lifecycleStatus, "active"),
      or(
        isNotNull(communityMemberships.id),
        and(eq(communities.visibility, "public"), eq(communities.scheduleVisibility, "public")),
      ),
      gte(sessions.startsAt, now),
    ))
    .orderBy(asc(sessions.startsAt), asc(sessions.id));

  return rows.flatMap((row): SignedUpGame[] => {
    if (row.sessionStatus !== "published" && row.sessionStatus !== "cancelled") return [];
    if (row.signupStatus !== null && row.signupStatus !== "confirmed" && row.signupStatus !== "waitlisted") return [];
    const { gmPersonId, pregenName, ...game } = row;
    const participationRole = gmPersonId === personId ? "gm" as const : "player" as const;
    return [{
      ...game,
      characterName: pregenName ? `${pregenName} (pregen)` : game.characterName,
      sessionStatus: row.sessionStatus,
      signupStatus: row.signupStatus,
      participationRole,
    }];
  });
}

/** All viewable game history for the person, including completed and overdue GM sessions. */
export async function listAllSignedUpGames(personId: string, database: Database = getDb()): Promise<SignedUpGame[]> {
  const rows = await database.select({ sessionId: sessions.id, gmPersonId: sessions.gmPersonId, communityName: communities.name, communitySlug: communities.slug, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, displayTimeZone: sessions.displayTimeZone, sessionStatus: sessions.status, signupStatus: sessionSignups.status, waitlistPosition: sessionSignups.waitlistPosition, characterName: characters.name, pregenName: sessionSignups.pregenName, paizoReportedAt: sessions.paizoReportedAt })
    .from(sessions).leftJoin(sessionSignups, and(eq(sessionSignups.sessionId, sessions.id), eq(sessionSignups.personId, personId), inArray(sessionSignups.status, ["confirmed", "waitlisted"]))).leftJoin(characters, eq(characters.id, sessionSignups.characterId)).innerJoin(communities, eq(communities.id, sessions.communityId)).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).leftJoin(communityMemberships, and(eq(communityMemberships.communityId, communities.id), eq(communityMemberships.personId, personId), eq(communityMemberships.status, "active")))
    .where(and(or(eq(sessions.gmPersonId, personId), isNotNull(sessionSignups.id)), inArray(sessions.status, ["published", "completed", "cancelled"]), eq(communities.lifecycleStatus, "active"), or(isNotNull(communityMemberships.id), and(eq(communities.visibility, "public"), eq(communities.scheduleVisibility, "public")))))
    .orderBy(desc(sessions.startsAt), desc(sessions.id));
  return rows.flatMap((row): SignedUpGame[] => {
    if (row.sessionStatus !== "published" && row.sessionStatus !== "completed" && row.sessionStatus !== "cancelled") return [];
    if (row.signupStatus !== null && row.signupStatus !== "confirmed" && row.signupStatus !== "waitlisted") return [];
    const { gmPersonId, pregenName, ...game } = row;
    return [{ ...game, characterName: pregenName ? `${pregenName} (pregen)` : game.characterName, sessionStatus: row.sessionStatus, signupStatus: row.signupStatus, participationRole: gmPersonId === personId ? "gm" : "player" }];
  });
}

function effectiveRole(access: { isActiveMember: boolean; roles: ("owner" | "gm")[] }): CommunityRole {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}

function canViewSchedule(access: {
  isActiveMember: boolean;
  roles: ("owner" | "gm")[];
  community: { visibility: string; scheduleVisibility: string };
}) {
  return canPerformCommunityOperation(effectiveRole(access), "schedule.view", {
    visibility: access.community.visibility === "public" ? "public" : "private",
    scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members",
  });
}

export async function signupForSession(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  rawChoice: SessionSignupChoice | string,
  database: Database = getDb(),
): Promise<SessionSignupResult> {
  const choice: SessionSignupChoice = typeof rawChoice === "string" ? { kind: "character", characterId: rawChoice } : rawChoice;
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available" || !canViewSchedule(access)) return { status: "not-found" };

    const [session] = await transaction.select({
      id: sessions.id,
      capacity: sessions.playerCapacity,
      gmPersonId: sessions.gmPersonId,
      gameSystemId: rulesets.gameSystemId,
      minimumLevel: contentItems.minimumLevel,
      maximumLevel: contentItems.maximumLevel,
    })
      .from(sessions)
      .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
      .innerJoin(organizedPlayPrograms, eq(organizedPlayPrograms.id, contentItems.programId))
      .innerJoin(rulesets, eq(rulesets.id, organizedPlayPrograms.rulesetId))
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.communityId, access.community.id),
        eq(sessions.status, "published"),
      )).limit(1).for("update");
    if (!session) return { status: "not-found" };
    if (session.gmPersonId === actor.personId) return { status: "unavailable" };

    const values = await validateChoice(choice, actor.personId, session.gameSystemId, session.minimumLevel, session.maximumLevel, transaction as Database);
    if (!values) return { status: "unavailable" };

    const [existing] = await transaction.select({
      id: sessionSignups.id,
      status: sessionSignups.status,
      waitlistPosition: sessionSignups.waitlistPosition,
      characterId: sessionSignups.characterId,
    }).from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, session.id),
      eq(sessionSignups.personId, actor.personId),
      inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
    )).limit(1).for("update");
    if (existing && (existing.status === "confirmed" || existing.status === "waitlisted")) {
      if (!existing.characterId) {
        await transaction.update(sessionSignups).set({ ...values, updatedAt: new Date() })
          .where(eq(sessionSignups.id, existing.id));
      }
      return {
        status: existing.status,
        signupId: existing.id,
        replayed: true,
        ...(existing.waitlistPosition ? { waitlistPosition: existing.waitlistPosition } : {}),
      };
    }

    const [confirmed] = await transaction.select({ value: count() })
      .from(sessionSignups).where(and(
        eq(sessionSignups.sessionId, session.id),
        eq(sessionSignups.status, "confirmed"),
      ));
    const status = (confirmed?.value ?? 0) < session.capacity
      ? "confirmed" as const
      : "waitlisted" as const;
    let waitlistPosition: number | undefined;
    if (status === "waitlisted") {
      const [last] = await transaction.select({ position: sessionSignups.waitlistPosition })
        .from(sessionSignups).where(and(
          eq(sessionSignups.sessionId, session.id),
          eq(sessionSignups.status, "waitlisted"),
        )).orderBy(desc(sessionSignups.waitlistPosition)).limit(1);
      waitlistPosition = (last?.position ?? 0) + 1;
    }

    const signupId = randomUUID();
    const now = new Date();
    await transaction.insert(sessionSignups).values({
      id: signupId,
      sessionId: session.id,
      personId: actor.personId,
      ...values,
      status,
      waitlistPosition,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(), communityId: access.community.id, actorPersonId: actor.personId,
      eventType: status === "confirmed" ? "session.signup.confirmed" : "session.signup.waitlisted",
      details: { sessionId: session.id, signupId, ...values }, occurredAt: now,
    });
    return { status, signupId, replayed: false, ...(waitlistPosition ? { waitlistPosition } : {}) };
  });
}

export async function cancelOwnSessionSignup(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  database: Database = getDb(),
): Promise<CancelSessionSignupResult> {
  return database.transaction(async (transaction) => {
    const [session] = await transaction.select({ id: sessions.id, communityId: sessions.communityId })
      .from(sessions).innerJoin(communities, eq(communities.id, sessions.communityId)).where(and(
        eq(sessions.id, sessionId), eq(communities.slug, slug), eq(sessions.status, "published"),
        gte(sessions.startsAt, new Date()),
      ))
      .limit(1).for("update");
    if (!session) return { status: "unavailable" };
    const [signup] = await transaction.select({ id: sessionSignups.id, status: sessionSignups.status })
      .from(sessionSignups).where(and(
        eq(sessionSignups.sessionId, session.id),
        eq(sessionSignups.personId, actor.personId),
        inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
      )).limit(1).for("update");
    if (!signup) return { status: "not-found" };

    const now = new Date();
    await transaction.update(sessionSignups).set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(sessionSignups.id, signup.id));
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(), communityId: session.communityId, actorPersonId: actor.personId,
      eventType: "session.signup.cancelled", details: { sessionId: session.id, signupId: signup.id },
      occurredAt: now,
    });

    let promotedSignupId: string | undefined;
    if (signup.status === "confirmed") {
      const [next] = await transaction.select({ id: sessionSignups.id, personId: sessionSignups.personId })
        .from(sessionSignups).where(and(
          eq(sessionSignups.sessionId, session.id), eq(sessionSignups.status, "waitlisted"),
        )).orderBy(asc(sessionSignups.waitlistPosition)).limit(1).for("update");
      if (next) {
        promotedSignupId = next.id;
        await transaction.update(sessionSignups).set({
          status: "confirmed", waitlistPosition: null, updatedAt: now,
        }).where(eq(sessionSignups.id, next.id));
        await transaction.insert(communityAuditEvents).values({
          id: randomUUID(), communityId: session.communityId, actorPersonId: actor.personId,
          eventType: "session.signup.promoted", details: { sessionId: session.id, signupId: next.id },
          occurredAt: now,
        });
      }
    }
    return { status: "cancelled", ...(promotedSignupId ? { promotedSignupId } : {}) };
  });
}
