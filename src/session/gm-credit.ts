import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characters, sessionGmCredits, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

/** Applies or moves the actor's single GM credit. Both authorization checks are server-side. */
export async function applyGmCredit(actor: AuthenticatedActor, sessionId: string, characterId: string, database: Database = getDb()) {
  return database.transaction(async (transaction) => {
    const [eligible] = await transaction.select({ sessionId: sessions.id, characterId: characters.id })
      .from(sessions).innerJoin(characters, and(eq(characters.id, characterId), eq(characters.personId, actor.personId), eq(characters.gameSystemId, sessions.gameSystemId)))
      .where(and(eq(sessions.id, sessionId), eq(sessions.gmPersonId, actor.personId))).limit(1);
    if (!eligible) return null;
    const now = new Date();
    const [credit] = await transaction.insert(sessionGmCredits).values({ id: randomUUID(), sessionId, gmPersonId: actor.personId, characterId, updatedAt: now })
      .onConflictDoUpdate({ target: [sessionGmCredits.sessionId, sessionGmCredits.gmPersonId], set: { characterId, updatedAt: now } }).returning();
    return credit ?? null;
  });
}

export async function getOwnGmCredit(actor: AuthenticatedActor, sessionId: string, database: Database = getDb()) {
  const [credit] = await database.select({ characterId: sessionGmCredits.characterId, characterName: characters.name })
    .from(sessionGmCredits).innerJoin(characters, eq(characters.id, sessionGmCredits.characterId))
    .where(and(eq(sessionGmCredits.sessionId, sessionId), eq(sessionGmCredits.gmPersonId, actor.personId))).limit(1);
  return credit ?? null;
}
