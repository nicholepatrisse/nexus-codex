import { describe, expect, it } from "vitest";
import { deriveSfs2Progression, SFS2_MAXIMUM_LEVEL } from "@/character/sfs2-progression";

describe("Starfinder Society 2E XP-to-level policy", () => {
  it.each([1, 3, 5, 7])("uses supported starting level %i at zero XP", (startingLevel) => {
    expect(deriveSfs2Progression(startingLevel, [])).toEqual({ totalXp: 0, currentLevel: startingLevel, atLevelCap: false });
  });

  it.each([1, 3, 5, 7])("advances from starting level %i every 12 cumulative XP", (startingLevel) => {
    expect(deriveSfs2Progression(startingLevel, [4, 7])).toMatchObject({ totalXp: 11, currentLevel: startingLevel });
    expect(deriveSfs2Progression(startingLevel, [4, 8])).toMatchObject({ totalXp: 12, currentLevel: startingLevel + 1 });
    expect(deriveSfs2Progression(startingLevel, [12, 12, 11])).toMatchObject({ totalXp: 35, currentLevel: startingLevel + 2 });
  });

  it("keeps cumulative XP beyond the supported level cap", () => {
    expect(deriveSfs2Progression(7, [12 * 20])).toEqual({ totalXp: 240, currentLevel: SFS2_MAXIMUM_LEVEL, atLevelCap: true });
  });

  it.each([[2, []], [1, [-1]], [1, [1.5]], [1, [Number.MAX_SAFE_INTEGER, 1]]] as const)("rejects unsupported or invalid data", (startingLevel, rewards) => {
    expect(() => deriveSfs2Progression(startingLevel, rewards)).toThrow(RangeError);
  });
});
