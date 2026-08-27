import Link from "next/link";
import type { AuthenticatedActor } from "@/auth/actor";
import { listUpcomingSignedUpGames, type SignedUpGame } from "@/session/session-signups";
import { SessionStatusPill } from "@/app/session-status-pill";

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
    </div> : <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {games.map((game) => {
        const cancelled = game.sessionStatus === "cancelled";
        const completed = game.sessionStatus === "completed";
        const signupLabel = game.signupStatus === "waitlisted"
          ? `Waitlisted${game.waitlistPosition ? ` · #${game.waitlistPosition}` : ""}`
          : "Confirmed";
        return <li key={game.sessionId}>
          <Link href={`/communities/${encodeURIComponent(game.communitySlug)}/sessions/${encodeURIComponent(game.sessionId)}`} className={`block h-full rounded-2xl border p-5 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${cancelled ? "border-danger/30 bg-danger/10 hover:border-danger" : "border-border bg-surface-raised hover:border-brand"}`}>
            <span className="block">
              <span className="block font-semibold text-text-primary">{game.scenarioCode} — {game.scenarioTitle}</span>
              <span className="mt-3 flex flex-wrap gap-2">
                {game.participationRole === "gm" ? <span className="rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-xs font-semibold text-info">GM</span> : null}
                {game.participationRole === "player" && !completed ? <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${game.signupStatus === "waitlisted" ? "border-warning/30 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>{signupLabel}</span> : null}
                {game.participationRole === "player" && game.characterName ? <span className="rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-xs font-semibold text-info">{game.characterName}</span> : null}
                <SessionStatusPill status={game.sessionStatus} startsAt={game.startsAt} paizoReportedAt={game.paizoReportedAt} />
              </span>
            </span>
            <span className="mt-3 block text-sm text-text-muted">{game.communityName}</span>
            <time dateTime={game.startsAt.toISOString()} className={`mt-1 block text-sm ${cancelled ? "text-danger line-through" : "text-text-muted"}`}>{formatGameTime(game)}</time>
            {cancelled ? <span className="sr-only">This game was cancelled. You were participating as {game.participationRole === "gm" ? "the GM" : `a player with a ${signupLabel.toLowerCase()} signup`}.</span> : null}
          </Link>
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
