import { describe, expect, it } from "vitest";
import { groupScenarioOptions } from "@/app/scenario-selector";

describe("shared scenario selector", () => {
  it("groups and naturally sorts scenarios by season", () => {
    expect(groupScenarioOptions([
      { id: "two", code: "2-10", title: "Later" },
      { id: "special", code: "SPECIAL-01", title: "Special" },
      { id: "one-b", code: "1-10", title: "Tenth" },
      { id: "one-a", code: "1-2", title: "Second" },
    ])).toEqual([
      { label: "Season 1", options: [expect.objectContaining({ id: "one-a" }), expect.objectContaining({ id: "one-b" })] },
      { label: "Season 2", options: [expect.objectContaining({ id: "two" })] },
      { label: "Other scenarios", options: [expect.objectContaining({ id: "special" })] },
    ]);
  });
});
