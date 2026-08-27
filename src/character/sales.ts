import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characterInventoryEntries, characterPurchases, characterSales, characters } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

/** SFS2 ordinary gear sales return half the actual price paid, rounded down to whole credits. */
export const SFS2_ORDINARY_SALE_POLICY = "sfs2-ordinary-half-paid-floor-v1";
export function sfs2OrdinarySaleProceeds(originalUnitPaidMinor: number, quantity: number) {
  if (!Number.isSafeInteger(originalUnitPaidMinor) || originalUnitPaidMinor < 0) throw new RangeError("Original unit price must be a non-negative whole credit amount.");
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError("Sale quantity must be a positive whole number.");
  return Math.floor((originalUnitPaidMinor * quantity) / 2);
}

export const saleInputSchema = z.object({
  inventoryEntryId: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().int("Quantity must be a whole number.").positive().max(2_000_000_000),
  soldOn: z.string().date("Enter a valid sale date."),
  idempotencyKey: z.string().trim().min(1, "A submission key is required.").max(200),
});

export type SaleInput = z.input<typeof saleInputSchema>;
export class InsufficientInventoryError extends Error {
  constructor() { super("The selected inventory lot no longer has that quantity available."); this.name = "InsufficientInventoryError"; }
}
export class UnsellableInventoryError extends Error {
  constructor(message = "This inventory lot has no positive recorded resale value.") { super(message); this.name = "UnsellableInventoryError"; }
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

    let originalUnitPaidMinor: number;
    if (lot.sourcePurchaseId) {
      const [purchase] = await transaction.select({ unitPriceMinor: characterPurchases.unitPriceMinor }).from(characterPurchases).where(eq(characterPurchases.id, lot.sourcePurchaseId)).limit(1);
      if (!purchase) throw new UnsellableInventoryError("The acquisition price for this lot is unavailable.");
      originalUnitPaidMinor = purchase.unitPriceMinor;
    } else {
      if (lot.amountPaidMinor == null || lot.quantity === 0 || lot.amountPaidMinor % lot.quantity !== 0) throw new UnsellableInventoryError("This lot needs an exact per-unit acquisition price before it can be sold.");
      originalUnitPaidMinor = lot.amountPaidMinor / lot.quantity;
    }
    const originalTotalPaidMinor = originalUnitPaidMinor * input.quantity;
    const saleAmountMinor = sfs2OrdinarySaleProceeds(originalUnitPaidMinor, input.quantity);
    if (saleAmountMinor <= 0) throw new UnsellableInventoryError();

    const saleId = randomUUID();
    const [sale] = await transaction.insert(characterSales).values({
      id: saleId, characterId, inventoryEntryId: lot.id, sourcePurchaseId: lot.sourcePurchaseId,
      contentItemId: lot.contentItemId, itemNameSnapshot: lot.itemNameSnapshot, itemLinkSnapshot: lot.itemLinkSnapshot,
      quantity: input.quantity, originalUnitPaidMinor, originalTotalPaidMinor, saleAmountMinor,
      soldOn: input.soldOn, saleKind: "ordinary", pricingPolicy: SFS2_ORDINARY_SALE_POLICY, idempotencyKey: input.idempotencyKey,
    }).returning();
    const remainingQuantity = lot.quantity - input.quantity;
    const [inventory] = await transaction.update(characterInventoryEntries).set({
      quantity: remainingQuantity,
      amountPaidMinor: lot.amountPaidMinor == null ? null : Math.max(0, lot.amountPaidMinor - originalTotalPaidMinor),
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
