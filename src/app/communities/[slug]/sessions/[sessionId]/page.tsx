import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { contentItems, people, sessionSignups, sessions } from "@/db/schema";
import { PublishSessionButton } from "./publish-session-button";
import { SessionRoster, type SessionRosterEntry } from "./session-roster";
import { CancelSessionButton } from "./cancel-session-button";

function formatInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(instant);
}

export default async function SessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent(`/communities/${slug}/sessions/${sessionId}`)}`);
  const access = await resolveCommunityAccessBySlug(slug, actor.personId);
  if (access.status !== "available") notFound();
  const [session] = await getDb().select({ id: sessions.id, status: sessions.status, gmPersonId: sessions.gmPersonId, gmName: people.displayName, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, endsAt: sessions.endsAt, displayTimeZone: sessions.displayTimeZone, playerCapacity: sessions.playerCapacity, notes: sessions.notes, locationType: sessions.locationType }).from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(people, eq(people.id, sessions.gmPersonId)).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
  if (!session || !["draft", "published", "cancelled"].includes(session.status)) notFound();
  const isOwner = access.roles.includes("owner");
  const isAssignedGm = access.roles.includes("gm") && session.gmPersonId === actor.personId;
  const role: CommunityRole = isOwner ? "owner" : access.roles.includes("gm") ? "gm" : access.isActiveMember ? "member" : "visitor";
  const canViewSchedule = canPerformCommunityOperation(role, "schedule.view", { visibility: access.community.visibility === "public" ? "public" : "private", scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members" });
  if (session.status === "draft" || session.status === "cancelled" ? !isOwner && !isAssignedGm : !canViewSchedule) notFound();

  let confirmedCount = 0;
  let waitlistedCount = 0;
  let roster: SessionRosterEntry[] | undefined;
  if (session.status === "published" || session.status === "cancelled") {
    const rows = await getDb().select({ id: sessionSignups.id, status: sessionSignups.status, waitlistPosition: sessionSignups.waitlistPosition, personName: people.displayName }).from(sessionSignups).innerJoin(people, eq(people.id, sessionSignups.personId)).where(and(eq(sessionSignups.sessionId, session.id), inArray(sessionSignups.status, ["confirmed", "waitlisted"]))).orderBy(asc(sessionSignups.waitlistPosition), asc(sessionSignups.createdAt));
    confirmedCount = rows.filter(({ status }) => status === "confirmed").length;
    waitlistedCount = rows.filter(({ status }) => status === "waitlisted").length;
    roster = rows.map((row) => ({ id: row.id, personName: row.personName, status: row.status === "confirmed" ? "confirmed" : "waitlisted", ...(row.waitlistPosition ? { waitlistPosition: row.waitlistPosition } : {}) }));
  }

  const canManage = isOwner || isAssignedGm;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-[var(--accent)] hover:underline">← {access.community.name}</Link><section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">{session.status === "draft" ? "Session draft" : session.status === "cancelled" ? "Cancelled session" : "Published session"}</p><h1 className="mt-3 text-3xl font-semibold">{session.scenarioCode} — {session.scenarioTitle}</h1></div>{session.status === "draft" ? <div className="flex flex-wrap items-start gap-3"><Link href={`/communities/${encodeURIComponent(slug)}/sessions/${session.id}/edit`} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold hover:border-[var(--accent)]">Edit draft</Link><PublishSessionButton slug={slug} sessionId={session.id} /><CancelSessionButton slug={slug} sessionId={session.id} /></div> : session.status === "published" && canManage ? <CancelSessionButton slug={slug} sessionId={session.id} /> : null}</div>{session.status === "cancelled" ? <p className="mt-6 rounded-xl bg-red-300/10 p-4 text-red-100">This session has been cancelled and is retained for administration history.</p> : null}<dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="text-sm text-[var(--muted)]">Game Master</dt><dd className="mt-1 font-semibold">{session.gmName}</dd></div><div><dt className="text-sm text-[var(--muted)]">Player capacity</dt><dd className="mt-1 font-semibold">{session.playerCapacity}</dd></div><div><dt className="text-sm text-[var(--muted)]">Starts</dt><dd className="mt-1">{formatInstant(session.startsAt, session.displayTimeZone)}</dd></div><div><dt className="text-sm text-[var(--muted)]">Ends</dt><dd className="mt-1">{formatInstant(session.endsAt, session.displayTimeZone)}</dd></div><div><dt className="text-sm text-[var(--muted)]">Location intent</dt><dd className="mt-1 capitalize">{session.locationType}</dd></div><div><dt className="text-sm text-[var(--muted)]">Display time zone</dt><dd className="mt-1">{session.displayTimeZone}</dd></div></dl>{session.notes ? <div className="mt-8 border-t border-white/10 pt-6"><h2 className="text-sm font-semibold text-[var(--muted)]">Notes</h2><p className="mt-2 whitespace-pre-wrap">{session.notes}</p></div> : null}{session.status === "published" || session.status === "cancelled" ? <SessionRoster capacity={session.playerCapacity} confirmedCount={confirmedCount} waitlistedCount={waitlistedCount} entries={roster} /> : <p className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--muted)]">This draft is private and is not part of the public schedule.</p>}</section></main>;
}
