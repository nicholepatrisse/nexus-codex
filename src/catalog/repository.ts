import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contentItems } from "@/db/schema";
import { normalizeContentCode, normalizeContentTitle } from "@/catalog/normalization";

interface LookupContentItemsInput {
  programId: string;
  query: string;
  limit?: number;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function lookupContentItems(
  input: LookupContentItemsInput,
  database = getDb(),
) {
  const query = input.query.trim();
  if (!query) return [];

  const normalizedCode = normalizeContentCode(query);
  const normalizedTitle = normalizeContentTitle(query);
  const titlePattern = `%${escapeLikePattern(normalizedTitle)}%`;
  const titleMatch: SQL = sql`${contentItems.normalizedTitle} ilike ${titlePattern} escape '\\'`;

  return database
    .select({
      id: contentItems.id,
      code: contentItems.code,
      title: contentItems.title,
      contentType: contentItems.contentType,
      minimumLevel: contentItems.minimumLevel,
      maximumLevel: contentItems.maximumLevel,
    })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.programId, input.programId),
        or(eq(contentItems.normalizedCode, normalizedCode), titleMatch),
      ),
    )
    .orderBy(asc(contentItems.normalizedCode))
    .limit(Math.min(Math.max(input.limit ?? 20, 1), 50));
}
