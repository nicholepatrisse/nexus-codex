import type { CharacterOptionSelection } from "@/character/option-selections";
import type { IdentityValidationContext } from "@/character/identity-validation";
import type { ValidationResult } from "@/validation/advisory-validation";
import { aggregateValidationResults, validated, validationReasons } from "@/validation/advisory-validation";
import { isFreeAccessMaterial, materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

type CharacterIdentity = { className: string | null; ancestry: string | null };

const strings = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
const same = (left: string | null, right: string) => Boolean(left && left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0);

/** Advisory validation only: callers must never use this result to gate writes or play. */
export function validateCharacterOptionSelection(selection: CharacterOptionSelection, character: CharacterIdentity, context: IdentityValidationContext): ValidationResult {
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

  const ancestryRestrictions = strings(option.metadata.ancestryRestrictions);
  if (selection.selectionKind === "heritage" && ancestryRestrictions?.length && !ancestryRestrictions.some((value) => same(character.ancestry, value))) results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} requires one of these ancestries: ${ancestryRestrictions.join(", ")}. The recorded ancestry is ${character.ancestry ?? "unknown"}.`));
  if (selection.selectionKind === "feat") {
    const catalogCategory = typeof option.metadata.featCategory === "string" ? option.metadata.featCategory : null;
    if (catalogCategory && selection.featCategory && catalogCategory !== selection.featCategory) results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} is cataloged as a ${catalogCategory} feat, not a ${selection.featCategory} feat.`));
    const level = typeof option.metadata.level === "number" ? option.metadata.level : null;
    if (level !== null && selection.acquiredLevel < level) results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} is a level ${level} feat but was recorded at level ${selection.acquiredLevel}.`));
    const classRestrictions = strings(option.metadata.classRestrictions);
    if (classRestrictions?.length && !classRestrictions.some((value) => same(character.className, value))) results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} requires one of these classes: ${classRestrictions.join(", ")}. The recorded class is ${character.className ?? "unknown"}.`));
    if (ancestryRestrictions?.length && !ancestryRestrictions.some((value) => same(character.ancestry, value))) results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} requires one of these ancestries: ${ancestryRestrictions.join(", ")}. The recorded ancestry is ${character.ancestry ?? "unknown"}.`));
    if (option.metadata.prerequisites) results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} has prerequisites Nexus cannot fully evaluate: ${String(option.metadata.prerequisites)}.`));
    if (selection.acquisitionMethod === "awarded") results.push(validationReasons.unsupportedAccessRule(`${selection.nameSnapshot} was awarded${selection.grantOrigin ? ` by ${selection.grantOrigin}` : ""}; Nexus cannot verify the award or feat-slot rules.`));
  }
  return results.length ? aggregateValidationResults(results) : validated();
}
