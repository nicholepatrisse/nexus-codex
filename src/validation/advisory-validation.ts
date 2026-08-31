export const VALIDATION_STATUSES = ["validated", "unvalidated", "invalid"] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const VALIDATION_ISSUE_TYPES = [
  "missing_material_ownership",
  "missing_source_data",
  "incomplete_source_data",
  "unsupported_access_rule",
  "unknown_option",
  "society_restriction",
] as const;

export type ValidationIssueType = (typeof VALIDATION_ISSUE_TYPES)[number];
export type ValidationIssueSeverity = "warning" | "error";

export type ValidationIssue = Readonly<{
  type: ValidationIssueType;
  severity: ValidationIssueSeverity;
  message: string;
  resolvable: boolean;
}>;

/**
 * Advisory, derived information about a character choice. A validation result
 * deliberately has no `allowed` field and is not part of the persistence model:
 * callers may show or log it, but must not use it as a write gate.
 */
export type ValidationResult = Readonly<{
  status: ValidationStatus;
  issues: readonly ValidationIssue[];
}>;

const statusRank: Record<ValidationStatus, number> = {
  validated: 0,
  unvalidated: 1,
  invalid: 2,
};

const severityRank: Record<ValidationIssueSeverity, number> = {
  warning: 0,
  error: 1,
};

function compareIssues(left: ValidationIssue, right: ValidationIssue) {
  return (
    left.type.localeCompare(right.type) ||
    severityRank[left.severity] - severityRank[right.severity] ||
    left.message.localeCompare(right.message) ||
    Number(left.resolvable) - Number(right.resolvable)
  );
}

function result(status: ValidationStatus, issues: readonly ValidationIssue[]): ValidationResult {
  return Object.freeze({ status, issues: Object.freeze([...issues].sort(compareIssues)) });
}

export function validated(): ValidationResult {
  return result("validated", []);
}

export function unvalidated(
  type: Exclude<ValidationIssueType, "society_restriction">,
  message: string,
  resolvable = true,
): ValidationResult {
  return result("unvalidated", [{ type, severity: "warning", message, resolvable }]);
}

export function invalid(
  type: ValidationIssueType,
  message: string,
  resolvable = true,
): ValidationResult {
  return result("invalid", [{ type, severity: "error", message, resolvable }]);
}

/** Combines independent checks with invalid > unvalidated > validated precedence. */
export function aggregateValidationResults(results: readonly ValidationResult[]): ValidationResult {
  if (results.length === 0) return validated();

  const status = results.reduce<ValidationStatus>(
    (current, candidate) => statusRank[candidate.status] > statusRank[current] ? candidate.status : current,
    "validated",
  );

  return result(status, results.flatMap((candidate) => candidate.issues));
}

export const validationReasons = {
  missingMaterialOwnership(message: string, resolvable = true) {
    return unvalidated("missing_material_ownership", message, resolvable);
  },
  missingSourceData(message: string, resolvable = false) {
    return unvalidated("missing_source_data", message, resolvable);
  },
  incompleteSourceData(message: string, resolvable = false) {
    return unvalidated("incomplete_source_data", message, resolvable);
  },
  unsupportedAccessRule(message: string, resolvable = false) {
    return unvalidated("unsupported_access_rule", message, resolvable);
  },
  unknownOption(message: string, resolvable = false) {
    return unvalidated("unknown_option", message, resolvable);
  },
  societyRestriction(message: string, resolvable = true) {
    return invalid("society_restriction", message, resolvable);
  },
} as const;
