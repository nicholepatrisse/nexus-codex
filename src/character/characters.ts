import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { characters, communities, contentItems, gameSystems, people, sessionSignups, sessions } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

export const createCharacterInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a character name.").max(100, "Character name must be 100 characters or fewer."),
  characterNumber: z.string().trim().regex(/^(0?[1-9]|[1-9]\d)$/, "Enter a character number from 1 to 99."),
  level: z.coerce.number().int("Enter a whole-number level.").min(SUPPORTED_GAME_SYSTEM.minimumCharacterLevel, `Level must be at least ${SUPPORTED_GAME_SYSTEM.minimumCharacterLevel}.`).max(SUPPORTED_GAME_SYSTEM.maximumCharacterLevel, `Level must be ${SUPPORTED_GAME_SYSTEM.maximumCharacterLevel} or lower.`).default(1),
  className: z.string().trim().max(100, "Class must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  ancestry: z.string().trim().max(100, "Ancestry must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  background: z.string().trim().max(100, "Background must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  backstory: z.string().trim().max(5000, "Backstory must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
  notes: z.string().trim().max(5000, "Notes must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
});
export type CreateCharacterInput = z.input<typeof createCharacterInputSchema>;
export const updateCharacterInputSchema = createCharacterInputSchema.omit({ characterNumber: true });
export type UpdateCharacterInput = z.input<typeof updateCharacterInputSchema>;
type Database = ReturnType<typeof getDb>;
export class CharacterCreationError extends Error {}

export function formatSocietyNumber(societyPlayNumber: string, characterNumber: string) {
  const prefix = SUPPORTED_GAME_SYSTEM.societyCharacterPrefix;
  const sequence = String(Number(characterNumber));
  return `${societyPlayNumber}-${prefix}${sequence.padStart(2, "0")}`;
}
export async function listCharacters(actor: AuthenticatedActor, database: Database = getDb()) {
  return database.select({ id: characters.id, name: characters.name, societyNumber: characters.societyNumber, gameSystemId: characters.gameSystemId, gameSystemName: gameSystems.name })
    .from(characters).innerJoin(gameSystems, eq(gameSystems.id, characters.gameSystemId))
    .where(eq(characters.personId, actor.personId)).orderBy(asc(characters.name));
}
export interface CharacterSession { id: string; communityName: string; communitySlug: string; scenarioCode: string; scenarioTitle: string; startsAt: Date; displayTimeZone: string; signupStatus: "confirmed" | "waitlisted" | "cancelled"; }
export interface CharacterDetail { id: string; name: string; societyNumber: string; gameSystemName: string; level: number; className: string | null; ancestry: string | null; background: string | null; backstory: string | null; notes: string | null; isOwner: boolean; upcomingSessions: CharacterSession[]; pastSessions: CharacterSession[]; }
function communityRole(access: { isActiveMember: boolean; roles: ("owner" | "gm")[] }): CommunityRole | "member" | "visitor" {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}
/** Returns only character and game data the actor is authorized to see. */
export async function getCharacterDetail(actor: AuthenticatedActor, characterId: string, now: Date = new Date(), database: Database = getDb()): Promise<CharacterDetail | null> {
  const [character] = await database.select({ id: characters.id, personId: characters.personId, name: characters.name, societyNumber: characters.societyNumber, gameSystemName: gameSystems.name, level: characters.level, className: characters.className, ancestry: characters.ancestry, background: characters.background, backstory: characters.backstory, notes: characters.notes }).from(characters).innerJoin(gameSystems, eq(gameSystems.id, characters.gameSystemId)).where(eq(characters.id, characterId)).limit(1);
  if (!character) return null;
  const isOwner = character.personId === actor.personId;
  if (!isOwner) {
    const [managedSignup] = await database.select({ id: sessionSignups.id }).from(sessionSignups).innerJoin(sessions, eq(sessions.id, sessionSignups.sessionId)).where(and(eq(sessionSignups.characterId, character.id), eq(sessions.gmPersonId, actor.personId))).limit(1);
    if (!managedSignup) return null;
  }
  const rows = await database.select({ id: sessions.id, gmPersonId: sessions.gmPersonId, status: sessions.status, communityName: communities.name, communitySlug: communities.slug, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, displayTimeZone: sessions.displayTimeZone, signupStatus: sessionSignups.status }).from(sessionSignups).innerJoin(sessions, eq(sessions.id, sessionSignups.sessionId)).innerJoin(communities, eq(communities.id, sessions.communityId)).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).where(eq(sessionSignups.characterId, character.id));
  const visible = (await Promise.all(rows.map(async (row) => {
    if (row.status !== "published" && row.status !== "cancelled") return null;
    if (!isOwner && row.gmPersonId !== actor.personId) return null;
    const access = await resolveCommunityAccessBySlug(row.communitySlug, actor.personId, database);
    if (access.status !== "available") return null;
    if (!canPerformCommunityOperation(communityRole(access), "schedule.view", { visibility: access.community.visibility === "public" ? "public" : "private", scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members" })) return null;
    if (row.signupStatus !== "confirmed" && row.signupStatus !== "waitlisted" && row.signupStatus !== "cancelled") return null;
    return { id: row.id, communityName: row.communityName, communitySlug: row.communitySlug, scenarioCode: row.scenarioCode, scenarioTitle: row.scenarioTitle, startsAt: row.startsAt, displayTimeZone: row.displayTimeZone, signupStatus: row.signupStatus };
  }))).filter((session): session is CharacterSession => session !== null);
  const upcomingSessions = visible.filter((session) => session.startsAt >= now && session.signupStatus !== "cancelled").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const pastSessions = visible.filter((session) => session.startsAt < now).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  if (!isOwner && visible.length === 0) return null;
  return { id: character.id, name: character.name, societyNumber: character.societyNumber, gameSystemName: character.gameSystemName, level: character.level, className: character.className, ancestry: character.ancestry, background: character.background, backstory: character.backstory, notes: character.notes, isOwner, upcomingSessions, pastSessions };
}
export async function createCharacter(actor: AuthenticatedActor, rawInput: CreateCharacterInput, database: Database = getDb()) {
  const input = createCharacterInputSchema.parse(rawInput);
  const [[system], [profile]] = await Promise.all([
    database.select({ id: gameSystems.id }).from(gameSystems).where(eq(gameSystems.id, SUPPORTED_GAME_SYSTEM.id)).limit(1),
    database.select({ societyPlayNumber: people.societyPlayNumber }).from(people).where(eq(people.id, actor.personId)).limit(1),
  ]);
  if (!system) throw new CharacterCreationError("Starfinder 2E is not configured yet.");
  if (!profile?.societyPlayNumber || !/^\d+$/.test(profile.societyPlayNumber)) {
    throw new CharacterCreationError("Add a valid society number to your profile before creating a character.");
  }
  const societyNumber = formatSocietyNumber(profile.societyPlayNumber, input.characterNumber);
  try {
    const [created] = await database.insert(characters).values({
      id: randomUUID(), personId: actor.personId, gameSystemId: SUPPORTED_GAME_SYSTEM.id,
      name: input.name, societyNumber, level: input.level, className: input.className, ancestry: input.ancestry, background: input.background, backstory: input.backstory, notes: input.notes,
    }).returning({ id: characters.id, name: characters.name });
    return created;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") throw new CharacterCreationError("You already have a character with that society number.");
    throw error;
  }
}

export async function updateCharacter(actor: AuthenticatedActor, characterId: string, rawInput: UpdateCharacterInput, database: Database = getDb()) {
  const input = updateCharacterInputSchema.parse(rawInput);
  const [updated] = await database.update(characters).set({ ...input, updatedAt: new Date() })
    .where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId)))
    .returning({ id: characters.id, name: characters.name });
  return updated ?? null;
}
