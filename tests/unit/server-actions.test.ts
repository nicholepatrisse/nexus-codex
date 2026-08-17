import { describe, expect, it } from "vitest";
import * as communityActions from "@/app/communities/new/actions";

describe("server action modules", () => {
  it("export only functions at runtime", () => {
    expect(Object.values(communityActions)).not.toHaveLength(0);
    expect(Object.values(communityActions).every((value) => typeof value === "function")).toBe(true);
  });
});
