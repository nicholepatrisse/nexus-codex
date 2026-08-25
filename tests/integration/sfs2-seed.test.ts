import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { seedSfs2Catalog, sfs2CatalogSnapshot, STARFINDER_SYSTEM_ID } from "@/catalog/seed-sfs2";
import { getDb } from "@/db/client";
import { contentItems, gameSystems } from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;

describeWithDatabase("SFS2 catalog seed", () => {
  it("is deterministic and safe to rerun", async () => {
    const first = await seedSfs2Catalog();
    const second = await seedSfs2Catalog();
    const stored = await getDb()
      .select()
      .from(contentItems)
      .where(eq(contentItems.programId, first.programId));

    expect(second).toEqual(first);
    expect((await getDb().select({ name: gameSystems.name }).from(gameSystems).where(eq(gameSystems.id, STARFINDER_SYSTEM_ID)))[0]?.name).toBe("Starfinder 2E");
    expect(stored).toHaveLength(sfs2CatalogSnapshot.items.length);
    expect(new Set(stored.map((item) => item.normalizedCode)).size).toBe(stored.length);
  });
});
