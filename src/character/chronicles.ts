import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicles, contentItems } from "@/db/schema";
import { calculateEarnIncome, totalChronicleCredits } from "@/character/sfs2-chronicle-rewards";

type Database = ReturnType<typeof getDb>;
const optionalId = z.string().trim().max(100).nullable().optional().transform((value) => value || null);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
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
  baseCreditsMinor: wholeReward("Base credits"),
  downtimeDisposition: z.enum(["earn_income", "other", "declined"], { error: "Choose how Downtime was used." }),
  downtimeEntryMethod: z.enum(["calculated", "sheet"]).default("calculated"),
  downtimeCheckTotal: z.coerce.number().int().nullable().optional(),
  downtimeProficiency: z.enum(["trained", "expert", "master"]).nullable().optional(),
  downtimeSheetCreditsMinor: wholeReward("Downtime credits from sheet").nullable().optional(),
  downtimeOverrideCreditsMinor: wholeReward("Downtime override").nullable().optional(),
  downtimeCorrectionNote: optionalText(1000),
  downtimeActivity: optionalText(200),
  partnerCode: optionalText(100),
  eventName: z.string().trim().min(1, "Enter the event name.").max(200, "Event name must be 200 characters or fewer."),
  eventCode: z.string().trim().min(1, "Enter the event number or code.").max(100, "Event number or code must be 100 characters or fewer."),
  gmOrganizedPlayId: optionalText(100),
  playerNotes: z.string().trim().max(5000, "Notes must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
}).superRefine((value, context) => {
  if (value.downtimeDisposition === "earn_income" && value.downtimeEntryMethod === "calculated" && (value.downtimeCheckTotal == null || value.downtimeProficiency == null)) context.addIssue({ code: "custom", path: ["downtimeCheckTotal"], message: "Enter the Earn Income check total and proficiency." });
  if (value.downtimeDisposition === "earn_income" && value.downtimeEntryMethod === "sheet" && value.downtimeSheetCreditsMinor == null) context.addIssue({ code: "custom", path: ["downtimeSheetCreditsMinor"], message: "Enter the Downtime credits printed on the Chronicle sheet." });
  if (value.downtimeOverrideCreditsMinor != null && !value.downtimeCorrectionNote) context.addIssue({ code: "custom", path: ["downtimeCorrectionNote"], message: "Explain the Downtime credit correction." });
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
export const totalCredits = (chronicle: Pick<Chronicle, "baseCreditsMinor" | "downtimeCreditsMinor">) => totalChronicleCredits(chronicle.baseCreditsMinor, chronicle.downtimeCreditsMinor);

/** Allocates a stable, per-character Chronicle sequence number under a transaction lock. */
export async function nextChronicleNumber(characterId: string, database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`chronicle-number:${characterId}`}, 0))`);
  const rows = await database.select({ chronicleNumber: chronicles.chronicleNumber }).from(chronicles).where(eq(chronicles.characterId, characterId));
  const highest = rows.reduce((maximum, row) => { const value = row.chronicleNumber?.match(/^\d+$/) ? Number(row.chronicleNumber) : 0; return Math.max(maximum, value); }, 0);
  return String(highest + 1);
}

function rewardSnapshot(input: z.output<typeof manualChronicleInputSchema>) {
  const downtimeDays = input.xp * 2;
  const earned = input.downtimeDisposition === "earn_income" && input.downtimeEntryMethod === "calculated" && input.downtimeCheckTotal != null && input.downtimeProficiency
    ? calculateEarnIncome(input.characterLevel, input.downtimeCheckTotal, input.downtimeProficiency, downtimeDays)
    : null;
  const sheetCredits = input.downtimeDisposition === "earn_income" && input.downtimeEntryMethod === "sheet" ? input.downtimeSheetCreditsMinor ?? 0 : null;
  return { baseCreditsMinor: input.baseCreditsMinor, downtimeDays, downtimeDisposition: input.downtimeDisposition, downtimeEntryMethod: input.downtimeEntryMethod, downtimeCheckTotal: earned ? input.downtimeCheckTotal ?? null : null, downtimeProficiency: earned ? input.downtimeProficiency ?? null : null, downtimeDc: earned?.dc ?? null, downtimeDegree: earned?.degree ?? null, downtimeCalculatedCreditsMinor: earned?.calculatedCreditsMinor ?? null, downtimeSheetCreditsMinor: sheetCredits, downtimeOverrideCreditsMinor: input.downtimeOverrideCreditsMinor ?? null, downtimeCreditsMinor: input.downtimeOverrideCreditsMinor ?? sheetCredits ?? earned?.calculatedCreditsMinor ?? 0, downtimeCorrectionNote: input.downtimeCorrectionNote, downtimeActivity: input.downtimeActivity };
}

export async function listChronicles(characterId: string, database: Database = getDb()): Promise<Chronicle[]> {
  return database.select().from(chronicles).where(eq(chronicles.characterId, characterId)).orderBy(desc(chronicles.playedOn), desc(chronicles.id));
}

export async function listUnappliedChronicles(personId: string, database: Database = getDb()) {
  return database.select({ id: chronicles.id, characterId: chronicles.characterId, characterName: characters.name, scenarioNumber: chronicles.scenarioNumberSnapshot, scenarioName: chronicles.scenarioNameSnapshot, playedOn: chronicles.playedOn, characterLevel: chronicles.characterLevel, xp: chronicles.xp, provenance: chronicles.provenance })
    .from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId))
    .where(and(eq(characters.personId, personId), eq(chronicles.status, "pending")))
    .orderBy(desc(chronicles.playedOn), desc(chronicles.createdAt), desc(chronicles.id));
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
  const [created] = await database.insert(chronicles).values({ id: randomUUID(), characterId, sessionId: null, provenance: "manual", status: "pending", appliedAt: null, ...snapshot, ...rewardSnapshot(input), playedOn: input.datePlayed, characterLevel: input.characterLevel, advancementSpeed: input.advancementSpeed, xp: input.xp, chronicleNumber: null, partnerCode: input.partnerCode, eventName: input.eventName, eventCode: input.eventCode, gmOrganizedPlayId: input.gmOrganizedPlayId, playerNotes: input.playerNotes }).returning();
  return created;
}

export async function getEditableManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const [row] = await database.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "manual"), isNull(chronicles.sessionId), eq(characters.personId, actor.personId))).limit(1);
  return row?.chronicles ?? null;
}

export async function updateManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, rawInput: ManualChronicleInput, database: Database = getDb()) {
  const input = parseManualChronicleInput(rawInput);
  const editable = await getEditableManualChronicle(actor, characterId, chronicleId, database);
  if (!editable) return null;
  const snapshot = await catalogSnapshot(input.contentItemId, input.scenarioNumber, input.scenarioName, database);
  return database.transaction(async (transaction) => {
    const [updated] = await transaction.update(chronicles).set({ ...snapshot, ...rewardSnapshot(input), playedOn: input.datePlayed, characterLevel: input.characterLevel, advancementSpeed: input.advancementSpeed, xp: input.xp, partnerCode: input.partnerCode, eventName: input.eventName, eventCode: input.eventCode, gmOrganizedPlayId: input.gmOrganizedPlayId, playerNotes: input.playerNotes, updatedAt: new Date() }).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "manual"), isNull(chronicles.sessionId))).returning();
    if (!updated) return null;
    const creditDelta = updated.status === "applied" ? totalCredits(updated) - totalCredits(editable) : 0;
    if (creditDelta !== 0) await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: creditDelta, displayScale: 1, type: "adjustment", effectiveOn: updated.playedOn, source: "chronicle_correction", sourceChronicleId: chronicleId, notes: `Corrected ${updated.scenarioNumberSnapshot} — ${updated.scenarioNameSnapshot}` });
    return updated;
  });
}

export async function deleteManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const editable = await getEditableManualChronicle(actor, characterId, chronicleId, database);
  if (!editable) return false;
  const [posted] = await database.select({ id: characterCreditLedgerEntries.id }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId)).limit(1);
  if (posted) return false;
  const deleted = await database.delete(chronicles).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "manual"), isNull(chronicles.sessionId), eq(chronicles.status, "pending"))).returning({ id: chronicles.id });
  return deleted.length === 1;
}

export async function applyChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb(), now = new Date()) {
  return database.transaction(async (transaction) => {
    const [pending] = await transaction.select({ chronicleNumber: chronicles.chronicleNumber }).from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(characters.personId, actor.personId), eq(chronicles.status, "pending"), isNull(chronicles.appliedAt))).limit(1);
    const chronicleNumber = pending?.chronicleNumber ?? (pending ? await nextChronicleNumber(characterId, transaction as Database) : null);
    const [applied] = chronicleNumber ? await transaction.update(chronicles).set({ status: "applied", appliedAt: now, chronicleNumber, updatedAt: now }).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.status, "pending"), isNull(chronicles.appliedAt))).returning() : [];
    if (applied) {
      const existing = await transaction.select({ id: characterCreditLedgerEntries.id, amountMinor: characterCreditLedgerEntries.amountMinor }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId));
      const net = existing.reduce((sum, entry) => sum + entry.amountMinor, 0);
      const total = totalCredits(applied);
      if (net !== total) {
        await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: total - net, displayScale: 1, type: existing.length ? "adjustment" : "chronicle_reward", effectiveOn: applied.playedOn, source: existing.length ? "chronicle_correction" : "chronicle", sourceChronicleId: chronicleId, notes: existing.length ? "Chronicle reapplied" : `${applied.scenarioNumberSnapshot} — ${applied.scenarioNameSnapshot}` }).onConflictDoNothing();
      }
      return applied;
    }
    const [existing] = await transaction.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(characters.personId, actor.personId), eq(chronicles.status, "applied"))).limit(1);
    return existing?.chronicles ?? null;
  });
}

export const applyManualChronicle = applyChronicle;

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
