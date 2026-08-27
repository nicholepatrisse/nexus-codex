import { describe, expect, it } from "vitest";
import { saleInputSchema, sfs2OrdinarySaleProceeds } from "@/character/sales";

describe("SFS2 ordinary sale pricing", () => {
  it.each([[10, 1, 5], [5, 1, 2], [5, 3, 7], [0, 4, 0]])("returns half actual paid cost and floors to whole credits", (unit, quantity, expected) => {
    expect(sfs2OrdinarySaleProceeds(unit, quantity)).toBe(expected);
  });

  it("validates a positive whole quantity and idempotency key", () => {
    const valid = { inventoryEntryId: "lot-1", quantity: 1, soldOn: "2026-08-26", idempotencyKey: "sale-1" };
    expect(saleInputSchema.parse(valid)).toEqual(valid);
    expect(saleInputSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    expect(saleInputSchema.safeParse({ ...valid, quantity: 1.5 }).success).toBe(false);
    expect(saleInputSchema.safeParse({ ...valid, idempotencyKey: "" }).success).toBe(false);
  });
});
