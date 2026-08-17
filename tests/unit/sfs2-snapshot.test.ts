import { describe, expect, it } from "vitest";
import { sfs2CatalogSnapshot } from "@/catalog/seed-sfs2";

describe("checked-in SFS2 catalog snapshot", () => {
  it("contains only validated, unique scheduling metadata", () => {
    expect(sfs2CatalogSnapshot.items).toHaveLength(36);
    expect(new Set(sfs2CatalogSnapshot.items.map((item) => item.code)).size).toBe(36);
    expect(sfs2CatalogSnapshot.items[0]).toMatchObject({
      code: "1-00",
      contentType: "special",
      minimumLevel: 3,
      maximumLevel: 3,
    });
    expect(JSON.stringify(sfs2CatalogSnapshot)).not.toMatch(/price|description|customer|player/i);
  });
});
