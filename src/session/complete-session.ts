import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getCharacterProgressions } from "@/character/characters";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicleSheetAttachments, chronicles, communities, communityAuditEvents, contentItems, people, sessionGmCredits, sessionSignups, sessions } from "@/db/schema";
import { calculateEarnIncome, totalChronicleCredits } from "@/character/sfs2-chronicle-rewards";
import { assertChronicleReplayAllowed, reconcileChronicles, renumberChronicles } from "@/character/chronicles";

export type SessionChronicleInput = { characterId: string; characterLevel: number; advancementSpeed: "standard" | "slow"; xp: number; baseCreditsMinor: number; downtimeDisposition: "earn_income" | "other" | "declined"; downtimeCheckTotal: number | null; downtimeProficiency: "trained" | "expert" | "master" | null; downtimeOverrideCreditsMinor: number | null; downtimeCorrectionNote: string; downtimeActivity: string; partnerCode: string; eventName: string; eventCode: string; gmOrganizedPlayId: string; gmNotes: string };
type Database = ReturnType<typeof getDb>;
const mayManage = (roles: string[], gmId: string, actorId: string) => roles.includes("owner") || gmId === actorId;
const validChronicles = (notes: SessionChronicleInput[]) => !notes.some((note) => !Number.isInteger(note.characterLevel) || note.characterLevel < 1 || note.characterLevel > 20 || ![note.xp, note.baseCreditsMinor].every((value) => Number.isSafeInteger(value) && value >= 0) || !["earn_income", "other", "declined"].includes(note.downtimeDisposition) || (note.downtimeDisposition === "earn_income" && (note.downtimeCheckTotal == null || note.downtimeProficiency == null)) || (note.downtimeOverrideCreditsMinor != null && (!Number.isSafeInteger(note.downtimeOverrideCreditsMinor) || note.downtimeOverrideCreditsMinor < 0 || !note.downtimeCorrectionNote)) || !note.eventName.trim() || !note.eventCode.trim());

function rewardValues(note: SessionChronicleInput, characterLevel: number, metadataDefaults?: { eventName: string; eventCode: string | null; gmOrganizedPlayId: string }) {
  const downtimeDays = note.xp * 2;
  const earned = note.downtimeDisposition === "earn_income" && note.downtimeCheckTotal != null && note.downtimeProficiency ? calculateEarnIncome(characterLevel, note.downtimeCheckTotal, note.downtimeProficiency, downtimeDays) : null;
  return { baseCreditsMinor: note.baseCreditsMinor, downtimeDays, downtimeDisposition: note.downtimeDisposition, downtimeCheckTotal: note.downtimeCheckTotal, downtimeProficiency: note.downtimeProficiency, downtimeDc: earned?.dc ?? null, downtimeDegree: earned?.degree ?? null, downtimeCalculatedCreditsMinor: earned?.calculatedCreditsMinor ?? null, downtimeOverrideCreditsMinor: note.downtimeOverrideCreditsMinor, downtimeCreditsMinor: note.downtimeOverrideCreditsMinor ?? earned?.calculatedCreditsMinor ?? 0, downtimeCorrectionNote: note.downtimeCorrectionNote || null, downtimeActivity: note.downtimeActivity || null, partnerCode: note.partnerCode || null, eventName: note.eventName || metadataDefaults?.eventName || null, eventCode: note.eventCode || metadataDefaults?.eventCode || null, gmOrganizedPlayId: note.gmOrganizedPlayId || metadataDefaults?.gmOrganizedPlayId || null };
}

async function eligibleCharacters(sessionId: string, database: Database) {
  const players = (await database.select({ id: characters.id, startingLevel: characters.startingLevel }).from(sessionSignups).innerJoin(characters, eq(characters.id, sessionSignups.characterId)).where(and(eq(sessionSignups.sessionId, sessionId), eq(sessionSignups.status, "confirmed")))).map((character) => ({ ...character, creditType: "normal" as const }));
  const credits = (await database.select({ id: characters.id, startingLevel: characters.startingLevel }).from(sessionGmCredits).innerJoin(characters, eq(characters.id, sessionGmCredits.characterId)).where(eq(sessionGmCredits.sessionId, sessionId))).map((character) => ({ ...character, creditType: "gm" as const }));
  return [...new Map([...players, ...credits].map((character) => [character.id, character])).values()];
}

async function upsertChronicles(session: { id: string; communityId: string; gmPersonId: string; contentItemId: string; startsAt: Date }, notes: SessionChronicleInput[], database: Database) {
  if (!validChronicles(notes)) return false;
  const eligible = await eligibleCharacters(session.id, database);
  const eligibleIds = new Set(eligible.map(({ id }) => id));
  if (notes.some(({ characterId }) => !eligibleIds.has(characterId))) return false;
  const progression = await getCharacterProgressions(eligible, database);
  const [content] = await database.select({ code: contentItems.code, title: contentItems.title, minimumLevel: contentItems.minimumLevel, maximumLevel: contentItems.maximumLevel }).from(contentItems).where(eq(contentItems.id, session.contentItemId)).limit(1);
  if (!content) throw new Error("Session content is missing.");
  const [community] = await database.select({ name: communities.name, eventName: communities.eventName, eventCode: communities.eventCode }).from(communities).where(eq(communities.id, session.communityId)).limit(1);
  if (!community) throw new Error("Session community is missing.");
  const [gm] = await database.select({ organizedPlayId: people.societyPlayNumber }).from(people).where(eq(people.id, session.gmPersonId)).limit(1);
  if (!gm?.organizedPlayId) throw new Error("The session GM is missing an Organized Play number.");
  const metadataDefaults = { eventName: community.eventName ?? community.name, eventCode: community.eventCode, gmOrganizedPlayId: gm.organizedPlayId };
  const now = new Date();
  for (const note of notes) {
    const [existing] = await database.select({ id: chronicles.id, characterLevel: chronicles.characterLevel }).from(chronicles).where(and(eq(chronicles.sessionId, session.id), eq(chronicles.characterId, note.characterId))).limit(1);
    await assertChronicleReplayAllowed(note.characterId, content.code, database, existing?.id);
    const characterLevel = existing?.characterLevel ?? progression.get(note.characterId)?.currentLevel ?? 1;
    const creditType = eligible.find(({ id }) => id === note.characterId)?.creditType ?? "normal";
    const inRange = characterLevel >= content.minimumLevel && characterLevel <= content.maximumLevel;
    const eligibilityState = inRange || (creditType === "gm" && characterLevel === 1) ? "eligible" : creditType === "gm" && characterLevel < content.minimumLevel ? "held" : "ineligible";
    const values = { characterLevel, creditType, eligibilityState, scenarioMinimumLevelSnapshot: content.minimumLevel, scenarioMaximumLevelSnapshot: content.maximumLevel, advancementSpeed: note.advancementSpeed, xp: note.xp, ...rewardValues(note, characterLevel, metadataDefaults), chronicleNumber: null, gmNotes: note.gmNotes || null, status: "pending", appliedAt: null, updatedAt: now };
    const chronicleId = existing?.id ?? randomUUID();
    if (existing) await database.update(chronicles).set(values).where(eq(chronicles.id, existing.id));
    else await database.insert(chronicles).values({ id: chronicleId, characterId: note.characterId, sessionId: session.id, contentItemId: session.contentItemId, scenarioNumberSnapshot: content.code, scenarioNameSnapshot: content.title, playedOn: session.startsAt.toISOString().slice(0, 10), playedAt: session.startsAt, provenance: "nexus", playerNotes: null, ...values, createdAt: now });
  }
  for (const character of eligible) {
    await renumberChronicles(character.id, database);
  }
  return true;
}

async function authorize(actor: AuthenticatedActor, slug: string, sessionId: string, database: Database) {
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return { status: "not-found" as const };
  const [session] = await database.select({ id: sessions.id, communityId: sessions.communityId, status: sessions.status, gmPersonId: sessions.gmPersonId, contentItemId: sessions.contentItemId, startsAt: sessions.startsAt }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
  if (!session) return { status: "not-found" as const };
  if (!mayManage(access.roles, session.gmPersonId, actor.personId)) return { status: "forbidden" as const };
  return { status: "authorized" as const, access, session };
}

export async function saveSessionCharacterNotes(actor: AuthenticatedActor, slug: string, sessionId: string, notes: SessionChronicleInput[], database: Database = getDb()) {
  return database.transaction(async (transaction) => {
    const authorization = await authorize(actor, slug, sessionId, transaction as Database);
    if (authorization.status !== "authorized") return authorization;
    if (authorization.session.status !== "completed") return { status: "unavailable" as const };
    if (!validChronicles(notes)) return { status: "invalid-character" as const };
    const eligible = new Set((await eligibleCharacters(sessionId, transaction as Database)).map(({ id }) => id));
    if (notes.some(({ characterId }) => !eligible.has(characterId))) return { status: "invalid-character" as const };
    const now = new Date();
    for (const note of notes) {
      const [existing] = await transaction.select().from(chronicles).where(and(eq(chronicles.sessionId, sessionId), eq(chronicles.characterId, note.characterId), eq(chronicles.provenance, "nexus"))).limit(1);
      if (!existing) return { status: "invalid-character" as const };
      const rewards = rewardValues(note, existing.characterLevel);
      await transaction.update(chronicles).set({ advancementSpeed: note.advancementSpeed, xp: note.xp, ...rewards, gmNotes: note.gmNotes || null, updatedAt: now }).where(eq(chronicles.id, existing.id));
      const creditDelta = existing.status === "applied" ? totalChronicleCredits(rewards.baseCreditsMinor, rewards.downtimeCreditsMinor) - totalChronicleCredits(existing.baseCreditsMinor, existing.downtimeCreditsMinor) : 0;
      if (creditDelta !== 0) await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId: note.characterId, amountMinor: creditDelta, displayScale: 1, type: "adjustment", effectiveOn: existing.playedOn, source: "chronicle_correction", sourceChronicleId: existing.id, notes: `GM corrected ${existing.scenarioNumberSnapshot} — ${existing.scenarioNameSnapshot}` });
    }
    await transaction.insert(communityAuditEvents).values({ id: randomUUID(), communityId: authorization.access.community.id, actorPersonId: actor.personId, eventType: "session.notes.updated", details: { sessionId, chronicleValuesUpdated: true }, occurredAt: now });
    return { status: "updated" as const };
  });
}

export async function saveSessionReporting(actor: AuthenticatedActor, slug: string, sessionId: string, notes: SessionChronicleInput[], database: Database = getDb()) {
  const result = await database.transaction(async (transaction) => {
    const authorization = await authorize(actor, slug, sessionId, transaction as Database);
    if (authorization.status !== "authorized") return authorization;
    if (authorization.session.status !== "published") return { status: authorization.session.status === "completed" ? "completed" as const : "unavailable" as const };
    if (!await upsertChronicles(authorization.session, notes, transaction as Database)) return { status: "invalid-character" as const };
    return { status: "saved" as const };
  });
  if (result.status === "saved") for (const characterId of new Set(notes.map(({ characterId }) => characterId))) await reconcileChronicles(null, characterId, database);
  return result;
}

export async function completeSession(actor: AuthenticatedActor, slug: string, sessionId: string, database: Database = getDb()) {
  return database.transaction(async (transaction) => {
    const authorization = await authorize(actor, slug, sessionId, transaction as Database);
    if (authorization.status !== "authorized") return authorization;
    if (authorization.session.status !== "published") return { status: authorization.session.status === "completed" ? "completed" as const : "unavailable" as const };
    const required = await transaction.select({ id: chronicles.id }).from(chronicles).where(and(eq(chronicles.sessionId, sessionId), eq(chronicles.provenance, "nexus")));
    if (!required.length) return { status: "reporting-required" as const };
    const attached = await transaction.select({ chronicleId: chronicleSheetAttachments.chronicleId }).from(chronicleSheetAttachments).where(and(eq(chronicleSheetAttachments.isCurrent, true)));
    const attachedIds = new Set(attached.map(({ chronicleId }) => chronicleId));
    if (required.some(({ id }) => !attachedIds.has(id))) return { status: "attachments-required" as const };
    const now = new Date();
    await transaction.update(sessions).set({ status: "completed", updatedByPersonId: actor.personId, updatedAt: now }).where(and(eq(sessions.id, sessionId), eq(sessions.status, "published")));
    await transaction.insert(communityAuditEvents).values({ id: randomUUID(), communityId: authorization.access.community.id, actorPersonId: actor.personId, eventType: "session.completed", details: { sessionId }, occurredAt: now });
    return { status: "completed" as const };
  });
}

export async function markSessionReportedToPaizo(actor: AuthenticatedActor, slug: string, sessionId: string, database: Database = getDb()) {
  const authorization = await authorize(actor, slug, sessionId, database);
  if (authorization.status !== "authorized") return authorization;
  if (authorization.session.status !== "completed") return { status: "unavailable" as const };
  const now = new Date();
  await database.update(sessions).set({ paizoReportedAt: now, paizoReportedByPersonId: actor.personId, updatedByPersonId: actor.personId, updatedAt: now }).where(and(eq(sessions.id, sessionId), eq(sessions.status, "completed")));
  return { status: "reported" as const, reportedAt: now };
}
