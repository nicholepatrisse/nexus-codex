import Link from "next/link";
import type { AuthenticatedActor } from "@/auth/actor";
import { listUpcomingSignedUpGames, type SignedUpGame } from "@/session/session-signups";

function formatGameTime(game: SignedUpGame) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: game.displayTimeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(game.startsAt);
}

export function SignedUpGamesList({
  games,
  showViewAll = true,
}: {
  games: SignedUpGame[];
  showViewAll?: boolean;
}) {
  return <section aria-labelledby="signed-up-games-heading">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Your schedule</p>
        <h1 id="signed-up-games-heading" className="mt-2 text-3xl font-semibold tracking-tight">Upcoming games</h1>
      </div>
      {showViewAll ? <Link href="/games" className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">View all games</Link> : null}
    </div>
    {games.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
      <p className="font-semibold">No upcoming games</p>
      <p className="mt-2 text-sm text-[var(--muted)]">Games you join will appear here.</p>
    </div> : <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {games.map((game) => {
        const cancelled = game.sessionStatus === "cancelled";
        const signupLabel = game.signupStatus === "waitlisted"
          ? `Waitlisted${game.waitlistPosition ? ` · #${game.waitlistPosition}` : ""}`
          : "Confirmed";
        return <li key={game.sessionId}>
          <Link href={`/communities/${encodeURIComponent(game.communitySlug)}/sessions/${encodeURIComponent(game.sessionId)}`} className={`block h-full rounded-2xl border p-5 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${cancelled ? "border-red-200/20 bg-red-300/[0.04] hover:border-red-200/50" : "border-white/10 bg-white/5 hover:border-[var(--accent)]"}`}>
            <span className="flex items-start justify-between gap-4">
              <span className="font-semibold text-white">{game.scenarioCode} — {game.scenarioTitle}</span>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${cancelled ? "border-red-200/30 bg-red-300/10 text-red-100" : game.signupStatus === "waitlisted" ? "border-amber-200/30 bg-amber-300/10 text-amber-100" : "border-emerald-200/30 bg-emerald-300/10 text-emerald-100"}`}>{cancelled ? "Cancelled" : signupLabel}</span>
            </span>
            <span className="mt-3 block text-sm text-[var(--muted)]">{game.communityName}</span>
            <time dateTime={game.startsAt.toISOString()} className={`mt-1 block text-sm ${cancelled ? "text-red-100 line-through" : "text-[var(--muted)]"}`}>{formatGameTime(game)}</time>
            {cancelled ? <span className="sr-only">This game was cancelled. Your signup was {signupLabel.toLowerCase()}.</span> : null}
          </Link>
        </li>;
      })}
    </ul>}
  </section>;
}

export function SignedUpGamesLoading() {
  return <section aria-labelledby="signed-up-games-loading-heading" aria-busy="true">
    <h1 id="signed-up-games-loading-heading" className="text-3xl font-semibold">Upcoming games</h1>
    <p role="status" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[var(--muted)]">Loading your games…</p>
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
      <p role="alert" className="mt-6 rounded-2xl bg-red-400/10 p-6 text-red-200">Your signed-up games could not be loaded. Please try again.</p>
    </section>;
  }
  return <SignedUpGamesList games={result.games.slice(0, 4)} />;
}
