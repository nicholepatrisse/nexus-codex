import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { contentItems, people, sessions } from "@/db/schema";
import { CancelSessionButton } from "./cancel-session-button";
import { PublishSessionButton } from "./publish-session-button";

function formatInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(instant);
}

export default async function SessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const actor = await getAuthenticatedActor();
  const access = await resolveCommunityAccessBySlug(slug, actor?.personId ?? null);
  if (access.status !== "available") notFound();
  const [session] = await getDb().select({ id: sessions.id, status: sessions.status, gmPersonId: sessions.gmPersonId, gmName: people.displayName, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, endsAt: sessions.endsAt, displayTimeZone: sessions.displayTimeZone, playerCapacity: sessions.playerCapacity, notes: sessions.notes, locationType: sessions.locationType }).from(sessions).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).innerJoin(people, eq(people.id, sessions.gmPersonId)).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
  if (!session) notFound();
  const isManager = Boolean(actor) && (access.roles.includes("owner") || (access.roles.includes("gm") && session.gmPersonId === actor!.personId));
  if (session.status === "draft" && !isManager) notFound();
  if (session.status !== "draft") {
    const role = access.roles.includes("owner") ? "owner" : access.roles.includes("gm") ? "gm" : access.isActiveMember ? "member" : "visitor";
    if (!canPerformCommunityOperation(role, "schedule.view", { visibility: access.community.visibility as "private" | "public", scheduleVisibility: access.community.scheduleVisibility as "members" | "public" })) notFound();
  }
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cancelled = session.status === "cancelled";
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-[var(--accent)] hover:underline">← {access.community.name}</Link><section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-10">{cancelled ? <p role="status" className="mb-6 rounded-xl bg-red-400/10 p-4 font-semibold text-red-200">This session has been cancelled.</p> : null}<div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">{session.status === "draft" ? "Session draft" : "Session"}</p><h1 className="mt-3 text-3xl font-semibold">{session.scenarioCode} — {session.scenarioTitle}</h1></div>{isManager ? <div className="flex flex-wrap gap-3">{!cancelled ? <Link href={`/communities/${encodeURIComponent(slug)}/sessions/${session.id}/edit`} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Edit {session.status === "draft" ? "draft" : "session"}</Link> : null}{session.status === "draft" ? <PublishSessionButton slug={slug} sessionId={session.id} /> : !cancelled ? <CancelSessionButton slug={slug} sessionId={session.id} /> : null}</div> : null}</div><dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="text-sm text-[var(--muted)]">Game Master</dt><dd className="mt-1 font-semibold">{session.gmName}</dd></div><div><dt className="text-sm text-[var(--muted)]">Player capacity</dt><dd className="mt-1 font-semibold">{session.playerCapacity}</dd></div><div><dt className="text-sm text-[var(--muted)]">Your local time</dt><dd className="mt-1">{formatInstant(session.startsAt, browserZone)} – {formatInstant(session.endsAt, browserZone)}</dd></div><div><dt className="text-sm text-[var(--muted)]">Event time ({session.displayTimeZone})</dt><dd className="mt-1">{formatInstant(session.startsAt, session.displayTimeZone)} – {formatInstant(session.endsAt, session.displayTimeZone)}</dd></div><div><dt className="text-sm text-[var(--muted)]">Location</dt><dd className="mt-1 capitalize">{session.locationType}</dd></div></dl>{session.notes ? <div className="mt-8 border-t border-white/10 pt-6"><h2 className="text-sm font-semibold text-[var(--muted)]">Notes</h2><p className="mt-2 whitespace-pre-wrap">{session.notes}</p></div> : null}{session.status === "draft" ? <p className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--muted)]">This draft is private and is not part of the public schedule.</p> : <p className="mt-8 text-sm text-[var(--muted)]">Share this page’s URL. It remains the session’s permanent address, including after cancellation.</p>}</section></main>;
}
