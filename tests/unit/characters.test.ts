import { describe, expect, it } from "vitest";
import { createCharacterInputSchema, formatSocietyNumber, updateCharacterInputSchema } from "@/character/characters";
import { normalizeCharacterNumber } from "@/app/characters/new/character-form";
describe("character creation", () => {
  it("accepts and normalizes required fields", () => {
    expect(createCharacterInputSchema.parse({ name: "  Navasi  ", characterNumber: " 01 " })).toEqual({ name: "Navasi", characterNumber: "01", level: 1, className: null, ancestry: null, background: null, backstory: null, notes: null });
  });
  it.each([
    { name: "", characterNumber: "01" },
    { name: "Navasi", characterNumber: "" },
    { name: "Navasi", characterNumber: "00" },
    { name: "Navasi", characterNumber: "100" },
  ])("rejects invalid information", (input) => expect(createCharacterInputSchema.safeParse(input).success).toBe(false));

  it("normalizes optional character details", () => {
    expect(createCharacterInputSchema.parse({ name: "Navasi", characterNumber: "01", level: "12", className: "  Envoy ", ancestry: "  Human  ", background: "   " })).toEqual({
      name: "Navasi", characterNumber: "01", level: 12, className: "Envoy", ancestry: "Human", background: null, backstory: null, notes: null,
    });
  });

  it.each([0, 21, 1.5, "not a level"])("rejects invalid character level %s", (level) => {
    expect(updateCharacterInputSchema.safeParse({ name: "Navasi", level }).success).toBe(false);
  });

  it("applies reasonable detail length limits", () => {
    expect(updateCharacterInputSchema.safeParse({ name: "Navasi", level: 1, className: "x".repeat(101) }).success).toBe(false);
    expect(updateCharacterInputSchema.safeParse({ name: "Navasi", level: 1, backstory: "x".repeat(5001) }).success).toBe(false);
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
});
