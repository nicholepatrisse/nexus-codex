import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getCharacterProgressions } from "@/character/characters";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicles, communityAuditEvents, contentItems, sessionGmCredits, sessionSignups, sessions } from "@/db/schema";

export type SessionChronicleInput = { characterId: string; characterLevel: number; advancementSpeed: "standard" | "slow"; xp: number; creditsMinor: number; reputation: number; downtime: number; gmNotes: string };
type Database = ReturnType<typeof getDb>;
const mayManage = (roles: string[], gmId: string, actorId: string) => roles.includes("owner") || gmId === actorId;
const validChronicles = (notes: SessionChronicleInput[]) => !notes.some((note) => !Number.isInteger(note.characterLevel) || note.characterLevel < 1 || note.characterLevel > 20 || ![note.xp, note.creditsMinor, note.reputation, note.downtime].every((value) => Number.isSafeInteger(value) && value >= 0));

async function eligibleCharacters(sessionId: string, database: Database) {
  const players = await database.select({ id: characters.id, startingLevel: characters.startingLevel }).from(sessionSignups).innerJoin(characters, eq(characters.id, sessionSignups.characterId)).where(and(eq(sessionSignups.sessionId, sessionId), eq(sessionSignups.status, "confirmed")));
  const credits = await database.select({ id: characters.id, startingLevel: characters.startingLevel }).from(sessionGmCredits).innerJoin(characters, eq(characters.id, sessionGmCredits.characterId)).where(eq(sessionGmCredits.sessionId, sessionId));
  return [...new Map([...players, ...credits].map((character) => [character.id, character])).values()];
}

async function upsertChronicles(session: { id: string; contentItemId: string; startsAt: Date }, notes: SessionChronicleInput[], database: Database) {
  if (!validChronicles(notes)) return false;
  const eligible = await eligibleCharacters(session.id, database);
  const eligibleIds = new Set(eligible.map(({ id }) => id));
  if (notes.some(({ characterId }) => !eligibleIds.has(characterId))) return false;
  const progression = await getCharacterProgressions(eligible, database);
  const [content] = await database.select({ code: contentItems.code, title: contentItems.title }).from(contentItems).where(eq(contentItems.id, session.contentItemId)).limit(1);
  if (!content) throw new Error("Session content is missing.");
  const now = new Date();
  for (const note of notes) {
    const [existing] = await database.select({ id: chronicles.id, characterLevel: chronicles.characterLevel }).from(chronicles).where(and(eq(chronicles.sessionId, session.id), eq(chronicles.characterId, note.characterId))).limit(1);
    const values = { characterLevel: existing?.characterLevel ?? progression.get(note.characterId)?.currentLevel ?? 1, advancementSpeed: note.advancementSpeed, xp: note.xp, creditsMinor: note.creditsMinor, reputation: note.reputation, downtime: note.downtime, gmNotes: note.gmNotes || null, status: "applied", appliedAt: now, updatedAt: now };
    const chronicleId = existing?.id ?? randomUUID();
    if (existing) await database.update(chronicles).set(values).where(eq(chronicles.id, existing.id));
    else await database.insert(chronicles).values({ id: chronicleId, characterId: note.characterId, sessionId: session.id, contentItemId: session.contentItemId, scenarioNumberSnapshot: content.code, scenarioNameSnapshot: content.title, playedOn: session.startsAt.toISOString().slice(0, 10), provenance: "nexus", playerNotes: null, ...values, createdAt: now });
    await database.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId: note.characterId, amountMinor: note.creditsMinor, displayScale: 1, type: "chronicle_reward", effectiveOn: session.startsAt.toISOString().slice(0, 10), source: "chronicle", sourceChronicleId: chronicleId, notes: `${content.code} — ${content.title}` }).onConflictDoNothing();
  }
  return true;
}

async function authorize(actor: AuthenticatedActor, slug: string, sessionId: string, database: Database) {
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return { status: "not-found" as const };
  const [session] = await database.select({ id: sessions.id, status: sessions.status, gmPersonId: sessions.gmPersonId, contentItemId: sessions.contentItemId, startsAt: sessions.startsAt }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
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
      await transaction.update(chronicles).set({ advancementSpeed: note.advancementSpeed, xp: note.xp, creditsMinor: note.creditsMinor, reputation: note.reputation, downtime: note.downtime, gmNotes: note.gmNotes || null, updatedAt: now }).where(eq(chronicles.id, existing.id));
      const creditDelta = existing.status === "applied" ? note.creditsMinor - existing.creditsMinor : 0;
      if (creditDelta !== 0) await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId: note.characterId, amountMinor: creditDelta, displayScale: 1, type: "adjustment", effectiveOn: existing.playedOn, source: "chronicle_correction", sourceChronicleId: existing.id, notes: `GM corrected ${existing.scenarioNumberSnapshot} — ${existing.scenarioNameSnapshot}` });
    }
    await transaction.insert(communityAuditEvents).values({ id: randomUUID(), communityId: authorization.access.community.id, actorPersonId: actor.personId, eventType: "session.notes.updated", details: { sessionId, chronicleValuesUpdated: true }, occurredAt: now });
    return { status: "updated" as const };
  });
}

export async function completeSession(actor: AuthenticatedActor, slug: string, sessionId: string, notes: SessionChronicleInput[], database: Database = getDb()) {
  return database.transaction(async (transaction) => {
    const authorization = await authorize(actor, slug, sessionId, transaction as Database);
    if (authorization.status !== "authorized") return authorization;
    if (authorization.session.status !== "published") return { status: authorization.session.status === "completed" ? "completed" as const : "unavailable" as const };
    if (!await upsertChronicles(authorization.session, notes, transaction as Database)) return { status: "invalid-character" as const };
    const now = new Date();
    await transaction.update(sessions).set({ status: "completed", updatedByPersonId: actor.personId, updatedAt: now }).where(and(eq(sessions.id, sessionId), eq(sessions.status, "published")));
    await transaction.insert(communityAuditEvents).values({ id: randomUUID(), communityId: authorization.access.community.id, actorPersonId: actor.personId, eventType: "session.completed", details: { sessionId }, occurredAt: now });
    return { status: "completed" as const };
  });
}
