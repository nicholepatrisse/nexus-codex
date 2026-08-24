import { Suspense } from "react";
import { MyCommunities } from "@/app/my-communities";
import { SignInButton } from "@/app/sign-in/sign-in-button";
import { SignedUpGames, SignedUpGamesLoading } from "@/app/signed-up-games";
import { getAuthenticatedActor } from "@/auth/actor";

export default async function Home() {
  const actor = await getAuthenticatedActor();
  const signedIn = Boolean(actor);

  return (
    <main className={`mx-auto min-h-screen max-w-5xl px-6 ${signedIn ? "py-10" : "py-20"}`}>
      {!signedIn ? <section className="max-w-3xl pt-8 sm:pt-16">
        <p className="mb-5 text-sm font-semibold tracking-[0.24em] text-[var(--accent)] uppercase">
          Society operations, connected
        </p>
        <h1 className="text-5xl leading-tight font-semibold tracking-tight sm:text-7xl">
          Nexus Codex
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
          Schedule games, coordinate characters and tables, and keep every Chronicle and credit
          auditable from play to Society record.
        </p>
        <div className="mt-10">
          <SignInButton label="Get started" />
        </div>
      </section> : null}
      {actor ? <Suspense fallback={<SignedUpGamesLoading />}><SignedUpGames actor={actor} /></Suspense> : null}
      <MyCommunities />
    </main>
  );
}
