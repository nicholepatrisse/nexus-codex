import type { AuthenticatedActor } from "@/auth/actor";
import { listUnreportedGmGames, type UnreportedGmGame } from "@/session/session-signups";
import { GameCard } from "@/app/game-card";

export function GmReportingQueueList({ games, singleColumn = false }: { games: UnreportedGmGame[]; singleColumn?: boolean }) {
  if (!games.length) return null;
  return <section className="mt-10" aria-labelledby="gm-reporting-heading"><div><p className="text-sm font-semibold tracking-[0.2em] text-warning uppercase">GM follow-up</p><h2 id="gm-reporting-heading" className="mt-2 text-2xl font-semibold tracking-tight">Games awaiting completion</h2><p className="mt-2 text-sm text-text-muted">These games have ended but still need Chronicle reporting and completion.</p></div><ul className={`mt-5 grid gap-4 ${singleColumn ? "grid-cols-1" : "sm:grid-cols-2"}`}>{games.map((game) => <li key={game.sessionId}><GameCard href={`/communities/${encodeURIComponent(game.communitySlug)}/sessions/${encodeURIComponent(game.sessionId)}`} scenarioCode={game.scenarioCode} scenarioTitle={game.scenarioTitle} startsAt={game.startsAt} displayTimeZone={game.displayTimeZone} status="published" communityName={game.communityName} relationship="gm" warning="Chronicles and completion are still required." /></li>)}</ul></section>;
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
