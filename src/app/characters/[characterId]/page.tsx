import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail, type CharacterSession } from "@/character/characters";
import { formatCredits, getOwnedCreditLedger } from "@/character/credit-ledger";
import { CharacterClassIcon } from "@/character/character-class-icon";
import { listChronicles } from "@/character/chronicles";
import { CharacterProgress } from "./character-progress";
import { applyChronicleAction, deleteChronicleAction, unapplyChronicleAction } from "./chronicles/actions";
import { DeleteChronicleButton } from "./chronicles/delete-chronicle-button";
import { ChronicleLifecycleButton } from "./chronicles/lifecycle-button";
import { createCreditAdjustmentAction } from "./credits/actions";
import { CreditAdjustmentForm } from "./credits/adjustment-form";
import { listOwnedInventory } from "@/character/inventory";
import { deleteInventoryAction } from "./inventory/actions";

function formatSessionDate(session: CharacterSession) {
  return new Intl.DateTimeFormat("en-US", { timeZone: session.displayTimeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(session.startsAt);
}

function SessionList({ sessions, empty }: { sessions: CharacterSession[]; empty: string }) {
  if (!sessions.length) return <p className="mt-3 text-sm text-text-muted">{empty}</p>;
  return <ul className="mt-4 space-y-3">{sessions.map((session) => <li key={session.id} className="rounded-xl border border-border bg-surface p-4">
    <Link className="font-semibold hover:text-brand hover:underline" href={`/communities/${encodeURIComponent(session.communitySlug)}/sessions/${session.id}`}>{session.scenarioCode} — {session.scenarioTitle}</Link>
    <p className="mt-1 text-sm text-text-muted">{session.communityName} · {formatSessionDate(session)}</p>
    <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${session.participationType === "gm_credit" ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted"}`}>{session.participationType === "gm_credit" ? "GM Credit" : `Player participation · ${session.signupStatus}`}{session.sessionStatus === "cancelled" ? " · Cancelled session" : ""}</p>
  </li>)}</ul>;
}

export default async function CharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}`)}`);
  const character = await getCharacterDetail(actor, characterId);
  if (!character) notFound();
  const chronicles = await listChronicles(characterId);
  const ledger = character.isOwner ? await getOwnedCreditLedger(actor, characterId) : null;
  const inventory = character.isOwner ? await listOwnedInventory(actor, characterId) : null;
  const hasSessions = character.upcomingSessions.length > 0 || character.pastSessions.length > 0;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <Link href={character.isOwner ? "/characters" : "/games"} className="text-sm text-brand hover:underline">← {character.isOwner ? "Your characters" : "Games"}</Link>
    <section className="relative mt-8 rounded-3xl border border-border bg-surface p-8 sm:p-10">
      <div className="pr-20 sm:pr-24"><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{character.isOwner ? "Your character" : "Character · Read only"}</p>
      <h1 className="mt-3 text-4xl font-semibold">{character.name}</h1>
      {character.isOwner ? <Link href={`/characters/${character.id}/edit`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Edit character</Link> : null}</div>
      <div className="absolute top-5 right-5 sm:top-7 sm:right-7"><CharacterClassIcon className={character.className} /></div>
      <dl className="mt-8 grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-text-muted">Society number</dt><dd className="mt-1 font-semibold">{character.societyNumber}</dd></div><CharacterProgress startingLevel={character.startingLevel} currentLevel={character.currentLevel} xp={character.xp} />
        <div><dt className="text-sm text-text-muted">Applied rewards</dt><dd className="mt-1 font-semibold">{character.isOwner ? `${formatCredits(character.creditsMinor ?? 0)} credits · ` : ""}{character.reputation} reputation · {character.downtime} downtime</dd></div>
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
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{chronicle.scenarioNumberSnapshot} — {chronicle.scenarioNameSnapshot}</h3><p className="mt-1 text-sm text-text-muted">Played {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${chronicle.playedOn}T00:00:00Z`))} · Level {chronicle.characterLevel} · {chronicle.advancementSpeed} advancement</p></div><div className="flex gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${chronicle.status === "applied" ? "border-brand text-brand" : "border-border text-text-muted"}`}>{chronicle.status}</span><span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{chronicle.provenance === "manual" ? "Manual entry" : "Nexus session"}</span></div></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-text-muted">XP</dt><dd className="font-semibold">{chronicle.xp}</dd></div>{character.isOwner ? <div><dt className="text-text-muted">Credits</dt><dd className="font-semibold">{formatCredits(chronicle.creditsMinor)}</dd></div> : null}<div><dt className="text-text-muted">Reputation</dt><dd className="font-semibold">{chronicle.reputation}</dd></div><div><dt className="text-text-muted">Downtime</dt><dd className="font-semibold">{chronicle.downtime}</dd></div></dl>
          {chronicle.playerNotes ? <div className="mt-4"><p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Player notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{chronicle.playerNotes}</p></div> : null}
          {chronicle.gmNotes ? <div className="mt-4 rounded-lg border border-info/30 bg-info/10 p-3"><p className="text-xs font-semibold tracking-wide text-info uppercase">GM notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{chronicle.gmNotes}</p></div> : null}
          {character.isOwner && chronicle.provenance === "manual" ? <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3"><Link href={`/characters/${character.id}/chronicles/${chronicle.id}/edit`} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Edit Chronicle</Link>{chronicle.status === "pending" ? <DeleteChronicleButton scenario={`${chronicle.scenarioNumberSnapshot} — ${chronicle.scenarioNameSnapshot}`} action={deleteChronicleAction.bind(null, character.id, chronicle.id)} /> : null}<div className="ml-auto"><ChronicleLifecycleButton status={chronicle.status as "pending" | "applied"} action={(chronicle.status === "pending" ? applyChronicleAction : unapplyChronicleAction).bind(null, character.id, chronicle.id)} /></div></div> : null}
        </li>)}</ul>}
      </section>
      {inventory ? <section className="mt-10 border-t border-border pt-8">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Inventory</h2><p className="mt-1 text-sm text-text-muted">Current ownership · acquisition lots remain separate</p></div><Link className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white" href={`/characters/${character.id}/inventory/new`}>Add item</Link></div>
        {!inventory.length ? <div className="mt-5 rounded-xl border border-dashed border-border-strong p-6 text-center"><h3 className="font-semibold">No inventory yet</h3><p className="mt-1 text-sm text-text-muted">Add this character’s current equipment when you’re ready.</p></div> : <ul className="mt-5 space-y-3">{inventory.map((entry) => <li key={entry.id} className="rounded-xl border border-border bg-surface-raised p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{entry.quantity} × {entry.itemLinkSnapshot ? <a className="text-brand hover:underline" href={entry.itemLinkSnapshot} target="_blank" rel="noreferrer">{entry.itemNameSnapshot}</a> : entry.itemNameSnapshot}</h3><p className="mt-1 text-sm text-text-muted">{entry.acquisitionType.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.acquiredOn}T00:00:00Z`))}{entry.amountPaidMinor == null ? "" : ` · ${formatCredits(entry.amountPaidMinor)} credits paid`}</p>{entry.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{entry.notes}</p> : null}</div><div className="flex items-center gap-2"><Link className="text-sm font-semibold text-brand hover:underline" href={`/characters/${character.id}/inventory/${entry.id}/edit`}>Edit</Link><form action={deleteInventoryAction.bind(null, character.id, entry.id)}><button className="text-sm font-semibold text-danger hover:underline" type="submit">Remove</button></form></div></div></li>)}</ul>}
      </section> : null}
      {ledger ? <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-2xl font-semibold">Credit ledger</h2><p className="mt-1 text-sm text-text-muted">Owner-only financial history · balance {formatCredits(ledger.balanceMinor, ledger.displayScale)} credits</p>
        <CreditAdjustmentForm action={createCreditAdjustmentAction.bind(null, character.id)} />
        <ol className="mt-5 space-y-3">{ledger.entries.map((entry) => <li key={entry.id} className="grid gap-2 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:grid-cols-[8rem_1fr_auto]">
          <time className="text-text-muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.effectiveOn}T00:00:00Z`))}</time><div><p className="font-semibold capitalize">{entry.type.replaceAll("_", " ")}</p><p className="text-text-muted">{entry.source.replaceAll("_", " ")}{entry.notes ? ` · ${entry.notes}` : ""}</p></div><span className="font-semibold tabular-nums">{entry.amountMinor > 0 ? "+" : ""}{formatCredits(entry.amountMinor, entry.displayScale)}</span>
        </li>)}</ol>
      </section> : null}
      {!hasSessions ? <div className="mt-10 rounded-xl border border-dashed border-border-strong p-6 text-center"><h2 className="text-xl font-semibold">No sessions yet</h2><p className="mt-2 text-text-muted">This character has not been used for a game yet.</p></div> : <div className="mt-10 space-y-10"><section><h2 className="text-2xl font-semibold">Upcoming sessions</h2><SessionList sessions={character.upcomingSessions} empty="No upcoming sessions." /></section><section><h2 className="text-2xl font-semibold">Past sessions</h2><SessionList sessions={character.pastSessions} empty="No past sessions." /></section></div>}
    </section>
  </main>;
}
