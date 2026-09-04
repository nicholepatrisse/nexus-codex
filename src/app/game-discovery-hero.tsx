"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { GameCreationCommunity } from "@/community/repository";

type DiscoveryMode = "find" | "schedule";

export function filterEligibleCommunities(communities: readonly GameCreationCommunity[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized ? communities.filter(({ name }) => name.toLocaleLowerCase().includes(normalized)) : communities;
}

function CompassIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><circle cx="12" cy="12" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9 3.9-1.7Z" /></svg>;
}

function CalendarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><rect x="4" y="5.5" width="16" height="14" rx="2" /><path strokeLinecap="round" d="M8 3.5v4M16 3.5v4M4 10h16" /></svg>;
}

export function GameDiscoveryHero({ eligibleCommunities = [], communityCount = eligibleCommunities.length, initialMode = "find" }: { eligibleCommunities?: readonly GameCreationCommunity[]; communityCount?: number; initialMode?: DiscoveryMode }) {
  const [mode, setMode] = useState<DiscoveryMode>(initialMode);
  const [query, setQuery] = useState("");
  const searchId = useId();
  const filteredCommunities = useMemo(() => {
    return filterEligibleCommunities(eligibleCommunities, query);
  }, [eligibleCommunities, query]);

  return (
    <section aria-labelledby="game-discovery-heading" className="discovery-hero mb-12 overflow-hidden rounded-3xl border border-cyan-300/25 px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-12 lg:min-h-[25rem] lg:px-12 lg:py-14">
      <div aria-hidden="true" className="hero-orbits" />
      <div className={`relative z-10 grid items-center gap-8 ${mode === "schedule" ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:gap-12" : ""}`}>
        <div className="max-w-2xl">
          <p className="flex items-center gap-3 text-sm font-semibold tracking-[0.25em] text-cyan-300 uppercase"><span className="text-xl" aria-hidden="true">✦</span>Your next adventure</p>
          <h1 id="game-discovery-heading" className="mt-5 text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">Find your next table</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">Discover public games, join upcoming sessions, or bring your community together around a new adventure.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/games/browse" className="hero-mode-button hero-mode-button-active"><CompassIcon />Find a game</Link>
            <button id="schedule-game-button" type="button" aria-expanded={mode === "schedule"} aria-controls="game-discovery-panel" onClick={() => setMode(mode === "schedule" ? "find" : "schedule")} className={`hero-mode-button ${mode === "schedule" ? "hero-mode-button-active" : ""}`}><CalendarIcon />Schedule a game</button>
          </div>
        </div>

        {mode === "schedule" ? <div id="game-discovery-panel" aria-labelledby="schedule-game-button" className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-950/45 p-4 backdrop-blur-sm sm:p-5 lg:justify-self-end">
          {mode === "schedule" && eligibleCommunities.length === 1 ? <div><p className="text-sm text-slate-200">Create a game for <strong className="text-white">{eligibleCommunities[0]?.name}</strong>.</p><Link href={`/communities/${encodeURIComponent(eligibleCommunities[0]?.slug ?? "")}/sessions/new`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Continue to scheduling <span aria-hidden="true" className="ml-2">→</span></Link></div> : null}
          {mode === "schedule" && eligibleCommunities.length > 1 ? <div><label htmlFor={searchId} className="text-sm font-semibold text-white">Choose a community</label><input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter communities…" className="mt-3 min-h-11 w-full rounded-xl border border-white/25 bg-slate-950/70 px-4 text-sm text-white placeholder:text-slate-400" /><ul aria-label="Eligible communities" className="mt-3 max-h-40 space-y-2 overflow-auto">{filteredCommunities.map((community) => <li key={community.id}><Link href={`/communities/${encodeURIComponent(community.slug)}/sessions/new`} className="flex min-h-11 items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:border-cyan-300/60 hover:bg-white/10">{community.name}<span aria-hidden="true">→</span></Link></li>)}</ul>{filteredCommunities.length === 0 ? <p role="status" className="mt-3 text-sm text-slate-300">No eligible communities match your search.</p> : null}</div> : null}
          {mode === "schedule" && eligibleCommunities.length === 0 && communityCount > 0 ? <div><p className="text-sm leading-6 text-slate-200">You need Game Master access in one of your communities before scheduling.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/communities" className="inline-flex min-h-11 items-center rounded-full border border-cyan-300/70 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Request GM permissions <span aria-hidden="true" className="ml-2">→</span></Link><Link href="/communities/new" className="inline-flex min-h-11 items-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Create a community</Link></div></div> : null}
          {mode === "schedule" && eligibleCommunities.length === 0 && communityCount === 0 ? <div><p className="text-sm leading-6 text-slate-200">Join a community to schedule games with its players, or start a community of your own.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/communities/directory" className="inline-flex min-h-11 items-center rounded-full border border-cyan-300/70 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Find communities</Link><Link href="/communities/new" className="inline-flex min-h-11 items-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Create a community</Link></div></div> : null}
        </div> : null}
      </div>
    </section>
  );
}
