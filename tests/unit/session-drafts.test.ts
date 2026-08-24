import { describe, expect, it } from "vitest";
import { sessionDraftInputSchema } from "@/session/session-drafts";

const valid = {
  contentItemId: "scenario-1",
  startsAt: "2026-09-01T18:00:00-07:00",
  endsAt: "2026-09-01T22:00:00-07:00",
  displayTimeZone: "America/Phoenix",
  locationType: "physical" as const,
};

describe("session draft input", () => {
  it("requires explicit instants, a real IANA zone, and ordered times", () => {
    expect(sessionDraftInputSchema.safeParse(valid).success).toBe(true);
    expect(sessionDraftInputSchema.safeParse({ ...valid, startsAt: "2026-09-01T18:00:00" }).success).toBe(false);
    expect(sessionDraftInputSchema.safeParse({ ...valid, displayTimeZone: "Phoenix" }).success).toBe(false);
    expect(sessionDraftInputSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success).toBe(false);
  });

  it("accepts UTC instants without changing their meaning", () => {
    const parsed = sessionDraftInputSchema.parse({
      ...valid,
      startsAt: "2026-09-02T01:00:00Z",
      endsAt: "2026-09-02T05:00:00Z",
      displayTimeZone: "UTC",
    });
    expect(new Date(parsed.startsAt).toISOString()).toBe("2026-09-02T01:00:00.000Z");
  });

  it("accepts normalized blank notes across repeated validation boundaries", () => {
    const once = sessionDraftInputSchema.parse({ ...valid, notes: "" });
    expect(once.notes).toBeNull();
    expect(sessionDraftInputSchema.parse(once).notes).toBeNull();
  });
});
