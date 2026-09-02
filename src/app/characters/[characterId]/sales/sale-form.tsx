"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { SaleState } from "./actions";

export function SaleForm({ itemName, available, valueMinor, returnAmount, editHref, action, returnAction, triggerClassName = "" }: { itemName: string; available: number; valueMinor: number | null; returnAmount: number | null; editHref: string; action: (state: SaleState, data: FormData) => Promise<SaleState>; returnAction: (state: SaleState, data: FormData) => Promise<SaleState>; triggerClassName?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [returnState, returnFormAction, returnPending] = useActionState(returnAction, {});
  const [quantity, setQuantity] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const key = `sale-${useId()}-${available}`;
  const sellable = valueMinor != null && valueMinor > 0 && Math.floor((valueMinor * quantity) / 2) > 0;
  const proceeds = sellable ? Math.floor((valueMinor * quantity) / 2) : 0;
  useEffect(() => {
    if (!state.success && !returnState.success) return;
    dialog.current?.close();
    router.refresh();
  }, [returnState.success, router, state.success]);
  return <>
    <button type="button" aria-label={`Sell ${itemName}`} onClick={() => dialog.current?.showModal()} className={`rounded-full border border-brand bg-surface px-4 py-1.5 text-sm font-semibold text-brand shadow-sm transition-all hover:bg-brand hover:text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${triggerClassName}`}>Sell</button>
    <dialog ref={dialog} aria-labelledby={`sale-${key}-title`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border-strong bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold tracking-[0.16em] text-brand uppercase">Confirm sale</p><h2 id={`sale-${key}-title`} className="mt-2 text-2xl font-semibold">Sell {itemName}</h2></div><button type="button" onClick={() => dialog.current?.close()} aria-label="Close sale" className="rounded-full px-2 py-1 text-xl leading-none text-text-muted hover:bg-surface-raised hover:text-text-primary">×</button></div>
        {!sellable ? <div className="mt-6"><div className="rounded-2xl border border-warning/30 bg-warning/10 p-4"><p className="font-semibold">Item value needed</p><p className="mt-1 text-sm text-text-muted">Add this item’s value before selling it. Nexus uses the value—not the amount paid—to calculate sale proceeds.</p></div><div className="mt-5 flex flex-wrap items-center gap-4"><Link href={editHref} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">Add item value</Link><button type="button" onClick={() => dialog.current?.close()} className="text-sm font-semibold text-text-muted hover:text-text-primary">Cancel</button></div></div> : <form action={formAction} className="mt-6 grid gap-5 sm:grid-cols-2">
          <input type="hidden" name="idempotencyKey" value={key} />
          <label className="text-sm font-semibold">Quantity<input className="mt-2 block w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-normal" name="quantity" type="number" min="1" max={available} step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label>
          <label className="text-sm font-semibold">Sale date<input className="mt-2 block w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-normal" name="soldOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
          <div className="rounded-2xl border border-success/30 bg-success/10 p-4 sm:col-span-2"><p className="text-sm text-text-muted">Character receives</p><p className="mt-1 text-2xl font-semibold text-success">{new Intl.NumberFormat("en-US").format(proceeds)} credits</p><p className="mt-1 text-xs text-text-muted">Ordinary gear sells for half its value, rounded down.</p></div>
          {state.fieldErrors ? <p role="alert" className="text-sm text-danger sm:col-span-2">{Object.values(state.fieldErrors).flat().filter(Boolean).join(" ")}</p> : null}
          {state.formError ? <p role="alert" className="text-sm text-danger sm:col-span-2">{state.formError}</p> : null}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2"><button disabled={pending || proceeds <= 0} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Selling…" : `Sell for ${new Intl.NumberFormat("en-US").format(proceeds)} credits`}</button><button type="button" onClick={() => dialog.current?.close()} className="text-sm font-semibold text-text-muted hover:text-text-primary">Cancel</button></div>
        </form>}
        {returnAmount != null && returnAmount > 0 ? <form action={returnFormAction} className="mt-6 border-t border-border pt-5">
          <input type="hidden" name="idempotencyKey" value={`return-${key}`} />
          <input type="hidden" name="returnedOn" value={new Date().toISOString().slice(0, 10)} />
          <p className="font-semibold">Added by mistake?</p><p className="mt-1 text-sm text-text-muted">Return the remaining purchase and restore the full {new Intl.NumberFormat("en-US").format(returnAmount)} credits paid. The return remains in transaction history.</p>
          {returnState.fieldErrors ? <p role="alert" className="mt-3 text-sm text-danger">{Object.values(returnState.fieldErrors).flat().filter(Boolean).join(" ")}</p> : null}
          {returnState.formError ? <p role="alert" className="mt-3 text-sm text-danger">{returnState.formError}</p> : null}
          <button disabled={returnPending} className="mt-4 rounded-full border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand hover:text-on-brand disabled:opacity-60">{returnPending ? "Returning…" : `Return item for ${new Intl.NumberFormat("en-US").format(returnAmount)} credits`}</button>
        </form> : null}
      </div>
    </dialog>
  </>;
}
