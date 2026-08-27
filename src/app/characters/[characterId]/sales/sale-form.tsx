"use client";
import { useActionState, useId } from "react";
import type { SaleState } from "./actions";

export function SaleForm({ available, action }: { available: number; action: (state: SaleState, data: FormData) => Promise<SaleState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const key = `sale-${useId()}-${available}`;
  return <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
    <input type="hidden" name="idempotencyKey" value={key} />
    <label className="text-xs font-semibold">Quantity<input className="mt-1 block w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm font-normal" name="quantity" type="number" min="1" max={available} step="1" defaultValue="1" required /></label>
    <label className="text-xs font-semibold">Sale date<input className="mt-1 block rounded-lg border border-border bg-surface px-2 py-1.5 text-sm font-normal" name="soldOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    <button disabled={pending} className="rounded-full border border-brand px-4 py-1.5 text-sm font-semibold text-brand disabled:opacity-60">{pending ? "Selling…" : "Sell at SFS rate"}</button>
    {state.fieldErrors ? <p className="w-full text-sm text-danger">{Object.values(state.fieldErrors).flat().filter(Boolean).join(" ")}</p> : null}
    {state.formError ? <p className="w-full text-sm text-danger">{state.formError}</p> : null}
  </form>;
}
