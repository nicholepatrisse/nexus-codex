import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicles, contentItems } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
const optionalId = z.string().trim().max(100).nullable().optional().transform((value) => value || null);
const wholeReward = (label: string) => z.coerce.number().int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`).max(2_000_000_000, `${label} is too large.`);

function todayUtc(now = new Date()) { return now.toISOString().slice(0, 10); }

export const manualChronicleInputSchema = z.object({
  contentItemId: optionalId,
  scenarioNumber: z.string().trim().min(1, "Enter a scenario number.").max(100, "Scenario number must be 100 characters or fewer."),
  scenarioName: z.string().trim().min(1, "Enter a scenario name.").max(200, "Scenario name must be 200 characters or fewer."),
  datePlayed: z.string().date("Enter a valid play date."),
  characterLevel: z.coerce.number().int().min(1, "Level must be at least 1.").max(20, "Level must be 20 or lower."),
  advancementSpeed: z.enum(["standard", "slow"], { error: "Choose an advancement speed." }),
  xp: wholeReward("XP"),
  creditsMinor: wholeReward("Credits"),
  reputation: wholeReward("Reputation"),
  downtime: wholeReward("Downtime"),
  playerNotes: z.string().trim().max(5000, "Notes must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
});
export type ManualChronicleInput = z.input<typeof manualChronicleInputSchema>;

export function parseManualChronicleInput(input: ManualChronicleInput, now = new Date()) {
  const parsed = manualChronicleInputSchema.parse(input);
  if (parsed.datePlayed > todayUtc(now)) throw new z.ZodError([{ code: "custom", path: ["datePlayed"], message: "Play date cannot be in the future.", input: parsed.datePlayed }]);
  return parsed;
}

export const chronicleLifecycleSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), appliedAt: z.null() }),
  z.object({ status: z.literal("applied"), appliedAt: z.date() }),
]);
export type Chronicle = typeof chronicles.$inferSelect;

export async function listChronicles(characterId: string, database: Database = getDb()): Promise<Chronicle[]> {
  return database.select().from(chronicles).where(eq(chronicles.characterId, characterId)).orderBy(desc(chronicles.playedOn), desc(chronicles.id));
}

export async function listChronicleContentItems(database: Database = getDb()) {
  return database.select({ id: contentItems.id, code: contentItems.code, title: contentItems.title }).from(contentItems).orderBy(asc(contentItems.normalizedCode));
}

async function catalogSnapshot(contentItemId: string | null, scenarioNumber: string, scenarioName: string, database: Database) {
  if (!contentItemId) return { contentItemId: null, scenarioNumberSnapshot: scenarioNumber, scenarioNameSnapshot: scenarioName };
  const [item] = await database.select({ id: contentItems.id, code: contentItems.code, title: contentItems.title }).from(contentItems).where(eq(contentItems.id, contentItemId)).limit(1);
  if (!item) throw new Error("The selected catalog scenario no longer exists.");
  return { contentItemId: item.id, scenarioNumberSnapshot: item.code, scenarioNameSnapshot: item.title };
}

export async function createManualChronicle(actor: AuthenticatedActor, characterId: string, rawInput: ManualChronicleInput, database: Database = getDb()) {
  const input = parseManualChronicleInput(rawInput);
  const [owned] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  if (!owned) return null;
  const snapshot = await catalogSnapshot(input.contentItemId, input.scenarioNumber, input.scenarioName, database);
  const [created] = await database.insert(chronicles).values({ id: randomUUID(), characterId, sessionId: null, provenance: "manual", status: "pending", appliedAt: null, ...snapshot, playedOn: input.datePlayed, characterLevel: input.characterLevel, advancementSpeed: input.advancementSpeed, xp: input.xp, creditsMinor: input.creditsMinor, reputation: input.reputation, downtime: input.downtime, playerNotes: input.playerNotes }).returning();
  return created;
}

export async function getEditableManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const [row] = await database.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), isNull(chronicles.sessionId), eq(characters.personId, actor.personId))).limit(1);
  return row?.chronicles ?? null;
}

export async function updateManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, rawInput: ManualChronicleInput, database: Database = getDb()) {
  const input = parseManualChronicleInput(rawInput);
  const editable = await getEditableManualChronicle(actor, characterId, chronicleId, database);
  if (!editable) return null;
  const snapshot = await catalogSnapshot(input.contentItemId, input.scenarioNumber, input.scenarioName, database);
  return database.transaction(async (transaction) => {
    const [updated] = await transaction.update(chronicles).set({ ...snapshot, playedOn: input.datePlayed, characterLevel: input.characterLevel, advancementSpeed: input.advancementSpeed, xp: input.xp, creditsMinor: input.creditsMinor, reputation: input.reputation, downtime: input.downtime, playerNotes: input.playerNotes, updatedAt: new Date() }).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), isNull(chronicles.sessionId))).returning();
    if (!updated) return null;
    const creditDelta = updated.status === "applied" ? updated.creditsMinor - editable.creditsMinor : 0;
    if (creditDelta !== 0) await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: creditDelta, displayScale: 1, type: "adjustment", effectiveOn: updated.playedOn, source: "chronicle_correction", sourceChronicleId: chronicleId, notes: `Corrected ${updated.scenarioNumberSnapshot} — ${updated.scenarioNameSnapshot}` });
    return updated;
  });
}

export async function deleteManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const editable = await getEditableManualChronicle(actor, characterId, chronicleId, database);
  if (!editable) return false;
  const [posted] = await database.select({ id: characterCreditLedgerEntries.id }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId)).limit(1);
  if (posted) return false;
  const deleted = await database.delete(chronicles).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), isNull(chronicles.sessionId), eq(chronicles.status, "pending"))).returning({ id: chronicles.id });
  return deleted.length === 1;
}

export async function applyManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb(), now = new Date()) {
  return database.transaction(async (transaction) => {
    const [applied] = await transaction.update(chronicles).set({ status: "applied", appliedAt: now, updatedAt: now }).from(characters).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.characterId, characters.id), eq(characters.personId, actor.personId), eq(chronicles.provenance, "manual"), eq(chronicles.status, "pending"), isNull(chronicles.appliedAt))).returning();
    if (applied) {
      const existing = await transaction.select({ id: characterCreditLedgerEntries.id, amountMinor: characterCreditLedgerEntries.amountMinor }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId));
      const net = existing.reduce((sum, entry) => sum + entry.amountMinor, 0);
      if (!existing.some((entry) => entry.amountMinor === applied.creditsMinor && net === applied.creditsMinor)) {
        await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: applied.creditsMinor - net, displayScale: 1, type: existing.length ? "adjustment" : "chronicle_reward", effectiveOn: applied.playedOn, source: existing.length ? "chronicle_correction" : "chronicle", sourceChronicleId: chronicleId, notes: existing.length ? "Chronicle reapplied" : `${applied.scenarioNumberSnapshot} — ${applied.scenarioNameSnapshot}` }).onConflictDoNothing();
      }
      return applied;
    }
    const [existing] = await transaction.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(characters.personId, actor.personId), eq(chronicles.provenance, "manual"), eq(chronicles.status, "applied"))).limit(1);
    return existing?.chronicles ?? null;
  });
}

export async function unapplyManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb(), now = new Date()) {
  return database.transaction(async (transaction) => {
    const [pending] = await transaction.update(chronicles).set({ status: "pending", appliedAt: null, updatedAt: now }).from(characters).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.characterId, characters.id), eq(characters.personId, actor.personId), eq(chronicles.provenance, "manual"), eq(chronicles.status, "applied"))).returning();
    if (pending) {
      const existing = await transaction.select({ id: characterCreditLedgerEntries.id, amountMinor: characterCreditLedgerEntries.amountMinor }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId));
      const net = existing.reduce((sum, entry) => sum + entry.amountMinor, 0);
      if (net !== 0) await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: -net, displayScale: 1, type: "adjustment", effectiveOn: pending.playedOn, source: "chronicle_reversal", sourceChronicleId: chronicleId, reversesEntryId: existing[existing.length - 1]?.id, notes: `Unapplied ${pending.scenarioNumberSnapshot} — ${pending.scenarioNameSnapshot}` });
      return pending;
    }
    const [existing] = await transaction.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(characters.personId, actor.personId), eq(chronicles.provenance, "manual"), eq(chronicles.status, "pending"))).limit(1);
    return existing?.chronicles ?? null;
  });
}
