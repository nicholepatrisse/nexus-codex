import { describe, expect, it } from "vitest";
import { communitySlugCandidate, normalizeCommunitySlug } from "@/community/create-community";

describe("community slug normalization", () => {
  it("normalizes punctuation, whitespace, case, and diacritics", () => {
    expect(normalizeCommunitySlug("  Ákiton’s Best!!!  ")).toBe("akiton-s-best");
  });

  it("produces only safe lowercase path segments", () => {
    expect(normalizeCommunitySlug("My_Group / Society")).toBe("my-group-society");
  });

  it("uses deterministic space-themed adjectives for collisions", () => {
    expect(communitySlugCandidate("drift-lodge", 0)).toBe("drift-lodge");
    expect(communitySlugCandidate("drift-lodge", 1)).toBe("drift-lodge-astral");
    expect(communitySlugCandidate("drift-lodge", 2)).toBe("drift-lodge-celestial");
    expect(communitySlugCandidate("drift-lodge", 17)).toBe("drift-lodge-astral-astral");
    expect(communitySlugCandidate("a".repeat(80), 1)).toBe(`${"a".repeat(73)}-astral`);
  });
});
