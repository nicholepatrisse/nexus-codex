import Link from "next/link";
import type { AuthenticatedActor } from "@/auth/actor";
import { listUnappliedChronicles } from "@/character/chronicles";
import { GmCreditBadge } from "@/app/gm-credit-badge";

function formatPlayedOn(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function UnappliedChroniclesList({ chronicles, singleColumn = false }: { chronicles: Awaited<ReturnType<typeof listUnappliedChronicles>>; singleColumn?: boolean }) {
  if (!chronicles.length) return null;
  return <section className="mt-10" aria-labelledby="unapplied-chronicles-heading">
    <div><p className="text-sm font-semibold tracking-[0.2em] text-warning uppercase">Character follow-up</p><h2 id="unapplied-chronicles-heading" className="mt-2 text-2xl font-semibold tracking-tight">Unapplied Chronicles</h2><p className="mt-2 text-sm text-text-muted">Review these Chronicles and apply their rewards when you’re ready.</p></div>
    <ul className={`mt-5 grid gap-4 ${singleColumn ? "grid-cols-1" : "sm:grid-cols-2"}`}>{chronicles.map((chronicle) => <li key={chronicle.id}><Link href={`/characters/${chronicle.characterId}/chronicles/${chronicle.id}`} className="block h-full rounded-2xl border border-border bg-surface-raised p-5 transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"><span className="flex items-start justify-between gap-4"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-text-primary">{chronicle.scenarioNumber} — {chronicle.scenarioName}</span>{chronicle.isGmCredit ? <GmCreditBadge /> : null}</span><span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Needs review</span></span><span className="mt-3 block text-sm font-semibold text-text-primary">{chronicle.characterName}</span><span className="mt-1 block text-sm text-text-muted">{formatPlayedOn(chronicle.playedOn)} · Level {chronicle.characterLevel} · {chronicle.xp} XP</span></Link></li>)}</ul>
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
