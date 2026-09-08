import { describe, expect, it } from "vitest";
import type { IdentityValidationOption } from "@/character/identity-validation";
import { parsePathbuilderImportV1 } from "@/import/pathbuilder-v1";
import { resolvePathbuilderImportV1 } from "@/import/pathbuilder-resolution-v1";

const option = (optionType: IdentityValidationOption["optionType"], name: string, metadata: Record<string, unknown> = {}, id = `${optionType}-${name}`): IdentityValidationOption => ({ id, optionType, name, sourceMaterialIdentity: "source", sourceMaterialTitle: "Source", metadata });
const candidate = (fields: Record<string, unknown> = {}) => parsePathbuilderImportV1(JSON.stringify({ success: true, build: { name: "Vey", level: 8, class: "Envoy", ancestry: "Android", heritage: "Warrior Android", background: "Outlaw", feats: [], ...fields } }));

describe("Pathbuilder catalog resolution v1", () => {
  it("resolves exact and explicit alias matches without treating current level as starting level", () => {
    const review = resolvePathbuilderImportV1(candidate({ ancestry: "Ysoki (Ratfolk)" }), [option("class", "Envoy"), option("ancestry", "Ysoki"), option("background", "Outlaw"), option("heritage", "Warrior Android")]);
    expect(review.character.class.status).toBe("exact");
    expect(review.character.ancestry).toMatchObject({ status: "aliased", option: { name: "Ysoki" } });
    expect(review.character.currentLevel).toBe(8);
    expect(review.character).not.toHaveProperty("startingLevel");
  });

  it("resolves Vey's awarded feat category and likely background origin while retaining the raw category", () => {
    const review = resolvePathbuilderImportV1(candidate({ feats: [["Intimidating Shot", null, "Awarded Feat", 1]] }), [
      option("class", "Envoy"), option("ancestry", "Android"), option("heritage", "Warrior Android"),
      option("background", "Outlaw", { grantedFeats: ["Intimidating Shot"] }), option("feat", "Intimidating Shot", { featCategory: "skill" }),
    ]);
    expect(review.feats[0]).toMatchObject({ raw: { exportedCategory: "Awarded Feat" }, featCategory: "skill", categoryStatus: "catalog", acquisitionMethod: "awarded", likelyOrigins: [{ optionType: "background", name: "Outlaw", confidence: "review" }] });
  });

  it("gives Kess review-only class and background origin hints for skill feats", () => {
    const review = resolvePathbuilderImportV1(candidate({ background: "Ace Pilot", feats: [["Digital Diversion", null, "Awarded Feat", 1], ["Express Driver", null, "Awarded Feat", 1]] }), [
      option("class", "Envoy", { awardedFeats: ["Digital Diversion"] }), option("ancestry", "Android"), option("heritage", "Warrior Android"),
      option("background", "Ace Pilot", { feats: ["Express Driver"] }), option("feat", "Digital Diversion", { featCategory: "skill" }), option("feat", "Express Driver", { featCategory: "skill" }),
    ]);
    expect(review.feats.map(({ featCategory, likelyOrigins }) => [featCategory, likelyOrigins[0]?.name, likelyOrigins[0]?.confidence])).toEqual([["skill", "Envoy", "review"], ["skill", "Ace Pilot", "review"]]);
  });

  it("never selects ambiguous or duplicate-name matches and lists unknown values", () => {
    const review = resolvePathbuilderImportV1(candidate({ class: "Mystic", feats: [["Quick Study", null, "Skill Feat", 2], ["Lost Talent", null, "Class Feat", 2]] }), [
      option("ancestry", "Android"), option("background", "Outlaw"), option("heritage", "Warrior Android"),
      option("feat", "Quick Study", { featCategory: "skill" }, "feat-a"), option("feat", "Quick Study", { featCategory: "skill" }, "feat-b"),
    ]);
    expect(review.feats[0]!.match).toMatchObject({ status: "ambiguous", option: null });
    expect(review.feats[0]!.match.candidates).toHaveLength(2);
    expect(review.unresolvedValues).toEqual(expect.arrayContaining([{ path: "class", value: "Mystic", status: "unknown" }, { path: "feat", value: "Quick Study", status: "ambiguous" }, { path: "feat", value: "Lost Talent", status: "unknown" }]));
  });

  it("reports unsupported categories and fields without mutating either input", () => {
    const parsed = candidate({ feats: [["Oddity", null, "Mythic Feat", 1]], spells: ["Daze"] });
    const catalog = [option("class", "Envoy"), option("ancestry", "Android"), option("background", "Outlaw"), option("heritage", "Warrior Android"), option("feat", "Oddity")];
    const before = JSON.stringify({ parsed, catalog });
    const review = resolvePathbuilderImportV1(parsed, catalog);
    expect(review.unsupportedValues).toEqual([{ path: "build.feats[0][2]", value: "Mythic Feat" }]);
    expect(review.unsupportedFields).toEqual([{ path: "build.spells", valueType: "array" }]);
    expect(JSON.stringify({ parsed, catalog })).toBe(before);
  });
});
