import type { ValidationResult } from "@/validation/advisory-validation";
import { validated, validationReasons } from "@/validation/advisory-validation";
import { isFreeAccessMaterial, materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

export type InventoryValidationEntry = {
  itemNameSnapshot: string;
  itemLinkSnapshot: string | null;
  sourceMaterialIdentity: string | null;
  sourceMaterialTitle: string | null;
  societyLegal: boolean | null;
  societyStatus: string | null;
  rarity: string | null;
};

export function validateInventoryEntry(entry: InventoryValidationEntry, ownedMaterialIdentities: readonly string[]): ValidationResult {
  if (entry.societyStatus === "restricted" || entry.societyLegal === false) return validationReasons.societyRestriction(`${entry.itemNameSnapshot} is SFS Restricted.`);
  if (!entry.sourceMaterialTitle) {
    return entry.itemLinkSnapshot
      ? validationReasons.incompleteSourceData(`The source information for ${entry.itemNameSnapshot} is incomplete.`)
      : validationReasons.missingSourceData(`No rules source is recorded for ${entry.itemNameSnapshot}.`);
  }
  if (/\bStarfinder Society Scenario\b/i.test(entry.sourceMaterialTitle)) {
    return validationReasons.unsupportedAccessRule(`If ${entry.itemNameSnapshot} was granted by a Chronicle sheet, link that Chronicle to this inventory lot. Nexus cannot yet verify Chronicle-granted access.`);
  }
  if (entry.societyStatus === "limited") return validationReasons.unsupportedAccessRule(`${entry.itemNameSnapshot} is SFS Limited and requires specific boon, Chronicle, or other access that Nexus cannot verify.`);
  if (entry.rarity && entry.rarity.toLowerCase() !== "common") {
    return validationReasons.unsupportedAccessRule(`${entry.itemNameSnapshot} may require Chronicle, boon, or other access that Nexus cannot verify.`);
  }
  if (isFreeAccessMaterial(entry.sourceMaterialTitle)) return validated();
  const identity = entry.sourceMaterialIdentity ?? normalizeMaterialIdentity(materialTitleWithoutCitation(entry.sourceMaterialTitle));
  if (!ownedMaterialIdentities.includes(identity)) return validationReasons.missingMaterialOwnership(`Add ${entry.sourceMaterialTitle} to your owned materials to validate this item.`);
  return validated();
}
