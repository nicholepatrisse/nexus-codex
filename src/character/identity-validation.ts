import { CHARACTER_CLASSES } from "@/character/class-options";
import type { ValidationResult } from "@/validation/advisory-validation";
import { validated, validationReasons } from "@/validation/advisory-validation";
import { isFreeAccessMaterial, materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

export type IdentitySelectionType = "class" | "ancestry" | "background";
export type IdentityValidationOption = { optionType: IdentitySelectionType; name: string; sourceMaterialIdentity: string | null; sourceMaterialTitle: string | null; sourceUrl?: string | null; metadata: Record<string, unknown> };
export type IdentityValidationContext = { options: IdentityValidationOption[]; ownedMaterialIdentities: string[] };

export function validateIdentitySelection(type: IdentitySelectionType, value: string, context: IdentityValidationContext, hasChronicleAccess = false): ValidationResult | null {
  const selection = value.trim();
  if (!selection) return null;
  const option = context.options.find((candidate) => candidate.optionType === type && candidate.name.localeCompare(selection, undefined, { sensitivity: "accent" }) === 0);
  if (!option && type === "class" && CHARACTER_CLASSES.some((name) => name === selection)) return validated();
  if (!option) return validationReasons.unknownOption(`${selection} is not in the available ${type} catalog. Keep it selected and add a note if you know its source.`);
  if (option.metadata.societyLegal === false) return validationReasons.societyRestriction(`${selection} is marked as unavailable for Society play.`);
  if (!option.sourceMaterialIdentity || !option.sourceMaterialTitle) return hasChronicleAccess && type !== "class" ? validationReasons.unsupportedAccessRule(`A Source Chronicle is linked for ${selection}, but Nexus cannot yet verify that it grants this ${type}. GM review is required.`) : validationReasons.incompleteSourceData(`The source information for ${selection} is incomplete.`);
  if (isFreeAccessMaterial(option.sourceMaterialTitle)) return validated();
  const canonicalIdentity = normalizeMaterialIdentity(materialTitleWithoutCitation(option.sourceMaterialTitle));
  if (!context.ownedMaterialIdentities.includes(option.sourceMaterialIdentity) && !context.ownedMaterialIdentities.includes(canonicalIdentity)) return hasChronicleAccess && type !== "class" ? validationReasons.unsupportedAccessRule(`A Source Chronicle is linked for ${selection}, but Nexus cannot yet verify that it grants this ${type}. GM review is required.`) : validationReasons.missingMaterialOwnership(`Add ${option.sourceMaterialTitle} to your owned materials to validate this selection.`);
  return validated();
}

export function identitySelectionNeedsChronicle(type: Exclude<IdentitySelectionType, "class">, value: string, context: IdentityValidationContext) {
  return validateIdentitySelection(type, value, context)?.status === "unvalidated";
}
