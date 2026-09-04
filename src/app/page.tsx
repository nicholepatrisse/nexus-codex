import Image from "next/image";
import { Suspense } from "react";
import { AccentSurface, OrbitMotif, SparkAccent, accentPosition } from "@/app/accent-primitives";
import { MyCommunities } from "@/app/my-communities";
import { SignInButton } from "@/app/sign-in/sign-in-button";
import { SignedUpGames, SignedUpGamesLoading } from "@/app/signed-up-games";
import { getAuthenticatedActor } from "@/auth/actor";
import { GmReportingQueueLoading } from "@/app/gm-reporting-queue";
import { UnappliedChroniclesLoading } from "@/app/unapplied-chronicles";
import { HomepageFollowups } from "@/app/homepage-followups";
import { GameDiscoveryHero } from "@/app/game-discovery-hero";
import { listGameCreationCommunitiesForPerson } from "@/community/repository";

export default async function Home() {
  const actor = await getAuthenticatedActor();
  const signedIn = Boolean(actor);
  const gameCreationCommunities = actor
    ? await listGameCreationCommunitiesForPerson(actor.personId)
    : [];

  return (
    <main className={`mx-auto min-h-screen max-w-5xl px-6 ${signedIn ? "py-10" : "py-20"}`}>
      {!signedIn ? <AccentSurface
        className="max-w-4xl rounded-[2rem] px-7 py-12 sm:px-12 sm:py-16"
        style={accentPosition("82%", "18%")}
      >
        <OrbitMotif className="pointer-events-none absolute -top-8 -right-16 w-80 opacity-35 sm:w-[28rem]" />
        <section className="relative max-w-3xl">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-[0.24em] text-brand uppercase">
            <SparkAccent className="shrink-0" size={14} />
            Society operations, connected
          </p>
          <h1 className="relative -ml-[8%] aspect-[12/5] w-[108%] max-w-[45rem] overflow-hidden">
            <Image
              src="/nexus-codex-wordmark.png"
              alt="Nexus Codex"
              fill
              priority
              sizes="(min-width: 640px) 720px, calc(100vw - 64px)"
              className="object-cover"
            />
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-text-muted sm:text-xl">
            Schedule games, coordinate characters and tables, and keep every Chronicle and credit
            auditable from play to Society record.
          </p>
          <div className="mt-10">
            <SignInButton label="Get started" />
          </div>
        </section>
      </AccentSurface> : null}
      {actor ? <GameDiscoveryHero eligibleCommunities={gameCreationCommunities} /> : null}
      {actor ? <Suspense fallback={<SignedUpGamesLoading />}><SignedUpGames actor={actor} /></Suspense> : null}
      {actor ? <Suspense fallback={<><GmReportingQueueLoading /><UnappliedChroniclesLoading /></>}><HomepageFollowups actor={actor} /></Suspense> : null}
      <MyCommunities />
    </main>
  );
}
