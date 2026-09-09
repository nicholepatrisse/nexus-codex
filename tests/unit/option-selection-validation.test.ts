import { describe, expect, it } from "vitest";
import { validateCharacterOptionSelection } from "@/character/option-selection-validation";
import type { CharacterOptionSelection } from "@/character/option-selections";
import type { IdentityValidationContext } from "@/character/identity-validation";

const selection = (fields: Partial<CharacterOptionSelection> = {}): CharacterOptionSelection => ({ id: "selection-1", characterId: "character-1", selectionKind: "feat", featCategory: "general", acquiredLevel: 3, acquisitionMethod: "selected", grantOrigin: null, characterOptionId: "option-1", nameSnapshot: "Catalog Option", sourceMaterialIdentitySnapshot: "player-core", sourceMaterialTitleSnapshot: "Player Core", sourceUrlSnapshot: "https://2e.aonsrd.com/feats/1", validationNote: null, sourceChronicleId: null, createdAt: new Date(), updatedAt: new Date(), ...fields });
const context = (metadata: Record<string, unknown> = {}, fields: Partial<IdentityValidationContext["options"][number]> = {}): IdentityValidationContext => ({ ownedMaterialIdentities: ["player-core"], options: [{ id: "option-1", optionType: "feat", name: "Catalog Option", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Player Core", sourceUrl: "https://2e.aonsrd.com/feats/1", metadata, ...fields }] });
const character = { className: "Envoy", ancestry: "Human", background: "Outlaw" };

describe("heritage and feat advisory validation", () => {
  it("validates a supported owned catalog feat", () => expect(validateCharacterOptionSelection(selection(), character, context({ level: 2, featCategory: "general" })).status).toBe("validated"));

  it("validates an exact feat grant from the character's known background", () => {
    const validationContext = context({ level: 1, featCategory: "skill" }, { name: "Intimidating Shot" });
    validationContext.options.push({ optionType: "background", name: "Outlaw", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Player Core", metadata: { grantedFeats: ["Intimidating Shot"] } });
    expect(validateCharacterOptionSelection(selection({ nameSnapshot: "Intimidating Shot", acquiredLevel: 1, featCategory: "skill", acquisitionMethod: "awarded", grantOrigin: "Outlaw" }), character, validationContext).status).toBe("validated");
  });

  it("leaves awarded feat and grant-origin checking to character sheet builders", () => {
    const validationContext = context({ level: 1, featCategory: "ancestry" }, { name: "Natural Ambition" });
    validationContext.options.push({ optionType: "background", name: "Outlaw", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Player Core", metadata: {} });
    expect(validateCharacterOptionSelection(selection({ nameSnapshot: "Natural Ambition", acquiredLevel: 1, featCategory: "ancestry", acquisitionMethod: "awarded", grantOrigin: "Outlaw" }), character, validationContext).status).toBe("validated");
  });

  it("marks confirmed Society restrictions invalid", () => expect(validateCharacterOptionSelection(selection(), character, context({ societyLegal: false })).status).toBe("invalid"));

  it("leaves feat prerequisite checking to character sheet builders", () => expect(validateCharacterOptionSelection(selection(), character, context({ prerequisites: "trained in Society" })).status).toBe("validated"));

  it.each([
    ["level", selection({ acquiredLevel: 1 }), context({ level: 2 })],
    ["category", selection({ featCategory: "skill" }), context({ featCategory: "general" })],
    ["class restriction", selection(), context({ classRestrictions: ["Mystic"] })],
    ["ancestry restriction", selection(), context({ ancestryRestrictions: ["Android"] })],
    ["heritage ancestry restriction", selection({ selectionKind: "heritage", featCategory: null }), context({ ancestryRestrictions: ["Android"] }, { optionType: "heritage" })],
  ])("leaves %s checking to character sheet builders", (_label, value, validationContext) => expect(validateCharacterOptionSelection(value, character, validationContext).status).toBe("validated"));

  it.each([
    ["unknown catalog selection", selection({ characterOptionId: null }), context()],
    ["linked Chronicle", selection({ sourceChronicleId: "chronicle-1" }), context()],
  ])("keeps %s as Needs Review", (_label, value, validationContext) => expect(validateCharacterOptionSelection(value, character, validationContext).status).toBe("unvalidated"));
});
