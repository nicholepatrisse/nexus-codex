import Link from "next/link";
import { GameCard } from "@/app/game-card";
import type { CommunityGame } from "@/session/browse-games";

export function BrowseGamesList({ games }: { games: readonly CommunityGame[] }) {
  if (games.length === 0) {
    return <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface p-6"><p className="font-semibold">No upcoming games</p><p className="mt-2 text-sm text-text-muted">Your communities have not published any upcoming games yet.</p></div>;
  }

  return <ul className="mt-8 grid gap-4 sm:grid-cols-2">{games.map((game) => <li key={game.sessionId}><GameCard href={`/communities/${encodeURIComponent(game.communitySlug)}/sessions/${encodeURIComponent(game.sessionId)}`} scenarioCode={game.scenarioCode} scenarioTitle={game.scenarioTitle} startsAt={game.startsAt} displayTimeZone={game.displayTimeZone} status="published" gmName={game.gmName} communityName={game.communityName} capacity={game.playerCapacity} /></li>)}</ul>;
}

export function FindMoreCommunitiesLink() {
  return <Link href="/communities/directory" className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Find new communities</Link>;
}
