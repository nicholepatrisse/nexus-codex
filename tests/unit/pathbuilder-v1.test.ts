import { describe, expect, it } from "vitest";
import { parsePathbuilderImportV1, PathbuilderImportError } from "@/import/pathbuilder-v1";

const exportJson = (build: Record<string, unknown>) => JSON.stringify({ success: true, build });
const base = { name: "Vey", level: 1, class: "Envoy", ancestry: "Android", heritage: "Warrior Android", background: "Ace Pilot" };

describe("Pathbuilder import adapter v1", () => {
  it.each([
    ["Vey", "Warrior Android", [["Quick Recognition", null, "General Feat", 1], ["Group Impression", "Diplomacy", "Skill Feat", 1], ["Toughness", null, "Awarded Feat", 1]]],
    ["Kess", "Moonborn", Array.from({ length: 8 }, (_, i) => [`Feat ${i + 1}`, null, i === 7 ? "Awarded Feat" : "Class Feat", Math.min(i + 1, 20)])],
  ])("parses the anonymized %s fixture", (name, heritage, feats) => {
    const result = parsePathbuilderImportV1(exportJson({ ...base, name, heritage, feats }));
    expect(result.character.heritages).toEqual([heritage]);
    expect(result.feats).toHaveLength(feats.length);
    expect(result.feats.at(-1)).toMatchObject({ exportedCategory: feats.at(-1)?.[2], provenance: "probable-awarded" });
  });

  it("preserves extended parent and child relationships", () => {
    const result = parsePathbuilderImportV1(exportJson({ ...base, feats: [
      ["Multitalented", null, "Ancestry Feat", 9, "Multitalented", "parentChoice", null],
      ["Envoy Dedication", null, "Archetype Feat", 9, "Multitalented Envoy", "childChoice", "Multitalented"],
    ] }));
    expect(result.feats.map((feat) => feat.relationship)).toEqual([
      { choiceRef: "Multitalented", kind: "parentChoice", parentChoiceRef: null },
      { choiceRef: "Multitalented Envoy", kind: "childChoice", parentChoiceRef: "Multitalented" },
    ]);
  });

  it("reports unsupported build fields", () => {
    expect(parsePathbuilderImportV1(exportJson({ ...base, feats: [], spells: ["Daze"], deity: "Triune" })).unsupportedFields).toEqual([
      { path: "build.spells", valueType: "array" }, { path: "build.deity", valueType: "string" },
    ]);
  });

  it.each([
    ["malformed", "{"],
    ["unrelated", JSON.stringify({ hello: "world" })],
    ["foundry", JSON.stringify({ name: "Actor", type: "character", system: {}, items: [] })],
    ["bad tuple", exportJson({ ...base, feats: [["Feat", null, "Class Feat"]] })],
  ])("rejects %s JSON", (_label, json) => expect(() => parsePathbuilderImportV1(json)).toThrow(PathbuilderImportError));

  it("rejects oversized and deeply nested JSON", () => {
    expect(() => parsePathbuilderImportV1(`{"padding":"${"x".repeat(1_000_000)}"}`)).toThrow(/exceeds/);
    let nested: unknown = "end";
    for (let i = 0; i < 22; i++) nested = { nested };
    expect(() => parsePathbuilderImportV1(JSON.stringify(nested))).toThrow(/depth/);
  });
});
