import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { SignedUpGamesList } from "@/app/signed-up-games";
import { listUpcomingSignedUpGames } from "@/session/session-signups";

export default async function GamesPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?callbackURL=%2Fgames");

  const games = await listUpcomingSignedUpGames(actor.personId);
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
    <SignedUpGamesList games={games} showViewAll={false} />
  </main>;
}
