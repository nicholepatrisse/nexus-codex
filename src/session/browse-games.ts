import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities, communityMemberships, contentItems, people, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export interface CommunityGame {
  sessionId: string;
  communityName: string;
  communitySlug: string;
  scenarioCode: string;
  scenarioTitle: string;
  startsAt: Date;
  displayTimeZone: string;
  gmName: string;
  playerCapacity: number;
}

/** Upcoming published games across every active community membership. */
export async function listUpcomingCommunityGames(
  personId: string,
  now: Date = new Date(),
  database: Database = getDb(),
): Promise<CommunityGame[]> {
  return database
    .select({
      sessionId: sessions.id,
      communityName: communities.name,
      communitySlug: communities.slug,
      scenarioCode: contentItems.code,
      scenarioTitle: contentItems.title,
      startsAt: sessions.startsAt,
      displayTimeZone: sessions.displayTimeZone,
      gmName: people.displayName,
      playerCapacity: sessions.playerCapacity,
    })
    .from(sessions)
    .innerJoin(communities, eq(communities.id, sessions.communityId))
    .innerJoin(
      communityMemberships,
      and(
        eq(communityMemberships.communityId, communities.id),
        eq(communityMemberships.personId, personId),
        eq(communityMemberships.status, "active"),
      ),
    )
    .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
    .innerJoin(people, eq(people.id, sessions.gmPersonId))
    .where(and(
      eq(communities.lifecycleStatus, "active"),
      eq(sessions.status, "published"),
      gte(sessions.startsAt, now),
    ))
    .orderBy(asc(sessions.startsAt), asc(sessions.id));
}
