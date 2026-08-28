import Link from "next/link";
import { TabRow, tabClassName } from "@/app/tab-row";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail, type CharacterSession } from "@/character/characters";
import { formatCredits, getOwnedCreditLedger } from "@/character/credit-ledger";
import { CharacterClassIcon } from "@/character/character-class-icon";
import { listChronicles, type ChronicleWithGmCredit } from "@/character/chronicles";
import { CharacterProgress } from "./character-progress";
import { applyChronicleAction } from "./chronicles/actions";
import { ChronicleLifecycleButton } from "./chronicles/lifecycle-button";
import { createCreditAdjustmentAction } from "./credits/actions";
import { CreditAdjustmentForm } from "./credits/adjustment-form";
import { listOwnedInventory } from "@/character/inventory";
import { InventoryCard } from "./inventory/inventory-card";
import { sellInventoryAction } from "./sales/actions";
import { GmCreditBadge } from "@/app/gm-credit-badge";
import { GameCard } from "@/app/game-card";

function SessionList({ sessions, empty }: { sessions: CharacterSession[]; empty: string }) {
  if (!sessions.length) return <p className="mt-3 text-sm text-text-muted">{empty}</p>;
  return <ul className="mt-4 space-y-3">{sessions.map((session) => {
    const needsReporting = session.participationType === "gm_credit" && session.sessionStatus === "published" && session.startsAt < new Date();
    return <li key={session.id}><GameCard href={`/communities/${encodeURIComponent(session.communitySlug)}/sessions/${session.id}`} scenarioCode={session.scenarioCode} scenarioTitle={session.scenarioTitle} startsAt={session.startsAt} displayTimeZone={session.displayTimeZone} status={session.sessionStatus} communityName={session.communityName} relationship={session.participationType === "gm_credit" ? "gm" : session.signupStatus === "waitlisted" ? "waitlisted" : session.signupStatus === "confirmed" ? "registered" : null} warning={needsReporting ? "Chronicles and completion are still required." : null} /></li>;
  })}</ul>;
}

function chronicleNumberOrder(left: ChronicleWithGmCredit, right: ChronicleWithGmCredit) {
  const leftNumber = Number(left.chronicleNumber);
  const rightNumber = Number(right.chronicleNumber);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return (left.chronicleNumber ?? "").localeCompare(right.chronicleNumber ?? "", undefined, { numeric: true });
}

const transactionLabels: Record<string, string> = {
  starting_credits: "Starting credits",
  chronicle_reward: "Chronicle",
  adjustment: "Adjustment",
  purchase: "Purchase",
  sale: "Sale",
};

function ChronicleCard({ chronicle, characterId, isOwner }: { chronicle: ChronicleWithGmCredit; characterId: string; isOwner: boolean }) {
  return <li className="card-standard card-interactive p-5">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0">{chronicle.chronicleNumber ? <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Chronicle {chronicle.chronicleNumber}</p> : null}<div className={`${chronicle.chronicleNumber ? "mt-1" : ""} flex flex-wrap items-center gap-2`}><Link className="font-semibold text-text-primary hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand" href={`/characters/${characterId}/chronicles/${chronicle.id}`}>{chronicle.scenarioNumberSnapshot} — {chronicle.scenarioNameSnapshot}</Link>{chronicle.isGmCredit ? <GmCreditBadge /> : null}</div></div>{isOwner && chronicle.status === "pending" ? <div className="shrink-0"><ChronicleLifecycleButton status="pending" action={applyChronicleAction.bind(null, characterId, chronicle.id)} /></div> : null}</div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${chronicle.playedOn}T00:00:00Z`))} · Level {chronicle.characterLevel} · {chronicle.xp} XP</p>{isOwner && chronicle.status === "pending" && chronicle.provenance === "manual" ? <Link href={`/characters/${characterId}/chronicles/${chronicle.id}/edit`} aria-label={`Edit ${chronicle.scenarioNumberSnapshot} Chronicle`} title="Edit Chronicle" className="inline-flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></Link> : null}</div>
  </li>;
}

const ownerTabs = ["overview", "chronicles", "sessions", "inventory"] as const;
type CharacterTab = (typeof ownerTabs)[number];

function selectedCharacterTab(value: string | string[] | undefined, isOwner: boolean): CharacterTab {
  const requested = Array.isArray(value) ? value[0] : value;
  if (!ownerTabs.includes(requested as CharacterTab)) return "overview";
  if (!isOwner && requested === "inventory") return "overview";
  return requested as CharacterTab;
}

export default async function CharacterPage({ params, searchParams }: { params: Promise<{ characterId: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const { characterId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}`)}`);
  const character = await getCharacterDetail(actor, characterId);
  if (!character) notFound();
  const tab = selectedCharacterTab((await searchParams).tab, character.isOwner);
  const chronicles = await listChronicles(characterId);
  const ledger = character.isOwner ? await getOwnedCreditLedger(actor, characterId) : null;
  const inventory = character.isOwner ? await listOwnedInventory(actor, characterId) : null;
  const appliedChronicles = chronicles.filter(({ status }) => status === "applied").sort(chronicleNumberOrder);
  const unappliedChronicles = chronicles.filter(({ status }) => status === "pending");
  const hasSessions = character.upcomingSessions.length > 0 || character.pastSessions.length > 0;
  return <main className="page-shell mx-auto min-h-screen max-w-3xl">
    <section className="card-standard responsive-card relative sm:rounded-3xl sm:p-10">
      <div className="flex items-start gap-3 sm:gap-5"><div className="min-w-0 flex-1"><p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase sm:text-sm sm:tracking-[0.2em]">{character.isOwner ? "Your character" : "Character · Read only"}</p>
      <h1 className="responsive-title mt-2 break-words font-semibold sm:mt-3">{character.name}</h1>
      {character.isOwner ? <Link href={`/characters/${character.id}/edit`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline sm:mt-4">Edit character</Link> : null}</div>
      <div className="shrink-0"><CharacterClassIcon className={character.className} /></div></div>
      <nav aria-label="Character sections">
        <TabRow className="-mx-1 mt-5 px-1 sm:-mx-2 sm:mt-8 sm:px-2">
          {(character.isOwner ? ownerTabs : ownerTabs.filter((item) => item !== "inventory")).map((item) => <Link key={item} href={item === "overview" ? `/characters/${character.id}` : `/characters/${character.id}?tab=${item}`} aria-current={tab === item ? "page" : undefined} className={tabClassName(tab === item, "capitalize")}>{item}</Link>)}
        </TabRow>
      </nav>
      {tab === "overview" ? <>
      <dl className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5"><div><dt className="text-sm text-text-muted">Society number</dt><dd className="mt-1 font-semibold">{character.societyNumber}</dd></div><CharacterProgress startingLevel={character.startingLevel} currentLevel={character.currentLevel} xp={character.xp} />
        {character.isOwner ? <div><dt className="text-sm text-text-muted">Credit balance</dt><dd className="mt-1 font-semibold">{formatCredits(character.creditsMinor ?? 0)} credits</dd></div> : null}
        {character.className ? <div><dt className="text-sm text-text-muted">Class</dt><dd className="mt-1 font-semibold">{character.className}</dd></div> : null}
        {character.ancestry ? <div><dt className="text-sm text-text-muted">Ancestry</dt><dd className="mt-1 font-semibold">{character.ancestry}</dd></div> : null}
        {character.background ? <div><dt className="text-sm text-text-muted">Background</dt><dd className="mt-1 font-semibold">{character.background}</dd></div> : null}
      </dl>
      {character.backstory || character.notes ? <div className="mt-8 space-y-6 border-t border-border pt-8">
        {character.backstory ? <section><h2 className="text-lg font-semibold">Backstory</h2><p className="mt-2 whitespace-pre-wrap text-text-muted">{character.backstory}</p></section> : null}
        {character.notes ? <section><h2 className="text-lg font-semibold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-text-muted">{character.notes}</p></section> : null}
      </div> : null}
      </> : null}
      {tab === "chronicles" ? <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Chronicles</h2><p className="mt-1 text-sm text-text-muted">Stored reward history; existing values are never recalculated.</p></div>{character.isOwner ? <Link href={`/characters/${character.id}/chronicles/new`} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">Add Chronicle</Link> : null}</div>
        <section className="mt-8"><h3 className="text-lg font-semibold">Unapplied</h3>{unappliedChronicles.length ? <ul className="mt-3 space-y-3">{unappliedChronicles.map((chronicle) => <ChronicleCard key={chronicle.id} chronicle={chronicle} characterId={character.id} isOwner={character.isOwner} />)}</ul> : <p className="mt-3 text-sm text-text-muted">No unapplied Chronicles.</p>}</section>
        <section className="mt-8 border-t border-border pt-8"><h3 className="text-lg font-semibold">Applied</h3>{appliedChronicles.length ? <ol className="mt-3 space-y-3">{appliedChronicles.map((chronicle) => <ChronicleCard key={chronicle.id} chronicle={chronicle} characterId={character.id} isOwner={character.isOwner} />)}</ol> : <p className="mt-3 text-sm text-text-muted">No applied Chronicles.</p>}</section>
      </section> : null}
      {tab === "sessions" ? <section className="mt-8">{!hasSessions ? <div className="rounded-xl border border-dashed border-border-strong p-6 text-center"><h2 className="text-xl font-semibold">No sessions yet</h2><p className="mt-2 text-text-muted">This character has not been used for a game yet.</p></div> : <div className="space-y-10"><section><h2 className="text-2xl font-semibold">Upcoming sessions</h2><SessionList sessions={character.upcomingSessions} empty="No upcoming sessions." /></section><section className="border-t border-border pt-8"><h2 className="text-2xl font-semibold">Past sessions</h2><SessionList sessions={character.pastSessions} empty="No past sessions." /></section></div>}</section> : null}
      {tab === "inventory" && inventory ? <div className="mt-8 space-y-10"><section>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Inventory</h2><p className="mt-1 text-sm text-text-muted">Items currently owned by this character.</p></div><Link className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white" href={`/characters/${character.id}/inventory/new`}>Add item</Link></div>
        {!inventory.length ? <div className="mt-5 rounded-xl border border-dashed border-border-strong p-6 text-center"><h3 className="font-semibold">No inventory yet</h3><p className="mt-1 text-sm text-text-muted">Add this character’s current equipment when you’re ready.</p></div> : <ul className="mt-5 space-y-4">{inventory.map((entry) => <InventoryCard key={entry.id} characterId={character.id} entry={entry} saleAction={sellInventoryAction.bind(null, character.id, entry.id)} />)}</ul>}
      </section>
      {ledger ? <section className="border-t border-border pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Transaction history</h2><p className="mt-1 text-sm text-text-muted">Chronicles, purchases, sales, and adjustments by date · balance {formatCredits(ledger.balanceMinor, ledger.displayScale)} credits</p></div><CreditAdjustmentForm action={createCreditAdjustmentAction.bind(null, character.id)} /></div>
        {ledger.entries.length ? <ol className="mt-5 space-y-3">{ledger.entries.toReversed().map((entry) => <li key={entry.id} className="grid gap-2 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:grid-cols-[8rem_1fr_auto]">
          <time className="text-text-muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.effectiveOn}T00:00:00Z`))}</time><div><p className="font-semibold">{transactionLabels[entry.type] ?? entry.type.replaceAll("_", " ")}</p>{entry.notes ? <p className="text-text-muted">{entry.notes}</p> : null}</div><span className={`font-semibold tabular-nums ${entry.amountMinor > 0 ? "text-success" : entry.amountMinor < 0 ? "text-danger" : "text-text-muted"}`}>{entry.amountMinor > 0 ? "+" : ""}{formatCredits(entry.amountMinor, entry.displayScale)} credits</span>
        </li>)}</ol> : <p className="mt-5 text-sm text-text-muted">No transactions recorded yet.</p>}
      </section> : null}</div> : null}
    </section>
  </main>;
}
