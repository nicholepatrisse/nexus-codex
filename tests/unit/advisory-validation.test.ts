import { describe, expect, it } from "vitest";
import {
  aggregateValidationResults,
  validated,
  validationReasons,
} from "@/validation/advisory-validation";

describe("advisory validation", () => {
  it("returns validated when all implemented rules are satisfied", () => {
    expect(validated()).toEqual({ status: "validated", issues: [] });
    expect(aggregateValidationResults([])).toEqual(validated());
  });

  it.each([
    ["missing material ownership", validationReasons.missingMaterialOwnership("Player ownership is not recorded."), true],
    ["missing source data", validationReasons.missingSourceData("The source is unavailable."), false],
    ["incomplete source data", validationReasons.incompleteSourceData("The source omits access rules."), false],
    ["unsupported access rules", validationReasons.unsupportedAccessRule("This access rule is not supported."), false],
    ["an unknown option", validationReasons.unknownOption("This option is not in the catalog."), false],
  ])("treats %s as unvalidated", (_reason, result, resolvable) => {
    expect(result.status).toBe("unvalidated");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ severity: "warning", resolvable });
  });

  it("reserves invalid for a positively identified Society restriction", () => {
    expect(validationReasons.societyRestriction("The option is not legal for Society play.")).toEqual({
      status: "invalid",
      issues: [{
        type: "society_restriction",
        severity: "error",
        message: "The option is not legal for Society play.",
        resolvable: true,
      }],
    });
  });

  it("aggregates status and issues deterministically", () => {
    const unknown = validationReasons.unknownOption("Unknown option.");
    const ownership = validationReasons.missingMaterialOwnership("Ownership missing.");
    const restriction = validationReasons.societyRestriction("Society restriction.");

    const forward = aggregateValidationResults([unknown, validated(), restriction, ownership]);
    const reverse = aggregateValidationResults([ownership, restriction, validated(), unknown]);

    expect(forward).toEqual(reverse);
    expect(forward.status).toBe("invalid");
    expect(forward.issues.map((issue) => issue.type)).toEqual([
      "missing_material_ownership",
      "society_restriction",
      "unknown_option",
    ]);
  });

  it("does not expose a write-control decision", () => {
    const result = validationReasons.societyRestriction("Society restriction.");

    expect(result).not.toHaveProperty("allowed");
    expect(result).not.toHaveProperty("canSave");
  });
});
