import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { identitySelectionNeedsChronicle, validateIdentitySelection, type IdentityValidationContext } from "@/character/identity-validation";
import { AdvisorySelectionField } from "@/character/advisory-selection-field";

const option = { optionType: "ancestry" as const, name: "Android", sourceMaterialIdentity: "galaxy-guide", sourceMaterialTitle: "Galaxy Guide", metadata: {} };

describe("character identity advisory validation", () => {
  it("distinguishes validated, unavailable, and invalid selections", () => {
    expect(validateIdentitySelection("ancestry", "Android", { options: [option], ownedMaterialIdentities: ["galaxy-guide"] })?.status).toBe("validated");
    expect(validateIdentitySelection("ancestry", "Android", { options: [option], ownedMaterialIdentities: [] })?.status).toBe("unvalidated");
    expect(validateIdentitySelection("background", "Uncatalogued", { options: [], ownedMaterialIdentities: [] })?.status).toBe("unvalidated");
    const illegal: IdentityValidationContext = { options: [{ ...option, optionType: "background", name: "Outlaw", metadata: { societyLegal: false } }], ownedMaterialIdentities: ["galaxy-guide"] };
    expect(validateIdentitySelection("background", "Outlaw", illegal)?.status).toBe("invalid");
    expect(validateIdentitySelection("ancestry", "Android", { options: [option], ownedMaterialIdentities: [] }, true)).toMatchObject({ status: "unvalidated", issues: [{ message: expect.stringContaining("GM review is required") }] });
    expect(validateIdentitySelection("background", "Outlaw", illegal, true)?.status).toBe("invalid");
    expect(validateIdentitySelection("background", "Scholar", { options: [{ ...option, optionType: "background", name: "Scholar" }], ownedMaterialIdentities: [] }, true)?.status).toBe("unvalidated");
  });

  it("never produces a write-gating result", () => {
    expect(validateIdentitySelection("class", "Envoy", { options: [], ownedMaterialIdentities: [] })).toEqual({ status: "validated", issues: [] });
    expect(validateIdentitySelection("class", "", { options: [], ownedMaterialIdentities: [] })).toBeNull();
  });

  it("treats Society guides as free access and ignores source page citations", () => {
    const freeGuide = { ...option, optionType: "background" as const, name: "Acquisitive", sourceMaterialIdentity: "starfinder-society-invasions-edge-players-guide-pg-7", sourceMaterialTitle: "Starfinder Society Invasion’s Edge Player’s Guide pg. 7" };
    expect(validateIdentitySelection("background", "Acquisitive", { options: [freeGuide], ownedMaterialIdentities: [] })?.status).toBe("validated");
    const citedBook = { ...option, sourceMaterialIdentity: "galaxy-guide-pg-128", sourceMaterialTitle: "Galaxy Guide pg. 128" };
    expect(validateIdentitySelection("ancestry", "Android", { options: [citedBook], ownedMaterialIdentities: ["galaxy-guide"] })?.status).toBe("validated");
  });

  it.each(["Player Core", "Starfinder Player Core"])("always validates options from %s", (sourceMaterialTitle) => {
    const playerCoreOption = { ...option, sourceMaterialIdentity: "player-core", sourceMaterialTitle };
    expect(validateIdentitySelection("ancestry", "Android", { options: [playerCoreOption], ownedMaterialIdentities: [] })?.status).toBe("validated");
  });

  it.each(["ancestry", "background"] as const)("shows Chronicle access only for unresolved %s selections and reacts to option or ownership changes", (type) => {
    const catalogOption = { ...option, optionType: type, name: type === "ancestry" ? "Human" : "Scholar" };
    const unavailable = { options: [catalogOption], ownedMaterialIdentities: [] };
    expect(identitySelectionNeedsChronicle(type, catalogOption.name, unavailable)).toBe(true);
    expect(validateIdentitySelection(type, catalogOption.name, unavailable, true)?.issues[0]?.message).toContain("Source Chronicle is linked");
    expect(identitySelectionNeedsChronicle(type, catalogOption.name, { ...unavailable, ownedMaterialIdentities: ["galaxy-guide"] })).toBe(false);
    expect(identitySelectionNeedsChronicle(type, catalogOption.name, { options: [{ ...catalogOption, sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Player Core" }], ownedMaterialIdentities: [] })).toBe(false);
    expect(identitySelectionNeedsChronicle(type, "Unknown option", unavailable)).toBe(true);
    expect(identitySelectionNeedsChronicle(type, "", unavailable)).toBe(false);
    expect(identitySelectionNeedsChronicle(type, "Outlaw", { options: [{ ...catalogOption, name: "Outlaw", metadata: { societyLegal: false } }], ownedMaterialIdentities: [] })).toBe(false);
    expect(validateIdentitySelection(type, catalogOption.name, { ...unavailable, ownedMaterialIdentities: ["galaxy-guide"] }, true)?.status).toBe("validated");
  });

  it("communicates status with accessible text and keeps the note editable", () => {
    const html = renderToStaticMarkup(createElement(AdvisorySelectionField, { type: "background", value: "Outlaw", context: { options: [{ ...option, optionType: "background", name: "Outlaw", metadata: { societyLegal: false } }], ownedMaterialIdentities: [] }, note: "Allowed by boon", onNoteChange: () => {} }, createElement("input", { name: "background" })));
    expect(html).not.toContain(">Invalid<");
    expect(html).toContain("unavailable for Society play");
    expect(html).toContain('name="backgroundValidationNote"');
    expect(html).toContain("Allowed by boon");
    expect(html).not.toContain("disabled");
    const validatedHtml = renderToStaticMarkup(createElement(AdvisorySelectionField, { type: "ancestry", value: "Android", context: { options: [option], ownedMaterialIdentities: ["galaxy-guide"] }, note: "obsolete", onNoteChange: () => {} }, createElement("input", { name: "ancestry" })));
    expect(validatedHtml).not.toContain("Validated");
    expect(validatedHtml).not.toContain("Validation note");
    expect(validatedHtml).not.toContain("obsolete");
  });
});
