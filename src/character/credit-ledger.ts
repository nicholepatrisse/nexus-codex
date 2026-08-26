import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
export const CREDIT_DISPLAY_SCALE: number = 1;

export const creditAdjustmentInputSchema = z.object({
  amountMinor: z.coerce.number().int("Amount must be a whole number.").min(-2_000_000_000).max(2_000_000_000).refine((amount) => amount !== 0, "Amount cannot be zero."),
  effectiveOn: z.string().date("Enter a valid effective date."),
  notes: z.string().trim().min(1, "Explain the adjustment.").max(1000, "Notes must be 1,000 characters or fewer."),
});
export type CreditAdjustmentInput = z.input<typeof creditAdjustmentInputSchema>;
export type CreditLedgerEntry = typeof characterCreditLedgerEntries.$inferSelect;

export async function getOwnedCreditLedger(actor: AuthenticatedActor, characterId: string, database: Database = getDb()) {
  const [owned] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  if (!owned) return null;
  const entries = await database.select().from(characterCreditLedgerEntries)
    .where(eq(characterCreditLedgerEntries.characterId, characterId))
    .orderBy(asc(characterCreditLedgerEntries.effectiveOn), asc(characterCreditLedgerEntries.createdAt), asc(characterCreditLedgerEntries.id));
  return { balanceMinor: entries.reduce((sum, entry) => sum + entry.amountMinor, 0), displayScale: CREDIT_DISPLAY_SCALE, entries };
}

export async function createCreditAdjustment(actor: AuthenticatedActor, characterId: string, rawInput: CreditAdjustmentInput, database: Database = getDb()) {
  const input = creditAdjustmentInputSchema.parse(rawInput);
  const [owned] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  if (!owned) return null;
  const [created] = await database.insert(characterCreditLedgerEntries).values({
    id: randomUUID(), characterId, amountMinor: input.amountMinor, displayScale: CREDIT_DISPLAY_SCALE,
    type: "adjustment", effectiveOn: input.effectiveOn, source: "owner_adjustment", notes: input.notes,
  }).returning();
  return created ?? null;
}

export function formatCredits(amountMinor: number, displayScale = CREDIT_DISPLAY_SCALE) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: displayScale === 100 ? 2 : 0, maximumFractionDigits: displayScale === 100 ? 2 : 0 }).format(amountMinor / displayScale);
}
