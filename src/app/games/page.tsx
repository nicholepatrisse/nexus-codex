import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { AllGamesList } from "@/app/signed-up-games";
import { listAllSignedUpGames } from "@/session/session-signups";

export default async function GamesPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?callbackURL=%2Fgames");

  const games = await listAllSignedUpGames(actor.personId);
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
    <AllGamesList games={games} />
  </main>;
}
