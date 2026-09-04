import type { AuthenticatedActor } from "@/auth/actor";
import { listUnreportedGmGames } from "@/session/session-signups";
import { GmReportingQueueList } from "@/app/gm-reporting-queue";

export async function HomepageFollowups({ actor }: { actor: AuthenticatedActor }) {
  const games = await listUnreportedGmGames(actor.personId);
  return <GmReportingQueueList games={games.slice(0, 2)} />;
}
