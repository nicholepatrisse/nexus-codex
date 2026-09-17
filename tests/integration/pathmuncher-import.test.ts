import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter, updateCharacter } from "@/character/characters";
import { createCharacterOptionSelection } from "@/character/option-selections";
import { getDb } from "@/db/client";
import { authUsers, characterOptionSelections, characters, gameSystems, people } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

const mocks = vi.hoisted(() => ({ actor: { personId: "", authUserId: "", sessionId: "test" } }));
vi.mock("@/auth/actor", async (original) => ({ ...await original<typeof import("@/auth/actor")>(), requireAuthenticatedActor: vi.fn(async () => mocks.actor) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { applyPathmuncherImportAction, previewPathmuncherImportAction } = await import("@/app/characters/pathmuncher-import-actions");
const describeWithDatabase = process.env.CI ? describe : describe.skip;
const userIds: string[] = [];
const source = JSON.stringify({ success: true, build: { name: "Imported Hero", level: 1, class: "Envoy", ancestry: "Human", heritage: "Versatile Heritage", background: "Scholar", feats: [["Skill Training", null, "Skill Feat", 1]] } });

describeWithDatabase("Pathmuncher re-import persistence", () => {
  afterEach(async () => { for (const id of userIds.splice(0)) await getDb().delete(authUsers).where(eq(authUsers.id, id)); });

  it("preserves unchanged review data, rejects stale previews, and makes identical imports a no-op", async () => {
    const owner = await createTestIdentity({ name: "Import Owner", sessions: 0 });
    userIds.push(owner.authUser.id);
    mocks.actor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "test" };
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "456456" }).where(eq(people.id, owner.person.id));
    const character = await createCharacter(mocks.actor, { name: "Old Hero", characterNumber: "01" });
    const feat = await createCharacterOptionSelection(mocks.actor, character.id, { selectionKind: "feat", featCategory: "skill", acquiredLevel: 1, acquisitionMethod: "selected", name: "Skill Training", validationNote: "Keep this review note." });
    const firstPreview = await previewPathmuncherImportAction(source, character.id);
    if (!firstPreview.ok || !feat) throw new Error("Expected preview fixture.");
    await updateCharacter(mocks.actor, character.id, { name: "Concurrent edit", notes: "Protected history" });
    expect(await applyPathmuncherImportAction(character.id, firstPreview.preview.approval, firstPreview.preview.changes!.options.flatMap((item) => item.change === "removal" && item.id ? [item.id] : []))).toEqual(expect.objectContaining({ ok: false, error: expect.stringContaining("stale") }));

    const fresh = await previewPathmuncherImportAction(source, character.id);
    if (!fresh.ok) throw new Error("Expected fresh preview.");
    expect((await applyPathmuncherImportAction(character.id, fresh.preview.approval, fresh.preview.changes!.options.flatMap((item) => item.change === "removal" && item.id ? [item.id] : []))).ok).toBe(true);
    const [after] = await getDb().select().from(characters).where(eq(characters.id, character.id));
    const rows = await getDb().select().from(characterOptionSelections).where(eq(characterOptionSelections.characterId, character.id));
    if (!after) throw new Error("Expected imported character.");
    expect(rows.find(({ id }) => id === feat.id)).toEqual(expect.objectContaining({ validationNote: "Keep this review note." }));
    expect(after).toEqual(expect.objectContaining({ notes: "Protected history", importAdapterVersion: 1 }));
    const identical = await previewPathmuncherImportAction(source, character.id);
    if (!identical.ok) throw new Error("Expected identical preview.");
    expect((await applyPathmuncherImportAction(character.id, identical.preview.approval, [])).ok).toBe(true);
    const [unchanged] = await getDb().select().from(characters).where(eq(characters.id, character.id));
    if (!unchanged) throw new Error("Expected unchanged character.");
    expect(unchanged.importedAt).toEqual(after.importedAt);
    expect(await getDb().select().from(characterOptionSelections).where(eq(characterOptionSelections.characterId, character.id))).toHaveLength(rows.length);
  });
});
