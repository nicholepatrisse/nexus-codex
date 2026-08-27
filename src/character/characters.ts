import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { characterCreditLedgerEntries, characters, chronicles, communities, contentItems, gameSystems, people, sessionGmCredits, sessionSignups, sessions } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { CHARACTER_CLASSES } from "@/character/class-options";
import { deriveSfs2Progression } from "@/character/sfs2-progression";
import { isValidStartingCredits, SFS2_STARTING_WEALTH, startingWealthNote, type Sfs2StartingLevel } from "@/character/sfs2-starting-wealth";

const optionalCharacterClassSchema = z.string().trim()
  .pipe(z.union([z.literal(""), z.enum(CHARACTER_CLASSES, { error: "Choose a supported class." })]))
  .nullable().optional().transform((value) => value || null);

export const createCharacterInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a character name.").max(100, "Character name must be 100 characters or fewer."),
  characterNumber: z.string().trim().regex(/^(0?[1-9]|[1-9]\d)$/, "Enter a character number from 1 to 99."),
  startingLevel: z.coerce.number().refine((level): level is 1 | 3 | 5 | 7 => [1, 3, 5, 7].includes(level), "Starting level must be 1, 3, 5, or 7.").default(1),
  startingCredits: z.coerce.number().int().nonnegative().optional(),
  className: optionalCharacterClassSchema,
  ancestry: z.string().trim().max(100, "Ancestry must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  background: z.string().trim().max(100, "Background must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  backstory: z.string().trim().max(5000, "Backstory must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
  notes: z.string().trim().max(5000, "Notes must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
}).transform((input, context) => {
  const startingLevel = input.startingLevel as Sfs2StartingLevel;
  const startingCredits = input.startingCredits ?? SFS2_STARTING_WEALTH[startingLevel][0].credits;
  if (!isValidStartingCredits(startingLevel, startingCredits)) {
    context.addIssue({ code: "custom", path: ["startingCredits"], message: "Choose a starting wealth option available at this level." });
    return z.NEVER;
  }
  return { ...input, startingCredits };
});
export type CreateCharacterInput = z.input<typeof createCharacterInputSchema>;
export const updateCharacterInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a character name.").max(100, "Character name must be 100 characters or fewer."),
  className: optionalCharacterClassSchema,
  ancestry: z.string().trim().max(100, "Ancestry must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  background: z.string().trim().max(100, "Background must be 100 characters or fewer.").nullable().optional().transform((value) => value || null),
  backstory: z.string().trim().max(5000, "Backstory must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
  notes: z.string().trim().max(5000, "Notes must be 5,000 characters or fewer.").nullable().optional().transform((value) => value || null),
});
export type UpdateCharacterInput = z.input<typeof updateCharacterInputSchema>;
type Database = ReturnType<typeof getDb>;
export class CharacterCreationError extends Error {}

export function formatSocietyNumber(societyPlayNumber: string, characterNumber: string) {
  const prefix = SUPPORTED_GAME_SYSTEM.societyCharacterPrefix;
  const sequence = String(Number(characterNumber));
  return `${societyPlayNumber}-${prefix}${sequence.padStart(2, "0")}`;
}
export async function listCharacters(actor: AuthenticatedActor, database: Database = getDb()) {
  const rows = await database.select({ id: characters.id, name: characters.name, societyNumber: characters.societyNumber, className: characters.className, gameSystemId: characters.gameSystemId, gameSystemName: gameSystems.name, startingLevel: characters.startingLevel })
    .from(characters).innerJoin(gameSystems, eq(gameSystems.id, characters.gameSystemId))
    .where(eq(characters.personId, actor.personId)).orderBy(asc(characters.name));
  const progressionByCharacter = await getCharacterProgressions(rows, database);
  return rows.map((character) => ({ ...character, ...progressionByCharacter.get(character.id)! }));
}

export async function getCharacterProgressions(
  characterRows: ReadonlyArray<{ id: string; startingLevel: number }>,
  database: Database = getDb(),
) {
  if (!characterRows.length) return new Map<string, ReturnType<typeof deriveSfs2Progression>>();
  const rewards = await database.select({ characterId: chronicles.characterId, xp: chronicles.xp })
    .from(chronicles).where(and(inArray(chronicles.characterId, characterRows.map(({ id }) => id)), eq(chronicles.status, "applied")));
  const rewardsByCharacter = new Map<string, number[]>();
  for (const reward of rewards) rewardsByCharacter.set(reward.characterId, [...(rewardsByCharacter.get(reward.characterId) ?? []), reward.xp]);
  return new Map(characterRows.map((character) => [character.id, deriveSfs2Progression(character.startingLevel, rewardsByCharacter.get(character.id) ?? [])]));
}
export interface CharacterSession { id: string; communityName: string; communitySlug: string; scenarioCode: string; scenarioTitle: string; startsAt: Date; displayTimeZone: string; signupStatus: "confirmed" | "waitlisted" | "cancelled" | null; participationType: "player" | "gm_credit"; sessionStatus: "published" | "completed" | "cancelled"; }
export interface CharacterDetail { id: string; name: string; societyNumber: string; gameSystemName: string; startingLevel: number; currentLevel: number; xp: number; creditsMinor: number | null; className: string | null; ancestry: string | null; background: string | null; backstory: string | null; notes: string | null; isOwner: boolean; upcomingSessions: CharacterSession[]; pastSessions: CharacterSession[]; }
function communityRole(access: { isActiveMember: boolean; roles: ("owner" | "gm")[] }): CommunityRole | "member" | "visitor" {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}
/** Returns only character and game data the actor is authorized to see. */
export async function getCharacterDetail(actor: AuthenticatedActor, characterId: string, now: Date = new Date(), database: Database = getDb()): Promise<CharacterDetail | null> {
  const [character] = await database.select({ id: characters.id, personId: characters.personId, name: characters.name, societyNumber: characters.societyNumber, gameSystemName: gameSystems.name, startingLevel: characters.startingLevel, className: characters.className, ancestry: characters.ancestry, background: characters.background, backstory: characters.backstory, notes: characters.notes }).from(characters).innerJoin(gameSystems, eq(gameSystems.id, characters.gameSystemId)).where(eq(characters.id, characterId)).limit(1);
  if (!character) return null;
  const isOwner = character.personId === actor.personId;
  if (!isOwner) {
    const [managedSignup] = await database.select({ id: sessionSignups.id }).from(sessionSignups).innerJoin(sessions, eq(sessions.id, sessionSignups.sessionId)).where(and(eq(sessionSignups.characterId, character.id), eq(sessions.gmPersonId, actor.personId))).limit(1);
    if (!managedSignup) return null;
  }
  const rows = await database.select({ id: sessions.id, gmPersonId: sessions.gmPersonId, status: sessions.status, communityName: communities.name, communitySlug: communities.slug, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, displayTimeZone: sessions.displayTimeZone, signupStatus: sessionSignups.status }).from(sessionSignups).innerJoin(sessions, eq(sessions.id, sessionSignups.sessionId)).innerJoin(communities, eq(communities.id, sessions.communityId)).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).where(eq(sessionSignups.characterId, character.id));
  const visible = (await Promise.all(rows.map(async (row) => {
    if (row.status !== "published" && row.status !== "completed" && row.status !== "cancelled") return null;
    if (!isOwner && row.gmPersonId !== actor.personId) return null;
    const access = await resolveCommunityAccessBySlug(row.communitySlug, actor.personId, database);
    if (access.status !== "available") return null;
    if (!canPerformCommunityOperation(communityRole(access), "schedule.view", { visibility: access.community.visibility === "public" ? "public" : "private", scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members" })) return null;
    if (row.signupStatus !== "confirmed" && row.signupStatus !== "waitlisted" && row.signupStatus !== "cancelled") return null;
    return { id: row.id, communityName: row.communityName, communitySlug: row.communitySlug, scenarioCode: row.scenarioCode, scenarioTitle: row.scenarioTitle, startsAt: row.startsAt, displayTimeZone: row.displayTimeZone, signupStatus: row.signupStatus, participationType: "player", sessionStatus: row.status } satisfies CharacterSession;
  }))).filter((session): session is NonNullable<typeof session> => session !== null);
  const gmCreditRows = isOwner ? await database.select({ id: sessions.id, status: sessions.status, communityName: communities.name, communitySlug: communities.slug, scenarioCode: contentItems.code, scenarioTitle: contentItems.title, startsAt: sessions.startsAt, displayTimeZone: sessions.displayTimeZone }).from(sessionGmCredits).innerJoin(sessions, eq(sessions.id, sessionGmCredits.sessionId)).innerJoin(communities, eq(communities.id, sessions.communityId)).innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId)).where(eq(sessionGmCredits.characterId, character.id)) : [];
  const gmCredits: CharacterSession[] = gmCreditRows.filter((row) => row.status === "published" || row.status === "completed" || row.status === "cancelled").map((row) => ({ ...row, status: undefined, sessionStatus: row.status as "published" | "completed" | "cancelled", signupStatus: null, participationType: "gm_credit" }));
  const history = [...visible, ...gmCredits];
  const upcomingSessions = history.filter((session) => session.startsAt >= now && session.sessionStatus === "published" && session.signupStatus !== "cancelled").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const pastSessions = history.filter((session) => session.startsAt < now || session.sessionStatus === "completed" || session.sessionStatus === "cancelled" || session.signupStatus === "cancelled").sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  if (!isOwner && visible.length === 0) return null;
  const rewards = await database.select({ xp: chronicles.xp }).from(chronicles).where(and(eq(chronicles.characterId, character.id), eq(chronicles.status, "applied")));
  const progression = deriveSfs2Progression(character.startingLevel, rewards.map(({ xp }) => xp));
  const ledgerRows = isOwner ? await database.select({ amountMinor: characterCreditLedgerEntries.amountMinor }).from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.characterId, character.id)) : [];
  const creditsMinor = isOwner ? ledgerRows.reduce((sum, entry) => sum + entry.amountMinor, 0) : null;
  return { id: character.id, name: character.name, societyNumber: character.societyNumber, gameSystemName: character.gameSystemName, startingLevel: character.startingLevel, currentLevel: progression.currentLevel, xp: progression.totalXp, creditsMinor, className: character.className, ancestry: character.ancestry, background: character.background, backstory: character.backstory, notes: character.notes, isOwner, upcomingSessions, pastSessions };
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
    return await database.transaction(async (transaction) => {
      const [created] = await transaction.insert(characters).values({
        id: randomUUID(), personId: actor.personId, gameSystemId: SUPPORTED_GAME_SYSTEM.id,
        name: input.name, societyNumber, startingLevel: input.startingLevel, className: input.className, ancestry: input.ancestry, background: input.background, backstory: input.backstory, notes: input.notes,
      }).returning({ id: characters.id, name: characters.name });
      if (!created) throw new CharacterCreationError("The character could not be created.");
      await transaction.insert(characterCreditLedgerEntries).values({ id: randomUUID(), characterId: created.id, amountMinor: input.startingCredits, displayScale: 1, type: "starting_credits", effectiveOn: new Date().toISOString().slice(0, 10), source: "character_creation", notes: startingWealthNote(input.startingLevel, input.startingCredits) });
      return created;
    });
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
