import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import {
  communities,
  communityMemberships,
  communityRoleGrants,
  communitySupportedPrograms,
} from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

const MAX_SLUG_LENGTH = 80;
const SPACE_ADJECTIVES = ["astral", "celestial", "cosmic", "galactic", "interstellar", "lunar", "nebular", "orbital", "quantum", "radiant", "sidereal", "solar", "spectral", "starbound", "stellar", "voidborne"] as const;

export const createCommunityInputSchema = z.object({
  name: z.string().trim().min(1, "Community name is required.").max(120),
  requestedSlug: z.string().trim().min(1).max(MAX_SLUG_LENGTH).optional(),
  eventCode: z.string().trim().min(1).max(100, "Event number must be 100 characters or fewer.").optional(),
});

export interface CreatedCommunity {
  id: string;
  name: string;
  slug: string;
}

type CommunityCreator = Pick<AuthenticatedActor, "personId">;
type Database = ReturnType<typeof getDb>;

export class CommunityCreationError extends Error {
  constructor(options?: ErrorOptions) {
    super("The community could not be created.", options);
    this.name = "CommunityCreationError";
  }
}

export function normalizeCommunitySlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function communitySlugCandidate(base: string, collisionIndex: number): string {
  if (collisionIndex === 0) return base;
  let value = collisionIndex - 1;
  const words: string[] = [];
  do {
    words.unshift(SPACE_ADJECTIVES[value % SPACE_ADJECTIVES.length]!);
    value = Math.floor(value / SPACE_ADJECTIVES.length) - 1;
  } while (value >= 0);
  const ending = `-${words.join("-")}`;
  return `${base.slice(0, MAX_SLUG_LENGTH - ending.length).replace(/-+$/g, "")}${ending}`;
}

async function allocateSlug(
  base: string,
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
): Promise<string> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${base}, 0))`);

  for (let collisionIndex = 0; collisionIndex < 10_000; collisionIndex += 1) {
    const candidate = communitySlugCandidate(base, collisionIndex);
    const [occupied] = await transaction
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.slug, candidate))
      .limit(1);
    if (!occupied) return candidate;
  }

  throw new CommunityCreationError();
}

export async function createCommunity(
  actor: CommunityCreator,
  input: z.input<typeof createCommunityInputSchema>,
  database: Database = getDb(),
): Promise<CreatedCommunity> {
  const parsed = createCommunityInputSchema.parse(input);
  const slugBase = normalizeCommunitySlug(parsed.requestedSlug ?? parsed.name);
  if (!slugBase) {
    throw new z.ZodError([
      {
        code: "custom",
        path: [parsed.requestedSlug === undefined ? "name" : "requestedSlug"],
        message: "Enter a name that can be used in a web address.",
      },
    ]);
  }

  try {
    return await database.transaction(async (transaction) => {
      const slug = await allocateSlug(slugBase, transaction);
      const communityId = randomUUID();

      const [community] = await transaction
        .insert(communities)
        .values({ id: communityId, name: parsed.name, slug, eventName: parsed.name, eventCode: parsed.eventCode ?? null })
        .returning({ id: communities.id, name: communities.name, slug: communities.slug });
      if (!community) throw new CommunityCreationError();

      await transaction.insert(communityMemberships).values({
        id: randomUUID(),
        communityId,
        personId: actor.personId,
        status: "active",
      });
      await transaction.insert(communityRoleGrants).values({
        id: randomUUID(),
        communityId,
        personId: actor.personId,
        role: "owner",
        grantedByPersonId: actor.personId,
      });
      await transaction.insert(communitySupportedPrograms).values({
        id: randomUUID(),
        communityId,
        programId: SUPPORTED_GAME_SYSTEM.organizedPlayProgramId,
      });

      return community;
    });
  } catch (error) {
    if (error instanceof CommunityCreationError) throw error;
    throw new CommunityCreationError({ cause: error });
  }
}
