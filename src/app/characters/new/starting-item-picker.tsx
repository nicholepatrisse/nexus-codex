"use client";
import { useId, useState, useTransition } from "react";
import { SelectionCard } from "@/app/selection-card";
import { fetchNethysItemAction } from "@/app/characters/[characterId]/inventory/nethys-actions";
import type { NethysItem } from "@/nethys/items";

export type StartingItemSelection = { url: string; name: string };

function Slot({ level, value, onChange }: { level: number; value?: StartingItemSelection; onChange: (item?: StartingItemSelection) => void }) {
  const [url, setUrl] = useState(value?.url ?? "");
  const [eligibleItems, setEligibleItems] = useState<NethysItem[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const choiceName = useId();
  function lookup() { setMessage(""); startTransition(async () => {
    const result = await fetchNethysItemAction(url);
    if (!result.ok) { setEligibleItems([]); onChange(); setMessage(result.error); return; }
    const eligible = result.items.map(({ item }) => item).filter((item) => item.level === level && (!item.rarity || item.rarity.toLowerCase() === "common"));
    setEligibleItems(eligible);
    if (eligible.length === 1) {
      const item = eligible[0]!;
      onChange({ url: item.url, name: item.name });
      setMessage("Item confirmed.");
    } else {
      onChange();
      setMessage(eligible.length > 1 ? "Choose the item for this slot." : `That page has no available level ${level} item.`);
    }
  }); }
  const selectedItem = eligibleItems.find((item) => value?.name === item.name && value.url === item.url);
  return <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm"><label className="text-sm font-semibold">Level {level} item</label><div className="mt-2 flex gap-2"><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setEligibleItems([]); onChange(); }} placeholder="https://2e.aonsrd.com/treasure/…" className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2 shadow-inner transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" /><button type="button" onClick={lookup} disabled={pending || !url.trim()} className="rounded-xl border border-border-strong bg-surface px-3 py-2 font-semibold shadow-sm transition hover:-translate-y-px hover:border-brand hover:shadow disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none">{pending ? "Checking…" : "Check"}</button></div>
    {message ? <p className="mt-2 text-sm text-text-muted">{message}</p> : null}
    {eligibleItems.length === 1 && selectedItem ? <div className="mt-3 rounded-xl border border-success/40 bg-linear-to-br from-success/15 to-surface p-4 shadow-sm"><span className="block font-semibold">{selectedItem.name}</span><span className="mt-1 text-sm text-text-muted">Item {selectedItem.level}{selectedItem.price ? ` · ${selectedItem.price}` : ""}</span></div> : eligibleItems.length > 1 ? <div className="mt-3 grid gap-3">{eligibleItems.map((item) => <SelectionCard key={item.name} name={choiceName} value={item.name} title={item.name} description={`Item ${item.level}`} metadata={item.price} checked={selectedItem?.name === item.name} onChange={() => onChange({ url: item.url, name: item.name })} />)}</div> : null}</div>;
}

export function StartingItemPicker({ levels, selections, onChange }: { levels: readonly number[]; selections: (StartingItemSelection | undefined)[]; onChange: (items: (StartingItemSelection | undefined)[]) => void }) {
  return <fieldset><legend className="text-sm font-semibold">Permanent starting items</legend><p className="mt-1 text-sm text-text-muted">Paste official Archives of Nethys item links. Every slot is required. See the <a className="font-semibold text-brand hover:underline" href="https://lorespire.paizo.com/tiki-index.php?page=Guide-to-Organized-Play:-Starfinder-Society---Second-Edition#Purchasing_Guidelines" target="_blank" rel="noreferrer">Purchasing Guidelines<span className="sr-only"> (opens in a new tab)</span></a> for item access rules.</p><div className="mt-3 grid gap-3">{levels.map((level, index) => <Slot key={`${level}-${index}`} level={level} value={selections[index]} onChange={(item) => { const next = [...selections]; next[index] = item; onChange(next); }} />)}</div></fieldset>;
}
