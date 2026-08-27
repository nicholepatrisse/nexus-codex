import Link from "next/link";
import type { AuthenticatedActor } from "@/auth/actor";
import { listUnreportedGmGames, type UnreportedGmGame } from "@/session/session-signups";

function formatTime(game: UnreportedGmGame) {
  return new Intl.DateTimeFormat("en-US", { timeZone: game.displayTimeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(game.startsAt);
}

export function GmReportingQueueList({ games, singleColumn = false }: { games: UnreportedGmGame[]; singleColumn?: boolean }) {
  if (!games.length) return null;
  return <section className="mt-10" aria-labelledby="gm-reporting-heading"><div><p className="text-sm font-semibold tracking-[0.2em] text-warning uppercase">GM follow-up</p><h2 id="gm-reporting-heading" className="mt-2 text-2xl font-semibold tracking-tight">Games awaiting completion</h2><p className="mt-2 text-sm text-text-muted">These games have ended but still need Chronicle reporting and completion.</p></div><ul className={`mt-5 grid gap-4 ${singleColumn ? "grid-cols-1" : "sm:grid-cols-2"}`}>{games.map((game) => <li key={game.sessionId}><Link href={`/communities/${encodeURIComponent(game.communitySlug)}/sessions/${encodeURIComponent(game.sessionId)}`} className="block h-full rounded-2xl border border-warning/30 bg-warning/10 p-5 transition hover:border-warning focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"><span className="flex items-start justify-between gap-4"><span className="font-semibold text-text-primary">{game.scenarioCode} — {game.scenarioTitle}</span><span className="shrink-0 rounded-full border border-warning/30 bg-surface px-2.5 py-1 text-xs font-semibold text-warning">Needs reporting</span></span><span className="mt-3 block text-sm text-text-muted">{game.communityName}</span><time dateTime={game.startsAt.toISOString()} className="mt-1 block text-sm text-text-muted">{formatTime(game)}</time></Link></li>)}</ul></section>;
}

export function GmReportingQueueLoading() {
  return <section className="mt-10" aria-busy="true"><h2 className="text-2xl font-semibold">Games awaiting completion</h2><p role="status" className="mt-5 rounded-2xl border border-border bg-surface p-6 text-text-muted">Loading GM follow-up…</p></section>;
}

export async function GmReportingQueue({ actor }: { actor: AuthenticatedActor }) {
  let games: UnreportedGmGame[];
  try { games = await listUnreportedGmGames(actor.personId); }
  catch { return <section className="mt-10" aria-labelledby="gm-reporting-error"><h2 id="gm-reporting-error" className="text-2xl font-semibold">Games awaiting completion</h2><p role="alert" className="mt-5 rounded-2xl bg-danger/10 p-6 text-danger">Your GM reporting queue could not be loaded.</p></section>; }
  return <GmReportingQueueList games={games.slice(0, 3)} singleColumn />;
}
