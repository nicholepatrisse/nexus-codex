"use client";

import { useRef, useState, useTransition } from "react";
import type { CharacterOptionDraft } from "./character-option-fields";
import { previewPathmuncherImportAction } from "./pathmuncher-import-actions";

type SuccessfulPreview = Extract<Awaited<ReturnType<typeof previewPathmuncherImportAction>>, { ok: true }>["preview"];
const statusClass = { validated: "text-success", unvalidated: "text-warning", invalid: "text-danger" } as const;

function previewIssueMessage(issue: { type: string; message: string }, optionName: string) {
  if (issue.type === "unknown_option") return `${optionName} will remain selected for manual review. After applying this preview, import its Archives of Nethys rules page or add a validation note in Heritage and feats.`;
  return issue.message;
}

export function PathmuncherImport({ characterId, onApply }: { characterId?: string; onApply: (values: { name: string; className: string; ancestry: string; background: string; options: CharacterOptionDraft[] }) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<SuccessfulPreview | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [levelReviewed, setLevelReviewed] = useState(false);
  function upload(file: File | undefined) {
    setPreview(null); setError(""); setApplied(false); setLevelReviewed(false);
    if (!file) return;
    if (file.size > 1_000_000) return setError("Choose a JSON file no larger than 1 MB.");
    if (file.type && file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json")) return setError("Choose a JSON file exported by Pathbuilder.");
    startTransition(async () => {
      try {
        const result = await previewPathmuncherImportAction(await file.text(), characterId);
        if (!result.ok) setError(result.error); else setPreview(result.preview);
      } catch { setError("We couldn’t read that file. Choose it again and retry."); }
      if (inputRef.current) inputRef.current.value = "";
    });
  }
  function applyPreview() {
    if (!preview) return;
    onApply(preview.proposed);
    setPreview(null);
    setLevelReviewed(false);
    setApplied(true);
    requestAnimationFrame(() => {
      const firstField = document.getElementById("name");
      firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstField?.focus({ preventScroll: true });
    });
  }
  const matchLabel = (status: string) => status === "exact" ? "Catalog match" : status === "aliased" ? "Catalog alias match" : status === "ambiguous" ? "Ambiguous — manual review" : "Unknown — manual review";
  return <section className="rounded-2xl border border-brand/30 bg-brand/5 p-5" aria-labelledby="pathmuncher-heading">
    <h2 id="pathmuncher-heading" className="text-lg font-semibold">Import from Pathmuncher</h2>
    <p className="mt-1 text-sm text-text-muted">Upload a Pathbuilder JSON export to review proposed values. The file is processed in memory and is not retained; previewing does not save the character.</p>
    <label className="mt-4 inline-flex cursor-pointer rounded-full border border-border-strong bg-surface-raised px-4 py-2 text-sm font-semibold hover:border-brand"><span>{pending ? "Reviewing…" : "Choose JSON file"}</span><input ref={inputRef} type="file" accept="application/json,.json" disabled={pending} onChange={(event) => upload(event.currentTarget.files?.[0])} className="sr-only" /></label>
    {error ? <p role="alert" tabIndex={-1} className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
    {applied ? <p role="status" className="mt-3 rounded-xl bg-success/10 p-3 text-sm text-success">Reviewed values applied. Continue through the form to confirm them before saving.</p> : null}
    {preview ? <div className="mt-6 space-y-5" aria-live="polite">
      <div><h3 className="font-semibold">Import preview</h3><p className="mt-1 text-sm text-warning"><strong>Build level {preview.review.character.currentLevel}</strong> is informational and will not become the Nexus starting level.</p></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-raised p-3"><dt className="font-semibold">Name</dt><dd className="mt-1">Imported: {preview.proposed.name}</dd></div>
        <div className="rounded-xl border border-border bg-surface-raised p-3"><dt className="font-semibold">Class</dt><dd className="mt-1">Imported: {preview.proposed.className}</dd><dd className="text-text-muted">Not verified — Nexus class verification is not available yet.</dd></div>
        {([[
          "Ancestry", preview.review.character.ancestry.rawValue, preview.proposed.ancestry, preview.review.character.ancestry.status, preview.identityValidation.ancestry,
        ], [
          "Background", preview.review.character.background.rawValue, preview.proposed.background, preview.review.character.background.status, preview.identityValidation.background,
        ]] as const).map(([label, raw, resolved, status, validation]) => <div key={label as string} className="rounded-xl border border-border bg-surface-raised p-3"><dt className="font-semibold">{label as string}</dt><dd className="mt-1">Imported: {raw as string}</dd><dd>Nexus: {resolved as string}</dd><dd className="text-text-muted">{matchLabel(status as string)}</dd>{validation ? <dd className={statusClass[validation.status]}>Validation: {validation.status}</dd> : null}</div>)}
      </dl>
      <section><h3 className="font-semibold">Heritage and feats ({preview.proposed.options.length})</h3><ul className="mt-2 space-y-2">{preview.proposed.options.map((option, index) => { const resolved = option.selectionKind === "heritage" ? preview.review.character.heritages[index] : preview.review.feats[index - preview.review.character.heritages.length]; const validation = preview.optionValidation[index]!; return <li key={option.key} className="rounded-xl border border-border bg-surface-raised p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{option.name}</strong><span className={statusClass[validation.status]}>{validation.status}</span></div><p className="mt-1 text-text-muted">Raw category: {option.selectionKind === "heritage" ? "Heritage" : resolved && "raw" in resolved ? resolved.raw.exportedCategory : "Unknown"} · Nexus category: {option.featCategory ?? option.selectionKind} · {option.acquisitionMethod}{option.grantOrigin ? ` · origin: ${option.grantOrigin}` : ""}</p><p className="text-text-muted">Source: {option.sourceMaterialTitle ?? "No catalog/source match"} · Match: {resolved && "match" in resolved ? matchLabel(resolved.match.status) : resolved ? matchLabel(resolved.status) : "Manual review"}</p>{validation.issues.map((issue) => <p key={issue.message} className="mt-1 text-warning">{previewIssueMessage(issue, option.name)}</p>)}</li>; })}</ul></section>
      {preview.changes ? <section><h3 className="font-semibold">Effect on this character</h3><ul className="mt-2 list-disc pl-5 text-sm">{preview.changes.fields.map((item) => <li key={item.field}><span className="capitalize">{item.field.replace("Name", " name")}</span>: {item.change}{item.change === "change" ? ` — “${item.before || "blank"}” → “${item.after}”` : ""}</li>)}{preview.changes.options.map((item, index) => <li key={`${item.kind}-${item.name}-${index}`}>{item.change}: {item.name} ({item.kind})</li>)}</ul><p className="mt-2 text-sm text-text-muted"><strong>Protected and unchanged:</strong> {preview.changes.protected.join(", ")}.</p></section> : null}
      {preview.review.unsupportedFields.length || preview.review.unsupportedValues.length ? <details className="rounded-xl border border-border bg-surface-raised p-3"><summary className="cursor-pointer font-semibold">Not imported ({preview.review.unsupportedFields.length + preview.review.unsupportedValues.length})</summary><ul className="mt-2 list-disc pl-5 text-sm text-text-muted">{preview.review.unsupportedFields.map((item) => <li key={item.path}>{item.path} ({item.valueType})</li>)}{preview.review.unsupportedValues.map((item) => <li key={item.path}>{item.path}: {item.value}</li>)}</ul></details> : null}
      <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={levelReviewed} onChange={(event) => setLevelReviewed(event.currentTarget.checked)} className="mt-1" /><span>I understand that build level {preview.review.character.currentLevel} will not change the Nexus starting level. I will choose or keep the correct starting level and wealth in the form.</span></label>
      <button type="button" disabled={!levelReviewed} onClick={applyPreview} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50">Use these reviewed values</button>
    </div> : null}
  </section>;
}
