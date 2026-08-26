import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter, getCharacterDetail, listCharacters, updateCharacter } from "@/character/characters";
import { applyManualChronicle, createManualChronicle, deleteManualChronicle, listChronicles, unapplyManualChronicle, updateManualChronicle } from "@/character/chronicles";
import { createCreditAdjustment, getOwnedCreditLedger } from "@/character/credit-ledger";
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

  it("owner-manages manual Chronicles without changing identity", async () => {
    const owner = await createTestIdentity({ name: "Chronicle Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Chronicle Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "777777" }).where(eq(people.id, owner.person.id));
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    const character = await createCharacter(ownerActor, { name: "Chronicle Hero", characterNumber: "01" });
    if (!character) throw new Error("Expected character creation.");
    const first = await createManualChronicle(ownerActor, character.id, { scenarioNumber: "1-02", scenarioName: "Second", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 4, creditsMinor: 100, reputation: 2, downtime: 8 });
    const second = await createManualChronicle(ownerActor, character.id, { scenarioNumber: "1-01", scenarioName: "First", datePlayed: "2026-08-21", characterLevel: 1, advancementSpeed: "slow", xp: 2, creditsMinor: 50, reputation: 1, downtime: 4 });
    if (!first || !second) throw new Error("Expected Chronicle creation.");
    expect(first).toEqual(expect.objectContaining({ status: "pending", appliedAt: null, provenance: "manual", playedOn: "2026-08-20" }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ xp: 0, creditsMinor: 0, reputation: 0, downtime: 0 }));
    expect(await createManualChronicle(otherActor, character.id, { scenarioNumber: "x", scenarioName: "Unauthorized", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, creditsMinor: 0, reputation: 0, downtime: 0 })).toBeNull();
    expect((await listChronicles(character.id)).map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(await updateManualChronicle(otherActor, character.id, first.id, { scenarioNumber: "x", scenarioName: "Stolen", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, creditsMinor: 0, reputation: 0, downtime: 0 })).toBeNull();
    const updated = await updateManualChronicle(ownerActor, character.id, first.id, { scenarioNumber: "1-02", scenarioName: "Updated snapshot", datePlayed: "2026-08-22", characterLevel: 2, advancementSpeed: "standard", xp: 12, creditsMinor: 225, reputation: 3, downtime: 9 });
    expect(updated).toEqual(expect.objectContaining({ id: first.id, scenarioNameSnapshot: "Updated snapshot", creditsMinor: 225 }));
    expect(await applyManualChronicle(otherActor, character.id, first.id)).toBeNull();
    const appliedAt = new Date("2026-08-23T10:00:00Z");
    expect(await applyManualChronicle(ownerActor, character.id, first.id, getDb(), appliedAt)).toEqual(expect.objectContaining({ status: "applied", appliedAt }));
    expect(await applyManualChronicle(ownerActor, character.id, first.id, getDb(), new Date("2026-08-24T10:00:00Z"))).toEqual(expect.objectContaining({ status: "applied", appliedAt }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ xp: 12, currentLevel: 2, creditsMinor: 225, reputation: 3, downtime: 9 }));
    expect(await listCharacters(ownerActor)).toEqual([expect.objectContaining({ id: character.id, totalXp: 12, currentLevel: 2 })]);
    expect(await updateManualChronicle(ownerActor, character.id, first.id, { scenarioNumber: "x", scenarioName: "Applied edit", datePlayed: "2026-08-22", characterLevel: 2, advancementSpeed: "standard", xp: 99, creditsMinor: 250, reputation: 99, downtime: 99 })).toEqual(expect.objectContaining({ status: "applied", creditsMinor: 250 }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ creditsMinor: 250 }));
    expect(await deleteManualChronicle(ownerActor, character.id, first.id)).toBe(false);
    expect(await unapplyManualChronicle(ownerActor, character.id, first.id)).toEqual(expect.objectContaining({ status: "pending", appliedAt: null }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ xp: 0, creditsMinor: 0, reputation: 0, downtime: 0 }));
    expect(await deleteManualChronicle(otherActor, character.id, first.id)).toBe(false);
    expect(await deleteManualChronicle(ownerActor, character.id, first.id)).toBe(false);
    expect(await deleteManualChronicle(ownerActor, character.id, second.id)).toBe(true);
    expect((await listChronicles(character.id)).map((entry) => entry.id)).toEqual([first.id]);
    expect(await getOwnedCreditLedger(otherActor, character.id)).toBeNull();
    expect(await createCreditAdjustment(otherActor, character.id, { amountMinor: -25, effectiveOn: "2026-08-24", notes: "Not mine" })).toBeNull();
    expect(await createCreditAdjustment(ownerActor, character.id, { amountMinor: -25, effectiveOn: "2026-08-24", notes: "Purchase correction" })).toEqual(expect.objectContaining({ amountMinor: -25, type: "adjustment", source: "owner_adjustment" }));
    const adjusted = await getOwnedCreditLedger(ownerActor, character.id);
    expect(adjusted?.balanceMinor).toBe(-25);
    expect(adjusted?.entries.map(({ amountMinor }) => amountMinor)).toEqual([225, 25, -250, -25, 0]);
    expect(await applyManualChronicle(ownerActor, character.id, first.id)).toEqual(expect.objectContaining({ status: "applied" }));
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.balanceMinor).toBe(225);
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.entries.filter(({ type }) => type === "chronicle_reward")).toHaveLength(1);
  });
});
