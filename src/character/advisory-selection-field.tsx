"use client";
import type { ReactNode } from "react";
import type { IdentitySelectionType, IdentityValidationContext } from "@/character/identity-validation";
import { validateIdentitySelection } from "@/character/identity-validation";
import { MaterialResolutionActions } from "@/materials/material-resolution-actions";

const presentation = {
  validated: { className: "border-success/40 bg-success/10 text-success" },
  unvalidated: { className: "border-border-strong bg-surface text-text-muted" },
  invalid: { className: "border-danger/40 bg-danger/10 text-danger" },
} as const;

export function AdvisorySelectionField({ type, value, context, note, onNoteChange, onMaterialAdded, children }: { type: IdentitySelectionType; value: string; context: IdentityValidationContext; note: string; onNoteChange: (value: string) => void; onMaterialAdded?: (identities: string[]) => void; children?: ReactNode }) {
  const result = validateIdentitySelection(type, value, context);
  const option = context.options.find((candidate) => candidate.optionType === type && candidate.name.localeCompare(value.trim(), undefined, { sensitivity: "accent" }) === 0);
  const missingMaterial = result?.issues.find((issue) => issue.type === "missing_material_ownership" && issue.resolvable);
  const canAddMaterial = Boolean(missingMaterial && option?.sourceMaterialIdentity && option.sourceMaterialTitle && onMaterialAdded);
  return <div>{children}{result && result.status !== "validated" ? <div className={`mt-2 rounded-xl border p-3 text-sm ${presentation[result.status].className}`} aria-live="polite">{result.issues.map((issue) => <p key={`${issue.type}-${issue.message}`}>{issue.message}</p>)}{canAddMaterial ? <MaterialResolutionActions title={option!.sourceMaterialTitle!} identity={option!.sourceMaterialIdentity!} onAdded={onMaterialAdded!} onAddNote={() => requestAnimationFrame(() => document.getElementById(`${type}ValidationNote`)?.focus())} /> : null}</div> : null}{result && result.status !== "validated" ? <><label className="mt-2 block text-xs font-semibold" htmlFor={`${type}ValidationNote`}>Validation note <span className="font-normal text-text-muted">(optional)</span></label><textarea id={`${type}ValidationNote`} name={`${type}ValidationNote`} rows={2} maxLength={1000} value={note} onChange={(event) => onNoteChange(event.currentTarget.value)} className="mt-1 w-full resize-y rounded-xl border border-border-strong bg-surface-raised px-3 py-2 text-sm outline-none focus:border-brand" /></> : <input type="hidden" name={`${type}ValidationNote`} value="" />}</div>;
}
