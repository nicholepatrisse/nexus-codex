import { describe, expect, it } from "vitest";
import { createCharacterInputSchema, formatSocietyNumber } from "@/character/characters";
describe("character creation", () => {
  it("accepts and normalizes required fields", () => {
    expect(createCharacterInputSchema.parse({ name: "  Navasi  ", gameSystemId: "sfs2", characterNumber: " 01 " })).toEqual({ name: "Navasi", gameSystemId: "sfs2", characterNumber: "01" });
  });
  it.each([
    { name: "", gameSystemId: "sfs2", characterNumber: "01" },
    { name: "Navasi", gameSystemId: "", characterNumber: "01" },
    { name: "Navasi", gameSystemId: "sfs2", characterNumber: "" },
    { name: "Navasi", gameSystemId: "sfs2", characterNumber: "00" },
    { name: "Navasi", gameSystemId: "sfs2", characterNumber: "100" },
  ])("rejects invalid information", (input) => expect(createCharacterInputSchema.safeParse(input).success).toBe(false));

  it.each([
    ["starfinder-2e", "01", "123456-2701"],
    ["starfinder-1e", "02", "123456-702"],
    ["pathfinder-2e", "03", "123456-2003"],
    ["pathfinder-1e", "4", "123456-4"],
  ])("formats character numbers for %s", (systemCode, characterNumber, expected) => {
    expect(formatSocietyNumber("123456", characterNumber, systemCode)).toBe(expected);
  });
});
