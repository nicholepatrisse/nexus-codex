import { randomUUID } from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterInventoryEntries, characters, chronicles, contentItems, playerMaterials } from "@/db/schema";
import { PLAYER_CORE } from "@/materials/materials";
import { normalizeMaterialIdentity } from "@/materials/material-identity";
import { validateInventoryEntry } from "@/character/inventory-validation";

type Database = ReturnType<typeof getDb>;
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional().transform((value) => value || null);
const optionalLink = z.string().trim().max(2000, "Item link must be 2,000 characters or fewer.").refine((value) => !value || /^https?:\/\//i.test(value), "Enter a complete http or https link.").nullable().optional().transform((value) => value || null);

export const inventoryEntryInputSchema = z.object({
  contentItemId: optionalText(100),
  itemName: z.string().trim().min(1, "Enter an item name.").max(200, "Item name must be 200 characters or fewer."),
  itemLink: optionalLink,
  bulk: optionalText(20),
  sourceMaterialTitle: optionalText(300),
  sourceMaterialIdentity: optionalText(200),
  societyLegal: z.union([z.boolean(), z.literal("true"), z.literal("false"), z.literal(""), z.null()]).optional().transform((value) => value === true || value === "true" ? true : value === false || value === "false" ? false : null),
  societyStatus: z.enum(["standard", "limited", "restricted"]).or(z.literal("")).nullable().optional().transform((value) => value || null),
  rarity: optionalText(30),
  quantity: z.coerce.number().int("Quantity must be a whole number.").positive("Quantity must be at least 1.").max(2_000_000_000),
  acquisitionType: z.enum(["starting_equipment", "purchased", "crafted", "boon_reward", "other"], { error: "Choose an acquisition type." }),
  acquiredOn: z.string().date("Enter a valid acquisition date."),
  amountPaidMinor: z.union([z.literal(""), z.null(), z.coerce.number().int("Amount paid must be a whole number.").nonnegative("Amount paid cannot be negative.").max(2_000_000_000)]).optional().transform((value) => value === "" || value == null ? null : value),
  valueMinor: z.union([z.literal(""), z.null(), z.coerce.number().int("Item value must be a whole number.").nonnegative("Item value cannot be negative.").max(2_000_000_000)]).optional().transform((value) => value === "" || value == null ? null : value),
  sourceChronicleId: optionalText(100),
  notes: optionalText(5000),
  validationNote: z.string().trim().max(1000, "Validation note must be 1,000 characters or fewer.").nullable().optional().transform((value) => value || null),
});
export type InventoryEntryInput = z.input<typeof inventoryEntryInputSchema>;
export type InventoryEntry = typeof characterInventoryEntries.$inferSelect;
export type ValidatedInventoryEntry = InventoryEntry & { validation: ReturnType<typeof validateInventoryEntry> };

async function ownedCharacter(actor: AuthenticatedActor, characterId: string, database: Database) {
  const [row] = await database.select({ id: characters.id }).from(characters).where(and(eq(characters.id, characterId), eq(characters.personId, actor.personId))).limit(1);
  return row ?? null;
}

async function snapshots(input: z.output<typeof inventoryEntryInputSchema>, characterId: string, database: Database) {
  let item = { contentItemId: null as string | null, itemNameSnapshot: input.itemName, itemLinkSnapshot: input.itemLink, bulkSnapshot: input.bulk };
  if (input.contentItemId) {
    const [catalog] = await database.select({ id: contentItems.id, title: contentItems.title, code: contentItems.code }).from(contentItems).where(eq(contentItems.id, input.contentItemId)).limit(1);
    if (!catalog) throw new Error("The selected catalog item no longer exists.");
    item = { contentItemId: catalog.id, itemNameSnapshot: catalog.title, itemLinkSnapshot: input.itemLink, bulkSnapshot: input.bulk };
  }
  if (input.sourceChronicleId) {
    const [source] = await database.select({ id: chronicles.id }).from(chronicles).where(and(eq(chronicles.id, input.sourceChronicleId), eq(chronicles.characterId, characterId))).limit(1);
    if (!source) throw new Error("The source Chronicle must belong to this character.");
  }
  return item;
}

export async function listOwnedInventory(actor: AuthenticatedActor, characterId: string, database: Database = getDb()) {
  if (!await ownedCharacter(actor, characterId, database)) return null;
  const [entries, materials] = await Promise.all([
    database.select().from(characterInventoryEntries).where(and(eq(characterInventoryEntries.characterId, characterId), gt(characterInventoryEntries.quantity, 0))).orderBy(asc(characterInventoryEntries.itemNameSnapshot), asc(characterInventoryEntries.createdAt)),
    database.select({ identity: playerMaterials.identity }).from(playerMaterials).where(eq(playerMaterials.personId, actor.personId)),
  ]);
  const owned = [PLAYER_CORE.identity, ...materials.map(({ identity }) => identity)];
  return entries.map((entry): ValidatedInventoryEntry => ({ ...entry, validation: validateInventoryEntry(entry, owned) }));
}

export async function getOwnedInventoryEntry(actor: AuthenticatedActor, characterId: string, entryId: string, database: Database = getDb()) {
  const [entry] = await database.select({ entry: characterInventoryEntries }).from(characterInventoryEntries).innerJoin(characters, eq(characters.id, characterInventoryEntries.characterId)).where(and(eq(characterInventoryEntries.id, entryId), eq(characterInventoryEntries.characterId, characterId), eq(characters.personId, actor.personId))).limit(1);
  return entry?.entry ?? null;
}

export async function createInventoryEntry(actor: AuthenticatedActor, characterId: string, raw: InventoryEntryInput, database: Database = getDb()) {
  const input = inventoryEntryInputSchema.parse(raw);
  if (!await ownedCharacter(actor, characterId, database)) return null;
  const item = await snapshots(input, characterId, database);
  const sourceMaterialIdentity = input.sourceMaterialIdentity ?? (input.sourceMaterialTitle ? normalizeMaterialIdentity(input.sourceMaterialTitle) : null);
  const [created] = await database.insert(characterInventoryEntries).values({ id: randomUUID(), lotKey: randomUUID(), characterId, ...item, sourceMaterialIdentity, sourceMaterialTitle: input.sourceMaterialTitle, societyLegal: input.societyLegal, societyStatus: input.societyStatus, rarity: input.rarity, quantity: input.quantity, acquisitionType: input.acquisitionType, acquiredOn: input.acquiredOn, amountPaidMinor: input.amountPaidMinor, valueMinor: input.valueMinor, sourceChronicleId: input.sourceChronicleId, notes: input.notes, validationNote: input.validationNote }).returning();
  return created ?? null;
}

export async function updateInventoryEntry(actor: AuthenticatedActor, characterId: string, entryId: string, raw: InventoryEntryInput, database: Database = getDb()) {
  const input = inventoryEntryInputSchema.parse(raw);
  if (!await getOwnedInventoryEntry(actor, characterId, entryId, database)) return null;
  const item = await snapshots(input, characterId, database);
  const sourceMaterialIdentity = input.sourceMaterialIdentity ?? (input.sourceMaterialTitle ? normalizeMaterialIdentity(input.sourceMaterialTitle) : null);
  const [updated] = await database.update(characterInventoryEntries).set({ ...item, sourceMaterialIdentity, sourceMaterialTitle: input.sourceMaterialTitle, societyLegal: input.societyLegal, societyStatus: input.societyStatus, rarity: input.rarity, quantity: input.quantity, acquisitionType: input.acquisitionType, acquiredOn: input.acquiredOn, amountPaidMinor: input.amountPaidMinor, valueMinor: input.valueMinor, sourceChronicleId: input.sourceChronicleId, notes: input.notes, validationNote: input.validationNote, updatedAt: new Date() }).where(and(eq(characterInventoryEntries.id, entryId), eq(characterInventoryEntries.characterId, characterId))).returning();
  return updated ?? null;
}

export async function deleteInventoryEntry(actor: AuthenticatedActor, characterId: string, entryId: string, database: Database = getDb()) {
  if (!await getOwnedInventoryEntry(actor, characterId, entryId, database)) return false;
  const deleted = await database.delete(characterInventoryEntries).where(and(eq(characterInventoryEntries.id, entryId), eq(characterInventoryEntries.characterId, characterId))).returning({ id: characterInventoryEntries.id });
  return deleted.length === 1;
}
