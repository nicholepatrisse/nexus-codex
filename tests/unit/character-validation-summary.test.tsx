import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterValidationSummary as SummaryView } from "@/app/characters/[characterId]/character-validation-summary";
import { deriveCharacterValidationSummary } from "@/character/character-validation-summary";
import type { CharacterDetail } from "@/character/characters";
import type { IdentityValidationContext } from "@/character/identity-validation";
import type { ValidatedInventoryEntry } from "@/character/inventory";
import { invalid, unvalidated, validated } from "@/validation/advisory-validation";
import type { CharacterOptionSelection } from "@/character/option-selections";

const character = (fields: Partial<CharacterDetail> = {}): CharacterDetail => ({ id: "char-1", name: "Nova", societyNumber: "123-2001", gameSystemName: "Starfinder 2E", startingLevel: 1, startingLevelLocked: false, startingCredits: 1000, startingItems: [], currentLevel: 1, xp: 0, creditsMinor: 1000, className: null, classValidationNote: null, ancestry: null, ancestryValidationNote: null, ancestrySourceChronicleId: null, ancestrySourceChronicleCharacterId: null, background: null, backgroundValidationNote: null, backgroundSourceChronicleId: null, backgroundSourceChronicleCharacterId: null, backstory: null, notes: null, isOwner: true, upcomingSessions: [], pastSessions: [], ...fields });
const context: IdentityValidationContext = { ownedMaterialIdentities: ["player-core"], options: [
  { optionType: "ancestry", name: "Human", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Starfinder Player Core", metadata: {} },
  { optionType: "background", name: "Outlaw", sourceMaterialIdentity: "restricted-book", sourceMaterialTitle: "Restricted Book", sourceUrl: "https://2e.aonsrd.com/backgrounds/outlaw", metadata: { societyLegal: false } },
] };
const item = (id: string, status: "validated" | "unvalidated" | "invalid"): ValidatedInventoryEntry => ({ id, itemNameSnapshot: `Item ${id}`, sourceMaterialTitle: "Galaxy Guide", validationNote: status === "validated" ? null : "Access from a boon", validation: status === "validated" ? validated() : status === "unvalidated" ? unvalidated("unsupported_access_rule", "Nexus cannot confirm this access.") : invalid("society_restriction", "This item is SFS Restricted."), } as ValidatedInventoryEntry);
const feat = { id: "feat-1", characterId: "char-1", selectionKind: "feat", featCategory: "general", acquiredLevel: 1, acquisitionMethod: "awarded", grantOrigin: "Scenario reward", characterOptionId: "catalog-feat", nameSnapshot: "Awarded Feat", sourceMaterialIdentitySnapshot: "player-core", sourceMaterialTitleSnapshot: "Starfinder Player Core", sourceUrlSnapshot: "https://2e.aonsrd.com/feats/1", validationNote: "Shown on Chronicle", sourceChronicleId: "chronicle-1", createdAt: new Date(), updatedAt: new Date() } as CharacterOptionSelection;

describe("character validation summary", () => {
  it("treats an empty character as validated with zero counts", () => {
    expect(deriveCharacterValidationSummary(character(), context, [])).toMatchObject({ presentation: "Validated", validatedCount: 0, unvalidatedCount: 0, invalidCount: 0, details: [] });
  });

  it("counts an all-validated character", () => {
    expect(deriveCharacterValidationSummary(character({ className: "Envoy", ancestry: "Human" }), context, [item("1", "validated")])).toMatchObject({ presentation: "Validated", validatedCount: 3, unvalidatedCount: 0, invalidCount: 0 });
  });

  it("uses Needs Review for a mixed character and exposes source, reason, note, and edit link", () => {
    const summary = deriveCharacterValidationSummary(character({ className: "Envoy" }), context, [item("1", "unvalidated")]);
    expect(summary).toMatchObject({ presentation: "Needs Review", validatedCount: 1, unvalidatedCount: 1, invalidCount: 0, details: [{ category: "Inventory", source: "Galaxy Guide", playerNote: "Access from a boon" }] });
    const html = renderToStaticMarkup(createElement(SummaryView, { summary }));
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(html).toContain("Nexus cannot confirm this access.");
    expect(html).toContain("/characters/char-1/inventory/1/edit");
    expect(html).toContain("You can keep editing and using this character");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("illegal");
  });

  it("gives a confirmed invalid selection precedence without relabeling review items", () => {
    const summary = deriveCharacterValidationSummary(character({ ancestry: "Uncatalogued", ancestryValidationNote: "Home campaign option", background: "Outlaw" }), context, [item("1", "validated")]);
    expect(summary).toMatchObject({ presentation: "Rules Issue Found", validatedCount: 1, unvalidatedCount: 1, invalidCount: 1 });
    expect(summary.details.map(({ status }) => status)).toEqual(["unvalidated", "invalid"]);
    expect(summary.details[0]).toMatchObject({ category: "Ancestry", source: null, sourceHref: null, playerNote: "Home campaign option", editHref: "/characters/char-1/edit#ancestry" });
    expect(summary.details[1]).toMatchObject({ source: "Restricted Book", sourceHref: "https://2e.aonsrd.com/backgrounds/outlaw" });
  });

  it("renders GM validation details and notes without edit controls", () => {
    const summary = deriveCharacterValidationSummary(character({ ancestry: "Uncatalogued", ancestryValidationNote: "Ask about my boon", background: "Outlaw" }), context, [item("1", "invalid")]);
    const html = renderToStaticMarkup(createElement(SummaryView, { summary, readOnly: true }));
    expect(html).toContain("Unvalidated");
    expect(html).toContain("Invalid");
    expect(html).toContain("Ask about my boon");
    expect(html).toContain("read-only");
    expect(html).toContain('href="https://2e.aonsrd.com/backgrounds/outlaw"');
    expect(html).not.toContain("Review option");
    expect(html).not.toContain("/edit");
  });

  it("counts each heritage and feat once and links review to its edit section", () => {
    const optionContext: IdentityValidationContext = { ...context, options: [...context.options, { id: "catalog-feat", optionType: "feat", name: "Awarded Feat", sourceMaterialIdentity: "player-core", sourceMaterialTitle: "Starfinder Player Core", sourceUrl: "https://2e.aonsrd.com/feats/1", metadata: { level: 1, featCategory: "general" } }] };
    const summary = deriveCharacterValidationSummary(character(), optionContext, [], [feat]);
    expect(summary).toMatchObject({ validatedCount: 0, unvalidatedCount: 1, invalidCount: 0, details: [{ category: "Feat", playerNote: "Shown on Chronicle", sourceChronicleHref: "/characters/char-1/chronicles/chronicle-1", editHref: "/characters/char-1/edit#heritage-feats" }] });
    expect(renderToStaticMarkup(createElement(SummaryView, { summary, readOnly: true }))).toContain('href="/characters/char-1/chronicles/chronicle-1"');
  });
});
