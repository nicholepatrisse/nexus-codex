import { and, eq, isNull } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { CommunityAccessResult } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { communities, communityMemberships, communityRoleGrants } from "@/db/schema";

async function resolveOwnerSettingsAccess(
  slug: string,
  personId: string | null,
): Promise<CommunityAccessResult> {
  if (!personId) return { status: "unavailable" };

  const database = getDb();
  const [row] = await database
    .select({
      id: communities.id,
      name: communities.name,
      slug: communities.slug,
      visibility: communities.visibility,
      scheduleVisibility: communities.scheduleVisibility,
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
    .innerJoin(
      communityRoleGrants,
      and(
        eq(communityRoleGrants.communityId, communities.id),
        eq(communityRoleGrants.personId, personId),
        eq(communityRoleGrants.role, "owner"),
        isNull(communityRoleGrants.revokedAt),
      ),
    )
    .where(eq(communities.slug, slug))
    .limit(1);

  return row
    ? { status: "available", community: row, isActiveMember: true, roles: ["owner"] }
    : { status: "unavailable" };
}

export function authorizeOwnerSettings(actor: AuthenticatedActor, slug: string) {
  return authorizeCommunityBySlug({
    actor,
    slug,
    operation: "community.policy.manage",
    resolveAccess: resolveOwnerSettingsAccess,
  });
}
