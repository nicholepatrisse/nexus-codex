"use client";
import { ItemCatalogSearch } from "@/app/characters/item-catalog-search";

export type StartingItemSelection = { url: string; name: string };

function Slot({ level, value, onChange }: { level: number; value?: StartingItemSelection; onChange: (item?: StartingItemSelection) => void }) {
  return <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm"><h3 className="text-sm font-semibold">Level {level} item</h3><div className="item-picker-slide" data-open={!value}><div><div className="pt-3"><ItemCatalogSearch requiredLevel={level} initialQuery={value?.name} onSelected={({ item }) => onChange({ url: item.url, name: item.name })} /></div></div></div><div className="item-picker-slide" data-open={Boolean(value)}><div>{value ? <div role="status" className="mt-3 rounded-xl border border-success/40 bg-linear-to-br from-success/15 to-surface p-4 shadow-sm"><span className="block font-semibold">{value.name}</span><span className="mt-1 block text-sm text-text-muted">Selected level {level} item</span><button type="button" onClick={() => onChange()} className="mt-2 text-sm font-semibold text-danger hover:underline">Change selection</button></div> : null}</div></div></div>;
}

export function StartingItemPicker({ levels, selections, onChange }: { levels: readonly number[]; selections: (StartingItemSelection | undefined)[]; onChange: (items: (StartingItemSelection | undefined)[]) => void }) {
  return <fieldset><legend className="text-sm font-semibold">Permanent starting items</legend><p className="mt-1 text-sm text-text-muted">Search by item name or import an exact Archives of Nethys link. Every slot is required. See the <a className="font-semibold text-brand hover:underline" href="https://lorespire.paizo.com/tiki-index.php?page=Guide-to-Organized-Play:-Starfinder-Society---Second-Edition#Purchasing_Guidelines" target="_blank" rel="noreferrer">Purchasing Guidelines<span className="sr-only"> (opens in a new tab)</span></a> for item access rules.</p><div className="mt-3 grid gap-3">{levels.map((level, index) => <Slot key={`${level}-${index}`} level={level} value={selections[index]} onChange={(item) => { const next = [...selections]; next[index] = item; onChange(next); }} />)}</div></fieldset>;
}
