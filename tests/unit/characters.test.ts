import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCharacterInputSchema, formatSocietyNumber, updateCharacterInputSchema } from "@/character/characters";
import { nextAvailableCharacterNumber, normalizeCharacterNumber } from "@/app/characters/new/character-form";
import { CharacterProgress } from "@/app/characters/[characterId]/character-progress";
describe("character creation", () => {
  it("accepts and normalizes required fields", () => {
    expect(createCharacterInputSchema.parse({ name: "  Navasi  ", characterNumber: " 01 " })).toEqual({ name: "Navasi", characterNumber: "01", startingLevel: 1, startingCredits: 150, startingItems: [], className: null, ancestry: null, background: null, backstory: null, notes: null });
  });
  it.each([
    { name: "", characterNumber: "01" },
    { name: "Navasi", characterNumber: "" },
    { name: "Navasi", characterNumber: "00" },
    { name: "Navasi", characterNumber: "100" },
  ])("rejects invalid information", (input) => expect(createCharacterInputSchema.safeParse(input).success).toBe(false));

  it("normalizes optional character details", () => {
    expect(createCharacterInputSchema.parse({ name: "Navasi", characterNumber: "01", startingLevel: "7", className: "  Envoy ", ancestry: "  Human  ", background: "   " })).toEqual({
      name: "Navasi", characterNumber: "01", startingLevel: 7, startingCredits: 7200, startingItems: [], className: "Envoy", ancestry: "Human", background: null, backstory: null, notes: null,
    });
  });

  it("rejects unsupported character classes", () => {
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", className: "Vanguard" }).success).toBe(false);
    expect(updateCharacterInputSchema.safeParse({ name: "Navasi", className: "Technomancer" }).success).toBe(false);
  });

  it.each([0, 2, 4, 6, 8, 20, 1.5, "not a level"])("rejects invalid starting level %s", (startingLevel) => {
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel }).success).toBe(false);
  });

  it.each([1, 3, 5, 7])("accepts Society starting level %s", (startingLevel) => {
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel }).success).toBe(true);
  });

  it.each([[1, 150], [3, 750], [5, 2700], [7, 7200]])("accepts %i credits at starting level %i", (startingLevel, startingCredits) => {
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel, startingCredits }).success).toBe(true);
  });

  it.each([[3, 250, 3], [5, 500, 6], [7, 1250, 6]])("requires every item for level %i permanent wealth", (startingLevel, startingCredits, count) => {
    const startingItems = Array.from({ length: count }, (_, index) => ({ url: `https://2e.aonsrd.com/treasure/${index + 1}-item`, name: `Item ${index + 1}` }));
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel, startingCredits }).success).toBe(false);
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel, startingCredits, startingItems }).success).toBe(true);
  });

  it("rejects starting items with the credits-only option", () => {
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel: 3, startingCredits: 750, startingItems: [{ url: "https://2e.aonsrd.com/treasure/1-item", name: "Item" }] }).success).toBe(false);
  });

  it.each([[1, 250], [3, 150], [5, 750], [7, 2700], [7, -1]])("rejects %i credits at starting level %i", (startingLevel, startingCredits) => {
    expect(createCharacterInputSchema.safeParse({ name: "Navasi", characterNumber: "01", startingLevel, startingCredits }).success).toBe(false);
  });

  it("does not expose starting level through character updates", () => {
    expect(updateCharacterInputSchema.parse({ name: "Navasi", startingLevel: 7 })).toEqual({ name: "Navasi", className: null, ancestry: null, background: null, backstory: null, notes: null });
  });

  it("applies reasonable detail length limits", () => {
    expect(updateCharacterInputSchema.safeParse({ name: "Navasi", className: "x".repeat(101) }).success).toBe(false);
    expect(updateCharacterInputSchema.safeParse({ name: "Navasi", backstory: "x".repeat(5001) }).success).toBe(false);
  });

  it("formats Starfinder 2E character numbers", () => {
    expect(formatSocietyNumber("123456", "01")).toBe("123456-2701");
  });

  it("pads valid one-digit character numbers when the field loses focus", () => {
    expect(normalizeCharacterNumber("2")).toBe("02");
    expect(normalizeCharacterNumber(" 9 ")).toBe("09");
    expect(normalizeCharacterNumber("12")).toBe("12");
    expect(normalizeCharacterNumber("0")).toBe("0");
  });

  it("suggests the first unused Society character number", () => {
    expect(nextAvailableCharacterNumber(["01", "03"])).toBe("02");
    expect(nextAvailableCharacterNumber(["1", "02"])).toBe("03");
    expect(nextAvailableCharacterNumber(Array.from({ length: 99 }, (_, index) => String(index + 1)))).toBe("");
  });

  it("shows immutable starting level and placeholder progression state", () => {
    const html = renderToStaticMarkup(CharacterProgress({ startingLevel: 5, currentLevel: 5, xp: 0 }));
    expect(html).toContain("Starting level");
    expect(html).toContain("Current level");
    expect(html).toContain("XP");
    expect(html).toContain(">5<");
    expect(html).toContain(">0<");
  });

  it("preserves supported legacy levels and fails loudly for unsupported rows before constraining the column", () => {
    const migration = readFileSync(new URL("../../drizzle/0024_small_franklin_storm.sql", import.meta.url), "utf8");
    expect(migration.indexOf("level NOT IN (1, 3, 5, 7)")).toBeLessThan(migration.indexOf('RENAME COLUMN "level" TO "starting_level"'));
    expect(migration).toContain("RAISE EXCEPTION 'Cannot migrate characters with unsupported Society starting levels:");
    expect(migration).toContain('CHECK ("characters"."starting_level" in (1, 3, 5, 7))');
  });
});
