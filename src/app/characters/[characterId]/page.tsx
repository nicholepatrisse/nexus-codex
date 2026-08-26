import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail, type CharacterSession } from "@/character/characters";
import { listChronicles } from "@/character/chronicles";
import { CharacterProgress } from "./character-progress";
import { deleteChronicleAction } from "./chronicles/actions";
import { DeleteChronicleButton } from "./chronicles/delete-chronicle-button";

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
  const chronicles = await listChronicles(characterId);
  const hasSessions = character.upcomingSessions.length > 0 || character.pastSessions.length > 0;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <Link href={character.isOwner ? "/characters" : "/games"} className="text-sm text-brand hover:underline">← {character.isOwner ? "Your characters" : "Games"}</Link>
    <section className="mt-8 rounded-3xl border border-border bg-surface p-8 sm:p-10">
      <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{character.isOwner ? "Your character" : "Character · Read only"}</p>
      <h1 className="mt-3 text-4xl font-semibold">{character.name}</h1>
      {character.isOwner ? <Link href={`/characters/${character.id}/edit`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Edit character</Link> : null}
      <dl className="mt-8 grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-text-muted">Society number</dt><dd className="mt-1 font-semibold">{character.societyNumber}</dd></div><CharacterProgress startingLevel={character.startingLevel} currentLevel={character.currentLevel} xp={character.xp} />
        {character.className ? <div><dt className="text-sm text-text-muted">Class</dt><dd className="mt-1 font-semibold">{character.className}</dd></div> : null}
        {character.ancestry ? <div><dt className="text-sm text-text-muted">Ancestry</dt><dd className="mt-1 font-semibold">{character.ancestry}</dd></div> : null}
        {character.background ? <div><dt className="text-sm text-text-muted">Background</dt><dd className="mt-1 font-semibold">{character.background}</dd></div> : null}
      </dl>
      {character.backstory || character.notes ? <div className="mt-8 space-y-6 border-t border-border pt-8">
        {character.backstory ? <section><h2 className="text-lg font-semibold">Backstory</h2><p className="mt-2 whitespace-pre-wrap text-text-muted">{character.backstory}</p></section> : null}
        {character.notes ? <section><h2 className="text-lg font-semibold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-text-muted">{character.notes}</p></section> : null}
      </div> : null}
      <section className="mt-10 border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Chronicles</h2><p className="mt-1 text-sm text-text-muted">Stored reward history; existing values are never recalculated.</p></div>{character.isOwner ? <Link href={`/characters/${character.id}/chronicles/new`} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">Add Chronicle</Link> : null}</div>
        {!chronicles.length ? <p className="mt-4 text-sm text-text-muted">No Chronicles recorded yet.</p> : <ul className="mt-5 space-y-4">{chronicles.map((chronicle) => <li key={chronicle.id} className="rounded-xl border border-border bg-surface-raised p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{chronicle.scenarioNumberSnapshot} — {chronicle.scenarioNameSnapshot}</h3><p className="mt-1 text-sm text-text-muted">Played {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${chronicle.datePlayed}T00:00:00Z`))} · Level {chronicle.characterLevel} · {chronicle.advancementSpeed} advancement</p></div><span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{chronicle.provenance === "manual" ? "Manual entry" : "Nexus session"}</span></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-text-muted">XP</dt><dd className="font-semibold">{chronicle.xp}</dd></div><div><dt className="text-text-muted">Credits</dt><dd className="font-semibold">{chronicle.creditsMinor}</dd></div><div><dt className="text-text-muted">Reputation</dt><dd className="font-semibold">{chronicle.reputation}</dd></div><div><dt className="text-text-muted">Downtime</dt><dd className="font-semibold">{chronicle.downtime}</dd></div></dl>
          {chronicle.playerNotes ? <p className="mt-4 whitespace-pre-wrap text-sm text-text-muted">{chronicle.playerNotes}</p> : null}
          {character.isOwner && chronicle.provenance === "manual" ? <div className="mt-4 flex gap-4 border-t border-border pt-3"><Link href={`/characters/${character.id}/chronicles/${chronicle.id}/edit`} className="text-sm font-semibold text-brand hover:underline">Edit</Link><DeleteChronicleButton scenario={`${chronicle.scenarioNumberSnapshot} — ${chronicle.scenarioNameSnapshot}`} action={deleteChronicleAction.bind(null, character.id, chronicle.id)} /></div> : null}
        </li>)}</ul>}
      </section>
      {!hasSessions ? <div className="mt-10 rounded-xl border border-dashed border-border-strong p-6 text-center"><h2 className="text-xl font-semibold">No sessions yet</h2><p className="mt-2 text-text-muted">This character has not been used for a game yet.</p></div> : <div className="mt-10 space-y-10"><section><h2 className="text-2xl font-semibold">Upcoming sessions</h2><SessionList sessions={character.upcomingSessions} empty="No upcoming sessions." /></section><section><h2 className="text-2xl font-semibold">Past sessions</h2><SessionList sessions={character.pastSessions} empty="No past sessions." /></section></div>}
    </section>
  </main>;
}
