import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { communities, communityMemberships, communityRoleGrants } from "@/db/schema";

const MAX_SLUG_LENGTH = 80;

export const createCommunityInputSchema = z.object({
  name: z.string().trim().min(1, "Community name is required.").max(120),
  requestedSlug: z.string().trim().min(1).max(MAX_SLUG_LENGTH).optional(),
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

function slugWithSuffix(base: string, suffix: number): string {
  if (suffix === 1) return base;
  const ending = `-${suffix}`;
  return `${base.slice(0, MAX_SLUG_LENGTH - ending.length).replace(/-+$/g, "")}${ending}`;
}

async function allocateSlug(
  base: string,
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
): Promise<string> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${base}, 0))`);

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = slugWithSuffix(base, suffix);
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
        .values({ id: communityId, name: parsed.name, slug })
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

      return community;
    });
  } catch (error) {
    if (error instanceof CommunityCreationError) throw error;
    throw new CommunityCreationError({ cause: error });
  }
}
