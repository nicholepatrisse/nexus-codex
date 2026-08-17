import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPublicCommunities } from "@/community/public-discovery";
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
    const listed = await listPublicCommunities({ pageSize: 50 });
    const matchingItems = listed.items.filter(({ id }) => ids.includes(id));

    expect(matchingItems.map(({ name }) => name)).toEqual([
      "Alpha Lodge",
      "Beta Society",
      "Gamma Alpha Club",
    ]);
    expect(matchingItems.every(({ description }) => description === null)).toBe(true);
    expect(matchingItems.some(({ id }) => id === rows[3]!.id || id === rows[4]!.id)).toBe(false);
  });

  it("bounds pagination inputs", async () => {
    const result = await listPublicCommunities({ page: 0, pageSize: 500 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.items.some(({ id }) => id === rows[3]!.id || id === rows[4]!.id)).toBe(false);
  });

  it("removes a community from results immediately when it becomes private", async () => {
    expect((await listPublicCommunities({ pageSize: 50 })).items).toContainEqual(
      expect.objectContaining({ id: rows[1]!.id }),
    );

    await getDb()
      .update(communities)
      .set({ visibility: "private" })
      .where(inArray(communities.id, [rows[1]!.id]));

    expect((await listPublicCommunities({ pageSize: 50 })).items).not.toContainEqual(
      expect.objectContaining({ id: rows[1]!.id }),
    );
  });
});
