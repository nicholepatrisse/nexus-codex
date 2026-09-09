"use client";
import { useState, useTransition } from "react";
import { importCharacterOptionAction, searchCharacterOptionsAction } from "./character-options-actions";

export type SelectedCatalogOption = { id: string; name: string; sourceMaterialIdentity: string | null; sourceMaterialTitle: string | null; sourceUrl: string | null; metadata: Record<string, unknown> };
type Props = { kind: "heritage" | "feat"; category?: "class" | "ancestry" | "skill" | "general" | null; initialQuery?: string; onSelected: (option: SelectedCatalogOption) => void };

export function OptionCatalogSearch({ kind, category, initialQuery = "", onSelected }: Props) {
  const [mode, setMode] = useState<"search" | "link">("search");
  const [query, setQuery] = useState(initialQuery);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchCharacterOptionsAction>> | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [importingUrl, setImportingUrl] = useState("");
  const select = (option: SelectedCatalogOption) => { onSelected(option); setResult(null); setMessage(`Linked to ${option.sourceMaterialTitle ?? "the catalog"}.`); };
  const search = () => { setMessage(""); startTransition(async () => setResult(await searchCharacterOptionsAction(query, kind, kind === "feat" ? category ?? undefined : undefined))); };
  const importUrl = (value: string) => { setMessage(""); setImportingUrl(value); startTransition(async () => { const imported = await importCharacterOptionAction(value, kind); setImportingUrl(""); if (!imported.ok) return setMessage(imported.error); select(imported.option); setUrl(""); }); };
  const hasResults = result?.ok && (result.catalog.length > 0 || result.remote.length > 0);
  if (importingUrl) return <section className="rounded-xl border border-border bg-surface-raised p-3"><div className="flex min-h-28 flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite"><svg className="size-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3"/><path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"/></svg><div><p className="text-sm font-semibold">Importing from Archives of Nethys…</p><p className="mt-1 text-xs text-text-muted">Reading the option and linking it to the catalog.</p></div></div></section>;
  return <section className="rounded-xl border border-border bg-surface-raised p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Catalog import</h3><p className="text-xs text-text-muted">Find this {kind} on Archives of Nethys.</p></div><div className="flex rounded-full border border-border-strong p-0.5" aria-label="Catalog import method">
      <button type="button" onClick={() => { setMode("search"); setMessage(""); }} aria-pressed={mode === "search"} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "search" ? "bg-brand text-on-brand" : "text-text-muted"}`}>Search name</button>
      <button type="button" onClick={() => { setMode("link"); setMessage(""); }} aria-pressed={mode === "link"} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "link" ? "bg-brand text-on-brand" : "text-text-muted"}`}>Import link</button>
    </div></div>
    {mode === "search" ? <div className="mt-3 flex gap-2"><input type="search" aria-label={`Search ${kind}s`} value={query} minLength={2} onChange={(event) => setQuery(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim().length >= 2) { event.preventDefault(); search(); } }} placeholder={kind === "feat" ? "Feat name" : "Heritage name"} className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2"/><button type="button" onClick={search} disabled={pending || query.trim().length < 2} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending && !importingUrl ? "Searching…" : "Search"}</button></div>
    : <div className="mt-3 flex gap-2"><input type="url" aria-label="Archives of Nethys link" value={url} onChange={(event) => setUrl(event.currentTarget.value)} placeholder={`https://2e.aonsrd.com/${kind === "feat" ? "feats" : "heritages"}/…`} className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2"/><button type="button" onClick={() => importUrl(url)} disabled={pending || !url.trim()} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Importing…" : "Import"}</button></div>}
    {message ? <p role={message.startsWith("Linked") ? "status" : "alert"} className={`mt-2 text-sm ${message.startsWith("Linked") ? "text-success" : "text-danger"}`}>{message}</p> : null}
    {result && !result.ok ? <p role="alert" className="mt-2 text-sm text-danger">{result.error}</p> : null}
    {result?.ok && result.remoteError ? <p role="alert" className="mt-2 text-sm text-warning">{result.remoteError}</p> : null}
    {result?.ok && !hasResults && !result.remoteError ? <p role="status" className="mt-2 text-sm text-text-muted">No compatible {kind} results found.</p> : null}
    {result?.ok && hasResults ? <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
      {result.catalog.length ? <div><h4 className="text-xs font-semibold text-text-muted uppercase">Already in Nexus</h4><ul className="mt-1 space-y-1">{result.catalog.map((option) => <li key={option.id}><button type="button" onClick={() => select(option)} className="w-full rounded-lg border border-success/40 bg-success/5 p-2 text-left focus-visible:outline-3 focus-visible:outline-brand"><span className="text-sm font-semibold">{option.name}</span><span className="block text-xs text-text-muted">{option.sourceMaterialTitle ?? "Source not recorded"} · Reuse entry</span></button></li>)}</ul></div> : null}
      {result.remote.length ? <div><h4 className="text-xs font-semibold text-text-muted uppercase">Archives of Nethys</h4><ul className="mt-1 space-y-1">{result.remote.map((option) => <li key={option.sourceUrl}><button type="button" disabled={pending} onClick={() => importUrl(option.sourceUrl)} className="w-full rounded-lg border border-border-strong p-2 text-left disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-brand"><span className="text-sm font-semibold">{option.name}</span><span className="block text-xs text-text-muted">{[option.sourceMaterialTitle, option.level ? `Level ${option.level}` : null, option.featCategory ? `${option.featCategory} feat` : null].filter(Boolean).join(" · ") || kind}</span><span className="block text-xs font-semibold text-brand">{importingUrl === option.sourceUrl ? "Importing…" : "Review and select"}</span></button></li>)}</ul></div> : null}
    </div> : null}
  </section>;
}
