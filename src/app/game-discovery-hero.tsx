import Link from "next/link";
import { SparkAccent } from "@/app/accent-primitives";
import type { GameCreationCommunity } from "@/community/repository";

export function GameDiscoveryHero({ eligibleCommunities = [] }: { eligibleCommunities?: readonly GameCreationCommunity[] }) {
  const onlyCommunity = eligibleCommunities.length === 1 ? eligibleCommunities[0] : undefined;
  const scheduleHref = onlyCommunity
    ? `/communities/${encodeURIComponent(onlyCommunity.slug)}/sessions/new`
    : "/games/new";

  return (
    <section aria-labelledby="game-discovery-heading" className="mb-10 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-brand uppercase"><SparkAccent size={14} />Your next table</p>
          <h1 id="game-discovery-heading" className="mt-1.5 text-2xl font-semibold tracking-tight">Find a game to join</h1>
          <p className="mt-1 text-sm text-text-muted">Explore upcoming games across your communities.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/games/browse" className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Browse games</Link>
          {eligibleCommunities.length > 0 ? <Link href={scheduleHref} className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-6 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Schedule a game</Link> : null}
        </div>
      </div>
    </section>
  );
}
