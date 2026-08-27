import { describe, expect, it } from "vitest";
import { inventoryEntryInputSchema } from "@/character/inventory";

describe("inventory validation", () => {
  const valid = { itemName: "Laser pistol", quantity: 1, acquisitionType: "purchased", acquiredOn: "2026-08-26" };
  it("accepts supported acquisition metadata and exact zero cost", () => {
    expect(inventoryEntryInputSchema.parse({ ...valid, amountPaidMinor: 0, itemLink: "https://example.com/items/laser-pistol" })).toEqual(expect.objectContaining({ itemName: "Laser pistol", quantity: 1, amountPaidMinor: 0, itemLink: "https://example.com/items/laser-pistol" }));
  });
  it("rejects non-positive quantities, unsupported types, and negative costs", () => {
    expect(inventoryEntryInputSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    expect(inventoryEntryInputSchema.safeParse({ ...valid, acquisitionType: "sold" }).success).toBe(false);
    expect(inventoryEntryInputSchema.safeParse({ ...valid, amountPaidMinor: -1 }).success).toBe(false);
    expect(inventoryEntryInputSchema.safeParse({ ...valid, itemLink: "javascript:alert(1)" }).success).toBe(false);
  });
});
