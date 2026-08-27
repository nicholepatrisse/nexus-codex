import type { AuthenticatedActor } from "@/auth/actor";
import { listUnappliedChronicles } from "@/character/chronicles";
import { listUnreportedGmGames } from "@/session/session-signups";
import { GmReportingQueueList } from "@/app/gm-reporting-queue";
import { UnappliedChroniclesList } from "@/app/unapplied-chronicles";

export async function HomepageFollowups({ actor }: { actor: AuthenticatedActor }) {
  const [games, chronicles] = await Promise.all([
    listUnreportedGmGames(actor.personId),
    listUnappliedChronicles(actor.personId),
  ]);
  const bothPopulated = games.length > 0 && chronicles.length > 0;
  const visibleGames = games.slice(0, bothPopulated ? 3 : 2);
  const visibleChronicles = chronicles.slice(0, bothPopulated ? 3 : 2);
  return <div className={bothPopulated ? "grid gap-x-6 sm:grid-cols-2" : undefined}><GmReportingQueueList games={visibleGames} singleColumn={bothPopulated} /><UnappliedChroniclesList chronicles={visibleChronicles} singleColumn={bothPopulated} /></div>;
}
