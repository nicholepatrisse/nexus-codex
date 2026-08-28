import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter } from "@/character/characters";
import { getOwnedCreditLedger } from "@/character/credit-ledger";
import { purchaseItem } from "@/character/purchases";
import { InsufficientInventoryError, listOwnedSales, sellInventory, UnsellableInventoryError } from "@/character/sales";
import { getDb } from "@/db/client";
import { authUsers, characterCreditLedgerEntries, characterInventoryEntries, characterSales, gameSystems, people } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const userIds: string[] = [];

describeWithDatabase("character sales", () => {
  afterEach(async () => { for (const id of userIds.splice(0)) await getDb().delete(authUsers).where(eq(authUsers.id, id)); });
  async function fixture() {
    const owner = await createTestIdentity({ name: "Sale Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Sale Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "343434" }).where(eq(people.id, owner.person.id));
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    const character = await createCharacter(ownerActor, { name: "Seller", characterNumber: "01" });
    if (!character) throw new Error("Expected character.");
    return { ownerActor, otherActor, character };
  }

  it("atomically sells partial and full lots from item value and keeps provenance", async () => {
    const { ownerActor, otherActor, character } = await fixture();
    const purchase = await purchaseItem(ownerActor, character.id, { itemName: "Odd-price gear", quantity: 3, acquiredOn: "2026-08-26", unitPriceMinor: 5, totalPriceMinor: 15, idempotencyKey: "buy" });
    if (!purchase) throw new Error("Expected purchase.");
    const input = { inventoryEntryId: purchase.inventory.id, quantity: 1, soldOn: "2026-08-27", idempotencyKey: "sell-1" };
    expect(await sellInventory(otherActor, character.id, input)).toBeNull();
    const first = await sellInventory(ownerActor, character.id, input);
    expect(first?.sale).toEqual(expect.objectContaining({ unitValueMinor: 5, totalValueMinor: 5, saleAmountMinor: 2, saleKind: "ordinary" }));
    expect(first?.inventory).toEqual(expect.objectContaining({ quantity: 2, amountPaidMinor: 10 }));
    expect((await sellInventory(ownerActor, character.id, input))?.sale.id).toBe(first?.sale.id);
    const full = await sellInventory(ownerActor, character.id, { ...input, quantity: 2, idempotencyKey: "sell-2" });
    expect(full?.inventory.quantity).toBe(0);
    expect(full?.sale.saleAmountMinor).toBe(5);
    expect(await listOwnedSales(otherActor, character.id)).toBeNull();
    expect(await listOwnedSales(ownerActor, character.id)).toHaveLength(2);
    expect(await getDb().select().from(characterInventoryEntries).where(eq(characterInventoryEntries.id, purchase.inventory.id))).toEqual([expect.objectContaining({ quantity: 0, sourcePurchaseId: purchase.purchase.id })]);
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.balanceMinor).toBe(142);
    expect((await getDb().select().from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.characterId, character.id))).filter((row) => row.type === "sale")).toHaveLength(2);
  });

  it("sells starting equipment by value without an amount paid", async () => {
    const { ownerActor, character } = await fixture();
    const [startingItem] = await getDb().insert(characterInventoryEntries).values({ id: crypto.randomUUID(), characterId: character.id, itemNameSnapshot: "Starting toolkit", quantity: 1, acquisitionType: "starting_equipment", acquiredOn: "2026-08-26", amountPaidMinor: null, valueMinor: 100, lotKey: crypto.randomUUID() }).returning();
    if (!startingItem) throw new Error("Expected starting item.");
    const result = await sellInventory(ownerActor, character.id, { inventoryEntryId: startingItem.id, quantity: 1, soldOn: "2026-08-27", idempotencyKey: "sell-starting" });
    expect(result?.sale).toEqual(expect.objectContaining({ unitValueMinor: 100, totalValueMinor: 100, saleAmountMinor: 50 }));
    expect(result?.inventory).toEqual(expect.objectContaining({ quantity: 0, amountPaidMinor: null }));
  });

  it("rejects over-sale, concurrent double-sale, and zero-cost lots", async () => {
    const { ownerActor, character } = await fixture();
    const purchase = await purchaseItem(ownerActor, character.id, { itemName: "Only one", quantity: 1, acquiredOn: "2026-08-26", unitPriceMinor: 10, totalPriceMinor: 10, idempotencyKey: "buy-one" });
    if (!purchase) throw new Error("Expected purchase.");
    await expect(sellInventory(ownerActor, character.id, { inventoryEntryId: purchase.inventory.id, quantity: 2, soldOn: "2026-08-27", idempotencyKey: "too-many" })).rejects.toBeInstanceOf(InsufficientInventoryError);
    const settled = await Promise.allSettled(["a", "b"].map((key) => sellInventory(ownerActor, character.id, { inventoryEntryId: purchase.inventory.id, quantity: 1, soldOn: "2026-08-27", idempotencyKey: key })));
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected" && result.reason instanceof InsufficientInventoryError)).toHaveLength(1);

    const [free] = await getDb().insert(characterInventoryEntries).values({ id: crypto.randomUUID(), characterId: character.id, itemNameSnapshot: "Freebie", quantity: 1, acquisitionType: "other", acquiredOn: "2026-08-26", amountPaidMinor: 0, valueMinor: 0, lotKey: crypto.randomUUID() }).returning();
    if (!free) throw new Error("Expected zero-cost lot.");
    await expect(sellInventory(ownerActor, character.id, { inventoryEntryId: free.id, quantity: 1, soldOn: "2026-08-27", idempotencyKey: "free" })).rejects.toBeInstanceOf(UnsellableInventoryError);
    expect(await getDb().select().from(characterSales).where(eq(characterSales.idempotencyKey, "free"))).toEqual([]);
  });
});
