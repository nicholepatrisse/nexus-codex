import { describe, expect, it } from "vitest";
import { directoryHref, parseDirectoryQuery } from "@/app/communities/discovery-query";

describe("public community discovery query", () => {
  it("accepts a positive page", () => {
    expect(parseDirectoryQuery({ page: "2" })).toEqual({ page: 2 });
  });

  it("fails safely for malformed and repeated page parameters", () => {
    const parsed = parseDirectoryQuery({ page: ["-4", "2"] });
    expect(parsed.page).toBe(1);
  });

  it("builds pagination links", () => {
    expect(directoryHref(3)).toBe("/communities?page=3");
    expect(directoryHref(1)).toBe("/communities");
  });
});
