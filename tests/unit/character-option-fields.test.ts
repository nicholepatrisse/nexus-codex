import { describe, expect, it } from "vitest";
import { validAcquiredLevel } from "@/app/characters/character-option-fields";

describe("character option fields", () => {
  it("imports every heritage at level 1", () => {
    expect(validAcquiredLevel("heritage", 0)).toBe(1);
    expect(validAcquiredLevel("heritage", 7)).toBe(1);
  });

  it("bounds imported feat levels to valid character levels", () => {
    expect(validAcquiredLevel("feat", 0)).toBe(1);
    expect(validAcquiredLevel("feat", 7)).toBe(7);
    expect(validAcquiredLevel("feat", 21)).toBe(20);
  });
});
