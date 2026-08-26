import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail, type CharacterSession } from "@/character/characters";

function formatSessionDate(session: CharacterSession) {
  return new Intl.DateTimeFormat("en-US", { timeZone: session.displayTimeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(session.startsAt);
}

function SessionList({ sessions, empty }: { sessions: CharacterSession[]; empty: string }) {
  if (!sessions.length) return <p className="mt-3 text-sm text-text-muted">{empty}</p>;
  return <ul className="mt-4 space-y-3">{sessions.map((session) => <li key={session.id} className="rounded-xl border border-border bg-surface p-4">
    <Link className="font-semibold hover:text-brand hover:underline" href={`/communities/${encodeURIComponent(session.communitySlug)}/sessions/${session.id}`}>{session.scenarioCode} — {session.scenarioTitle}</Link>
    <p className="mt-1 text-sm text-text-muted">{session.communityName} · {formatSessionDate(session)}</p>
    <p className="mt-1 text-xs capitalize text-text-muted">Signup: {session.signupStatus}</p>
  </li>)}</ul>;
}

export default async function CharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}`)}`);
  const character = await getCharacterDetail(actor, characterId);
  if (!character) notFound();
  const hasSessions = character.upcomingSessions.length > 0 || character.pastSessions.length > 0;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <Link href={character.isOwner ? "/characters" : "/games"} className="text-sm text-brand hover:underline">← {character.isOwner ? "Your characters" : "Games"}</Link>
    <section className="mt-8 rounded-3xl border border-border bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{character.isOwner ? "Your character" : "Character · Read only"}</p>
      <h1 className="mt-3 text-4xl font-semibold">{character.name}</h1>
      <dl className="mt-8"><div><dt className="text-sm text-text-muted">Society number</dt><dd className="mt-1 font-semibold">{character.societyNumber}</dd></div></dl>
      {!hasSessions ? <div className="mt-10 rounded-xl border border-dashed border-border-strong p-6 text-center"><h2 className="text-xl font-semibold">No sessions yet</h2><p className="mt-2 text-text-muted">This character has not been used for a game yet.</p></div> : <div className="mt-10 space-y-10"><section><h2 className="text-2xl font-semibold">Upcoming sessions</h2><SessionList sessions={character.upcomingSessions} empty="No upcoming sessions." /></section><section><h2 className="text-2xl font-semibold">Past sessions</h2><SessionList sessions={character.pastSessions} empty="No past sessions." /></section></div>}
    </section>
  </main>;
}
