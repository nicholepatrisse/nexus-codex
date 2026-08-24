import { describe, expect, it } from "vitest";
import { updateProfileInputSchema } from "@/profile/profile";

describe("profile details", () => {
  it("accepts optional details and normalizes removed values", () => {
    expect(updateProfileInputSchema.parse({ displayName: "  Nova  ", discordHandle: " ", societyPlayNumber: " 12345 " })).toEqual({ displayName: "Nova", discordHandle: null, societyPlayNumber: "12345" });
    expect(updateProfileInputSchema.parse({ displayName: null, discordHandle: null, societyPlayNumber: null })).toEqual({ displayName: null, discordHandle: null, societyPlayNumber: null });
  });

  it("limits profile values", () => {
    expect(updateProfileInputSchema.safeParse({ displayName: "x".repeat(101), discordHandle: "", societyPlayNumber: "" }).success).toBe(false);
  });
});
