import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import { createCharacter, getCharacterDetail, InvalidAncestryChronicleError, listCharacters, StartingLevelLockedError, updateCharacter } from "@/character/characters";
import { applyManualChronicle, createManualChronicle, deleteManualChronicle, listChronicles, updateManualChronicle } from "@/character/chronicles";
import { createCreditAdjustment, getOwnedCreditLedger } from "@/character/credit-ledger";
import { createInventoryEntry, deleteInventoryEntry, getOwnedInventoryEntry, listOwnedInventory, updateInventoryEntry, updateInventorySourceChronicle } from "@/character/inventory";
import { getDb } from "@/db/client";
import { authUsers, characterCreditLedgerEntries, characters, gameSystems, people } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
const describeWithDatabase = process.env.CI ? describe : describe.skip;
const userIds: string[] = [];
const systemIds: string[] = [];
const event = { eventName: "Starfinder Nexus", eventCode: "2,690,298" };
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
    const attemptedStartingLevelChange = { name: " Navasi ", startingLevel: 7, startingCredits: 7200, startingItems: [], className: " Envoy ", classValidationNote: "  Acquired through multiclass training.  ", ancestry: "Human", ancestryValidationNote: "  ", background: "  ", backgroundValidationNote: "  Granted by a boon.  ", backstory: "  Raised aboard a station.  ", notes: "  " } as Parameters<typeof updateCharacter>[2];
    expect(await updateCharacter(ownerActor, created.id, attemptedStartingLevelChange)).toEqual(expect.objectContaining({ id: created.id }));
    expect(await getCharacterDetail(ownerActor, created.id)).toEqual(expect.objectContaining({ name: "Navasi", startingLevel: 7, startingCredits: 7200, creditsMinor: 7200, currentLevel: 7, xp: 0, className: "Envoy", classValidationNote: "Acquired through multiclass training.", ancestry: "Human", ancestryValidationNote: null, background: null, backgroundValidationNote: "Granted by a boon.", backstory: "Raised aboard a station.", notes: null, isOwner: true }));

    expect(await updateCharacter(ownerActor, created.id, { name: "Navasi", classValidationNote: "", ancestryValidationNote: null, backgroundValidationNote: "   " })).toEqual(expect.objectContaining({ id: created.id }));
    expect(await getCharacterDetail(ownerActor, created.id)).toEqual(expect.objectContaining({ classValidationNote: null, ancestryValidationNote: null, backgroundValidationNote: null }));
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
    const first = await createManualChronicle(ownerActor, character.id, { ...event, scenarioNumber: "1-02", scenarioName: "Second", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 4, baseCreditsMinor: 100, downtimeDisposition: "declined" });
    const second = await createManualChronicle(ownerActor, character.id, { ...event, scenarioNumber: "1-01", scenarioName: "First", datePlayed: "2026-08-21", characterLevel: 1, advancementSpeed: "slow", xp: 2, baseCreditsMinor: 50, downtimeDisposition: "declined" });
    if (!first || !second) throw new Error("Expected Chronicle creation.");
    expect(first).toEqual(expect.objectContaining({ status: "applied", appliedAt: new Date("2026-08-20T00:00:00Z"), provenance: "manual", playedOn: "2026-08-20", chronicleNumber: "1" }));
    await expect(createManualChronicle(ownerActor, character.id, { ...event, scenarioNumber: " 1-02 ", scenarioName: "Replay", datePlayed: "2026-08-21", characterLevel: 1, advancementSpeed: "standard", xp: 4, baseCreditsMinor: 100, downtimeDisposition: "declined" })).rejects.toThrow("already has a Chronicle for 1-02");
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ xp: 6, creditsMinor: 300 }));
    expect(await createManualChronicle(otherActor, character.id, { ...event, scenarioNumber: "x", scenarioName: "Unauthorized", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" })).toBeNull();
    expect((await listChronicles(character.id)).map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(await updateManualChronicle(otherActor, character.id, first.id, { ...event, scenarioNumber: "x", scenarioName: "Stolen", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" })).toBeNull();
    const updated = await updateManualChronicle(ownerActor, character.id, first.id, { ...event, scenarioNumber: "1-02", scenarioName: "Updated snapshot", datePlayed: "2026-08-22", characterLevel: 2, advancementSpeed: "standard", xp: 12, baseCreditsMinor: 225, downtimeDisposition: "declined" });
    expect(updated).toEqual(expect.objectContaining({ id: first.id, scenarioNameSnapshot: "Updated snapshot", baseCreditsMinor: 225 }));
    expect(await listChronicles(character.id)).toEqual([
      expect.objectContaining({ id: second.id, chronicleNumber: "1" }),
      expect.objectContaining({ id: first.id, chronicleNumber: "2" }),
    ]);
    expect(await applyManualChronicle(otherActor, character.id, first.id)).toBeNull();
    await expect(updateCharacter(ownerActor, character.id, { name: "Chronicle Hero", startingLevel: 3, startingCredits: 750, startingItems: [] })).rejects.toBeInstanceOf(StartingLevelLockedError);
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ xp: 14, currentLevel: 2, creditsMinor: 425 }));
    expect(await listCharacters(ownerActor)).toEqual([expect.objectContaining({ id: character.id, totalXp: 14, currentLevel: 2 })]);
    expect(await updateManualChronicle(ownerActor, character.id, first.id, { ...event, scenarioNumber: "x", scenarioName: "Applied edit", datePlayed: "2026-08-22", characterLevel: 2, advancementSpeed: "standard", xp: 99, baseCreditsMinor: 250, downtimeDisposition: "declined" })).toEqual(expect.objectContaining({ status: "applied", baseCreditsMinor: 250 }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ creditsMinor: 450 }));
    expect(await deleteManualChronicle(otherActor, character.id, first.id)).toBe(false);
    expect(await deleteManualChronicle(ownerActor, character.id, first.id)).toBe(true);
    expect(await listChronicles(character.id)).toEqual([expect.objectContaining({ id: second.id, chronicleNumber: "1" })]);
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ xp: 2, creditsMinor: 200 }));
    expect(await getOwnedCreditLedger(otherActor, character.id)).toBeNull();
    expect(await createCreditAdjustment(otherActor, character.id, { amountMinor: -25, effectiveOn: "2026-08-24", notes: "Not mine" })).toBeNull();
    expect(await createCreditAdjustment(ownerActor, character.id, { amountMinor: -25, effectiveOn: "2026-08-24", notes: "Purchase correction" })).toEqual(expect.objectContaining({ amountMinor: -25, type: "adjustment", source: "owner_adjustment" }));
    const adjusted = await getOwnedCreditLedger(ownerActor, character.id);
    expect(adjusted?.balanceMinor).toBe(175);
    expect((await getOwnedCreditLedger(ownerActor, character.id))?.entries.filter(({ type }) => type === "chronicle_reward")).toHaveLength(1);
  });

  it("derives Chronicle numbers from played date and optional time", async () => {
    const owner = await createTestIdentity({ name: "Chronicle Time Owner", sessions: 0 });
    userIds.push(owner.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "777779" }).where(eq(people.id, owner.person.id));
    const actor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const character = await createCharacter(actor, { name: "Timed Hero", characterNumber: "01" });
    if (!character) throw new Error("Expected character creation.");
    const evening = await createManualChronicle(actor, character.id, { ...event, scenarioNumber: "1-02", scenarioName: "Evening", datePlayed: "2026-08-20", timePlayed: "18:00", characterLevel: 1, advancementSpeed: "standard", xp: 4, baseCreditsMinor: 100, downtimeDisposition: "declined" });
    const morning = await createManualChronicle(actor, character.id, { ...event, scenarioNumber: "1-01", scenarioName: "Morning", datePlayed: "2026-08-20", timePlayed: "10:00", characterLevel: 1, advancementSpeed: "standard", xp: 4, baseCreditsMinor: 100, downtimeDisposition: "declined" });
    if (!evening || !morning) throw new Error("Expected Chronicles.");
    expect(await listChronicles(character.id)).toEqual([
      expect.objectContaining({ id: morning.id, chronicleNumber: "1", appliedAt: new Date("2026-08-20T10:00:00Z") }),
      expect.objectContaining({ id: evening.id, chronicleNumber: "2", appliedAt: new Date("2026-08-20T18:00:00Z") }),
    ]);
  });

  it("owner-manages distinct inventory lots without ledger side effects", async () => {
    const owner = await createTestIdentity({ name: "Inventory Owner", sessions: 0 });
    const other = await createTestIdentity({ name: "Inventory Other", sessions: 0 });
    userIds.push(owner.authUser.id, other.authUser.id);
    await getDb().insert(gameSystems).values({ id: SUPPORTED_GAME_SYSTEM.id, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name }).onConflictDoUpdate({ target: gameSystems.id, set: { code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name } });
    await getDb().update(people).set({ societyPlayNumber: "888888" }).where(eq(people.id, owner.person.id));
    await getDb().update(people).set({ societyPlayNumber: "999999" }).where(eq(people.id, other.person.id));
    const ownerActor = { personId: owner.person.id, authUserId: owner.authUser.id, sessionId: "owner" };
    const otherActor = { personId: other.person.id, authUserId: other.authUser.id, sessionId: "other" };
    const character = await createCharacter(ownerActor, { name: "Equipped Hero", characterNumber: "01" });
    const ownerAltCharacter = await createCharacter(ownerActor, { name: "Boon Earner", characterNumber: "02" });
    const otherCharacter = await createCharacter(otherActor, { name: "Other Hero", characterNumber: "01" });
    if (!character || !ownerAltCharacter || !otherCharacter) throw new Error("Expected characters.");
    const source = await createManualChronicle(ownerActor, character.id, { ...event, scenarioNumber: "1-01", scenarioName: "Source", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" });
    const wrongSource = await createManualChronicle(otherActor, otherCharacter.id, { ...event, scenarioNumber: "1-02", scenarioName: "Wrong source", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" });
    const crossCharacterSource = await createManualChronicle(ownerActor, ownerAltCharacter.id, { ...event, scenarioNumber: "1-03", scenarioName: "Cross-character boon", datePlayed: "2026-08-20", characterLevel: 1, advancementSpeed: "standard", xp: 0, baseCreditsMinor: 0, downtimeDisposition: "declined" });
    if (!source || !wrongSource || !crossCharacterSource) throw new Error("Expected Chronicles.");
    expect(await updateCharacter(ownerActor, character.id, { name: "Equipped Hero", ancestry: "Barathu", ancestrySourceChronicleId: crossCharacterSource.id })).toEqual(expect.objectContaining({ id: character.id }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ ancestrySourceChronicleId: crossCharacterSource.id, ancestrySourceChronicleCharacterId: ownerAltCharacter.id }));
    expect(await updateCharacter(ownerActor, character.id, { name: "Equipped Hero", background: "Chronicle Scholar", backgroundSourceChronicleId: crossCharacterSource.id })).toEqual(expect.objectContaining({ id: character.id }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ background: "Chronicle Scholar", backgroundSourceChronicleId: crossCharacterSource.id, backgroundSourceChronicleCharacterId: ownerAltCharacter.id }));
    await expect(updateCharacter(ownerActor, character.id, { name: "Equipped Hero", background: "Chronicle Scholar", backgroundSourceChronicleId: wrongSource.id })).rejects.toBeInstanceOf(InvalidAncestryChronicleError);
    expect(await updateCharacter(ownerActor, character.id, { name: "Equipped Hero", ancestry: "Barathu", ancestrySourceChronicleId: source.id })).toEqual(expect.objectContaining({ id: character.id }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ ancestry: "Barathu", ancestrySourceChronicleId: source.id }));
    await expect(updateCharacter(ownerActor, character.id, { name: "Equipped Hero", ancestry: "Barathu", ancestrySourceChronicleId: wrongSource.id })).rejects.toBeInstanceOf(InvalidAncestryChronicleError);
    expect(await updateCharacter(ownerActor, character.id, { name: "Equipped Hero", ancestry: "Barathu", ancestrySourceChronicleId: null })).toEqual(expect.objectContaining({ id: character.id }));
    expect(await getCharacterDetail(ownerActor, character.id)).toEqual(expect.objectContaining({ ancestrySourceChronicleId: null }));
    const ledgerBefore = await getDb().select().from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.characterId, character.id));
    const first = await createInventoryEntry(ownerActor, character.id, { itemName: "Laser rifle", quantity: 1, acquisitionType: "purchased", acquiredOn: "2026-08-21", amountPaidMinor: 100, sourceChronicleId: source.id, validationNote: "  Access from Chronicle 1.  " });
    const second = await createInventoryEntry(ownerActor, character.id, { itemName: "Laser rifle", quantity: 2, acquisitionType: "purchased", acquiredOn: "2026-08-21", amountPaidMinor: 125, sourceChronicleId: source.id, validationNote: "Different lot access" });
    const otherCharacterLot = await createInventoryEntry(otherActor, otherCharacter.id, { itemName: "Laser rifle", quantity: 1, acquisitionType: "other", acquiredOn: "2026-08-21", validationNote: "Other character access" });
    if (!first || !second || !otherCharacterLot) throw new Error("Expected inventory entries.");
    expect(first.lotKey).not.toBe(second.lotKey);
    expect((await listOwnedInventory(ownerActor, character.id))?.map(({ amountPaidMinor, validationNote }) => ({ amountPaidMinor, validationNote }))).toEqual([
      { amountPaidMinor: 100, validationNote: "Access from Chronicle 1." },
      { amountPaidMinor: 125, validationNote: "Different lot access" },
    ]);
    expect(await listOwnedInventory(otherActor, character.id)).toBeNull();
    expect(await createInventoryEntry(otherActor, character.id, { itemName: "Stolen", quantity: 1, acquisitionType: "other", acquiredOn: "2026-08-21" })).toBeNull();
    await expect(createInventoryEntry(ownerActor, character.id, { itemName: "Bad source", quantity: 1, acquisitionType: "boon_reward", acquiredOn: "2026-08-21", sourceChronicleId: wrongSource.id })).rejects.toThrow("must belong to this character");
    expect(await updateInventoryEntry(otherActor, character.id, first.id, { itemName: "Stolen", quantity: 9, acquisitionType: "other", acquiredOn: "2026-08-22", validationNote: "Unauthorized note" })).toBeNull();
    expect(await getOwnedInventoryEntry(otherActor, otherCharacter.id, otherCharacterLot.id)).toEqual(expect.objectContaining({ validationNote: "Other character access" }));
    expect(await getOwnedInventoryEntry(ownerActor, character.id, first.id)).toEqual(expect.objectContaining({ validationNote: "Access from Chronicle 1." }));
    expect(await updateInventorySourceChronicle(ownerActor, character.id, first.id, null)).toEqual(expect.objectContaining({ sourceChronicleId: null }));
    expect(await updateInventorySourceChronicle(ownerActor, character.id, first.id, source.id)).toEqual(expect.objectContaining({ sourceChronicleId: source.id }));
    await expect(updateInventorySourceChronicle(ownerActor, character.id, first.id, wrongSource.id)).rejects.toThrow("must belong to this character");
    expect(await updateInventoryEntry(ownerActor, character.id, first.id, { itemName: "Laser rifle snapshot", quantity: 3, acquisitionType: "purchased", acquiredOn: "2026-08-22", amountPaidMinor: 100, validationNote: "   " })).toEqual(expect.objectContaining({ quantity: 3, lotKey: first.lotKey, validationNote: null }));
    expect(await deleteInventoryEntry(otherActor, character.id, second.id)).toBe(false);
    expect(await deleteInventoryEntry(ownerActor, character.id, second.id)).toBe(true);
    const ledgerAfter = await getDb().select().from(characterCreditLedgerEntries).where(eq(characterCreditLedgerEntries.characterId, character.id));
    expect(ledgerAfter).toEqual(ledgerBefore);
  });
});
