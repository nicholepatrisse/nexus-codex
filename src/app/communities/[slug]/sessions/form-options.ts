import { and, asc, eq, inArray, isNull } from "drizzle-orm";
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
      .selectDistinct({ id: people.id, displayName: people.displayName, organizedPlayNumber: people.societyPlayNumber })
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
        inArray(communityRoleGrants.role, ["owner", "gm"]),
        eq(communityRoleGrants.status, "active"),
        isNull(communityRoleGrants.revokedAt),
      ))
      .orderBy(asc(people.displayName)),
  ]);
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  const groupedScenarios = new Map<string, typeof scenarios>();
  for (const scenario of scenarios) {
    const seasonNumber = scenario.code.match(/^(\d+)-/)?.[1];
    const season = seasonNumber ? `Season ${Number(seasonNumber)}` : "Other scenarios";
    groupedScenarios.set(season, [...(groupedScenarios.get(season) ?? []), scenario]);
  }

  return {
    scenarioGroups: [...groupedScenarios.entries()]
      .sort(([left], [right]) => left === "Other scenarios" ? 1 : right === "Other scenarios" ? -1 : collator.compare(left, right))
      .map(([label, items]) => ({
        label,
        options: items
          .sort((left, right) => collator.compare(left.code, right.code))
          .map(({ id, code, title }) => ({ id, label: `${code}: ${title}` })),
      })),
    gms: gms
      .filter(({ organizedPlayNumber }) => organizedPlayNumber?.trim())
      .map(({ id, displayName, organizedPlayNumber }) => ({ id, label: `${displayName} · ${organizedPlayNumber}` })),
  };
}
