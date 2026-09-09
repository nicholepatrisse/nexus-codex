import type { CharacterOptionSelection } from "@/character/option-selections";
import type { IdentityValidationContext } from "@/character/identity-validation";
import type { ValidationResult } from "@/validation/advisory-validation";
import { aggregateValidationResults, validated, validationReasons } from "@/validation/advisory-validation";
import { isFreeAccessMaterial, materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

type CharacterIdentity = { className: string | null; ancestry: string | null; background?: string | null };


/** Advisory validation only: callers must never use this result to gate writes or play. */
export function validateCharacterOptionSelection(selection: CharacterOptionSelection, _character: CharacterIdentity, context: IdentityValidationContext): ValidationResult {
  const option = selection.characterOptionId
    ? context.options.find((candidate) => candidate.id === selection.characterOptionId && candidate.optionType === selection.selectionKind)
    : null;
  if (!option) return validationReasons.unknownOption(`${selection.nameSnapshot} is not linked to a known ${selection.selectionKind} catalog entry. Import its rules page or add a note for GM review.`);
  if (option.metadata.societyLegal === false || option.metadata.societyStatus === "restricted") return validationReasons.societyRestriction(`${selection.nameSnapshot} is marked as unavailable for Society play.`);

  const results: ValidationResult[] = [];
  if (!option.sourceMaterialIdentity || !option.sourceMaterialTitle) results.push(validationReasons.incompleteSourceData(`The source information for ${selection.nameSnapshot} is incomplete.`));
  else if (!isFreeAccessMaterial(option.sourceMaterialTitle)) {
    const canonical = normalizeMaterialIdentity(materialTitleWithoutCitation(option.sourceMaterialTitle));
    if (!context.ownedMaterialIdentities.includes(option.sourceMaterialIdentity) && !context.ownedMaterialIdentities.includes(canonical)) results.push(validationReasons.missingMaterialOwnership(`Add ${option.sourceMaterialTitle} to your owned materials to validate this selection.`));
  }
  if (selection.sourceChronicleId) results.push(validationReasons.unsupportedAccessRule(`A Source Chronicle is linked for ${selection.nameSnapshot}, but Nexus cannot yet verify what it grants. GM review is required.`));
  if (option.metadata.societyStatus === "limited") results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} is SFS Limited and requires access that Nexus cannot verify.`));

  return results.length ? aggregateValidationResults(results) : validated();
}
