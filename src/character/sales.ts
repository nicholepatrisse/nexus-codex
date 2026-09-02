import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characterInventoryEntries, characterPurchases, characterSales, characters } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

/** SFS2 ordinary gear sales return half the item's value, rounded down to whole credits. */
export const SFS2_ORDINARY_SALE_POLICY = "sfs2-ordinary-half-paid-floor-v1";
export const PURCHASE_RETURN_POLICY = "purchase-return-full-refund-v1";
export function sfs2OrdinarySaleProceeds(unitValueMinor: number, quantity: number) {
  if (!Number.isSafeInteger(unitValueMinor) || unitValueMinor < 0) throw new RangeError("Item value must be a non-negative whole credit amount.");
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError("Sale quantity must be a positive whole number.");
  return Math.floor((unitValueMinor * quantity) / 2);
}

export const saleInputSchema = z.object({
  inventoryEntryId: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().int("Quantity must be a whole number.").positive().max(2_000_000_000),
  soldOn: z.string().date("Enter a valid sale date."),
  idempotencyKey: z.string().trim().min(1, "A submission key is required.").max(200),
});

export type SaleInput = z.input<typeof saleInputSchema>;
export const returnPurchaseInputSchema = z.object({
  inventoryEntryId: z.string().trim().min(1).max(100),
  returnedOn: z.string().date("Enter a valid return date."),
  idempotencyKey: z.string().trim().min(1, "A submission key is required.").max(200),
});
export type ReturnPurchaseInput = z.input<typeof returnPurchaseInputSchema>;
export class InsufficientInventoryError extends Error {
  constructor() { super("The selected inventory lot no longer has that quantity available."); this.name = "InsufficientInventoryError"; }
}
export class UnsellableInventoryError extends Error {
  constructor(message = "This inventory lot has no positive recorded resale value.") { super(message); this.name = "UnsellableInventoryError"; }
}
export class PurchaseCannotBeReturnedError extends Error {
  constructor(message = "This purchase can no longer be returned.") { super(message); this.name = "PurchaseCannotBeReturnedError"; }
}

async function saleResult(saleId: string, database: Database) {
  const [sale] = await database.select().from(characterSales).where(eq(characterSales.id, saleId)).limit(1);
  if (!sale) return null;
  const [inventory] = await database.select().from(characterInventoryEntries).where(eq(characterInventoryEntries.id, sale.inventoryEntryId)).limit(1);
  const [ledgerEntry] = await database.select().from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceSaleId, saleId)).limit(1);
  return inventory && ledgerEntry ? { sale, inventory, ledgerEntry } : null;
}

export async function listOwnedSales(actor: AuthenticatedActor, characterId: string, database: Database = getDb()) {
  const [owned] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  if (!owned) return null;
  return database.select().from(characterSales).where(eq(characterSales.characterId, characterId)).orderBy(asc(characterSales.soldOn), asc(characterSales.createdAt), asc(characterSales.id));
}

export async function sellInventory(actor: AuthenticatedActor, characterId: string, raw: SaleInput, database: Database = getDb()) {
  const input = saleInputSchema.parse(raw);
  return database.transaction(async (transaction) => {
    const [owned] = await transaction.select({ id: characters.id }).from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).for("update").limit(1);
    if (!owned) return null;

    const [existing] = await transaction.select({ id: characterSales.id }).from(characterSales)
      .where(and(eq(characterSales.characterId, characterId), eq(characterSales.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) return saleResult(existing.id, transaction as Database);

    const [lot] = await transaction.select().from(characterInventoryEntries)
      .where(and(eq(characterInventoryEntries.id, input.inventoryEntryId), eq(characterInventoryEntries.characterId, characterId))).for("update").limit(1);
    if (!lot || lot.quantity < input.quantity) throw new InsufficientInventoryError();

    if (lot.valueMinor == null) throw new UnsellableInventoryError("This item needs a value before it can be sold.");
    const totalValueMinor = lot.valueMinor * input.quantity;
    const saleAmountMinor = sfs2OrdinarySaleProceeds(lot.valueMinor, input.quantity);
    if (saleAmountMinor <= 0) throw new UnsellableInventoryError();

    const saleId = randomUUID();
    const [sale] = await transaction.insert(characterSales).values({
      id: saleId, characterId, inventoryEntryId: lot.id, sourcePurchaseId: lot.sourcePurchaseId,
      contentItemId: lot.contentItemId, itemNameSnapshot: lot.itemNameSnapshot, itemLinkSnapshot: lot.itemLinkSnapshot,
      quantity: input.quantity, unitValueMinor: lot.valueMinor, totalValueMinor, saleAmountMinor,
      soldOn: input.soldOn, saleKind: "ordinary", pricingPolicy: SFS2_ORDINARY_SALE_POLICY, idempotencyKey: input.idempotencyKey,
    }).returning();
    const remainingQuantity = lot.quantity - input.quantity;
    const [inventory] = await transaction.update(characterInventoryEntries).set({
      quantity: remainingQuantity,
      amountPaidMinor: lot.amountPaidMinor == null ? null : Math.max(0, lot.amountPaidMinor - Math.floor((lot.amountPaidMinor / lot.quantity) * input.quantity)),
      updatedAt: new Date(),
    }).where(and(eq(characterInventoryEntries.id, lot.id), eq(characterInventoryEntries.quantity, lot.quantity))).returning();
    if (!inventory) throw new InsufficientInventoryError();
    const [ledgerEntry] = await transaction.insert(characterCreditLedgerEntries).values({
      id: randomUUID(), characterId, amountMinor: saleAmountMinor, displayScale: 1, type: "sale", effectiveOn: input.soldOn,
      source: "sale", sourceChronicleId: null, sourcePurchaseId: null, sourceSaleId: saleId, notes: `${input.quantity} × ${lot.itemNameSnapshot}`,
    }).returning();
    if (!sale || !ledgerEntry) throw new Error("Sale transaction did not return all created records.");
    return { sale, inventory, ledgerEntry };
  });
}

/** Returns the remaining purchase-backed lot for its exact recorded cost. */
export async function returnPurchase(actor: AuthenticatedActor, characterId: string, raw: ReturnPurchaseInput, database: Database = getDb()) {
  const input = returnPurchaseInputSchema.parse(raw);
  return database.transaction(async (transaction) => {
    const [owned] = await transaction.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).for("update").limit(1);
    if (!owned) return null;
    const [existing] = await transaction.select({ id: characterSales.id }).from(characterSales).where(and(eq(characterSales.characterId, characterId), eq(characterSales.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) return saleResult(existing.id, transaction as Database);
    const [lot] = await transaction.select().from(characterInventoryEntries).where(and(eq(characterInventoryEntries.id, input.inventoryEntryId), eq(characterInventoryEntries.characterId, characterId))).for("update").limit(1);
    if (!lot || lot.quantity <= 0) throw new InsufficientInventoryError();
    if (lot.acquisitionType !== "purchased" || !lot.sourcePurchaseId) throw new PurchaseCannotBeReturnedError("Only an item recorded through a purchase can be returned.");
    const [purchase] = await transaction.select().from(characterPurchases).where(and(eq(characterPurchases.id, lot.sourcePurchaseId), eq(characterPurchases.characterId, characterId))).limit(1);
    const refundAmount = purchase ? purchase.unitPriceMinor * lot.quantity : 0;
    if (!purchase || lot.quantity > purchase.quantity || lot.amountPaidMinor !== refundAmount) throw new PurchaseCannotBeReturnedError("This purchase’s quantity or paid amount has changed, so Nexus cannot safely issue a full refund.");
    const saleId = randomUUID();
    const [sale] = await transaction.insert(characterSales).values({ id: saleId, characterId, inventoryEntryId: lot.id, sourcePurchaseId: purchase.id, contentItemId: lot.contentItemId, itemNameSnapshot: lot.itemNameSnapshot, itemLinkSnapshot: lot.itemLinkSnapshot, quantity: lot.quantity, unitValueMinor: purchase.unitPriceMinor, totalValueMinor: refundAmount, saleAmountMinor: refundAmount, soldOn: input.returnedOn, saleKind: "refund", pricingPolicy: PURCHASE_RETURN_POLICY, idempotencyKey: input.idempotencyKey }).returning();
    const [inventory] = await transaction.update(characterInventoryEntries).set({ quantity: 0, amountPaidMinor: 0, updatedAt: new Date() }).where(and(eq(characterInventoryEntries.id, lot.id), eq(characterInventoryEntries.quantity, lot.quantity))).returning();
    if (!inventory) throw new InsufficientInventoryError();
    const [ledgerEntry] = await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: refundAmount, displayScale: 1, type: "sale", effectiveOn: input.returnedOn, source: "sale", sourceChronicleId: null, sourcePurchaseId: null, sourceSaleId: saleId, notes: `Returned purchase: ${lot.quantity} × ${lot.itemNameSnapshot}` }).returning();
    if (!sale || !ledgerEntry) throw new Error("Purchase return did not return all created records.");
    return { sale, inventory, ledgerEntry };
  });
}
