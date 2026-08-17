import { describe, expect, it } from "vitest";
import { discoveryHref, parseDiscoveryQuery } from "@/app/communities/discovery-query";

describe("public community discovery query", () => {
  it("normalizes a search and accepts a positive page", () => {
    expect(parseDiscoveryQuery({ q: "  Absalom   Lodge ", page: "2" })).toEqual({
      query: "Absalom Lodge",
      page: 2,
    });
  });

  it("fails safely for malformed, repeated, and oversized parameters", () => {
    const parsed = parseDiscoveryQuery({ q: ["x".repeat(120), "private-name"], page: "-4" });

    expect(parsed.query).toHaveLength(100);
    expect(parsed.query).not.toContain("private-name");
    expect(parsed.page).toBe(1);
  });

  it("preserves normalized searches in pagination links", () => {
    expect(discoveryHref("Absalom & Beyond", 3)).toBe(
      "/communities?q=Absalom+%26+Beyond&page=3",
    );
    expect(discoveryHref("", 1)).toBe("/communities");
  });
});
