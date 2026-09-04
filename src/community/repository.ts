import { and, asc, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
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

export type GameCreationCommunity = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

type GameCreationAccessRow = GameCreationCommunity & Readonly<{
  gmAdmission: string;
  role: string | null;
  roleStatus: string | null;
  revokedAt: Date | null;
}>;

/** Reduces current membership and grant rows to communities where game creation is allowed. */
export function filterGameCreationCommunities(rows: readonly GameCreationAccessRow[]) {
  const communitiesById = new Map<string, GameCreationAccessRow[]>();
  for (const row of rows) {
    const existing = communitiesById.get(row.id) ?? [];
    existing.push(row);
    communitiesById.set(row.id, existing);
  }

  return [...communitiesById.values()].flatMap((communityRows) => {
    const community = communityRows[0];
    if (!community) return [];
    const hasActiveRole = communityRows.some(({ role, roleStatus, revokedAt }) =>
      (role === "owner" || role === "gm") && roleStatus === "active" && revokedAt === null,
    );
    const hasRevokedGmRole = communityRows.some(({ role, roleStatus }) =>
      role === "gm" && roleStatus === "revoked",
    );
    return hasActiveRole || (community.gmAdmission === "self_service" && !hasRevokedGmRole)
      ? [{ id: community.id, name: community.name, slug: community.slug }]
      : [];
  });
}

export async function listGameCreationCommunitiesForPerson(personId: string, database = getDb()) {
  const rows = await database
    .select({
      id: communities.id,
      name: communities.name,
      slug: communities.slug,
      gmAdmission: communities.gmAdmission,
      role: communityRoleGrants.role,
      roleStatus: communityRoleGrants.status,
      revokedAt: communityRoleGrants.revokedAt,
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
        inArray(communityRoleGrants.role, ["owner", "gm"]),
      ),
    )
    .where(eq(communities.lifecycleStatus, "active"))
    .orderBy(asc(communities.name), asc(communities.slug));

  return filterGameCreationCommunities(rows);
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
