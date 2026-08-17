import { describe, expect, it } from "vitest";
import * as communityActions from "@/app/communities/new/actions";
import * as communitySettingsActions from "@/app/communities/[slug]/settings/actions";

describe("server action modules", () => {
  it("export only functions at runtime", () => {
    for (const actions of [communityActions, communitySettingsActions]) {
      expect(Object.values(actions)).not.toHaveLength(0);
      expect(Object.values(actions).every((value) => typeof value === "function")).toBe(true);
    }
  });
});
