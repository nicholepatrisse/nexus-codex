import Link from "next/link";
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
import { deleteInventoryAction } from "./inventory/actions";
import { listOwnedPurchases } from "@/character/purchases";
import { listOwnedSales } from "@/character/sales";
import { sellInventoryAction } from "./sales/actions";
import { SaleForm } from "./sales/sale-form";
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

function ChronicleCard({ chronicle, characterId, isOwner }: { chronicle: ChronicleWithGmCredit; characterId: string; isOwner: boolean }) {
  return <li className="rounded-2xl border border-border bg-surface-raised p-5 transition hover:border-brand">
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
  const purchases = character.isOwner ? await listOwnedPurchases(actor, characterId) : null;
  const sales = character.isOwner ? await listOwnedSales(actor, characterId) : null;
  const appliedChronicles = chronicles.filter(({ status }) => status === "applied").sort(chronicleNumberOrder);
  const unappliedChronicles = chronicles.filter(({ status }) => status === "pending");
  const hasSessions = character.upcomingSessions.length > 0 || character.pastSessions.length > 0;
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <section className="relative rounded-3xl border border-border bg-surface p-8 sm:p-10">
      <div className="pr-20 sm:pr-24"><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{character.isOwner ? "Your character" : "Character · Read only"}</p>
      <h1 className="mt-3 text-4xl font-semibold">{character.name}</h1>
      {character.isOwner ? <Link href={`/characters/${character.id}/edit`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Edit character</Link> : null}</div>
      <div className="absolute top-5 right-5 sm:top-7 sm:right-7"><CharacterClassIcon className={character.className} /></div>
      <nav aria-label="Character sections" className="-mx-2 mt-8 overflow-x-auto border-b border-border px-2">
        <div className="flex min-w-max gap-1">
          {(character.isOwner ? ownerTabs : ownerTabs.filter((item) => item !== "inventory")).map((item) => <Link key={item} href={item === "overview" ? `/characters/${character.id}` : `/characters/${character.id}?tab=${item}`} aria-current={tab === item ? "page" : undefined} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${tab === item ? "border-brand text-brand" : "border-transparent text-text-muted hover:border-border-strong hover:text-text-primary"}`}>{item}</Link>)}
        </div>
      </nav>
      {tab === "overview" ? <>
      <dl className="mt-8 grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-text-muted">Society number</dt><dd className="mt-1 font-semibold">{character.societyNumber}</dd></div><CharacterProgress startingLevel={character.startingLevel} currentLevel={character.currentLevel} xp={character.xp} />
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
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Inventory</h2><p className="mt-1 text-sm text-text-muted">Current ownership · acquisition lots remain separate</p></div><Link className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white" href={`/characters/${character.id}/inventory/new`}>Add item</Link></div>
        {!inventory.length ? <div className="mt-5 rounded-xl border border-dashed border-border-strong p-6 text-center"><h3 className="font-semibold">No inventory yet</h3><p className="mt-1 text-sm text-text-muted">Add this character’s current equipment when you’re ready.</p></div> : <ul className="mt-5 space-y-3">{inventory.map((entry) => <li key={entry.id} className="rounded-xl border border-border bg-surface-raised p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{entry.quantity} × {entry.itemLinkSnapshot ? <a className="text-brand hover:underline" href={entry.itemLinkSnapshot} target="_blank" rel="noreferrer">{entry.itemNameSnapshot}</a> : entry.itemNameSnapshot}</h3><p className="mt-1 text-sm text-text-muted">{entry.acquisitionType.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.acquiredOn}T00:00:00Z`))}{entry.bulkSnapshot ? ` · Bulk ${entry.bulkSnapshot} each` : ""}{entry.amountPaidMinor == null ? "" : ` · ${formatCredits(entry.amountPaidMinor)} credits paid`}</p>{entry.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{entry.notes}</p> : null}</div><div className="flex items-center gap-2"><Link className="text-sm font-semibold text-brand hover:underline" href={`/characters/${character.id}/inventory/${entry.id}/edit`}>Edit</Link><form action={deleteInventoryAction.bind(null, character.id, entry.id)}><button className="text-sm font-semibold text-danger hover:underline" type="submit">Remove</button></form></div></div>{entry.amountPaidMinor != null ? <SaleForm available={entry.quantity} action={sellInventoryAction.bind(null, character.id, entry.id)} /> : null}</li>)}</ul>}
      </section>
      <section className="border-t border-border pt-8"><h2 className="text-2xl font-semibold">Purchase history</h2><p className="mt-1 text-sm text-text-muted">Permanent acquisition records remain after inventory removal.</p>{purchases?.length ? <ol className="mt-5 space-y-3">{purchases.map((purchase) => <li key={purchase.id} className="rounded-xl border border-border bg-surface-raised p-4"><p className="font-semibold">{purchase.quantity} × {purchase.itemLinkSnapshot ? <a className="text-brand hover:underline" href={purchase.itemLinkSnapshot} target="_blank" rel="noreferrer">{purchase.itemNameSnapshot}</a> : purchase.itemNameSnapshot}</p><p className="mt-1 text-sm text-text-muted">Purchased {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${purchase.acquiredOn}T00:00:00Z`))} · {formatCredits(purchase.unitPriceMinor)} each · {formatCredits(purchase.totalPriceMinor)} total</p></li>)}</ol> : <p className="mt-4 text-sm text-text-muted">No purchases recorded yet.</p>}</section>
      <section className="border-t border-border pt-8"><h2 className="text-2xl font-semibold">Sale history</h2><p className="mt-1 text-sm text-text-muted">Permanent disposition records retain the original acquisition price and lot.</p>{sales?.length ? <ol className="mt-5 space-y-3">{sales.map((sale) => <li key={sale.id} className="rounded-xl border border-border bg-surface-raised p-4"><p className="font-semibold">{sale.quantity} × {sale.itemLinkSnapshot ? <a className="text-brand hover:underline" href={sale.itemLinkSnapshot} target="_blank" rel="noreferrer">{sale.itemNameSnapshot}</a> : sale.itemNameSnapshot}</p><p className="mt-1 text-sm text-text-muted">Sold {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${sale.soldOn}T00:00:00Z`))} · paid {formatCredits(sale.originalTotalPaidMinor)} · received {formatCredits(sale.saleAmountMinor)} credits</p></li>)}</ol> : <p className="mt-4 text-sm text-text-muted">No sales recorded yet.</p>}</section>
      {ledger ? <section className="border-t border-border pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Credit ledger</h2><p className="mt-1 text-sm text-text-muted">Owner-only financial history · balance {formatCredits(ledger.balanceMinor, ledger.displayScale)} credits</p></div><CreditAdjustmentForm action={createCreditAdjustmentAction.bind(null, character.id)} /></div>
        <ol className="mt-5 space-y-3">{ledger.entries.map((entry) => <li key={entry.id} className="grid gap-2 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:grid-cols-[8rem_1fr_auto]">
          <time className="text-text-muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${entry.effectiveOn}T00:00:00Z`))}</time><div><p className="font-semibold capitalize">{entry.type.replaceAll("_", " ")}</p><p className="text-text-muted">{entry.source.replaceAll("_", " ")}{entry.notes ? ` · ${entry.notes}` : ""}</p></div><span className="font-semibold tabular-nums">{entry.amountMinor > 0 ? "+" : ""}{formatCredits(entry.amountMinor, entry.displayScale)}</span>
        </li>)}</ol>
      </section> : null}</div> : null}
    </section>
  </main>;
}
