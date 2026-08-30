import { describe, expect, it } from "vitest";
import { evaluateChronicleEligibility, shouldAutomaticallyApplyChronicle } from "@/character/chronicles";
import { defaultPregenLevel, isValidPregenLevel } from "@/character/sfs2-pregens";

describe("Starfinder Society 2E Chronicle eligibility", () => {
  it.each([3, 4])("accepts normal play at boundary level %i", (level) => {
    expect(evaluateChronicleEligibility(3, 4, level, level, "normal")).toBe("eligible");
  });

  it.each([1, 2, 5])("rejects out-of-range normal play at level %i", (level) => {
    expect(evaluateChronicleEligibility(3, 4, level, level, "normal")).toBe("ineligible");
  });

  it("allows but does not automatically apply pregen credit to a level-1 recipient", () => {
    expect(evaluateChronicleEligibility(3, 4, 3, 1, "pregen")).toBe("eligible");
    expect(shouldAutomaticallyApplyChronicle("pregen", 3, 1, "eligible")).toBe(false);
    expect(shouldAutomaticallyApplyChronicle("pregen", 3, 3, "eligible")).toBe(true);
  });

  it("requires an available Iconic Pregen level within the scenario range", () => {
    expect(isValidPregenLevel(3, 4, 3)).toBe(true);
    expect(isValidPregenLevel(3, 4, 4)).toBe(false);
    expect(isValidPregenLevel(3, 4, 1)).toBe(false);
    expect(isValidPregenLevel(3, 4, 5)).toBe(false);
    expect(isValidPregenLevel(1, 8, 1)).toBe(true);
    expect(isValidPregenLevel(1, 8, 3)).toBe(true);
    expect(isValidPregenLevel(1, 8, 5)).toBe(true);
    expect(isValidPregenLevel(1, 8, 7)).toBe(true);
    expect(isValidPregenLevel(1, 8, 2)).toBe(false);
    expect(isValidPregenLevel(1, 8, 6)).toBe(false);
  });

  it("defaults to the published pregen level allowed by the scenario", () => {
    expect(defaultPregenLevel(1, 2)).toBe(1);
    expect(defaultPregenLevel(3, 4)).toBe(3);
    expect(defaultPregenLevel(5, 6)).toBe(5);
    expect(defaultPregenLevel(7, 8)).toBe(7);
  });

  it("holds pregen credit below the pregen level and loses it above that level", () => {
    expect(evaluateChronicleEligibility(3, 4, 3, 2, "pregen")).toBe("held");
    expect(evaluateChronicleEligibility(3, 4, 3, 3, "pregen")).toBe("eligible");
    expect(evaluateChronicleEligibility(3, 4, 3, 4, "pregen")).toBe("ineligible");
  });

  it("treats below-range GM credit as pregen credit at the scenario minimum", () => {
    expect(evaluateChronicleEligibility(3, 4, 1, 1, "gm")).toBe("eligible");
    expect(evaluateChronicleEligibility(3, 4, 2, 2, "gm")).toBe("held");
    expect(evaluateChronicleEligibility(3, 4, 3, 3, "gm")).toBe("eligible");
  });

  it("allows an explicitly authorized correction", () => {
    expect(evaluateChronicleEligibility(3, 4, 1, 1, "correction")).toBe("eligible");
  });
});
