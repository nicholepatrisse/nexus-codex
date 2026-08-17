import { describe, expect, it } from "vitest";
import { normalizeCommunitySlug } from "@/community/create-community";

describe("community slug normalization", () => {
  it("normalizes punctuation, whitespace, case, and diacritics", () => {
    expect(normalizeCommunitySlug("  Ákiton’s Best!!!  ")).toBe("akiton-s-best");
  });

  it("produces only safe lowercase path segments", () => {
    expect(normalizeCommunitySlug("My_Group / Society")).toBe("my-group-society");
  });
});
