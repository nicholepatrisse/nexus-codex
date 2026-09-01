"use client";

import Link from "next/link";
import { useRef } from "react";
import type { ValidatedInventoryEntry } from "@/character/inventory";
import type { SaleState } from "../sales/actions";
import { SaleForm } from "../sales/sale-form";
import { DescriptionItem, DescriptionList } from "@/app/description-list";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const formatCredits = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function InventoryCard({ characterId, entry, saleAction }: { characterId: string; entry: ValidatedInventoryEntry; saleAction: (state: SaleState, data: FormData) => Promise<SaleState> }) {
  const details = useRef<HTMLDialogElement>(null);
  const acquisition = entry.acquisitionType.replaceAll("_", " ");
  return <li className="card-standard card-interactive group relative overflow-hidden">
    <button type="button" onClick={() => details.current?.showModal()} className="block w-full p-4 pr-16 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
      <span className="block min-w-0"><span className="block truncate font-semibold text-text-primary">{entry.itemNameSnapshot}</span><span className="mt-0.5 block text-sm text-text-muted">Quantity {entry.quantity}{entry.bulkSnapshot ? ` · Bulk ${entry.bulkSnapshot} each` : ""} · {entry.validation.status === "validated" ? "Validated" : entry.validation.status === "invalid" ? "Invalid" : "Unable to validate"}</span></span>
    </button>
    <SaleForm itemName={entry.itemNameSnapshot} available={entry.quantity} valueMinor={entry.valueMinor} editHref={`/characters/${characterId}/inventory/${entry.id}/edit`} action={saleAction} triggerClassName="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100" />
    <dialog ref={details} aria-labelledby={`inventory-${entry.id}-title`} onClick={(event) => { if (event.target === event.currentTarget) details.current?.close(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-border-strong bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold tracking-[0.16em] text-brand uppercase">Inventory item</p><h2 id={`inventory-${entry.id}-title`} className="mt-2 break-words text-2xl font-semibold">{entry.itemNameSnapshot}</h2></div><button type="button" onClick={() => details.current?.close()} aria-label="Close item details" className="rounded-full px-2 py-1 text-xl leading-none text-text-muted hover:bg-surface-raised hover:text-text-primary">×</button></div>
        <DescriptionList columns={2} className="mt-6">
          <DescriptionItem label="Quantity">{entry.quantity}</DescriptionItem>
          <DescriptionItem label="Acquisition" valueClassName="capitalize">{acquisition}</DescriptionItem>
          <DescriptionItem label="Acquired">{formatDate(entry.acquiredOn)}</DescriptionItem>
          <DescriptionItem label="Bulk">{entry.bulkSnapshot ? `${entry.bulkSnapshot} each` : null}</DescriptionItem>
          <DescriptionItem label="Amount paid">{entry.amountPaidMinor != null ? `${formatCredits(entry.amountPaidMinor)} credits` : null}</DescriptionItem>
          <DescriptionItem label="Value">{entry.valueMinor != null ? `${formatCredits(entry.valueMinor)} credits each` : null}</DescriptionItem>
          <DescriptionItem label="Validation">{entry.validation.status === "validated" ? "Validated" : entry.validation.status === "invalid" ? "Invalid" : "Unable to validate"}</DescriptionItem>
          <DescriptionItem label="Rules source">{entry.sourceMaterialTitle}</DescriptionItem>
        </DescriptionList>
        {entry.validation.issues.length ? <section className="mt-6 border-t border-border pt-6"><h3 className="font-semibold">Validation reason</h3>{entry.validation.issues.map((issue) => <p key={`${issue.type}-${issue.message}`} className="mt-2 text-sm text-text-muted">{issue.message}</p>)}</section> : null}
        {entry.validation.status !== "validated" ? <section className="mt-6 border-t border-border pt-6"><h3 className="font-semibold">Player validation note</h3>{entry.validationNote ? <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{entry.validationNote}</p> : <p className="mt-2 text-sm text-text-muted">No validation note added. <Link className="font-semibold text-brand hover:underline" href={`/characters/${characterId}/inventory/${entry.id}/edit`}>Add a note</Link></p>}</section> : null}
        {entry.notes ? <section className="mt-6 border-t border-border pt-6"><h3 className="font-semibold">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{entry.notes}</p></section> : null}
        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-border pt-6">{entry.itemLinkSnapshot ? <a className="text-sm font-semibold text-brand hover:underline" href={entry.itemLinkSnapshot} target="_blank" rel="noreferrer">View item rules<span className="sr-only"> (opens in a new tab)</span></a> : null}<Link className="text-sm font-semibold text-brand hover:underline" href={`/characters/${characterId}/inventory/${entry.id}/edit`}>Edit item</Link></div>
      </div>
    </dialog>
  </li>;
}
