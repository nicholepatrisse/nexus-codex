import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  communityMemberships,
  communityRoleGrants,
  communitySupportedPrograms,
  contentItems,
  people,
} from "@/db/schema";

export async function loadSessionFormOptions(communityId: string) {
  const database = getDb();
  const [scenarios, gms] = await Promise.all([
    database
      .select({ id: contentItems.id, code: contentItems.code, title: contentItems.title })
      .from(contentItems)
      .innerJoin(
        communitySupportedPrograms,
        and(
          eq(communitySupportedPrograms.communityId, communityId),
          eq(communitySupportedPrograms.programId, contentItems.programId),
        ),
      )
      .where(eq(contentItems.contentType, "scenario"))
      .orderBy(asc(contentItems.normalizedCode)),
    database
      .select({ id: people.id, label: people.displayName })
      .from(communityRoleGrants)
      .innerJoin(people, eq(people.id, communityRoleGrants.personId))
      .innerJoin(
        communityMemberships,
        and(
          eq(communityMemberships.communityId, communityRoleGrants.communityId),
          eq(communityMemberships.personId, communityRoleGrants.personId),
          eq(communityMemberships.status, "active"),
        ),
      )
      .where(and(
        eq(communityRoleGrants.communityId, communityId),
        eq(communityRoleGrants.role, "gm"),
        eq(communityRoleGrants.status, "active"),
        isNull(communityRoleGrants.revokedAt),
      ))
      .orderBy(asc(people.displayName)),
  ]);
  return {
    scenarios: scenarios.map(({ id, code, title }) => ({ id, label: `${code} — ${title}` })),
    gms,
  };
}
