"use client";
import { useMemo, useState, useTransition } from "react";
import { StyledSelect } from "@/app/styled-select";
import { Dialog } from "@/app/dialog";
import { importIdentityOptionAction, searchIdentityOptionsAction } from "@/app/characters/identity-option-actions";
import { AdvisorySelectionField } from "@/character/advisory-selection-field";
import { validateIdentitySelection, type IdentitySelectionType, type IdentityValidationContext, type IdentityValidationOption } from "@/character/identity-validation";

type Type = Exclude<IdentitySelectionType, "class">;
const EMPTY_VALIDATION_CONTEXT: IdentityValidationContext = { options: [], ownedMaterialIdentities: [] };
export function IdentityOptionField({ type, value, onValueChange, note, onNoteChange, context = EMPTY_VALIDATION_CONTEXT, hasChronicleAccess = false, invalid = false, onOptionImported, onMaterialAdded }: { type: Type; value: string; onValueChange: (value: string) => void; note: string; onNoteChange: (value: string) => void; context?: IdentityValidationContext; hasChronicleAccess?: boolean; invalid?: boolean; onOptionImported?: (option: IdentityValidationOption) => void; onMaterialAdded?: (identities: string[]) => void }) {
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<IdentityValidationOption[]>([]);
  const [message, setMessage] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [mode, setMode] = useState<"search" | "link">("search");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<Awaited<ReturnType<typeof searchIdentityOptionsAction>> | null>(null);
  const [importingUrl, setImportingUrl] = useState("");
  const [addedMaterialIdentities, setAddedMaterialIdentities] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const catalog = useMemo(() => {
    const choices = [...context.options.filter((option) => option.optionType === type), ...imported];
    if (value && !choices.some((option) => option.name === value)) choices.push({ optionType: type, name: value, sourceMaterialIdentity: null, sourceMaterialTitle: null, metadata: {} });
    return choices.filter((option, index) => choices.findIndex((candidate) => candidate.name === option.name) === index).sort((left, right) => left.name.localeCompare(right.name));
  }, [context.options, imported, type, value]);
  const validationContext = { ...context, options: [...context.options, ...imported], ownedMaterialIdentities: [...context.ownedMaterialIdentities, ...addedMaterialIdentities] };
  const statusPresentation = { validated: { mark: "✓", label: "Validated", tone: "success" }, unvalidated: { mark: "?", label: "Unable to validate", tone: "neutral" }, invalid: { mark: "!", label: "Invalid", tone: "danger" } } as const;
  const label = type === "ancestry" ? "Ancestry" : "Background";
  function select(option: IdentityValidationOption) {
    setImported((current) => [...current, option]);
    onOptionImported?.(option);
    onValueChange(option.name);
    setUrl(""); setQuery(""); setMessage(""); setSearchResult(null); setShowImport(false);
  }
  function lookup(value = url) { setMessage(""); setImportingUrl(value); startTransition(async () => {
    const result = await importIdentityOptionAction(value, type);
    setImportingUrl("");
    if (!result.ok) { setMessage(result.error); return; }
    select(result.option);
  }); }
  function search() {
    setMessage(""); setSearchResult(null);
    if (query.trim().length < 2) { setMessage("Enter at least 2 characters to search."); return; }
    startTransition(async () => setSearchResult(await searchIdentityOptionsAction(query, type)));
  }
  return <AdvisorySelectionField type={type} value={value} context={validationContext} note={note} onNoteChange={onNoteChange} hasChronicleAccess={hasChronicleAccess} onMaterialAdded={(identities) => { setAddedMaterialIdentities((current) => [...new Set([...current, ...identities])]); onMaterialAdded?.(identities); }}>
    <div className="flex items-center justify-between gap-3"><label className="block text-sm font-semibold" htmlFor={type}>{label} <span className="font-normal text-text-muted">(optional)</span></label><button type="button" onClick={() => { setMessage(""); setShowImport(true); }} className="text-sm font-semibold text-brand hover:underline">Add new</button></div>
    <StyledSelect name={type} label={label} value={value} invalid={invalid} onValueChange={onValueChange} options={[{ value: "", label: `No ${label.toLowerCase()} selected` }, ...catalog.map((option) => { const result = validateIdentitySelection(type, option.name, validationContext, hasChronicleAccess); const status = result ? statusPresentation[result.status] : null; return { value: option.name, label: option.name, description: option.sourceMaterialTitle ?? "Source details unavailable", metadata: status?.mark, metadataLabel: status?.label, metadataTone: status?.tone }; })]} />
    {showImport ? <Dialog open title={`Add ${label.toLowerCase()}`} description={`Search Archives of Nethys by name or paste an exact ${label.toLowerCase()} link. The imported option will be selected automatically.`} onClose={() => setShowImport(false)} closeLabel={`Close add ${label.toLowerCase()}`} className="max-w-2xl">
      <div className="mt-5 flex rounded-full border border-border-strong p-0.5" aria-label={`${label} import method`}><button type="button" aria-pressed={mode === "search"} onClick={() => { setMode("search"); setMessage(""); }} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold ${mode === "search" ? "bg-brand text-on-brand" : "text-text-muted"}`}>Search name</button><button type="button" aria-pressed={mode === "link"} onClick={() => { setMode("link"); setMessage(""); }} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold ${mode === "link" ? "bg-brand text-on-brand" : "text-text-muted"}`}>Import link</button></div>
      {mode === "search" ? <><label htmlFor={`${type}NethysSearch`} className="mt-5 block text-sm font-semibold">{label} name</label><div className="mt-2 flex gap-2"><input id={`${type}NethysSearch`} type="search" value={query} minLength={2} onChange={(event) => { setQuery(event.currentTarget.value); setMessage(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} autoFocus placeholder={`Search ${label.toLowerCase()}s`} className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-4 py-3 outline-none focus:border-brand"/><button type="button" onClick={search} disabled={pending} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{pending && !importingUrl ? "Searching…" : "Search"}</button></div></> : <><label htmlFor={`${type}NethysUrl`} className="mt-5 block text-sm font-semibold">Archives of Nethys link</label><div className="mt-2 flex gap-2"><input id={`${type}NethysUrl`} type="url" value={url} onChange={(event) => { setUrl(event.currentTarget.value); setMessage(""); }} autoFocus placeholder={`https://2e.aonsrd.com/${type === "ancestry" ? "ancestries" : "backgrounds"}/…`} className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-4 py-3 outline-none focus:border-brand"/><button type="button" onClick={() => lookup()} disabled={pending || !url.trim()} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{pending ? "Importing…" : "Import"}</button></div></>}
      <div aria-live="polite">{message ? <p role="alert" className="mt-3 text-sm text-danger">{message}</p> : null}{searchResult && !searchResult.ok ? <p role="alert" className="mt-3 text-sm text-danger">{searchResult.error}</p> : null}{searchResult?.ok && searchResult.remoteError ? <p role="alert" className="mt-3 text-sm text-warning">{searchResult.remoteError}</p> : null}{searchResult?.ok && !searchResult.catalog.length && !searchResult.remote.length && !searchResult.remoteError ? <p role="status" className="mt-3 text-sm text-text-muted">No matching {label.toLowerCase()}s found. Try another name or import an exact link.</p> : null}</div>
      {searchResult?.ok && (searchResult.catalog.length || searchResult.remote.length) ? <div className="mt-4 max-h-72 space-y-4 overflow-y-auto"><ResultList title="Already in Nexus" options={searchResult.catalog} onSelect={select}/><ResultList title="Archives of Nethys" options={searchResult.remote} pending={pending} importingUrl={importingUrl} onSelect={(option) => lookup(option.sourceUrl!)}/></div> : null}
      <div className="mt-6 flex justify-end"><button type="button" onClick={() => setShowImport(false)} className="rounded-full border border-border-strong px-4 py-2 font-semibold">Cancel</button></div>
    </Dialog> : null}
  </AdvisorySelectionField>;
}

function ResultList({ title, options, pending = false, importingUrl = "", onSelect }: { title: string; options: IdentityValidationOption[]; pending?: boolean; importingUrl?: string; onSelect: (option: IdentityValidationOption) => void }) {
  if (!options.length) return null;
  return <div><h3 className="text-xs font-semibold uppercase text-text-muted">{title}</h3><ul className="mt-1 space-y-1">{options.map((option) => <li key={option.sourceUrl ?? option.id ?? option.name}><button type="button" disabled={pending} onClick={() => onSelect(option)} className="w-full rounded-lg border border-border-strong p-3 text-left disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-brand"><span className="font-semibold">{option.name}</span><span className="block text-sm text-text-muted">{option.sourceMaterialTitle ?? "Source not recorded"}</span>{option.sourceUrl === importingUrl ? <span className="block text-xs font-semibold text-brand">Importing…</span> : null}</button></li>)}</ul></div>;
}
