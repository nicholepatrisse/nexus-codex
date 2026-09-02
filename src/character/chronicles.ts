import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicleSheetAttachments, chronicles, communities, contentItems, sessionGmCredits, sessions } from "@/db/schema";
import { calculateEarnIncome, totalChronicleCredits } from "@/character/sfs2-chronicle-rewards";
import { isValidPregenLevel, SFS2_PREGEN_LEVELS } from "@/character/sfs2-pregens";
import { deriveSfs2Progression } from "@/character/sfs2-progression";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

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
  timePlayed: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.").nullable().optional().transform((value) => value || null),
  characterLevel: z.coerce.number().int().min(1, "Level must be at least 1.").max(20, "Level must be 20 or lower."),
  creditType: z.enum(["normal", "pregen", "gm", "correction"]).default("normal"),
  eligibilityNote: optionalText(1000),
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
  if (value.creditType === "pregen" && !SFS2_PREGEN_LEVELS.some((level) => level === value.characterLevel)) context.addIssue({ code: "custom", path: ["characterLevel"], message: "Choose an available Iconic Pregen level: 1, 3, 5, or 7." });
  if (value.creditType === "correction" && !value.eligibilityNote) context.addIssue({ code: "custom", path: ["eligibilityNote"], message: "Explain who authorized this eligibility correction." });
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
export type ChronicleWithGmCredit = Chronicle & { isGmCredit: boolean; hasOfficialSheet: boolean };
export const totalCredits = (chronicle: Pick<Chronicle, "baseCreditsMinor" | "downtimeCreditsMinor">) => totalChronicleCredits(chronicle.baseCreditsMinor, chronicle.downtimeCreditsMinor);

/** Derives every Chronicle number from date played, with ID as the stable same-day tie-breaker. */
const chronicleOrder = [asc(chronicles.playedOn), sql`${chronicles.playedAt} asc nulls last`, asc(chronicles.id)] as const;
const playedAtValue = (datePlayed: string, timePlayed: string | null) => timePlayed ? new Date(`${datePlayed}T${timePlayed}:00.000Z`) : null;

export async function renumberChronicles(characterId: string, database: Database) {
  await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`chronicle-number:${characterId}`}, 0))`);
  const rows = await database.select({ id: chronicles.id, chronicleNumber: chronicles.chronicleNumber }).from(chronicles).where(eq(chronicles.characterId, characterId)).orderBy(...chronicleOrder);
  for (const [index, row] of rows.entries()) if (row.chronicleNumber !== String(index + 1)) await database.update(chronicles).set({ chronicleNumber: String(index + 1), updatedAt: new Date() }).where(eq(chronicles.id, row.id));
}

export class DuplicateChronicleError extends Error {
  constructor(scenarioNumber: string) { super(`This character already has a Chronicle for ${scenarioNumber}. Replays must be assigned to a different character.`); this.name = "DuplicateChronicleError"; }
}

export async function assertChronicleReplayAllowed(characterId: string, scenarioNumber: string, database: Database, excludeChronicleId?: string) {
  const normalizedScenario = scenarioNumber.trim().toLocaleLowerCase("en-US");
  await database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`chronicle-replay:${characterId}:${normalizedScenario}`}, 0))`);
  const [duplicate] = await database.select({ id: chronicles.id }).from(chronicles).where(and(eq(chronicles.characterId, characterId), sql`lower(btrim(${chronicles.scenarioNumberSnapshot})) = ${normalizedScenario}`, excludeChronicleId ? ne(chronicles.id, excludeChronicleId) : undefined)).limit(1);
  if (duplicate) throw new DuplicateChronicleError(scenarioNumber);
}

function rewardSnapshot(input: z.output<typeof manualChronicleInputSchema>) {
  const downtimeDays = input.xp * 2;
  const earned = input.downtimeDisposition === "earn_income" && input.downtimeEntryMethod === "calculated" && input.downtimeCheckTotal != null && input.downtimeProficiency
    ? calculateEarnIncome(input.characterLevel, input.downtimeCheckTotal, input.downtimeProficiency, downtimeDays)
    : null;
  const sheetCredits = input.downtimeDisposition === "earn_income" && input.downtimeEntryMethod === "sheet" ? input.downtimeSheetCreditsMinor ?? 0 : null;
  return { baseCreditsMinor: input.baseCreditsMinor, downtimeDays, downtimeDisposition: input.downtimeDisposition, downtimeEntryMethod: input.downtimeEntryMethod, downtimeCheckTotal: earned ? input.downtimeCheckTotal ?? null : null, downtimeProficiency: earned ? input.downtimeProficiency ?? null : null, downtimeDc: earned?.dc ?? null, downtimeDegree: earned?.degree ?? null, downtimeCalculatedCreditsMinor: earned?.calculatedCreditsMinor ?? null, downtimeSheetCreditsMinor: sheetCredits, downtimeOverrideCreditsMinor: input.downtimeOverrideCreditsMinor ?? null, downtimeCreditsMinor: input.downtimeOverrideCreditsMinor ?? sheetCredits ?? earned?.calculatedCreditsMinor ?? 0, downtimeCorrectionNote: input.downtimeCorrectionNote, downtimeActivity: input.downtimeActivity };
}

export async function listChronicles(characterId: string, database: Database = getDb()): Promise<ChronicleWithGmCredit[]> {
  const rows = await database.select({ chronicle: chronicles, gmCreditId: sessionGmCredits.id })
    .from(chronicles)
    .leftJoin(sessionGmCredits, and(eq(sessionGmCredits.sessionId, chronicles.sessionId), eq(sessionGmCredits.characterId, chronicles.characterId)))
    .where(eq(chronicles.characterId, characterId))
    .orderBy(...chronicleOrder);
  const sheets = rows.length ? await database.select({ chronicleId: chronicleSheetAttachments.chronicleId }).from(chronicleSheetAttachments).where(and(inArray(chronicleSheetAttachments.chronicleId, rows.map(({ chronicle }) => chronicle.id)), eq(chronicleSheetAttachments.isCurrent, true))) : [];
  const sheetIds = new Set(sheets.map(({ chronicleId }) => chronicleId));
  return rows.map(({ chronicle, gmCreditId }) => ({ ...chronicle, isGmCredit: gmCreditId !== null, hasOfficialSheet: sheetIds.has(chronicle.id) }));
}

export async function listOwnedChronicles(actor: AuthenticatedActor, database: Database = getDb()) {
  return database.select({ id: chronicles.id, characterId: chronicles.characterId, characterName: characters.name, scenarioNumberSnapshot: chronicles.scenarioNumberSnapshot, scenarioNameSnapshot: chronicles.scenarioNameSnapshot })
    .from(chronicles)
    .innerJoin(characters, eq(characters.id, chronicles.characterId))
    .where(eq(characters.personId, actor.personId))
    .orderBy(asc(characters.name), ...chronicleOrder);
}

/** Returns the source completion workflow only when the actor manages this Nexus session. */
export async function getNexusChronicleEditTarget(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const [source] = await database.select({ sessionId: sessions.id, gmPersonId: sessions.gmPersonId, communitySlug: communities.slug })
    .from(chronicles)
    .innerJoin(sessions, eq(sessions.id, chronicles.sessionId))
    .innerJoin(communities, eq(communities.id, sessions.communityId))
    .where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "nexus"), eq(sessions.status, "completed")))
    .limit(1);
  if (!source) return null;
  const access = await resolveCommunityAccessBySlug(source.communitySlug, actor.personId, database);
  if (access.status !== "available" || (!access.roles.includes("owner") && source.gmPersonId !== actor.personId)) return null;
  return { communitySlug: source.communitySlug, sessionId: source.sessionId };
}

export async function listUnappliedChronicles(personId: string, database: Database = getDb()) {
  return database.select({ id: chronicles.id, characterId: chronicles.characterId, characterName: characters.name, scenarioNumber: chronicles.scenarioNumberSnapshot, scenarioName: chronicles.scenarioNameSnapshot, playedOn: chronicles.playedOn, characterLevel: chronicles.characterLevel, xp: chronicles.xp, provenance: chronicles.provenance, isGmCredit: sql<boolean>`${sessionGmCredits.id} is not null` })
    .from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId))
    .leftJoin(sessionGmCredits, and(eq(sessionGmCredits.sessionId, chronicles.sessionId), eq(sessionGmCredits.characterId, chronicles.characterId)))
    .where(and(eq(characters.personId, personId), eq(chronicles.status, "pending")))
    .orderBy(...chronicleOrder);
}

export async function listChronicleContentItems(database: Database = getDb()) {
  return database.select({ id: contentItems.id, code: contentItems.code, title: contentItems.title, minimumLevel: contentItems.minimumLevel, maximumLevel: contentItems.maximumLevel }).from(contentItems).where(and(eq(contentItems.programId, SUPPORTED_GAME_SYSTEM.organizedPlayProgramId), eq(contentItems.contentType, "scenario"))).orderBy(asc(contentItems.normalizedCode));
}

export function evaluateChronicleEligibility(minimumLevel: number, maximumLevel: number, earningLevel: number, assignedLevel: number, creditType: "normal" | "pregen" | "gm" | "correction") {
  if (creditType === "correction") return "eligible" as const;
  if (creditType === "normal") return earningLevel >= minimumLevel && earningLevel <= maximumLevel ? "eligible" as const : "ineligible" as const;
  const earningTarget = creditType === "gm" ? minimumLevel : earningLevel;
  const validEarningLevel = creditType === "gm" || isValidPregenLevel(minimumLevel, maximumLevel, earningLevel);
  return !validEarningLevel || assignedLevel > maximumLevel || assignedLevel > earningTarget ? "ineligible" as const : assignedLevel === 1 || assignedLevel >= earningTarget ? "eligible" as const : "held" as const;
}

export function shouldAutomaticallyApplyChronicle(creditType: string, earningLevel: number, assignedLevel: number, eligibilityState: string) {
  return eligibilityState === "eligible" && !(creditType === "pregen" && earningLevel > 1 && assignedLevel === 1);
}

function eligibilitySnapshot(minimumLevel: number | null, maximumLevel: number | null, earningLevel: number, assignedLevel: number, creditType: z.output<typeof manualChronicleInputSchema>["creditType"]) {
  if (minimumLevel == null || maximumLevel == null) return { eligibilityState: "unverifiable", scenarioMinimumLevelSnapshot: null, scenarioMaximumLevelSnapshot: null } as const;
  const eligibilityState = evaluateChronicleEligibility(minimumLevel, maximumLevel, earningLevel, assignedLevel, creditType);
  return { eligibilityState, scenarioMinimumLevelSnapshot: minimumLevel, scenarioMaximumLevelSnapshot: maximumLevel } as const;
}

async function catalogSnapshot(contentItemId: string | null, scenarioNumber: string, scenarioName: string, earningLevel: number, assignedLevel: number, creditType: z.output<typeof manualChronicleInputSchema>["creditType"], database: Database) {
  if (!contentItemId) return { contentItemId: null, scenarioNumberSnapshot: scenarioNumber, scenarioNameSnapshot: scenarioName, ...eligibilitySnapshot(null, null, earningLevel, assignedLevel, creditType) };
  const [item] = await database.select({ id: contentItems.id, code: contentItems.code, title: contentItems.title, minimumLevel: contentItems.minimumLevel, maximumLevel: contentItems.maximumLevel }).from(contentItems).where(eq(contentItems.id, contentItemId)).limit(1);
  if (!item) throw new Error("The selected catalog scenario no longer exists.");
  if (creditType === "pregen" && !isValidPregenLevel(item.minimumLevel, item.maximumLevel, earningLevel)) throw new z.ZodError([{ code: "custom", path: ["characterLevel"], message: `Choose an available Iconic Pregen level within the scenario’s level ${item.minimumLevel}–${item.maximumLevel} range.`, input: earningLevel }]);
  return { contentItemId: item.id, scenarioNumberSnapshot: item.code, scenarioNameSnapshot: item.title, ...eligibilitySnapshot(item.minimumLevel, item.maximumLevel, earningLevel, assignedLevel, creditType) };
}

async function currentCharacterLevel(characterId: string, startingLevel: number, database: Database) {
  const applied = await database.select({ xp: chronicles.xp }).from(chronicles).where(and(eq(chronicles.characterId, characterId), eq(chronicles.status, "applied"))).orderBy(...chronicleOrder);
  return deriveSfs2Progression(startingLevel, applied.map(({ xp }) => xp)).currentLevel;
}

export async function createManualChronicle(actor: AuthenticatedActor, characterId: string, rawInput: ManualChronicleInput, database: Database = getDb()) {
  const input = parseManualChronicleInput(rawInput);
  const [owned] = await database.select({ id: characters.id, startingLevel: characters.startingLevel }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  if (!owned) return null;
  const created = await database.transaction(async (transaction) => {
    await assertChronicleReplayAllowed(characterId, input.scenarioNumber, transaction as Database);
    const assignedLevel = await currentCharacterLevel(characterId, owned.startingLevel, transaction as Database);
    const snapshot = await catalogSnapshot(input.contentItemId, input.scenarioNumber, input.scenarioName, input.characterLevel, assignedLevel, input.creditType, transaction as Database);
    const [created] = await transaction.insert(chronicles).values({ id: randomUUID(), characterId, sessionId: null, provenance: "manual", status: "pending", appliedAt: null, creditType: input.creditType, eligibilityNote: input.eligibilityNote, ...snapshot, ...rewardSnapshot(input), playedOn: input.datePlayed, playedAt: playedAtValue(input.datePlayed, input.timePlayed), characterLevel: input.characterLevel, advancementSpeed: input.advancementSpeed, xp: input.xp, chronicleNumber: null, partnerCode: input.partnerCode, eventName: input.eventName, eventCode: input.eventCode, gmOrganizedPlayId: input.gmOrganizedPlayId, playerNotes: input.playerNotes }).returning();
    if (!created) throw new Error("The Chronicle could not be created.");
    await renumberChronicles(characterId, transaction as Database);
    return created;
  });
  await reconcileChronicles(actor, characterId, database);
  const [refreshed] = await database.select().from(chronicles).where(eq(chronicles.id, created.id)).limit(1);
  return refreshed ?? created;
}

export async function getEditableManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const [row] = await database.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "manual"), isNull(chronicles.sessionId), eq(characters.personId, actor.personId))).limit(1);
  return row?.chronicles ?? null;
}

export async function updateManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, rawInput: ManualChronicleInput, database: Database = getDb()) {
  const input = parseManualChronicleInput(rawInput);
  const editable = await getEditableManualChronicle(actor, characterId, chronicleId, database);
  if (!editable) return null;
  const [owner] = await database.select({ startingLevel: characters.startingLevel }).from(characters).where(eq(characters.id, characterId)).limit(1);
  if (!owner) return null;
  const updated = await database.transaction(async (transaction) => {
    await assertChronicleReplayAllowed(characterId, input.scenarioNumber, transaction as Database, chronicleId);
    const assignedLevel = await currentCharacterLevel(characterId, owner.startingLevel, transaction as Database);
    const snapshot = await catalogSnapshot(input.contentItemId, input.scenarioNumber, input.scenarioName, input.characterLevel, assignedLevel, input.creditType, transaction as Database);
    const [updated] = await transaction.update(chronicles).set({ ...snapshot, ...rewardSnapshot(input), creditType: input.creditType, eligibilityNote: input.eligibilityNote, playedOn: input.datePlayed, playedAt: playedAtValue(input.datePlayed, input.timePlayed), characterLevel: input.characterLevel, advancementSpeed: input.advancementSpeed, xp: input.xp, partnerCode: input.partnerCode, eventName: input.eventName, eventCode: input.eventCode, gmOrganizedPlayId: input.gmOrganizedPlayId, playerNotes: input.playerNotes, updatedAt: new Date() }).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "manual"), isNull(chronicles.sessionId))).returning();
    if (!updated) return null;
    const creditDelta = updated.status === "applied" ? totalCredits(updated) - totalCredits(editable) : 0;
    if (creditDelta !== 0) await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: creditDelta, displayScale: 1, type: "adjustment", effectiveOn: updated.playedOn, source: "chronicle_correction", sourceChronicleId: chronicleId, notes: `Corrected ${updated.scenarioNumberSnapshot} — ${updated.scenarioNameSnapshot}` });
    return updated;
  });
  if (updated) {
    await database.transaction(async (transaction) => renumberChronicles(characterId, transaction as Database));
    await reconcileChronicles(actor, characterId, database);
    const [refreshed] = await database.select().from(chronicles).where(eq(chronicles.id, updated.id)).limit(1);
    return refreshed ?? updated;
  }
  return null;
}

export async function deleteManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  const editable = await getEditableManualChronicle(actor, characterId, chronicleId, database);
  if (!editable) return false;
  const deleted = await database.transaction(async (transaction) => {
    await transaction.delete(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId));
    const rows = await transaction.delete(chronicles).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.provenance, "manual"), isNull(chronicles.sessionId))).returning({ id: chronicles.id });
    if (rows.length === 1) await renumberChronicles(characterId, transaction as Database);
    return rows.length === 1;
  });
  if (deleted) await reconcileChronicles(actor, characterId, database);
  return deleted;
}

export class ChronicleEligibilityError extends Error {
  constructor(public readonly eligibilityState: "held" | "ineligible", message: string) { super(message); this.name = "ChronicleEligibilityError"; }
}
export class ChronicleOrderError extends Error { constructor(message: string) { super(message); this.name = "ChronicleOrderError"; } }

export async function applyChronicle(actor: AuthenticatedActor | null, characterId: string, chronicleId: string, database: Database = getDb(), now = new Date(), automatic = false) {
  return database.transaction(async (transaction) => {
    const [pending] = await transaction.select({ chronicle: chronicles, startingLevel: characters.startingLevel }).from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), actor ? eq(characters.personId, actor.personId) : undefined, eq(chronicles.status, "pending"), isNull(chronicles.appliedAt))).limit(1);
    if (pending) {
      const { chronicle } = pending;
      const minimum = chronicle.scenarioMinimumLevelSnapshot;
      const maximum = chronicle.scenarioMaximumLevelSnapshot;
      if (minimum != null && maximum != null && chronicle.creditType !== "correction") {
        const appliedRows = await transaction.select({ xp: chronicles.xp }).from(chronicles).where(and(eq(chronicles.characterId, characterId), eq(chronicles.status, "applied"))).orderBy(...chronicleOrder);
        const currentLevel = deriveSfs2Progression(pending.startingLevel, appliedRows.map(({ xp }) => xp)).currentLevel;
        const earningTarget = chronicle.creditType === "gm" ? minimum : chronicle.characterLevel;
        const eligibilityState = evaluateChronicleEligibility(minimum, maximum, chronicle.characterLevel, currentLevel, chronicle.creditType as "normal" | "pregen" | "gm");
        if (eligibilityState !== "eligible") {
          const prefix = eligibilityState === "held" ? "This Chronicle remains held" : "This Chronicle cannot be applied";
          const target = chronicle.creditType === "pregen" ? `; pregen credit applies at level 1 or ${earningTarget}` : "";
          throw new ChronicleEligibilityError(eligibilityState, `${prefix}: ${chronicle.scenarioNumberSnapshot} is for levels ${minimum}–${maximum}, but the assigned character is level ${currentLevel}${target}.`);
        }
        if (automatic && !shouldAutomaticallyApplyChronicle(chronicle.creditType, chronicle.characterLevel, currentLevel, eligibilityState)) return null;
        if (chronicle.creditType !== "normal") {
          const olderHeld = await transaction.select({ minimum: chronicles.scenarioMinimumLevelSnapshot, maximum: chronicles.scenarioMaximumLevelSnapshot, earningLevel: chronicles.characterLevel, creditType: chronicles.creditType }).from(chronicles).where(and(eq(chronicles.characterId, characterId), eq(chronicles.status, "pending"), eq(chronicles.eligibilityState, "held"), sql`cast(${chronicles.chronicleNumber} as integer) < cast(${chronicle.chronicleNumber} as integer)`)).orderBy(...chronicleOrder);
          const earlierEligibleHeld = olderHeld.some((row) => row.minimum != null && row.maximum != null && evaluateChronicleEligibility(row.minimum, row.maximum, row.earningLevel, currentLevel, row.creditType as "pregen" | "gm") === "eligible");
          if (earlierEligibleHeld) throw new ChronicleEligibilityError("held", "Apply the character’s earlier eligible held Chronicle first; held credit must be applied in play order.");
        }
      }
    }
    const applicationTime = pending?.chronicle.eligibilityState === "held" ? now : pending?.chronicle.playedAt ?? (pending ? new Date(`${pending.chronicle.playedOn}T00:00:00.000Z`) : now);
    const [applied] = pending?.chronicle.chronicleNumber ? await transaction.update(chronicles).set({ status: "applied", appliedAt: applicationTime, eligibilityState: pending.chronicle.scenarioMinimumLevelSnapshot != null ? "eligible" : pending.chronicle.eligibilityState, updatedAt: now }).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(chronicles.status, "pending"), isNull(chronicles.appliedAt))).returning() : [];
    if (applied) {
      await transaction.update(characters).set({ startingLevelLocked: true, updatedAt: now }).where(eq(characters.id, characterId));
      const existing = await transaction.select({ id: characterCreditLedgerEntries.id, amountMinor: characterCreditLedgerEntries.amountMinor }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.sourceChronicleId, chronicleId));
      const net = existing.reduce((sum, entry) => sum + entry.amountMinor, 0);
      const total = totalCredits(applied);
      if (net !== total) {
        await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId, amountMinor: total - net, displayScale: 1, type: existing.length ? "adjustment" : "chronicle_reward", effectiveOn: applied.playedOn, source: existing.length ? "chronicle_correction" : "chronicle", sourceChronicleId: chronicleId, notes: existing.length ? "Chronicle reapplied" : `${applied.scenarioNumberSnapshot} — ${applied.scenarioNameSnapshot}` }).onConflictDoNothing();
      }
      return applied;
    }
    const [existing] = await transaction.select().from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), actor ? eq(characters.personId, actor.personId) : undefined, eq(chronicles.status, "applied"))).limit(1);
    return existing?.chronicles ?? null;
  });
}

export const applyManualChronicle = applyChronicle;

/** Automatically applies every currently eligible Chronicle, rechecking after each XP change. */
export async function reconcileChronicles(actor: AuthenticatedActor | null, characterId: string, database: Database = getDb(), now = new Date()) {
  await database.transaction(async (transaction) => renumberChronicles(characterId, transaction as Database));
  let changed = true;
  while (changed) {
    changed = false;
    const pending = await database.select({ id: chronicles.id }).from(chronicles).where(and(eq(chronicles.characterId, characterId), eq(chronicles.status, "pending"))).orderBy(...chronicleOrder);
    for (const row of pending) {
      try {
        const applied = await applyChronicle(actor, characterId, row.id, database, now, true);
        if (applied?.status === "applied") changed = true;
      } catch (error) {
        if (!(error instanceof ChronicleEligibilityError)) throw error;
      }
    }
  }
}

export async function unapplyManualChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb(), now = new Date()) {
  return database.transaction(async (transaction) => {
    const [target] = await transaction.select({ appliedAt: chronicles.appliedAt }).from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId), eq(characters.personId, actor.personId), eq(chronicles.provenance, "manual"), eq(chronicles.status, "applied"))).limit(1);
    if (target) {
      const [laterApplied] = await transaction.select({ id: chronicles.id }).from(chronicles).where(and(eq(chronicles.characterId, characterId), eq(chronicles.status, "applied"), target.appliedAt ? or(gt(chronicles.appliedAt, target.appliedAt), and(eq(chronicles.appliedAt, target.appliedAt), gt(chronicles.id, chronicleId))) : undefined)).orderBy(desc(chronicles.appliedAt), desc(chronicles.id)).limit(1);
      if (laterApplied) throw new ChronicleOrderError("Unapply the latest Chronicle first so rewards remain in Starfinder Society order.");
    }
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
