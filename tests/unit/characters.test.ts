import { describe, expect, it } from "vitest";
import { createCharacterInputSchema, formatSocietyNumber } from "@/character/characters";
import { normalizeCharacterNumber } from "@/app/characters/new/character-form";
describe("character creation", () => {
  it("accepts and normalizes required fields", () => {
    expect(createCharacterInputSchema.parse({ name: "  Navasi  ", characterNumber: " 01 " })).toEqual({ name: "Navasi", characterNumber: "01" });
  });
  it.each([
    { name: "", characterNumber: "01" },
    { name: "Navasi", characterNumber: "" },
    { name: "Navasi", characterNumber: "00" },
    { name: "Navasi", characterNumber: "100" },
  ])("rejects invalid information", (input) => expect(createCharacterInputSchema.safeParse(input).success).toBe(false));

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
