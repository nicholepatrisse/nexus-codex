import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities, communityMemberships, communityRoleGrants } from "@/db/schema";

export type CommunityRole = "owner" | "gm";

export type CommunityAccessResult =
  | { status: "unavailable" }
  | {
      status: "available";
      community: {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        visibility: string;
        scheduleVisibility: string;
      };
      isActiveMember: boolean;
      roles: CommunityRole[];
    };

/**
 * Resolves community-scoped access from current database state.
 *
 * Private, archived, and unknown communities deliberately share the same result
 * so callers cannot use this boundary to discover private community metadata.
 * Role grants are queried on every call so a revocation takes effect on the next
 * request without waiting for a session or authorization cache to expire.
 */
export async function resolveCommunityAccessBySlug(
  slug: string,
  personId: string | null,
  database = getDb(),
): Promise<CommunityAccessResult> {
  const [community] = await database
    .select({
      id: communities.id,
      name: communities.name,
      slug: communities.slug,
      description: communities.description,
      visibility: communities.visibility,
      scheduleVisibility: communities.scheduleVisibility,
    })
    .from(communities)
    .where(and(eq(communities.slug, slug), eq(communities.lifecycleStatus, "active")))
    .limit(1);

  if (!community) return { status: "unavailable" };

  if (!personId) {
    return community.visibility === "public"
      ? { status: "available", community, isActiveMember: false, roles: [] }
      : { status: "unavailable" };
  }

  const [membership] = await database
    .select({ id: communityMemberships.id })
    .from(communityMemberships)
    .where(
      and(
        eq(communityMemberships.communityId, community.id),
        eq(communityMemberships.personId, personId),
        eq(communityMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) {
    return community.visibility === "public"
      ? { status: "available", community, isActiveMember: false, roles: [] }
      : { status: "unavailable" };
  }

  const grants = await database
    .select({ role: communityRoleGrants.role })
    .from(communityRoleGrants)
    .where(
      and(
        eq(communityRoleGrants.communityId, community.id),
        eq(communityRoleGrants.personId, personId),
        isNull(communityRoleGrants.revokedAt),
      ),
    );

  const roles = grants
    .map(({ role }) => role)
    .filter((role): role is CommunityRole => role === "owner" || role === "gm")
    .sort();

  return { status: "available", community, isActiveMember: true, roles };
}
