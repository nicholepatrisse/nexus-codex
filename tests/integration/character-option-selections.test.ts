import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter } from "@/character/characters";
import { createCharacterOptionSelection, deleteCharacterOptionSelection, listOwnedCharacterOptionSelections, updateCharacterOptionSelection } from "@/character/option-selections";
import { getDb } from "@/db/client";
import { authUsers, characterOptionSelections, characterOptions, characters, gameSystems, people } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const userIds: string[] = [];

describeWithDatabase("character option selection persistence", () => {
  afterEach(async () => {
    for (const id of userIds.splice(0)) await getDb().delete(authUsers).where(eq(authUsers.id, id));
  });

  async function fixture() {
    const owner = await createTestIdentity({ name: "Selection Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Selection Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "257257" }).where(eq(people.id, owner.person.id));
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    const character = await createCharacter(ownerActor, { name: "Selection Hero", characterNumber: "01" });
    if (!character) throw new Error("Expected character creation.");
    return { ownerActor, otherActor, character };
  }

  it("enforces ownership and one heritage while allowing repeated feat names with distinct acquisition facts", async () => {
    const { ownerActor, otherActor, character } = await fixture();
    const heritage = await createCharacterOptionSelection(ownerActor, character.id, { selectionKind: "heritage", acquiredLevel: 1, acquisitionMethod: "selected", name: "Skittermander" });
    expect(heritage).toEqual(expect.objectContaining({ selectionKind: "heritage", featCategory: null, nameSnapshot: "Skittermander" }));
    await expect(createCharacterOptionSelection(ownerActor, character.id, { selectionKind: "heritage", acquiredLevel: 1, name: "Another heritage" })).rejects.toThrow();

    const selected = await createCharacterOptionSelection(ownerActor, character.id, { selectionKind: "feat", featCategory: "skill", acquiredLevel: 2, acquisitionMethod: "selected", name: "Skill Training" });
    const awarded = await createCharacterOptionSelection(ownerActor, character.id, { selectionKind: "feat", featCategory: "general", acquiredLevel: 3, acquisitionMethod: "awarded", grantOrigin: "Society boon", name: "Skill Training", validationNote: "Category confirmed from the award." });
    expect(selected?.id).not.toBe(awarded?.id);
    expect(awarded).toEqual(expect.objectContaining({ featCategory: "general", acquisitionMethod: "awarded", grantOrigin: "Society boon" }));
    expect(await listOwnedCharacterOptionSelections(otherActor, character.id)).toBeNull();
    expect(await createCharacterOptionSelection(otherActor, character.id, { selectionKind: "feat", acquiredLevel: 1, name: "Stolen" })).toBeNull();
    expect(await updateCharacterOptionSelection(otherActor, character.id, awarded!.id, { selectionKind: "feat", acquiredLevel: 4, name: "Stolen" })).toBeNull();
    expect(await deleteCharacterOptionSelection(otherActor, character.id, awarded!.id)).toBe(false);
    expect((await listOwnedCharacterOptionSelections(ownerActor, character.id))?.map(({ nameSnapshot }) => nameSnapshot)).toEqual(["Skittermander", "Skill Training", "Skill Training"]);
  });

  it("retains snapshots after catalog deletion and cascades selections with the character", async () => {
    const { ownerActor, character } = await fixture();
    const catalogId = randomUUID();
    await getDb().insert(characterOptions).values({ id: catalogId, optionType: "feat", name: "Catalog Feat", normalizedName: "catalog feat", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Player Core", sourceUrl: `https://example.com/${catalogId}` });
    const selection = await createCharacterOptionSelection(ownerActor, character.id, { selectionKind: "feat", featCategory: null, acquiredLevel: 1, acquisitionMethod: "awarded", grantOrigin: "Scenario reward", characterOptionId: catalogId, name: "Ignored input snapshot" });
    expect(selection).toEqual(expect.objectContaining({ characterOptionId: catalogId, nameSnapshot: "Catalog Feat", sourceMaterialIdentitySnapshot: "player-core", sourceMaterialTitleSnapshot: "Player Core" }));
    await getDb().delete(characterOptions).where(eq(characterOptions.id, catalogId));
    expect((await listOwnedCharacterOptionSelections(ownerActor, character.id))?.[0]).toEqual(expect.objectContaining({ characterOptionId: null, nameSnapshot: "Catalog Feat", sourceMaterialTitleSnapshot: "Player Core" }));
    await getDb().delete(characters).where(eq(characters.id, character.id));
    expect(await getDb().select().from(characterOptionSelections).where(eq(characterOptionSelections.id, selection!.id))).toEqual([]);
  });
});
