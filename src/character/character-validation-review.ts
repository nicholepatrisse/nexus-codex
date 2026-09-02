import { and, asc, eq, gt } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { deriveCharacterValidationSummary } from "@/character/character-validation-summary";
import { getCharacterDetail } from "@/character/characters";
import { getIdentityValidationContext } from "@/character/identity-validation-context";
import { validateInventoryEntry } from "@/character/inventory-validation";
import { withLegacyInventorySource, type ValidatedInventoryEntry } from "@/character/inventory";
import { getDb } from "@/db/client";
import { characterInventoryEntries, characters } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

/** Loads advisory validation only after the existing character-view authorization succeeds. */
export async function getCharacterValidationReview(actor: AuthenticatedActor, characterId: string, database: Database = getDb()) {
  const character = await getCharacterDetail(actor, characterId, new Date(), database);
  if (!character) return null;
  const [owner] = await database.select({ personId: characters.personId }).from(characters).where(eq(characters.id, characterId)).limit(1);
  if (!owner) return null;
  const ownerActor = { ...actor, personId: owner.personId };
  const [context, entries] = await Promise.all([
    getIdentityValidationContext(ownerActor, database),
    database.select().from(characterInventoryEntries).where(and(eq(characterInventoryEntries.characterId, characterId), gt(characterInventoryEntries.quantity, 0))).orderBy(asc(characterInventoryEntries.itemNameSnapshot), asc(characterInventoryEntries.createdAt)),
  ]);
  const inventory = entries.map((raw): ValidatedInventoryEntry => {
    const entry = withLegacyInventorySource(raw);
    return { ...entry, validation: validateInventoryEntry(entry, context.ownedMaterialIdentities) };
  });
  return { summary: deriveCharacterValidationSummary(character, context, inventory), isOwner: character.isOwner };
}
