import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  autocompletePublicCommunities,
  searchPublicCommunities,
} from "@/community/public-discovery";
import { getDb } from "@/db/client";
import { communities } from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
const rows = [
  { id: `public-a-${suffix}`, name: "Alpha Lodge", slug: `alpha-lodge-${suffix}`, visibility: "public" },
  { id: `public-b-${suffix}`, name: "Beta Society", slug: `beta-society-${suffix}`, visibility: "public" },
  { id: `public-c-${suffix}`, name: "Gamma Alpha Club", slug: `gamma-alpha-${suffix}`, visibility: "public" },
  { id: `private-${suffix}`, name: "Private Alpha Lodge", slug: `private-alpha-${suffix}`, visibility: "private" },
  { id: `archived-${suffix}`, name: "Archived Alpha Lodge", slug: `archived-alpha-${suffix}`, visibility: "public", lifecycleStatus: "archived" },
] satisfies (typeof communities.$inferInsert)[];
const ids = rows.map(({ id }) => id);

describeWithDatabase("public community discovery", () => {
  beforeAll(async () => {
    await getDb().insert(communities).values(rows);
  });

  afterAll(async () => {
    await getDb().delete(communities).where(inArray(communities.id, ids));
  });

  it("browses only public active communities with deterministic bounded pagination", async () => {
    const first = await searchPublicCommunities({ query: suffix, page: 1, pageSize: 2 });
    const second = await searchPublicCommunities({ query: suffix, page: 2, pageSize: 2 });

    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.items.map(({ name }) => name)).toEqual(["Alpha Lodge", "Beta Society"]);
    expect(second.items.map(({ name }) => name)).toEqual(["Gamma Alpha Club"]);
    expect(first.items.every(({ description }) => description === null)).toBe(true);
  });

  it("treats an empty query as safe public browsing and caps page size", async () => {
    const result = await searchPublicCommunities({ query: "  ", page: 0, pageSize: 500 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.items.some(({ id }) => id === rows[3]!.id || id === rows[4]!.id)).toBe(false);
  });

  it("normalizes name and slug searches without leaking filtered counts", async () => {
    const byName = await searchPublicCommunities({ query: "  ALPHA   LODGE " });
    const bySlug = await searchPublicCommunities({ query: `GAMMA-ALPHA-${suffix}`.toUpperCase() });

    expect(byName.items.map(({ id }) => id)).toEqual([rows[0]!.id]);
    expect(byName.total).toBe(1);
    expect(bySlug.items.map(({ id }) => id)).toEqual([rows[2]!.id]);
    expect(bySlug.total).toBe(1);
  });

  it("returns public-only autocomplete and no suggestions for an empty query", async () => {
    expect(await autocompletePublicCommunities({ query: "" })).toEqual([]);
    const suggestions = await autocompletePublicCommunities({ query: "alpha", limit: 1 });

    expect(suggestions).toEqual([{ name: "Alpha Lodge", slug: rows[0]!.slug }]);
  });

  it("removes a community from results immediately when it becomes private", async () => {
    expect((await searchPublicCommunities({ query: rows[1]!.slug })).total).toBe(1);

    await getDb()
      .update(communities)
      .set({ visibility: "private" })
      .where(inArray(communities.id, [rows[1]!.id]));

    expect(await searchPublicCommunities({ query: rows[1]!.slug })).toMatchObject({
      items: [],
      total: 0,
    });
    expect(await autocompletePublicCommunities({ query: rows[1]!.slug })).toEqual([]);
  });
});
