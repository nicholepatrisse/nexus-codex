import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter } from "@/character/characters";
import { createManualChronicle } from "@/character/chronicles";
import { getOwnedCreditLedger } from "@/character/credit-ledger";
import { deleteInventoryEntry, listOwnedInventory } from "@/character/inventory";
import { InsufficientCreditBalanceError, listOwnedPurchases, purchaseItem } from "@/character/purchases";
import { getDb } from "@/db/client";
import { authUsers, characterCreditLedgerEntries, characterInventoryEntries, characterPurchases, gameSystems, people } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const userIds: string[] = [];

describeWithDatabase("character purchases", () => {
  afterEach(async () => {
    for (const id of userIds.splice(0)) await getDb().delete(authUsers).where(eq(authUsers.id, id));
  });

  async function fixture() {
    const owner = await createTestIdentity({ name: "Purchase Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Purchase Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "121212" }).where(eq(people.id, owner.person.id));
    await getDb().update(people).set({ societyPlayNumber: "343434" }).where(eq(people.id, other.person.id));
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    const character = await createCharacter(ownerActor, { name: "Buyer", characterNumber: "01" });
    const otherCharacter = await createCharacter(otherActor, { name: "Other Buyer", characterNumber: "01" });
    if (!character || !otherCharacter) throw new Error("Expected characters.");
    const sourceChronicle = await createManualChronicle(ownerActor, character.id, { eventName: "Nexus", eventCode: "1", scenarioNumber: "1-01", scenarioName: "Access", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" });
    const wrongChronicle = await createManualChronicle(otherActor, otherCharacter.id, { eventName: "Nexus", eventCode: "2", scenarioNumber: "1-02", scenarioName: "Other access", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" });
    if (!sourceChronicle || !wrongChronicle) throw new Error("Expected Chronicles.");
    return { ownerActor, otherActor, character, sourceChronicle, wrongChronicle };
  }

  it("atomically creates durable history, a distinct lot, and one linked debit", async () => {
    const { ownerActor, otherActor, character, sourceChronicle, wrongChronicle } = await fixture();
    const input = { itemName: "Laser rifle", itemLink: "https://example.com/laser", sourceMaterialTitle: "Starfinder Society Scenario #1-01", rarity: "Uncommon", sourceChronicleId: sourceChronicle.id, validationNote: "Chronicle access", notes: "Imported rules", quantity: 2, acquiredOn: "2026-08-26", unitPriceMinor: 50, totalPriceMinor: 100, idempotencyKey: "purchase-1" };
    expect(await purchaseItem(otherActor, character.id, input)).toBeNull();
    const result = await purchaseItem(ownerActor, character.id, input);
    if (!result) throw new Error("Expected purchase.");
    expect(result.purchase).toEqual(expect.objectContaining({ itemNameSnapshot: "Laser rifle", unitPriceMinor: 50, totalPriceMinor: 100 }));
    expect(result.inventory).toEqual(expect.objectContaining({ quantity: 2, amountPaidMinor: 100, lotKey: result.purchase.id, sourcePurchaseId: result.purchase.id, sourceChronicleId: sourceChronicle.id, sourceMaterialTitle: "Starfinder Society Scenario #1-01", rarity: "Uncommon", validationNote: "Chronicle access", notes: "Imported rules" }));
    expect((await listOwnedInventory(ownerActor, character.id))?.[0]?.validation).toMatchObject({ status: "unvalidated", issues: [{ message: expect.stringContaining("GM review is required") }] });
    await expect(purchaseItem(ownerActor, character.id, { ...input, idempotencyKey: "wrong-character", sourceChronicleId: wrongChronicle.id })).rejects.toThrow("must belong to this character");
    expect(result.ledgerEntry).toEqual(expect.objectContaining({ amountMinor: -100, type: "purchase", source: "purchase", sourcePurchaseId: result.purchase.id }));
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.balanceMinor).toBe(50);

    const repeated = await purchaseItem(ownerActor, character.id, input);
    expect(repeated?.purchase.id).toBe(result.purchase.id);
    expect(await getDb().select().from(characterPurchases).where(eq(characterPurchases.characterId, character.id))).toHaveLength(1);
    expect(await getDb().select().from(characterInventoryEntries).where(eq(characterInventoryEntries.characterId, character.id))).toHaveLength(1);
    expect((await getDb().select().from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.characterId, character.id))).filter((entry) => entry.type === "purchase")).toHaveLength(1);

    expect(await deleteInventoryEntry(ownerActor, character.id, result.inventory.id)).toBe(true);
    expect(await listOwnedInventory(ownerActor, character.id)).toEqual([]);
    expect(await listOwnedPurchases(ownerActor, character.id)).toEqual([expect.objectContaining({ id: result.purchase.id, itemLinkSnapshot: "https://example.com/laser", unitPriceMinor: 50 })]);
    expect(await listOwnedPurchases(otherActor, character.id)).toBeNull();
  });

  it("rolls back insufficient purchases and serializes concurrent balance consumption", async () => {
    const { ownerActor, character } = await fixture();
    const expensive = { itemName: "Too expensive", quantity: 1, acquiredOn: "2026-08-26", unitPriceMinor: 151, totalPriceMinor: 151, idempotencyKey: "too-expensive" };
    await expect(purchaseItem(ownerActor, character.id, expensive)).rejects.toBeInstanceOf(InsufficientCreditBalanceError);
    expect(await getDb().select().from(characterPurchases).where(eq(characterPurchases.characterId, character.id))).toEqual([]);
    expect(await getDb().select().from(characterInventoryEntries).where(eq(characterInventoryEntries.characterId, character.id))).toEqual([]);
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.balanceMinor).toBe(150);

    const attempts = ["concurrent-a", "concurrent-b"].map((idempotencyKey) => purchaseItem(ownerActor, character.id, { itemName: idempotencyKey, quantity: 1, acquiredOn: "2026-08-26", unitPriceMinor: 100, totalPriceMinor: 100, idempotencyKey }));
    const settled = await Promise.allSettled(attempts);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected" && result.reason instanceof InsufficientCreditBalanceError)).toHaveLength(1);
    expect(await getDb().select().from(characterPurchases).where(eq(characterPurchases.characterId, character.id))).toHaveLength(1);
    expect(await getDb().select().from(characterInventoryEntries).where(eq(characterInventoryEntries.characterId, character.id))).toHaveLength(1);
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.balanceMinor).toBe(50);
  });
});
