import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { characters, chronicleSheetAttachments, chronicles, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

async function managedChronicle(actor: AuthenticatedActor, slug: string, sessionId: string, chronicleId: string, database: Database) {
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return null;
  const [row] = await database.select({ chronicleId: chronicles.id, gmPersonId: sessions.gmPersonId })
    .from(chronicles).innerJoin(sessions, eq(sessions.id, chronicles.sessionId))
    .where(and(eq(chronicles.id, chronicleId), eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id), eq(chronicles.provenance, "nexus"))).limit(1);
  return row && (access.roles.includes("owner") || row.gmPersonId === actor.personId) ? row : null;
}

export async function attachChronicleSheet(actor: AuthenticatedActor, slug: string, sessionId: string, chronicleId: string, file: File, database: Database = getDb()) {
  if (!allowedTypes.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) return { status: "invalid-file" as const };
  const filename = file.name.trim().slice(0, 255);
  if (!filename) return { status: "invalid-file" as const };
  return database.transaction(async (transaction) => {
    if (!await managedChronicle(actor, slug, sessionId, chronicleId, transaction as Database)) return { status: "forbidden" as const };
    await transaction.update(chronicleSheetAttachments).set({ isCurrent: false }).where(and(eq(chronicleSheetAttachments.chronicleId, chronicleId), eq(chronicleSheetAttachments.isCurrent, true)));
    const id = randomUUID();
    await transaction.insert(chronicleSheetAttachments).values({ id, chronicleId, originalFilename: filename, contentType: file.type, byteSize: file.size, contents: Buffer.from(await file.arrayBuffer()), uploadedByPersonId: actor.personId });
    return { status: "attached" as const, id };
  });
}

export async function getChronicleSheet(actor: AuthenticatedActor, slug: string, sessionId: string, chronicleId: string, database: Database = getDb()) {
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return null;
  const [target] = await database.select({ ownerId: characters.personId, gmId: sessions.gmPersonId }).from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).innerJoin(sessions, eq(sessions.id, chronicles.sessionId)).where(and(eq(chronicles.id, chronicleId), eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1);
  if (!target || (target.ownerId !== actor.personId && target.gmId !== actor.personId && !access.roles.includes("owner"))) return null;
  const [sheet] = await database.select().from(chronicleSheetAttachments).where(and(eq(chronicleSheetAttachments.chronicleId, chronicleId), eq(chronicleSheetAttachments.isCurrent, true))).limit(1);
  return sheet ?? null;
}

async function mayViewCharacterChronicle(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database) {
  const [target] = await database.select({ ownerId: characters.personId, gmId: sessions.gmPersonId }).from(chronicles).innerJoin(characters, eq(characters.id, chronicles.characterId)).leftJoin(sessions, eq(sessions.id, chronicles.sessionId)).where(and(eq(chronicles.id, chronicleId), eq(chronicles.characterId, characterId))).limit(1);
  return Boolean(target && (target.ownerId === actor.personId || target.gmId === actor.personId));
}

export async function getCharacterChronicleSheetMetadata(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  if (!await mayViewCharacterChronicle(actor, characterId, chronicleId, database)) return null;
  const [sheet] = await database.select({ originalFilename: chronicleSheetAttachments.originalFilename, contentType: chronicleSheetAttachments.contentType, byteSize: chronicleSheetAttachments.byteSize, uploadedAt: chronicleSheetAttachments.uploadedAt }).from(chronicleSheetAttachments).where(and(eq(chronicleSheetAttachments.chronicleId, chronicleId), eq(chronicleSheetAttachments.isCurrent, true))).limit(1);
  return sheet ?? null;
}

export async function getCharacterChronicleSheet(actor: AuthenticatedActor, characterId: string, chronicleId: string, database: Database = getDb()) {
  if (!await mayViewCharacterChronicle(actor, characterId, chronicleId, database)) return null;
  const [sheet] = await database.select().from(chronicleSheetAttachments).where(and(eq(chronicleSheetAttachments.chronicleId, chronicleId), eq(chronicleSheetAttachments.isCurrent, true))).limit(1);
  return sheet ?? null;
}
