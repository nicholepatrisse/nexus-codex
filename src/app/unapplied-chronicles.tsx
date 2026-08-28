import type { AuthenticatedActor } from "@/auth/actor";
import { listUnappliedChronicles } from "@/character/chronicles";
import { ChronicleSummaryCard } from "@/app/chronicle-summary-card";

export function UnappliedChroniclesList({ chronicles, singleColumn = false }: { chronicles: Awaited<ReturnType<typeof listUnappliedChronicles>>; singleColumn?: boolean }) {
  if (!chronicles.length) return null;
  return <section className="mt-10" aria-labelledby="unapplied-chronicles-heading">
    <div><p className="text-sm font-semibold tracking-[0.2em] text-warning uppercase">Character follow-up</p><h2 id="unapplied-chronicles-heading" className="mt-2 text-2xl font-semibold tracking-tight">Unapplied Chronicles</h2><p className="mt-2 text-sm text-text-muted">Review these Chronicles and apply their rewards when you’re ready.</p></div>
    <ul className={`mt-5 grid gap-4 ${singleColumn ? "grid-cols-1" : "sm:grid-cols-2"}`}>{chronicles.map((chronicle) => <li key={chronicle.id}><ChronicleSummaryCard href={`/characters/${chronicle.characterId}/chronicles/${chronicle.id}`} scenarioNumber={chronicle.scenarioNumber} scenarioName={chronicle.scenarioName} playedOn={chronicle.playedOn} characterLevel={chronicle.characterLevel} xp={chronicle.xp} status="pending" isGmCredit={chronicle.isGmCredit} characterName={chronicle.characterName} /></li>)}</ul>
  </section>;
}

export function UnappliedChroniclesLoading() {
  return <section className="mt-10" aria-busy="true"><h2 className="text-2xl font-semibold">Unapplied Chronicles</h2><p role="status" className="mt-5 rounded-2xl border border-border bg-surface p-6 text-text-muted">Loading Chronicles…</p></section>;
}

export async function UnappliedChronicles({ actor }: { actor: AuthenticatedActor }) {
  let chronicles: Awaited<ReturnType<typeof listUnappliedChronicles>>;
  try { chronicles = await listUnappliedChronicles(actor.personId); }
  catch { return <section className="mt-10" aria-labelledby="unapplied-chronicles-error"><h2 id="unapplied-chronicles-error" className="text-2xl font-semibold">Unapplied Chronicles</h2><p role="alert" className="mt-5 rounded-2xl bg-danger/10 p-6 text-danger">Your unapplied Chronicles could not be loaded.</p></section>; }
  return <UnappliedChroniclesList chronicles={chronicles.slice(0, 3)} singleColumn />;
}
