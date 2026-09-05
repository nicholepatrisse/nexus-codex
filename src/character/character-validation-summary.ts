import type { CharacterDetail } from "@/character/characters";
import { validateIdentitySelection, type IdentitySelectionType, type IdentityValidationContext } from "@/character/identity-validation";
import type { ValidatedInventoryEntry } from "@/character/inventory";
import type { CharacterOptionSelection } from "@/character/option-selections";
import { validateCharacterOptionSelection } from "@/character/option-selection-validation";
import type { ValidationIssue, ValidationStatus } from "@/validation/advisory-validation";

export type CharacterValidationPresentation = "Validated" | "Needs Review" | "Rules Issue Found";
export type CharacterValidationDetail = Readonly<{ key: string; category: "Class" | "Ancestry" | "Background" | "Heritage" | "Feat" | "Inventory"; selection: string; source: string | null; sourceHref: string | null; playerNote: string | null; sourceChronicleHref?: string | null; editHref: string; status: Exclude<ValidationStatus, "validated">; issues: readonly ValidationIssue[] }>;
export type CharacterValidationSummary = Readonly<{ validatedCount: number; unvalidatedCount: number; invalidCount: number; presentation: CharacterValidationPresentation; details: readonly CharacterValidationDetail[] }>;

const identityFields: ReadonlyArray<{ type: IdentitySelectionType; category: "Class" | "Ancestry" | "Background"; value: keyof Pick<CharacterDetail, "className" | "ancestry" | "background">; note: keyof Pick<CharacterDetail, "classValidationNote" | "ancestryValidationNote" | "backgroundValidationNote">; chronicle: keyof Pick<CharacterDetail, "ancestrySourceChronicleId" | "backgroundSourceChronicleId"> | null; anchor: string }> = [
  { type: "class", category: "Class", value: "className", note: "classValidationNote", chronicle: null, anchor: "className" },
  { type: "ancestry", category: "Ancestry", value: "ancestry", note: "ancestryValidationNote", chronicle: "ancestrySourceChronicleId", anchor: "ancestry" },
  { type: "background", category: "Background", value: "background", note: "backgroundValidationNote", chronicle: "backgroundSourceChronicleId", anchor: "background" },
];

export function deriveCharacterValidationSummary(character: CharacterDetail, context: IdentityValidationContext, inventory: readonly ValidatedInventoryEntry[], characterOptions: readonly CharacterOptionSelection[] = []): CharacterValidationSummary {
  const selections: Array<{ status: ValidationStatus; detail?: CharacterValidationDetail }> = [];
  for (const field of identityFields) {
    const value = character[field.value];
    if (!value) continue;
    const validation = validateIdentitySelection(field.type, value, context, field.chronicle ? Boolean(character[field.chronicle]) : false);
    if (!validation) continue;
    const option = context.options.find((candidate) => candidate.optionType === field.type && candidate.name.localeCompare(value, undefined, { sensitivity: "accent" }) === 0);
    selections.push({ status: validation.status, detail: validation.status === "validated" ? undefined : { key: `identity-${field.type}`, category: field.category, selection: value, source: option?.sourceMaterialTitle ?? null, sourceHref: option?.sourceUrl ?? null, playerNote: character[field.note], editHref: `/characters/${character.id}/edit#${field.anchor}`, status: validation.status, issues: validation.issues } });
  }
  for (const selection of characterOptions) {
    const validation = validateCharacterOptionSelection(selection, character, context);
    selections.push({ status: validation.status, detail: validation.status === "validated" ? undefined : { key: `option-${selection.id}`, category: selection.selectionKind === "heritage" ? "Heritage" : "Feat", selection: selection.nameSnapshot, source: selection.sourceMaterialTitleSnapshot, sourceHref: selection.sourceUrlSnapshot, playerNote: selection.validationNote, sourceChronicleHref: selection.sourceChronicleId ? `/characters/${character.id}/chronicles/${selection.sourceChronicleId}` : null, editHref: `/characters/${character.id}/edit#heritage-feats`, status: validation.status, issues: validation.issues } });
  }
  for (const entry of inventory) selections.push({ status: entry.validation.status, detail: entry.validation.status === "validated" ? undefined : { key: `inventory-${entry.id}`, category: "Inventory", selection: entry.itemNameSnapshot, source: entry.sourceMaterialTitle, sourceHref: entry.itemLinkSnapshot, playerNote: entry.validationNote, editHref: `/characters/${character.id}/inventory/${entry.id}/edit`, status: entry.validation.status, issues: entry.validation.issues } });
  const validatedCount = selections.filter(({ status }) => status === "validated").length;
  const unvalidatedCount = selections.filter(({ status }) => status === "unvalidated").length;
  const invalidCount = selections.filter(({ status }) => status === "invalid").length;
  return Object.freeze({ validatedCount, unvalidatedCount, invalidCount, presentation: invalidCount ? "Rules Issue Found" : unvalidatedCount ? "Needs Review" : "Validated", details: Object.freeze(selections.flatMap(({ detail }) => detail ? [detail] : [])) });
}
