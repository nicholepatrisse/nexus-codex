import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characterInventoryEntries, characterPurchases, characters, contentItems } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().transform((value) => value || null);
const optionalLink = z.string().trim().max(2000).refine((value) => !value || /^https?:\/\//i.test(value), "Enter a complete http or https link.").nullable().optional().transform((value) => value || null);

export const purchaseInputSchema = z.object({
  contentItemId: optionalText(100),
  itemName: z.string().trim().min(1, "Enter an item name.").max(200),
  itemLink: optionalLink,
  bulk: optionalText(20),
  sourceMaterialTitle: optionalText(300),
  sourceMaterialIdentity: optionalText(200),
  societyLegal: z.union([z.boolean(), z.literal("true"), z.literal("false"), z.literal(""), z.null()]).optional().transform((value) => value === true || value === "true" ? true : value === false || value === "false" ? false : null),
  societyStatus: z.enum(["standard", "limited", "restricted"]).or(z.literal("")).nullable().optional().transform((value) => value || null),
  rarity: optionalText(30),
  validationNote: optionalText(1000),
  notes: optionalText(5000),
  quantity: z.coerce.number().int("Quantity must be a whole number.").positive().max(2_000_000_000),
  acquiredOn: z.string().date("Enter a valid acquisition date."),
  unitPriceMinor: z.coerce.number().int("Unit price must be a whole number.").positive("Unit price must be positive.").max(2_000_000_000),
  totalPriceMinor: z.coerce.number().int("Total price must be a whole number.").positive("Total price must be positive.").max(2_000_000_000),
  idempotencyKey: z.string().trim().min(1, "A submission key is required.").max(200),
}).superRefine((input, context) => {
  if (input.unitPriceMinor * input.quantity !== input.totalPriceMinor) context.addIssue({ code: "custom", path: ["totalPriceMinor"], message: "Total price must equal unit price times quantity." });
});

export type PurchaseInput = z.input<typeof purchaseInputSchema>;
export class InsufficientCreditBalanceError extends Error {
  constructor() { super("Insufficient available credit balance for this purchase."); this.name = "InsufficientCreditBalanceError"; }
}

async function purchaseResult(purchaseId: string, database: Database) {
  const [purchase] = await database.select().from(characterPurchases).where(eq(characterPurchases.id, purchaseId)).limit(1);
  if (!purchase) return null;
  const [inventory] = await database.select().from(characterInventoryEntries).where(eq(characterInventoryEntries.sourcePurchaseId, purchaseId)).limit(1);
  const [ledgerEntry] = await database.select().from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourcePurchaseId, purchaseId)).limit(1);
  return inventory && ledgerEntry ? { purchase, inventory, ledgerEntry } : null;
}

export async function listOwnedPurchases(actor: AuthenticatedActor, characterId: string, database: Database = getDb()) {
  const [owned] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  if (!owned) return null;
  return database.select().from(characterPurchases).where(eq(characterPurchases.characterId, characterId)).orderBy(asc(characterPurchases.acquiredOn), asc(characterPurchases.createdAt), asc(characterPurchases.id));
}

export async function purchaseItem(actor: AuthenticatedActor, characterId: string, raw: PurchaseInput, database: Database = getDb()) {
  const input = purchaseInputSchema.parse(raw);
  return database.transaction(async (transaction) => {
    // All purchases for a character lock the same durable row before checking balance.
    const [owned] = await transaction.select({ id: characters.id }).from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).for("update").limit(1);
    if (!owned) return null;

    const [existing] = await transaction.select({ id: characterPurchases.id }).from(characterPurchases)
      .where(and(eq(characterPurchases.characterId, characterId), eq(characterPurchases.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) return purchaseResult(existing.id, transaction as Database);

    let snapshot = { contentItemId: null as string | null, itemNameSnapshot: input.itemName, itemLinkSnapshot: input.itemLink, bulkSnapshot: input.bulk };
    if (input.contentItemId) {
      const [catalog] = await transaction.select({ id: contentItems.id, title: contentItems.title }).from(contentItems).where(eq(contentItems.id, input.contentItemId)).limit(1);
      if (!catalog) throw new Error("The selected catalog item no longer exists.");
      snapshot = { contentItemId: catalog.id, itemNameSnapshot: catalog.title, itemLinkSnapshot: input.itemLink, bulkSnapshot: input.bulk };
    }

    const [balanceRow] = await transaction.select({ balance: sql<string>`coalesce(sum(${characterCreditLedgerEntries.amountMinor}), 0)` })
      .from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.characterId, characterId));
    if (Number(balanceRow?.balance ?? 0) < input.totalPriceMinor) throw new InsufficientCreditBalanceError();

    const purchaseId = randomUUID();
    const [purchase] = await transaction.insert(characterPurchases).values({ id: purchaseId, characterId, ...snapshot, quantity: input.quantity, acquiredOn: input.acquiredOn, unitPriceMinor: input.unitPriceMinor, totalPriceMinor: input.totalPriceMinor, idempotencyKey: input.idempotencyKey }).returning();
    const [inventory] = await transaction.insert(characterInventoryEntries).values({ id: randomUUID(), characterId, ...snapshot, sourceMaterialIdentity: input.sourceMaterialIdentity, sourceMaterialTitle: input.sourceMaterialTitle, societyLegal: input.societyLegal, societyStatus: input.societyStatus, rarity: input.rarity, quantity: input.quantity, acquisitionType: "purchased", acquiredOn: input.acquiredOn, amountPaidMinor: input.totalPriceMinor, valueMinor: input.unitPriceMinor, sourceChronicleId: null, sourcePurchaseId: purchaseId, notes: input.notes, validationNote: input.validationNote, lotKey: purchaseId }).returning();
    const [ledgerEntry] = await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: -input.totalPriceMinor, displayScale: 1, type: "purchase", effectiveOn: input.acquiredOn, source: "purchase", sourceChronicleId: null, sourcePurchaseId: purchaseId, notes: `${input.quantity} × ${snapshot.itemNameSnapshot}` }).returning();
    if (!purchase || !inventory || !ledgerEntry) throw new Error("Purchase transaction did not return all created records.");
    return { purchase, inventory, ledgerEntry };
  });
}
