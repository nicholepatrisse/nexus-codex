import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities, communityMemberships, communityRoleGrants } from "@/db/schema";

export async function listCommunitiesForActiveMember(personId: string, database = getDb()) {
  return database
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
    .where(eq(communities.lifecycleStatus, "active"))
    .orderBy(asc(communities.name), asc(communities.slug));
}

export async function listHomepageCommunitiesForPerson(personId: string, database = getDb()) {
  return database
    .select({
      id: communities.id,
      name: communities.name,
      slug: communities.slug,
      visibility: communities.visibility,
      lifecycleStatus: communities.lifecycleStatus,
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
    .leftJoin(
      communityRoleGrants,
      and(
        eq(communityRoleGrants.communityId, communities.id),
        eq(communityRoleGrants.personId, personId),
        eq(communityRoleGrants.role, "owner"),
        isNull(communityRoleGrants.revokedAt),
      ),
    )
    .where(
      or(
        eq(communities.lifecycleStatus, "active"),
        and(
          eq(communities.lifecycleStatus, "archived"),
          isNotNull(communityRoleGrants.id),
        ),
      ),
    )
    .orderBy(asc(communities.lifecycleStatus), asc(communities.name), asc(communities.slug));
}
