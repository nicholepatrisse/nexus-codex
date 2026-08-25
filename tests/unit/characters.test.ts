import { describe, expect, it } from "vitest";
import { createCharacterInputSchema, formatSocietyNumber } from "@/character/characters";
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
});
