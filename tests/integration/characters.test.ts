import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter, getCharacterDetail, listCharacters, updateCharacter } from "@/character/characters";
import { getDb } from "@/db/client";
import { authUsers, characters, gameSystems, people } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
const describeWithDatabase = process.env.CI ? describe : describe.skip;
const userIds: string[] = [];
const systemIds: string[] = [];
describeWithDatabase("characters persistence", () => {
  afterEach(async () => {
    for (const id of userIds.splice(0)) await getDb().delete(authUsers).where(eq(authUsers.id, id));
    for (const id of systemIds.splice(0)) await getDb().delete(gameSystems).where(eq(gameSystems.id, id));
  });
  it("creates and lists characters only for the authenticated actor", async () => {
    const owner = await createTestIdentity({ name: "Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    await getDb().update(people).set({ societyPlayNumber: "123456" }).where(eq(people.id, owner.person.id));
    await createCharacter(ownerActor, { name: "Navasi", characterNumber: "01", startingLevel: 3 });
    expect(await listCharacters(ownerActor)).toEqual([expect.objectContaining({ name: "Navasi", societyNumber: "123456-2701", gameSystemName: "Starfinder 2E" })]);
    expect(await listCharacters(otherActor)).toEqual([]);
    expect(await getDb().select().from(characters).where(eq(characters.personId, owner.person.id))).toEqual([
      expect.objectContaining({ gameSystemId: SUPPORTED_GAME_SYSTEM.id, startingLevel: 3 }),
    ]);
  });

  it("updates details only when the actor owns the character", async () => {
    const owner = await createTestIdentity({ name: "Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    await getDb().update(people).set({ societyPlayNumber: "654321" }).where(eq(people.id, owner.person.id));
    const created = await createCharacter(ownerActor, { name: "Navasi", characterNumber: "01" });
    if (!created) throw new Error("Expected character creation to return a record.");

    expect(await updateCharacter(otherActor, created.id, { name: "Stolen" })).toBeNull();
    const attemptedStartingLevelChange = { name: " Navasi ", startingLevel: 7, className: " Envoy ", ancestry: "Human", background: "  ", backstory: "  Raised aboard a station.  ", notes: "  " } as Parameters<typeof updateCharacter>[2];
    expect(await updateCharacter(ownerActor, created.id, attemptedStartingLevelChange)).toEqual(expect.objectContaining({ id: created.id }));
    expect(await getCharacterDetail(ownerActor, created.id)).toEqual(expect.objectContaining({ name: "Navasi", startingLevel: 1, currentLevel: 1, xp: 0, className: "Envoy", ancestry: "Human", background: null, backstory: "Raised aboard a station.", notes: null, isOwner: true }));
  });
});
