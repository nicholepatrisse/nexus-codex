import Image from "next/image";
import { Suspense } from "react";
import { SignInButton } from "@/app/sign-in/sign-in-button";
import { SignedUpGames, SignedUpGamesLoading } from "@/app/signed-up-games";
import { getAuthenticatedActor } from "@/auth/actor";
import { GmReportingQueueLoading } from "@/app/gm-reporting-queue";
import { HomepageFollowups } from "@/app/homepage-followups";
import { GameDiscoveryHero } from "@/app/game-discovery-hero";
import { listGameCreationCommunitiesForPerson, listHomepageCommunitiesForPerson } from "@/community/repository";

export default async function Home() {
  const actor = await getAuthenticatedActor();
  const signedIn = Boolean(actor);
  const [gameCreationCommunities, homepageCommunities] = actor
    ? await Promise.all([listGameCreationCommunitiesForPerson(actor.personId), listHomepageCommunitiesForPerson(actor.personId)])
    : [[], []];

  return (
    <main className={`mx-auto min-h-screen max-w-7xl px-4 sm:px-6 ${signedIn ? "py-5 sm:py-8" : "grid items-center py-8 sm:py-12"}`}>
      {!signedIn ? <section className="discovery-hero relative isolate overflow-hidden rounded-3xl border border-cyan-300/25 px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <div aria-hidden="true" className="hero-orbits" />
        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-16">
          <div className="max-w-3xl">
          <p className="mb-5 flex items-center gap-3 text-sm font-semibold tracking-[0.24em] text-cyan-300 uppercase"><span className="text-xl" aria-hidden="true">✦</span>Society operations, connected</p>
          <h1 className="relative aspect-[12/5] w-full max-w-[45rem] overflow-hidden">
            <Image
              src="/nexus-codex-wordmark.png"
              alt="Nexus Codex"
              fill
              priority
              sizes="(min-width: 640px) 720px, calc(100vw - 64px)"
              className="object-contain object-left"
            />
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
            Schedule games, coordinate characters and tables, and keep every Chronicle and credit
            auditable from play to Society record.
          </p>
          <div className="mt-10">
            <SignInButton label="Get started" />
          </div>
          </div>
          <aside aria-label="Nexus Codex features" className="grid gap-3">
            {[['Characters', 'Track progression, inventory, and Society-ready validation.'], ['Communities', 'Bring players and Game Masters together around shared tables.'], ['Chronicles', 'Keep rewards, credits, and reporting connected to every game.']].map(([title, description]) => <div key={title} className="rounded-2xl border border-white/15 bg-slate-950/45 p-5 backdrop-blur-sm"><p className="font-semibold text-white">{title}</p><p className="mt-1 text-sm leading-6 text-slate-300">{description}</p></div>)}
          </aside>
        </div>
      </section> : null}
      {actor ? <GameDiscoveryHero eligibleCommunities={gameCreationCommunities} communityCount={homepageCommunities.length} /> : null}
      {actor ? <Suspense fallback={<SignedUpGamesLoading />}><SignedUpGames actor={actor} /></Suspense> : null}
      {actor ? <Suspense fallback={<GmReportingQueueLoading />}><HomepageFollowups actor={actor} /></Suspense> : null}
    </main>
  );
}
