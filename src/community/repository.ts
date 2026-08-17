import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities, communityMemberships } from "@/db/schema";

export async function findCommunityForActiveMember(
  slug: string,
  personId: string,
  database = getDb(),
) {
  const [community] = await database
    .select({
      id: communities.id,
      name: communities.name,
      slug: communities.slug,
      visibility: communities.visibility,
    })
    .from(communities)
    .innerJoin(
      communityMemberships,
      and(
        eq(communityMemberships.communityId, communities.id),
        eq(communityMemberships.personId, personId),
        eq(communityMemberships.status, "active"),
      ),
    )
    .where(eq(communities.slug, slug))
    .limit(1);

  return community ?? null;
}
