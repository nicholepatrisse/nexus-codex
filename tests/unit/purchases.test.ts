import { describe, expect, it } from "vitest";
import { purchaseInputSchema } from "@/character/purchases";

describe("purchase validation", () => {
  const valid = { itemName: "Laser pistol", quantity: 2, acquiredOn: "2026-08-26", unitPriceMinor: 25, totalPriceMinor: 50, idempotencyKey: "submission-1" };

  it("accepts exact whole-credit pricing and normalizes snapshots", () => {
    expect(purchaseInputSchema.parse({ ...valid, itemName: " Laser pistol ", itemLink: "https://example.com/item", bulk: "1" })).toEqual({ ...valid, itemLink: "https://example.com/item", bulk: "1", contentItemId: null, sourceMaterialTitle: null, sourceMaterialIdentity: null, societyLegal: null, societyStatus: null, rarity: null, validationNote: null, sourceChronicleId: null, notes: null });
  });

  it.each([
    { quantity: 0 },
    { quantity: 1.5 },
    { unitPriceMinor: 0, totalPriceMinor: 0 },
    { unitPriceMinor: 12.5, totalPriceMinor: 25 },
    { totalPriceMinor: 49 },
    { idempotencyKey: "" },
  ])("rejects invalid quantity, precision, price, or idempotency data: %o", (change) => {
    expect(purchaseInputSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});
