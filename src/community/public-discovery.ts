import { and, asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities } from "@/db/schema";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10_000;

export type PublicCommunitySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type PublicCommunityListResult = {
  items: PublicCommunitySummary[];
  total: number;
  page: number;
  pageSize: number;
};

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), maximum);
}

export async function listPublicCommunities(
  input: { page?: number; pageSize?: number } = {},
  database = getDb(),
): Promise<PublicCommunityListResult> {
  const page = boundedInteger(input.page, 1, MAX_PAGE);
  const pageSize = boundedInteger(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const predicate = and(
    eq(communities.visibility, "public"),
    eq(communities.lifecycleStatus, "active"),
  );

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
