import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformSessionOperation, type CommunityRole } from "@/authorization/policy";
import { prepareContentItem } from "@/catalog/content-item";
import { fetchPaizoScenarioPage, type PaizoScenarioDetails } from "@/catalog/paizo";
import { normalizeContentCode } from "@/catalog/normalization";
import { getDb } from "@/db/client";
import { communitySupportedPrograms, contentItems } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

export type AddScenarioResult =
  | { status: "ready"; scenario: PaizoScenarioDetails }
  | { status: "existing"; scenario: PaizoScenarioDetails; contentItemId: string }
  | { status: "created"; scenario: PaizoScenarioDetails; contentItemId: string }
  | { status: "forbidden" }
  | { status: "not-found" };

type Database = ReturnType<typeof getDb>;
const SFS2_PROGRAM_ID = SUPPORTED_GAME_SYSTEM.organizedPlayProgramId;

function role(roles: readonly string[]): CommunityRole {
  return roles.includes("owner") ? "owner" : roles.includes("gm") ? "gm" : "member";
}

async function authorizedProgram(actor: AuthenticatedActor, slug: string, database: Database) {
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return { status: "not-found" as const };
  // Catalog writes are reserved for explicit staff grants, not self-service promotion during draft creation.
  if (!canPerformSessionOperation(role(access.roles), "session.create")) return { status: "forbidden" as const };
  const [supported] = await database.select({ programId: communitySupportedPrograms.programId })
    .from(communitySupportedPrograms)
    .where(and(eq(communitySupportedPrograms.communityId, access.community.id), eq(communitySupportedPrograms.programId, SFS2_PROGRAM_ID)))
    .limit(1);
  return supported ? { status: "authorized" as const, programId: supported.programId } : { status: "not-found" as const };
}

async function findExisting(scenario: PaizoScenarioDetails, database: Database) {
  const matches = [
    eq(contentItems.normalizedCode, normalizeContentCode(scenario.code)),
    eq(contentItems.sourceUrl, scenario.sourceUrl),
  ];
  if (scenario.productCode) matches.push(and(eq(contentItems.source, "paizo"), eq(contentItems.productCode, scenario.productCode))!);
  const [existing] = await database.select({ id: contentItems.id }).from(contentItems)
    .where(and(eq(contentItems.programId, SFS2_PROGRAM_ID), or(...matches))).limit(1);
  return existing;
}

export async function previewPaizoScenario(actor: AuthenticatedActor, slug: string, url: string, database = getDb(), fetchPage: typeof fetch = fetch): Promise<AddScenarioResult> {
  const access = await authorizedProgram(actor, slug, database);
  if (access.status !== "authorized") return access;
  const scenario = await fetchPaizoScenarioPage(url, fetchPage);
  const existing = await findExisting(scenario, database);
  return existing ? { status: "existing", scenario, contentItemId: existing.id } : { status: "ready", scenario };
}

export async function addPaizoScenario(actor: AuthenticatedActor, slug: string, url: string, database = getDb(), fetchPage: typeof fetch = fetch): Promise<AddScenarioResult> {
  const access = await authorizedProgram(actor, slug, database);
  if (access.status !== "authorized") return access;
  const scenario = await fetchPaizoScenarioPage(url, fetchPage);
  const existing = await findExisting(scenario, database);
  if (existing) return { status: "existing", scenario, contentItemId: existing.id };
  const prepared = prepareContentItem({ id: randomUUID(), programId: access.programId, code: scenario.code, title: scenario.title, contentType: "scenario", minimumLevel: scenario.minimumLevel, maximumLevel: scenario.maximumLevel });
  const [created] = await database.insert(contentItems).values({ ...prepared, source: "paizo", sourceUrl: scenario.sourceUrl, productCode: scenario.productCode, publicationDate: scenario.publicationDate, description: scenario.description, createdByPersonId: actor.personId, lastVerifiedAt: new Date() }).onConflictDoNothing().returning({ id: contentItems.id });
  if (created) return { status: "created", scenario, contentItemId: created.id };
  const raced = await findExisting(scenario, database);
  if (!raced) throw new Error("The scenario could not be added to the catalog.");
  return { status: "existing", scenario, contentItemId: raced.id };
}
