import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { listUpcomingCommunityGames } from "@/session/browse-games";
import { BrowseGamesList, FindMoreCommunitiesLink } from "./browse-games-list";

export default async function BrowseGamesPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?callbackURL=%2Fgames%2Fbrowse");

  const games = await listUpcomingCommunityGames(actor.personId);
  return <main className="page-shell mx-auto min-h-screen max-w-5xl sm:py-10"><section aria-labelledby="browse-games-heading"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Your communities</p><h1 id="browse-games-heading" className="mt-2 text-3xl font-semibold tracking-tight">Upcoming games</h1><p className="mt-3 max-w-2xl text-text-muted">Browse every upcoming game published by communities you belong to.</p></div><FindMoreCommunitiesLink /></div><BrowseGamesList games={games} /></section></main>;
}
