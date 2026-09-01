"use client";
import { useMemo, useState, useTransition } from "react";
import { StyledSelect } from "@/app/styled-select";
import { Dialog } from "@/app/dialog";
import { importIdentityOptionAction } from "@/app/characters/identity-option-actions";
import { AdvisorySelectionField } from "@/character/advisory-selection-field";
import { validateIdentitySelection, type IdentitySelectionType, type IdentityValidationContext, type IdentityValidationOption } from "@/character/identity-validation";

type Type = Exclude<IdentitySelectionType, "class">;
export function IdentityOptionField({ type, value, onValueChange, note, onNoteChange, context, invalid = false }: { type: Type; value: string; onValueChange: (value: string) => void; note: string; onNoteChange: (value: string) => void; context: IdentityValidationContext; invalid?: boolean }) {
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<IdentityValidationOption[]>([]);
  const [message, setMessage] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pending, startTransition] = useTransition();
  const catalog = useMemo(() => {
    const choices = [...context.options.filter((option) => option.optionType === type), ...imported];
    if (value && !choices.some((option) => option.name === value)) choices.push({ optionType: type, name: value, sourceMaterialIdentity: null, sourceMaterialTitle: null, metadata: {} });
    return choices.filter((option, index) => choices.findIndex((candidate) => candidate.name === option.name) === index).sort((left, right) => left.name.localeCompare(right.name));
  }, [context.options, imported, type, value]);
  const validationContext = { ...context, options: [...context.options, ...imported] };
  const statusPresentation = { validated: { mark: "✓", label: "Validated", tone: "success" }, unvalidated: { mark: "?", label: "Unable to validate", tone: "neutral" }, invalid: { mark: "!", label: "Invalid", tone: "danger" } } as const;
  const label = type === "ancestry" ? "Ancestry" : "Background";
  function lookup() { setMessage(""); startTransition(async () => {
    const result = await importIdentityOptionAction(url, type);
    if (!result.ok) { setMessage(result.error); return; }
    setImported((current) => [...current, result.option]);
    onValueChange(result.option.name);
    setUrl("");
    setMessage("");
    setShowImport(false);
  }); }
  return <AdvisorySelectionField type={type} value={value} context={validationContext} note={note} onNoteChange={onNoteChange}>
    <div className="flex items-center justify-between gap-3"><label className="block text-sm font-semibold" htmlFor={type}>{label} <span className="font-normal text-text-muted">(optional)</span></label><button type="button" onClick={() => { setMessage(""); setShowImport(true); }} className="text-sm font-semibold text-brand hover:underline">Add new</button></div>
    <StyledSelect name={type} label={label} value={value} invalid={invalid} onValueChange={onValueChange} options={[{ value: "", label: `No ${label.toLowerCase()} selected` }, ...catalog.map((option) => { const result = validateIdentitySelection(type, option.name, validationContext); const status = result ? statusPresentation[result.status] : null; return { value: option.name, label: option.name, description: option.sourceMaterialTitle ?? "Source details unavailable", metadata: status?.mark, metadataLabel: status?.label, metadataTone: status?.tone }; })]} />
    {showImport ? <Dialog open title={`Add ${label.toLowerCase()}`} description={`Paste an official Starfinder 2e Archives of Nethys ${label.toLowerCase()} link. The imported option will be selected automatically.`} onClose={() => setShowImport(false)} closeLabel={`Close add ${label.toLowerCase()}`} className="max-w-lg"><label htmlFor={`${type}NethysUrl`} className="mt-5 block text-sm font-semibold">Archives of Nethys link</label><input id={`${type}NethysUrl`} type="url" value={url} onChange={(event) => { setUrl(event.currentTarget.value); setMessage(""); }} autoFocus placeholder={`https://2e.aonsrd.com/${type === "ancestry" ? "ancestries" : "backgrounds"}/…`} className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-4 py-3 outline-none focus:border-brand" />{message ? <p role="alert" className="mt-3 text-sm text-danger">{message}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowImport(false)} className="rounded-full border border-border-strong px-4 py-2 font-semibold">Cancel</button><button type="button" onClick={lookup} disabled={pending || !url.trim()} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{pending ? "Importing…" : `Add ${label.toLowerCase()}`}</button></div></Dialog> : null}
  </AdvisorySelectionField>;
}
