import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities } from "@/db/schema";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10_000;
const DEFAULT_AUTOCOMPLETE_LIMIT = 8;
const MAX_AUTOCOMPLETE_LIMIT = 20;

export type PublicCommunitySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type PublicCommunitySearchResult = {
  items: PublicCommunitySummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type PublicCommunityAutocompleteResult = Pick<
  PublicCommunitySummary,
  "name" | "slug"
>;

function normalizeQuery(query: string | undefined): string {
  return query?.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") ?? "";
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), maximum);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function publicCommunityPredicate(query: string): SQL {
  const publicAndActive = and(
    eq(communities.visibility, "public"),
    eq(communities.lifecycleStatus, "active"),
  )!;

  if (!query) return publicAndActive;

  const pattern = `%${escapeLike(query)}%`;
  return and(
    publicAndActive,
    or(ilike(communities.name, pattern), ilike(communities.slug, pattern)),
  )!;
}

export async function searchPublicCommunities(
  input: { query?: string; page?: number; pageSize?: number } = {},
  database = getDb(),
): Promise<PublicCommunitySearchResult> {
  const query = normalizeQuery(input.query);
  const page = boundedInteger(input.page, 1, MAX_PAGE);
  const pageSize = boundedInteger(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const predicate = publicCommunityPredicate(query);

  const [items, [totalRow]] = await Promise.all([
    database
      .select({
        id: communities.id,
        name: communities.name,
        slug: communities.slug,
        description: communities.description,
      })
      .from(communities)
      .where(predicate)
      .orderBy(asc(communities.name), asc(communities.slug), asc(communities.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    database.select({ value: count() }).from(communities).where(predicate),
  ]);

  return { items, total: totalRow?.value ?? 0, page, pageSize };
}

export async function autocompletePublicCommunities(
  input: { query?: string; limit?: number } = {},
  database = getDb(),
): Promise<PublicCommunityAutocompleteResult[]> {
  const query = normalizeQuery(input.query);
  if (!query) return [];

  const limit = boundedInteger(
    input.limit,
    DEFAULT_AUTOCOMPLETE_LIMIT,
    MAX_AUTOCOMPLETE_LIMIT,
  );

  return database
    .select({ name: communities.name, slug: communities.slug })
    .from(communities)
    .where(publicCommunityPredicate(query))
    .orderBy(asc(communities.name), asc(communities.slug), asc(communities.id))
    .limit(limit);
}
