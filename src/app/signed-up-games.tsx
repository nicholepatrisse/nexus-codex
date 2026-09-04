import Link from "next/link";
import type { AuthenticatedActor } from "@/auth/actor";
import { listUpcomingSignedUpGames, type SignedUpGame } from "@/session/session-signups";
import { GameCard } from "@/app/game-card";

export function SignedUpGamesList({
  games,
  showViewAll = true,
  heading = "Upcoming games",
  headingId = "signed-up-games-heading",
  emptyHeading = "No upcoming games",
  emptyMessage = "Games you join or GM will appear here.",
}: {
  games: SignedUpGame[];
  showViewAll?: boolean;
  heading?: string;
  headingId?: string;
  emptyHeading?: string;
  emptyMessage?: string;
}) {
  return <section aria-labelledby={headingId}>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Your schedule</p>
        <h1 id={headingId} className="mt-2 text-3xl font-semibold tracking-tight">{heading}</h1>
      </div>
      {showViewAll ? <Link href="/games" className="text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">View all games</Link> : null}
    </div>
    {games.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface p-6">
      <p className="font-semibold">{emptyHeading}</p>
      <p className="mt-2 text-sm text-text-muted">{emptyMessage}</p>
    </div> : <ul className="mt-6 grid gap-5 lg:grid-cols-2">
      {games.map((game) => {
        return <li key={game.sessionId}>
          <GameCard href={`/communities/${encodeURIComponent(game.communitySlug)}/sessions/${encodeURIComponent(game.sessionId)}`} scenarioCode={game.scenarioCode} scenarioTitle={game.scenarioTitle} startsAt={game.startsAt} displayTimeZone={game.displayTimeZone} status={game.sessionStatus} paizoReportedAt={game.paizoReportedAt} communityName={game.communityName} relationship={game.participationRole === "gm" ? "gm" : game.signupStatus === "waitlisted" ? "waitlisted" : "registered"} waitlistPosition={game.waitlistPosition} characterName={game.participationRole === "player" ? game.characterName : null} />
        </li>;
      })}
    </ul>}
  </section>;
}

export function AllGamesList({ games, now = new Date() }: { games: SignedUpGame[]; now?: Date }) {
  const upcoming = games.filter((game) => game.sessionStatus === "published" && game.startsAt >= now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = games.filter((game) => game.sessionStatus !== "published" || game.startsAt < now).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return <div className="space-y-12"><SignedUpGamesList games={upcoming} showViewAll={false} /><SignedUpGamesList games={past} showViewAll={false} heading="Past games" headingId="past-games-heading" emptyHeading="No past games" emptyMessage="Completed, cancelled, and previously played games will appear here." /></div>;
}

export function SignedUpGamesLoading() {
  return <section aria-labelledby="signed-up-games-loading-heading" aria-busy="true">
    <h1 id="signed-up-games-loading-heading" className="text-3xl font-semibold">Upcoming games</h1>
    <p role="status" className="mt-6 rounded-2xl border border-border bg-surface p-6 text-text-muted">Loading your games…</p>
  </section>;
}

async function loadSignedUpGames(personId: string) {
  try {
    return { games: await listUpcomingSignedUpGames(personId), error: false as const };
  } catch {
    return { games: [], error: true as const };
  }
}

export async function SignedUpGames({ actor }: { actor: AuthenticatedActor }) {
  const result = await loadSignedUpGames(actor.personId);
  if (result.error) {
    return <section aria-labelledby="signed-up-games-error-heading">
      <h1 id="signed-up-games-error-heading" className="text-3xl font-semibold">Upcoming games</h1>
      <p role="alert" className="mt-6 rounded-2xl bg-danger/10 p-6 text-danger">Your games could not be loaded. Please try again.</p>
    </section>;
  }
  return <SignedUpGamesList games={result.games.slice(0, 2)} />;
}
