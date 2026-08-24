import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { contentItems, people, sessions } from "@/db/schema";
import { PublishSessionButton } from "./publish-session-button";

function formatInstant(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}

export default async function SessionDraftPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect(`/sign-in?callbackURL=${encodeURIComponent(`/communities/${slug}/sessions/${sessionId}`)}`);
  }
  const access = await resolveCommunityAccessBySlug(slug, actor.personId);
  if (access.status !== "available") notFound();

  const [draft] = await getDb()
    .select({
      id: sessions.id,
      gmPersonId: sessions.gmPersonId,
      gmName: people.displayName,
      scenarioCode: contentItems.code,
      scenarioTitle: contentItems.title,
      startsAt: sessions.startsAt,
      endsAt: sessions.endsAt,
      displayTimeZone: sessions.displayTimeZone,
      playerCapacity: sessions.playerCapacity,
      notes: sessions.notes,
      locationType: sessions.locationType,
    })
    .from(sessions)
    .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .innerJoin(people, eq(people.id, sessions.gmPersonId))
    .where(and(
      eq(sessions.id, sessionId),
      eq(sessions.communityId, access.community.id),
      eq(sessions.status, "draft"),
    ))
    .limit(1);
  const isOwner = access.roles.includes("owner");
  if (!draft || (!isOwner && !(access.roles.includes("gm") && draft.gmPersonId === actor.personId))) {
    notFound();
  }

  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16"><Link href={`/communities/${encodeURIComponent(slug)}`} className="text-sm text-[var(--accent)] hover:underline">← {access.community.name}</Link><section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Session draft</p><h1 className="mt-3 text-3xl font-semibold">{draft.scenarioCode} — {draft.scenarioTitle}</h1></div><div className="flex flex-wrap items-start gap-3"><Link href={`/communities/${encodeURIComponent(slug)}/sessions/${draft.id}/edit`} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold hover:border-[var(--accent)]">Edit draft</Link><PublishSessionButton slug={slug} sessionId={draft.id} /></div></div><dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="text-sm text-[var(--muted)]">Game Master</dt><dd className="mt-1 font-semibold">{draft.gmName}</dd></div><div><dt className="text-sm text-[var(--muted)]">Player capacity</dt><dd className="mt-1 font-semibold">{draft.playerCapacity}</dd></div><div><dt className="text-sm text-[var(--muted)]">Starts</dt><dd className="mt-1">{formatInstant(draft.startsAt, draft.displayTimeZone)}</dd></div><div><dt className="text-sm text-[var(--muted)]">Ends</dt><dd className="mt-1">{formatInstant(draft.endsAt, draft.displayTimeZone)}</dd></div><div><dt className="text-sm text-[var(--muted)]">Location intent</dt><dd className="mt-1 capitalize">{draft.locationType}</dd></div><div><dt className="text-sm text-[var(--muted)]">Display time zone</dt><dd className="mt-1">{draft.displayTimeZone}</dd></div></dl>{draft.notes ? <div className="mt-8 border-t border-white/10 pt-6"><h2 className="text-sm font-semibold text-[var(--muted)]">Notes</h2><p className="mt-2 whitespace-pre-wrap">{draft.notes}</p></div> : null}<p className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--muted)]">This draft is private and is not part of the public schedule.</p></section></main>;
}
