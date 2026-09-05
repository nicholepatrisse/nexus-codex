import { describe, expect, it } from "vitest";
import { validateCharacterOptionSelection } from "@/character/option-selection-validation";
import type { CharacterOptionSelection } from "@/character/option-selections";
import type { IdentityValidationContext } from "@/character/identity-validation";

const selection = (fields: Partial<CharacterOptionSelection> = {}): CharacterOptionSelection => ({ id: "selection-1", characterId: "character-1", selectionKind: "feat", featCategory: "general", acquiredLevel: 3, acquisitionMethod: "selected", grantOrigin: null, characterOptionId: "option-1", nameSnapshot: "Catalog Option", sourceMaterialIdentitySnapshot: "player-core", sourceMaterialTitleSnapshot: "Player Core", sourceUrlSnapshot: "https://2e.aonsrd.com/feats/1", validationNote: null, sourceChronicleId: null, createdAt: new Date(), updatedAt: new Date(), ...fields });
const context = (metadata: Record<string, unknown> = {}, fields: Partial<IdentityValidationContext["options"][number]> = {}): IdentityValidationContext => ({ ownedMaterialIdentities: ["player-core"], options: [{ id: "option-1", optionType: "feat", name: "Catalog Option", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Player Core", sourceUrl: "https://2e.aonsrd.com/feats/1", metadata, ...fields }] });
const character = { className: "Envoy", ancestry: "Human" };

describe("heritage and feat advisory validation", () => {
  it("validates a supported owned catalog feat", () => expect(validateCharacterOptionSelection(selection(), character, context({ level: 2, featCategory: "general" })).status).toBe("validated"));

  it("marks confirmed Society restrictions invalid", () => expect(validateCharacterOptionSelection(selection(), character, context({ societyLegal: false })).status).toBe("invalid"));

  it.each([
    ["unknown catalog selection", selection({ characterOptionId: null }), context()],
    ["awarded feat", selection({ acquisitionMethod: "awarded", grantOrigin: "Scenario reward" }), context()],
    ["unsupported prerequisite", selection(), context({ prerequisites: "trained in Society" })],
    ["linked Chronicle", selection({ sourceChronicleId: "chronicle-1" }), context()],
    ["wrong level", selection({ acquiredLevel: 1 }), context({ level: 2 })],
    ["wrong category", selection({ featCategory: "skill" }), context({ featCategory: "general" })],
    ["wrong class", selection(), context({ classRestrictions: ["Mystic"] })],
    ["wrong ancestry", selection(), context({ ancestryRestrictions: ["Android"] })],
  ])("keeps %s as Needs Review", (_label, value, validationContext) => expect(validateCharacterOptionSelection(value, character, validationContext).status).toBe("unvalidated"));

  it("checks reliable heritage ancestry metadata", () => expect(validateCharacterOptionSelection(selection({ selectionKind: "heritage", featCategory: null }), character, context({ ancestryRestrictions: ["Android"] }, { optionType: "heritage" })).status).toBe("unvalidated"));
});
