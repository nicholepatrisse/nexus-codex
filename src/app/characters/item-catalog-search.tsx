"use client";
import { useId, useState, useTransition } from "react";
import { SelectionCard } from "@/app/selection-card";
import type { NethysItem } from "@/nethys/items";
import { fetchNethysItemAction, searchNethysItemsAction, selectNethysItemAction } from "@/app/characters/[characterId]/inventory/nethys-actions";

export type ImportedItemChoice = { item: NethysItem; notes: string; sourceMaterialId: string | null; sourceMaterialIdentity: string | null };

export function ItemCatalogSearch({ requiredLevel, initialQuery = "", onSelected }: { requiredLevel?: number; initialQuery?: string; onSelected: (choice: ImportedItemChoice) => void }) {
  const [mode, setMode] = useState<"search" | "link">("search");
  const [query, setQuery] = useState(initialQuery);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchNethysItemsAction>> | null>(null);
  const [choices, setChoices] = useState<NethysItem[]>([]);
  const [message, setMessage] = useState("");
  const [reviewingUrl, setReviewingUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const choiceName = useId();
  const compatible = (item: NethysItem) => (requiredLevel == null || item.level === requiredLevel) && (requiredLevel == null || !item.rarity || item.rarity.toLowerCase() === "common");
  const loadUrl = (sourceUrl: string) => { setMessage(""); setChoices([]); setResult(null); setReviewingUrl(sourceUrl); startTransition(async () => {
    const loaded = await fetchNethysItemAction(sourceUrl);
    setReviewingUrl("");
    if (!loaded.ok) return setMessage(loaded.error);
    const eligible = loaded.items.map(({ item }) => item).filter(compatible);
    setChoices(eligible);
    setMessage(eligible.length ? "Choose the exact item or variant to import." : requiredLevel == null ? "That page has no supported items." : `That page has no available common level ${requiredLevel} item.`);
  }); };
  const selectRemote = (item: NethysItem) => { setMessage(""); setReviewingUrl(item.url); startTransition(async () => {
    const selected = await selectNethysItemAction(item.url, item.name, item.level);
    setReviewingUrl("");
    if (!selected.ok) return setMessage(selected.error);
    onSelected(selected.choice); setChoices([]); setResult(null); setMessage(`${item.name} selected.`);
  }); };
  const search = () => { setMessage(""); setChoices([]); startTransition(async () => setResult(await searchNethysItemsAction(query, requiredLevel))); };
  const hasResults = result?.ok && (result.catalog.length > 0 || result.remote.length > 0);
  return <section className="rounded-xl border border-border bg-surface-raised p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Find an item</h3><p className="text-xs text-text-muted">Search Nexus and Archives of Nethys{requiredLevel == null ? "" : ` for a common level ${requiredLevel} item`}.</p></div><div className="flex rounded-full border border-border-strong p-0.5" aria-label="Item import method"><button type="button" aria-pressed={mode === "search"} onClick={() => { setMode("search"); setMessage(""); }} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "search" ? "bg-brand text-on-brand" : "text-text-muted"}`}>Search name</button><button type="button" aria-pressed={mode === "link"} onClick={() => { setMode("link"); setMessage(""); }} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "link" ? "bg-brand text-on-brand" : "text-text-muted"}`}>Import link</button></div></div>
    {mode === "search" ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="search" aria-label="Search items" value={query} minLength={2} onChange={(event) => setQuery(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim().length >= 2) { event.preventDefault(); search(); } }} placeholder="Item name" className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2"/><button type="button" onClick={search} disabled={pending || query.trim().length < 2} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Searching…" : "Search"}</button></div> : <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="url" aria-label="Archives of Nethys item link" value={url} onChange={(event) => setUrl(event.currentTarget.value)} placeholder="https://2e.aonsrd.com/treasure/…" className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2"/><button type="button" onClick={() => loadUrl(url)} disabled={pending || !url.trim()} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Loading…" : "Review"}</button></div>}
    <div aria-live="polite">{reviewingUrl ? <div className="mt-3 flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface text-center" role="status"><svg className="size-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3"/><path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"/></svg><div><p className="text-sm font-semibold">Loading item details…</p><p className="mt-1 text-xs text-text-muted">Reading the canonical item and its available variants.</p></div></div> : <>
      {message ? <p role={message.endsWith("selected.") ? "status" : "alert"} className={`mt-2 text-sm ${message.endsWith("selected.") ? "text-success" : "text-text-muted"}`}>{message}</p> : null}
      {result && !result.ok ? <p role="alert" className="mt-2 text-sm text-danger">{result.error}</p> : null}
      {result?.ok && result.remoteError ? <p role="alert" className="mt-2 text-sm text-warning">{result.remoteError}</p> : null}
      {result?.ok && !hasResults && !result.remoteError ? <p role="status" className="mt-2 text-sm text-text-muted">No compatible item results found.</p> : null}
      {result?.ok && hasResults ? <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">{result.catalog.length ? <div><h4 className="text-xs font-semibold text-text-muted uppercase">Already in Nexus</h4><ul className="mt-1 space-y-1">{result.catalog.map((choice) => <li key={choice.id}><button type="button" disabled={pending} onClick={() => { onSelected(choice); setResult(null); setMessage(`${choice.item.name} selected.`); }} className="w-full rounded-lg border border-success/40 bg-success/5 p-3 text-left focus-visible:outline-3 focus-visible:outline-brand"><span className="font-semibold">{choice.item.name}</span><span className="block text-xs text-text-muted">{[choice.item.level != null ? `Item ${choice.item.level}` : null, choice.item.category, "Reuse Nexus entry"].filter(Boolean).join(" · ")}</span></button></li>)}</ul></div> : null}{result.remote.length ? <div><h4 className="text-xs font-semibold text-text-muted uppercase">Archives of Nethys</h4><ul className="mt-1 space-y-1">{result.remote.map((item) => <li key={item.sourceUrl}><button type="button" disabled={pending} onClick={() => loadUrl(item.sourceUrl)} className="w-full rounded-lg border border-border-strong p-3 text-left focus-visible:outline-3 focus-visible:outline-brand"><span className="font-semibold">{item.name}</span><span className="block text-xs text-text-muted">{[item.level != null ? `Item ${item.level}` : null, item.category, item.sourceMaterialTitle].filter(Boolean).join(" · ") || "Review result"}</span><span className="block text-xs font-semibold text-brand">Review item and variants</span></button></li>)}</ul></div> : null}</div> : null}
      {choices.length ? <fieldset className="mt-3"><legend className="text-xs font-semibold text-text-muted uppercase">Select exact item</legend><div className="mt-1 space-y-2">{choices.map((item) => <SelectionCard key={`${item.name}-${item.level ?? ""}`} name={choiceName} value={`${item.name}-${item.level ?? ""}`} title={item.name} description={[item.level != null ? `Item ${item.level}` : null, item.category].filter(Boolean).join(" · ")} metadata={item.price} disabled={pending} onChange={() => selectRemote(item)} />)}</div></fieldset> : null}
    </>}</div>
  </section>;
}
