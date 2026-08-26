import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { characters, contentItems, people, sessionSignups, sessions } from "@/db/schema";
import { CancelSessionButton } from "./cancel-session-button";
import { PublishSessionButton } from "./publish-session-button";
import { OwnSessionSignup, type OwnSessionSignupDetails } from "./own-session-signup";
import { SessionRoster, type SessionRosterEntry } from "./session-roster";
import { SessionSignupControl } from "../../session-signup-control";
import type { Metadata } from "next";
import { defaultSocialMetadata, socialMetadata } from "@/app/social-metadata";
import { getCharacterProgressions, listCharacters } from "@/character/characters";
import { getOwnGmCredit } from "@/session/gm-credit";
import { GmCreditForm } from "./gm-credit-form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; sessionId: string }> }): Promise<Metadata> {
  const { slug, sessionId } = await params;
  const access = await resolveCommunityAccessBySlug(slug, null).catch(() => ({ status: "unavailable" as const }));
  if (access.status !== "available" || access.community.scheduleVisibility !== "public") return defaultSocialMetadata;
  const [session] = await getDb()
    .select({ code: contentItems.code, title: contentItems.title, startsAt: sessions.startsAt })
    .from(sessions)
    .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id), inArray(sessions.status, ["published", "cancelled"])))
    .limit(1)
    .catch(() => []);
  if (!session) return defaultSocialMetadata;
  const sessionName = `${session.code} — ${session.title}`;
  const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(session.startsAt);
  return socialMetadata({
    title: `${sessionName} | Nexus Codex`,
    description: `${access.community.name} · ${date}`,
    pathname: `/communities/${encodeURIComponent(access.community.slug)}/sessions/${encodeURIComponent(sessionId)}`,
  });
}

function formatInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(instant);
}

export default async function SessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const actor = await getAuthenticatedActor();
  const access = await resolveCommunityAccessBySlug(slug, actor?.personId ?? null);
  if (access.status !== "available") notFound();
  const [session] = await getDb().select({ id: sessions.id, status: sessions.status, gameSystemId: sessions.gameSystemId, gmPersonId: sessions.gmPersonId, gmName: people.displayName, gmDiscordHandle: people.discordHandle, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, endsAt: sessions.endsAt, displayTimeZone: sessions.displayTimeZone, playerCapacity: sessions.playerCapacity, notes: sessions.notes, locationType: sessions.locationType }).from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(people, eq(people.id, sessions.gmPersonId)).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
  if (!session) notFound();
  const isOwner = access.roles.includes("owner");
  const isAssignedGm = Boolean(actor) && session.gmPersonId === actor!.personId;
  const isManager = isOwner || isAssignedGm;
  const role: CommunityRole = isOwner ? "owner" : access.roles.includes("gm") ? "gm" : access.isActiveMember ? "member" : "visitor";
  const canViewSchedule = canPerformCommunityOperation(role, "schedule.view", { visibility: access.community.visibility === "public" ? "public" : "private", scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members" });
  if (session.status === "draft" ? !isManager : !canViewSchedule) notFound();

  let confirmedCount = 0;
  let waitlistedCount = 0;
  let roster: SessionRosterEntry[] | undefined;
  let ownSignup: (OwnSessionSignupDetails & { characterId: string; gameSystemId: string }) | undefined;
  let eligibleCharacters: { id: string; name: string; societyNumber: string; currentLevel: number }[] = [];
  if (session.status !== "draft") {
    const rows = await getDb().select({ id: sessionSignups.id, personId: sessionSignups.personId, status: sessionSignups.status, waitlistPosition: sessionSignups.waitlistPosition, personName: people.displayName, discordHandle: people.discordHandle, societyPlayNumber: people.societyPlayNumber, characterId: characters.id, characterName: characters.name, characterSocietyNumber: characters.societyNumber, characterStartingLevel: characters.startingLevel, gameSystemId: characters.gameSystemId }).from(sessionSignups).innerJoin(people, eq(people.id, sessionSignups.personId)).leftJoin(characters, eq(characters.id, sessionSignups.characterId)).where(and(eq(sessionSignups.sessionId, session.id), inArray(sessionSignups.status, ["confirmed", "waitlisted"]))).orderBy(asc(sessionSignups.waitlistPosition), asc(sessionSignups.createdAt));
    const rosterCharacters = rows.flatMap((row) => row.characterId && row.characterStartingLevel ? [{ id: row.characterId, startingLevel: row.characterStartingLevel }] : []);
    const progressionByCharacter = await getCharacterProgressions(rosterCharacters);
    confirmedCount = rows.filter(({ status }) => status === "confirmed").length;
    waitlistedCount = rows.filter(({ status }) => status === "waitlisted").length;
    const persistedOwnSignup = actor ? rows.find(({ personId }) => personId === actor.personId) : undefined;
    if (persistedOwnSignup?.characterName && persistedOwnSignup.characterId && persistedOwnSignup.gameSystemId) {
      ownSignup = {
        status: persistedOwnSignup.status === "confirmed" ? "confirmed" : "waitlisted",
        characterName: persistedOwnSignup.characterName,
        characterSocietyNumber: persistedOwnSignup.characterSocietyNumber,
        characterLevel: progressionByCharacter.get(persistedOwnSignup.characterId)?.currentLevel,
        waitlistPosition: persistedOwnSignup.waitlistPosition,
        characterId: persistedOwnSignup.characterId,
        gameSystemId: persistedOwnSignup.gameSystemId,
        slug,
        sessionId: session.id,
        canManage: session.status === "published" && session.startsAt > new Date(),
      };
      eligibleCharacters = (await listCharacters(actor!)).filter(({ gameSystemId }) => gameSystemId === persistedOwnSignup.gameSystemId).map(({ id, name, societyNumber, currentLevel }) => ({ id, name, societyNumber, currentLevel }));
      ownSignup.characters = eligibleCharacters;
    }
    roster = isManager ? rows.map((row) => ({ id: row.id, personName: row.personName, characterId: isAssignedGm ? row.characterId : null, discordHandle: row.discordHandle, societyPlayNumber: row.societyPlayNumber, characterName: row.characterName, characterSocietyNumber: row.characterSocietyNumber, characterLevel: row.characterId ? progressionByCharacter.get(row.characterId)?.currentLevel : null, status: row.status === "confirmed" ? "confirmed" : "waitlisted", ...(row.waitlistPosition ? { waitlistPosition: row.waitlistPosition } : {}) })) : undefined;
  }
  const cancelled = session.status === "cancelled";
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (actor && session.status === "published" && session.gmPersonId !== actor.personId && !ownSignup) {
    const sessionCharacters = await listCharacters(actor);
    const [sessionSystem] = await getDb().select({ gameSystemId: sessions.gameSystemId }).from(sessions).where(eq(sessions.id, session.id)).limit(1);
    eligibleCharacters = sessionCharacters.filter(({ gameSystemId }) => gameSystemId === sessionSystem?.gameSystemId).map(({ id, name, societyNumber, currentLevel }) => ({ id, name, societyNumber, currentLevel }));
    return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-brand hover:underline">← {access.community.name}</Link>
      <section className="mt-8 rounded-3xl border border-border bg-surface p-8 sm:p-10">
        <div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Session</p><h1 className="mt-3 text-3xl font-semibold">{session.scenarioCode} — {session.scenarioTitle}</h1></div>
        <section className="mt-8 rounded-2xl border border-border bg-surface p-5" aria-labelledby="signup-heading"><h2 id="signup-heading" className="text-lg font-semibold">Sign up for this game</h2><SessionSignupControl slug={slug} sessionId={session.id} characters={eligibleCharacters} /></section>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="text-sm text-text-muted">Game Master</dt><dd className="mt-1 font-semibold">{session.gmName}</dd></div><div><dt className="text-sm text-text-muted">Player capacity</dt><dd className="mt-1 font-semibold">{session.playerCapacity}</dd></div><div><dt className="text-sm text-text-muted">Your local time</dt><dd className="mt-1">{formatInstant(session.startsAt, browserZone)} – {formatInstant(session.endsAt, browserZone)}</dd></div><div><dt className="text-sm text-text-muted">Location</dt><dd className="mt-1 capitalize">{session.locationType}</dd></div></dl>
        {session.notes ? <div className="mt-8 border-t border-border pt-6"><h2 className="text-sm font-semibold text-text-muted">Notes</h2><p className="mt-2 whitespace-pre-wrap">{session.notes}</p></div> : null}
        <SessionRoster capacity={session.playerCapacity} confirmedCount={confirmedCount} waitlistedCount={waitlistedCount} />
      </section>
    </main>;
  }
  const gmCreditCharacters = isAssignedGm && actor ? (await listCharacters(actor)).filter(({ gameSystemId }) => gameSystemId === session.gameSystemId).map(({ id, name, societyNumber, currentLevel, className }) => ({ id, name, societyNumber, currentLevel, className })) : [];
  const ownGmCredit = isAssignedGm && actor ? await getOwnGmCredit(actor, session.id) : null;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-brand hover:underline">← {access.community.name}</Link><section className="mt-8 rounded-3xl border border-border bg-surface p-8 sm:p-10">{cancelled ? <p role="status" className="mb-6 rounded-xl bg-danger/10 p-4 font-semibold text-danger">This session has been cancelled.</p> : null}<div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{session.status === "draft" ? "Session draft" : "Session"}</p><h1 className="mt-3 text-3xl font-semibold">{session.scenarioCode} — {session.scenarioTitle}</h1></div>{isManager ? <div className="flex flex-wrap gap-3">{!cancelled ? <Link href={`/communities/${encodeURIComponent(slug)}/sessions/${session.id}/edit`} className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold">Edit {session.status === "draft" ? "draft" : "session"}</Link> : null}{session.status === "draft" ? <PublishSessionButton slug={slug} sessionId={session.id} /> : !cancelled ? <CancelSessionButton slug={slug} sessionId={session.id} /> : null}</div> : null}</div>{ownSignup ? <OwnSessionSignup signup={ownSignup} /> : null}{isAssignedGm && session.status !== "draft" ? <GmCreditForm slug={slug} sessionId={session.id} characters={gmCreditCharacters} current={ownGmCredit} /> : null}<dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="text-sm text-text-muted">Game Master</dt><dd className="mt-1 font-semibold">{session.gmName}</dd></div><div><dt className="text-sm text-text-muted">Player capacity</dt><dd className="mt-1 font-semibold">{session.playerCapacity}</dd></div><div><dt className="text-sm text-text-muted">Your local time</dt><dd className="mt-1">{formatInstant(session.startsAt, browserZone)} – {formatInstant(session.endsAt, browserZone)}</dd></div><div><dt className="text-sm text-text-muted">Location</dt><dd className="mt-1 capitalize">{session.locationType}</dd></div></dl>{session.notes ? <div className="mt-8 border-t border-border pt-6"><h2 className="text-sm font-semibold text-text-muted">Notes</h2><p className="mt-2 whitespace-pre-wrap">{session.notes}</p></div> : null}{session.status === "draft" ? <p className="mt-8 rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-muted">This draft is private and is not part of the public schedule.</p> : <><SessionRoster capacity={session.playerCapacity} confirmedCount={confirmedCount} waitlistedCount={waitlistedCount} entries={roster} /><p className="mt-8 text-sm text-text-muted">Share this page’s URL. It remains the session’s permanent address, including after cancellation.</p></>}</section></main>;
}
