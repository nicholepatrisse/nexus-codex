import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterOptionSelections, characterOptions, characters, chronicles } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().transform((value) => value || null);

export const characterOptionSelectionInputSchema = z.object({
  selectionKind: z.enum(["heritage", "feat"]),
  featCategory: z.enum(["class", "ancestry", "skill", "general"]).nullable().optional().default(null),
  acquiredLevel: z.coerce.number().int().min(1).max(20),
  acquisitionMethod: z.enum(["selected", "awarded"]).nullable().optional().default(null),
  grantOrigin: optionalText(300),
  characterOptionId: optionalText(100),
  name: z.string().trim().min(1).max(200),
  sourceMaterialIdentity: optionalText(200),
  sourceMaterialTitle: optionalText(300),
  sourceUrl: z.string().trim().url().max(2000).nullable().optional().transform((value) => value || null),
  validationNote: optionalText(1000),
  sourceChronicleId: optionalText(100),
}).superRefine((input, context) => {
  if (input.selectionKind === "heritage" && input.featCategory) context.addIssue({ code: "custom", path: ["featCategory"], message: "A heritage cannot have a feat category." });
});

export type CharacterOptionSelectionInput = z.input<typeof characterOptionSelectionInputSchema>;
export type CharacterOptionSelection = typeof characterOptionSelections.$inferSelect;

async function ownedCharacter(actor: AuthenticatedActor, characterId: string, database: Database) {
  const [row] = await database.select({ id: characters.id, gameSystemId: characters.gameSystemId }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  return row ?? null;
}

async function selectionSnapshots(input: z.output<typeof characterOptionSelectionInputSchema>, characterId: string, gameSystemId: string, database: Database) {
  if (input.sourceChronicleId) {
    const [source] = await database.select({ id: chronicles.id }).from(chronicles).where(and(eq(chronicles.id, input.sourceChronicleId), eq(chronicles.characterId, characterId))).limit(1);
    if (!source) throw new Error("The Source Chronicle must belong to this character.");
  }
  if (!input.characterOptionId) return { characterOptionId: null, nameSnapshot: input.name, sourceMaterialIdentitySnapshot: input.sourceMaterialIdentity, sourceMaterialTitleSnapshot: input.sourceMaterialTitle, sourceUrlSnapshot: input.sourceUrl };
  const [catalog] = await database.select().from(characterOptions).where(and(eq(characterOptions.id, input.characterOptionId), eq(characterOptions.gameSystemId, gameSystemId), eq(characterOptions.optionType, input.selectionKind))).limit(1);
  if (!catalog) throw new Error("The selected catalog option does not match this character and selection kind.");
  return { characterOptionId: catalog.id, nameSnapshot: catalog.name, sourceMaterialIdentitySnapshot: catalog.sourceMaterialIdentity, sourceMaterialTitleSnapshot: catalog.sourceMaterialTitle, sourceUrlSnapshot: catalog.sourceUrl };
}

export async function listOwnedCharacterOptionSelections(actor: AuthenticatedActor, characterId: string, database: Database = getDb()) {
  if (!await ownedCharacter(actor, characterId, database)) return null;
  return database.select().from(characterOptionSelections).where(eq(characterOptionSelections.characterId, characterId)).orderBy(asc(characterOptionSelections.acquiredLevel), asc(characterOptionSelections.createdAt), asc(characterOptionSelections.id));
}

export async function createCharacterOptionSelection(actor: AuthenticatedActor, characterId: string, raw: CharacterOptionSelectionInput, database: Database = getDb()) {
  const input = characterOptionSelectionInputSchema.parse(raw);
  return database.transaction(async (transaction) => {
    const owned = await ownedCharacter(actor, characterId, transaction as Database);
    if (!owned) return null;
    const snapshots = await selectionSnapshots(input, characterId, owned.gameSystemId, transaction as Database);
    const [created] = await transaction.insert(characterOptionSelections).values({ id: randomUUID(), characterId, selectionKind: input.selectionKind, featCategory: input.selectionKind === "feat" ? input.featCategory : null, acquiredLevel: input.acquiredLevel, acquisitionMethod: input.acquisitionMethod, grantOrigin: input.grantOrigin, ...snapshots, validationNote: input.validationNote, sourceChronicleId: input.sourceChronicleId }).returning();
    return created ?? null;
  });
}

export async function updateCharacterOptionSelection(actor: AuthenticatedActor, characterId: string, selectionId: string, raw: CharacterOptionSelectionInput, database: Database = getDb()) {
  const input = characterOptionSelectionInputSchema.parse(raw);
  return database.transaction(async (transaction) => {
    const owned = await ownedCharacter(actor, characterId, transaction as Database);
    if (!owned) return null;
    const [existing] = await transaction.select({ id: characterOptionSelections.id }).from(characterOptionSelections).where(and(eq(characterOptionSelections.id, selectionId), eq(characterOptionSelections.characterId, characterId))).limit(1);
    if (!existing) return null;
    const snapshots = await selectionSnapshots(input, characterId, owned.gameSystemId, transaction as Database);
    const [updated] = await transaction.update(characterOptionSelections).set({ selectionKind: input.selectionKind, featCategory: input.selectionKind === "feat" ? input.featCategory : null, acquiredLevel: input.acquiredLevel, acquisitionMethod: input.acquisitionMethod, grantOrigin: input.grantOrigin, ...snapshots, validationNote: input.validationNote, sourceChronicleId: input.sourceChronicleId, updatedAt: new Date() }).where(and(eq(characterOptionSelections.id, selectionId), eq(characterOptionSelections.characterId, characterId))).returning();
    return updated ?? null;
  });
}

export async function deleteCharacterOptionSelection(actor: AuthenticatedActor, characterId: string, selectionId: string, database: Database = getDb()) {
  if (!await ownedCharacter(actor, characterId, database)) return false;
  const deleted = await database.delete(characterOptionSelections).where(and(eq(characterOptionSelections.id, selectionId), eq(characterOptionSelections.characterId, characterId))).returning({ id: characterOptionSelections.id });
  return deleted.length === 1;
}
