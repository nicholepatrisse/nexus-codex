import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characters, gameSystems, people } from "@/db/schema";

export const createCharacterInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a character name.").max(100, "Character name must be 100 characters or fewer."),
  gameSystemId: z.string().trim().min(1, "Choose a game or system."),
  characterNumber: z.string().trim().regex(/^(0?[1-9]|[1-9]\d)$/, "Enter a character number from 1 to 99."),
});
export type CreateCharacterInput = z.input<typeof createCharacterInputSchema>;
type Database = ReturnType<typeof getDb>;
export class CharacterCreationError extends Error {}

export function characterNumberPrefixForSystemCode(code: string): string | null {
  const prefixes: Record<string, string> = {
    starfinder: "27",
    "starfinder-2e": "27",
    "starfinder-1e": "7",
    "pathfinder-2e": "20",
    "pathfinder-1e": "",
  };
  return prefixes[code] ?? null;
}

export function formatSocietyNumber(societyPlayNumber: string, characterNumber: string, systemCode: string) {
  const prefix = characterNumberPrefixForSystemCode(systemCode);
  if (prefix === null) throw new CharacterCreationError("Character numbering is not configured for that system.");
  const sequence = String(Number(characterNumber));
  return `${societyPlayNumber}-${prefix ? `${prefix}${sequence.padStart(2, "0")}` : sequence}`;
}

export async function listGameSystems(database: Database = getDb()) {
  const systems = await database.select({ id: gameSystems.id, code: gameSystems.code, name: gameSystems.name }).from(gameSystems).orderBy(asc(gameSystems.name));
  return systems.flatMap((system) => {
    const characterNumberPrefix = characterNumberPrefixForSystemCode(system.code);
    return characterNumberPrefix === null ? [] : [{ ...system, characterNumberPrefix }];
  });
}
export async function listCharacters(actor: AuthenticatedActor, database: Database = getDb()) {
  return database.select({ id: characters.id, name: characters.name, societyNumber: characters.societyNumber, gameSystemId: characters.gameSystemId, gameSystemName: gameSystems.name })
    .from(characters).innerJoin(gameSystems, eq(gameSystems.id, characters.gameSystemId))
    .where(eq(characters.personId, actor.personId)).orderBy(asc(characters.name));
}
export async function createCharacter(actor: AuthenticatedActor, rawInput: CreateCharacterInput, database: Database = getDb()) {
  const input = createCharacterInputSchema.parse(rawInput);
  const [[system], [profile]] = await Promise.all([
    database.select({ id: gameSystems.id, code: gameSystems.code }).from(gameSystems).where(eq(gameSystems.id, input.gameSystemId)).limit(1),
    database.select({ societyPlayNumber: people.societyPlayNumber }).from(people).where(eq(people.id, actor.personId)).limit(1),
  ]);
  if (!system) throw new CharacterCreationError("Choose an available game or system.");
  if (!profile?.societyPlayNumber || !/^\d+$/.test(profile.societyPlayNumber)) {
    throw new CharacterCreationError("Add a valid society number to your profile before creating a character.");
  }
  const societyNumber = formatSocietyNumber(profile.societyPlayNumber, input.characterNumber, system.code);
  try {
    const [created] = await database.insert(characters).values({
      id: randomUUID(), personId: actor.personId, gameSystemId: input.gameSystemId,
      name: input.name, societyNumber,
    }).returning({ id: characters.id, name: characters.name });
    return created;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") throw new CharacterCreationError("You already have a character with that society number.");
    throw error;
  }
}
