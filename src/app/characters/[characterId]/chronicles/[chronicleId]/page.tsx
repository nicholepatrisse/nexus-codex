import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { formatCredits } from "@/character/credit-ledger";
import { listChronicles, totalCredits } from "@/character/chronicles";
import { unapplyChronicleAction } from "../actions";
import { ChronicleLifecycleButton } from "../lifecycle-button";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-sm text-text-muted">{label}</dt><dd className="mt-1 font-semibold">{children}</dd></div>;
}

export default async function ChronicleDetailPage({ params }: { params: Promise<{ characterId: string; chronicleId: string }> }) {
  const { characterId, chronicleId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}/chronicles/${chronicleId}`)}`);
  const character = await getCharacterDetail(actor, characterId);
  if (!character) notFound();
  const chronicle = (await listChronicles(characterId)).find(({ id }) => id === chronicleId);
  if (!chronicle) notFound();

  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <Link href={`/characters/${characterId}?tab=chronicles`} className="text-sm font-semibold text-brand hover:underline">← {character.name} Chronicles</Link>
    <article className="mt-8 rounded-3xl border border-border bg-surface p-8 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{chronicle.chronicleNumber ? `Chronicle ${chronicle.chronicleNumber}` : "Unapplied Chronicle"}</p><h1 className="mt-3 text-3xl font-semibold">{chronicle.scenarioNumberSnapshot} — {chronicle.scenarioNameSnapshot}</h1><p className="mt-2 text-text-muted">Played {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${chronicle.playedOn}T00:00:00Z`))}</p></div><div className="flex gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${chronicle.status === "applied" ? "border-brand text-brand" : "border-border text-text-muted"}`}>{chronicle.status}</span><span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{chronicle.provenance === "manual" ? "Manual entry" : "Nexus session"}</span></div></div>
      <dl className="mt-8 grid gap-5 border-t border-border pt-8 sm:grid-cols-2"><Detail label="Character level">{chronicle.characterLevel}</Detail><Detail label="Advancement speed"><span className="capitalize">{chronicle.advancementSpeed}</span></Detail><Detail label="XP">{chronicle.xp}</Detail><Detail label="Downtime">{chronicle.downtimeDays} days · {chronicle.downtimeDisposition.replaceAll("_", " ")}</Detail>{character.isOwner ? <><Detail label="Base credits">{formatCredits(chronicle.baseCreditsMinor)}</Detail><Detail label="Downtime credits">{formatCredits(chronicle.downtimeCreditsMinor)}</Detail><Detail label="Total credits">{formatCredits(totalCredits(chronicle))}</Detail></> : null}</dl>
      {chronicle.partnerCode || chronicle.eventName || chronicle.eventCode || chronicle.gmOrganizedPlayId ? <section className="mt-8 border-t border-border pt-8"><h2 className="text-lg font-semibold">Event details</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2">{chronicle.partnerCode ? <Detail label="Partner code">{chronicle.partnerCode}</Detail> : null}{chronicle.eventName ? <Detail label="Event">{chronicle.eventName}</Detail> : null}{chronicle.eventCode ? <Detail label="Event code">{chronicle.eventCode}</Detail> : null}{chronicle.gmOrganizedPlayId ? <Detail label="GM organized play ID">{chronicle.gmOrganizedPlayId}</Detail> : null}</dl></section> : null}
      {chronicle.playerNotes ? <section className="mt-8 border-t border-border pt-8"><h2 className="text-lg font-semibold">Player notes</h2><p className="mt-2 whitespace-pre-wrap text-text-muted">{chronicle.playerNotes}</p></section> : null}
      {chronicle.gmNotes ? <section className="mt-8 rounded-xl border border-info/30 bg-info/10 p-5"><h2 className="text-sm font-semibold tracking-wide text-info uppercase">GM notes</h2><p className="mt-2 whitespace-pre-wrap">{chronicle.gmNotes}</p></section> : null}
      {character.isOwner && chronicle.provenance === "manual" && chronicle.status === "pending" ? <div className="mt-8 border-t border-border pt-8"><Link href={`/characters/${characterId}/chronicles/${chronicleId}/edit`} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">Edit Chronicle</Link></div> : null}
      {character.isOwner && chronicle.provenance === "manual" && chronicle.status === "applied" ? <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-8"><div><h2 className="font-semibold">Applied rewards</h2><p className="mt-1 text-sm text-text-muted">Removing these rewards will reverse this Chronicle’s XP and credits.</p></div><ChronicleLifecycleButton status="applied" action={unapplyChronicleAction.bind(null, characterId, chronicleId)} /></div> : null}
    </article>
  </main>;
}
