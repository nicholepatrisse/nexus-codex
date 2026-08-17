import { and, asc, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  communities,
  communityMembershipRequests,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

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

/** Latest admission attempt for each community where the person is not yet an active member. */
export async function listHomepageAdmissionStatusesForPerson(
  personId: string,
  database = getDb(),
) {
  return database
    .selectDistinctOn([communityMembershipRequests.communityId], {
      id: communityMembershipRequests.id,
      communityId: communities.id,
      communityName: communities.name,
      communitySlug: communities.slug,
      communityVisibility: communities.visibility,
      status: communityMembershipRequests.status,
      requestedAt: communityMembershipRequests.requestedAt,
      updatedAt: communityMembershipRequests.updatedAt,
    })
    .from(communityMembershipRequests)
    .innerJoin(communities, eq(communities.id, communityMembershipRequests.communityId))
    .leftJoin(
      communityMemberships,
      and(
        eq(communityMemberships.communityId, communityMembershipRequests.communityId),
        eq(communityMemberships.personId, personId),
        eq(communityMemberships.status, "active"),
      ),
    )
    .where(
      and(
        eq(communityMembershipRequests.personId, personId),
        isNull(communityMemberships.id),
      ),
    )
    .orderBy(
      communityMembershipRequests.communityId,
      desc(communityMembershipRequests.requestedAt),
      desc(communityMembershipRequests.id),
    );
}
