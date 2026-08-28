"use client";

import Link from "next/link";
import { useRef } from "react";
import type { InventoryEntry } from "@/character/inventory";
import type { SaleState } from "../sales/actions";
import { SaleForm } from "../sales/sale-form";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const formatCredits = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function InventoryCard({ characterId, entry, saleAction }: { characterId: string; entry: InventoryEntry; saleAction: (state: SaleState, data: FormData) => Promise<SaleState> }) {
  const details = useRef<HTMLDialogElement>(null);
  const acquisition = entry.acquisitionType.replaceAll("_", " ");
  return <li className="group relative overflow-hidden rounded-2xl border border-border bg-surface-raised transition hover:border-brand focus-within:border-brand">
    <button type="button" onClick={() => details.current?.showModal()} className="block w-full p-4 pr-16 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
      <span className="block min-w-0"><span className="block truncate font-semibold text-text-primary">{entry.itemNameSnapshot}</span><span className="mt-0.5 block text-sm text-text-muted">Quantity {entry.quantity}{entry.bulkSnapshot ? ` · Bulk ${entry.bulkSnapshot} each` : ""}</span></span>
    </button>
    <SaleForm itemName={entry.itemNameSnapshot} available={entry.quantity} valueMinor={entry.valueMinor} editHref={`/characters/${characterId}/inventory/${entry.id}/edit`} action={saleAction} triggerClassName="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100" />
    <dialog ref={details} aria-labelledby={`inventory-${entry.id}-title`} onClick={(event) => { if (event.target === event.currentTarget) details.current?.close(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-border-strong bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold tracking-[0.16em] text-brand uppercase">Inventory item</p><h2 id={`inventory-${entry.id}-title`} className="mt-2 break-words text-2xl font-semibold">{entry.itemNameSnapshot}</h2></div><button type="button" onClick={() => details.current?.close()} aria-label="Close item details" className="rounded-full px-2 py-1 text-xl leading-none text-text-muted hover:bg-surface-raised hover:text-text-primary">×</button></div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-text-muted">Quantity</dt><dd className="mt-1 font-semibold">{entry.quantity}</dd></div>
          <div><dt className="text-sm text-text-muted">Acquisition</dt><dd className="mt-1 font-semibold capitalize">{acquisition}</dd></div>
          <div><dt className="text-sm text-text-muted">Acquired</dt><dd className="mt-1 font-semibold">{formatDate(entry.acquiredOn)}</dd></div>
          {entry.bulkSnapshot ? <div><dt className="text-sm text-text-muted">Bulk</dt><dd className="mt-1 font-semibold">{entry.bulkSnapshot} each</dd></div> : null}
          {entry.amountPaidMinor != null ? <div><dt className="text-sm text-text-muted">Amount paid</dt><dd className="mt-1 font-semibold">{formatCredits(entry.amountPaidMinor)} credits</dd></div> : null}
          {entry.valueMinor != null ? <div><dt className="text-sm text-text-muted">Value</dt><dd className="mt-1 font-semibold">{formatCredits(entry.valueMinor)} credits each</dd></div> : null}
        </dl>
        {entry.notes ? <section className="mt-6 border-t border-border pt-6"><h3 className="font-semibold">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{entry.notes}</p></section> : null}
        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-border pt-6">{entry.itemLinkSnapshot ? <a className="text-sm font-semibold text-brand hover:underline" href={entry.itemLinkSnapshot} target="_blank" rel="noreferrer">View item rules<span className="sr-only"> (opens in a new tab)</span></a> : null}<Link className="text-sm font-semibold text-brand hover:underline" href={`/characters/${characterId}/inventory/${entry.id}/edit`}>Edit item</Link></div>
      </div>
    </dialog>
  </li>;
}
