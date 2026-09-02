import type { CharacterDetail } from "@/character/characters";
import { validateIdentitySelection, type IdentitySelectionType, type IdentityValidationContext } from "@/character/identity-validation";
import type { ValidatedInventoryEntry } from "@/character/inventory";
import type { ValidationIssue, ValidationStatus } from "@/validation/advisory-validation";

export type CharacterValidationPresentation = "Validated" | "Needs Review" | "Rules Issue Found";
export type CharacterValidationDetail = Readonly<{ key: string; category: "Class" | "Ancestry" | "Background" | "Inventory"; selection: string; source: string | null; playerNote: string | null; href: string; status: Exclude<ValidationStatus, "validated">; issues: readonly ValidationIssue[] }>;
export type CharacterValidationSummary = Readonly<{ validatedCount: number; unvalidatedCount: number; invalidCount: number; presentation: CharacterValidationPresentation; details: readonly CharacterValidationDetail[] }>;

const identityFields: ReadonlyArray<{ type: IdentitySelectionType; category: "Class" | "Ancestry" | "Background"; value: keyof Pick<CharacterDetail, "className" | "ancestry" | "background">; note: keyof Pick<CharacterDetail, "classValidationNote" | "ancestryValidationNote" | "backgroundValidationNote">; chronicle: keyof Pick<CharacterDetail, "ancestrySourceChronicleId" | "backgroundSourceChronicleId"> | null; anchor: string }> = [
  { type: "class", category: "Class", value: "className", note: "classValidationNote", chronicle: null, anchor: "className" },
  { type: "ancestry", category: "Ancestry", value: "ancestry", note: "ancestryValidationNote", chronicle: "ancestrySourceChronicleId", anchor: "ancestry" },
  { type: "background", category: "Background", value: "background", note: "backgroundValidationNote", chronicle: "backgroundSourceChronicleId", anchor: "background" },
];

export function deriveCharacterValidationSummary(character: CharacterDetail, context: IdentityValidationContext, inventory: readonly ValidatedInventoryEntry[]): CharacterValidationSummary {
  const selections: Array<{ status: ValidationStatus; detail?: CharacterValidationDetail }> = [];
  for (const field of identityFields) {
    const value = character[field.value];
    if (!value) continue;
    const validation = validateIdentitySelection(field.type, value, context, field.chronicle ? Boolean(character[field.chronicle]) : false);
    if (!validation) continue;
    const option = context.options.find((candidate) => candidate.optionType === field.type && candidate.name.localeCompare(value, undefined, { sensitivity: "accent" }) === 0);
    selections.push({ status: validation.status, detail: validation.status === "validated" ? undefined : { key: `identity-${field.type}`, category: field.category, selection: value, source: option?.sourceMaterialTitle ?? null, playerNote: character[field.note], href: `/characters/${character.id}/edit#${field.anchor}`, status: validation.status, issues: validation.issues } });
  }
  for (const entry of inventory) selections.push({ status: entry.validation.status, detail: entry.validation.status === "validated" ? undefined : { key: `inventory-${entry.id}`, category: "Inventory", selection: entry.itemNameSnapshot, source: entry.sourceMaterialTitle, playerNote: entry.validationNote, href: `/characters/${character.id}/inventory/${entry.id}/edit`, status: entry.validation.status, issues: entry.validation.issues } });
  const validatedCount = selections.filter(({ status }) => status === "validated").length;
  const unvalidatedCount = selections.filter(({ status }) => status === "unvalidated").length;
  const invalidCount = selections.filter(({ status }) => status === "invalid").length;
  return Object.freeze({ validatedCount, unvalidatedCount, invalidCount, presentation: invalidCount ? "Rules Issue Found" : unvalidatedCount ? "Needs Review" : "Validated", details: Object.freeze(selections.flatMap(({ detail }) => detail ? [detail] : [])) });
}
