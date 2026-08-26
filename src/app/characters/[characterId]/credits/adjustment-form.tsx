"use client";
import { useActionState } from "react";
import type { AdjustmentState } from "./actions";

export function CreditAdjustmentForm({ action }: { action: (state: AdjustmentState, data: FormData) => Promise<AdjustmentState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="mt-5 grid gap-4 rounded-xl border border-border bg-surface-raised p-5 sm:grid-cols-2">
    <label className="text-sm font-semibold">Credit adjustment<input name="amountMinor" type="number" step="1" required className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal" /><span className="mt-1 block font-normal text-text-muted">Use a negative number to subtract credits.</span></label>
    <label className="text-sm font-semibold">Effective date<input name="effectiveOn" type="date" required className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal" /></label>
    <label className="text-sm font-semibold sm:col-span-2">Reason<textarea name="notes" required maxLength={1000} className="mt-2 min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal" /></label>
    {state.fieldErrors ? <p className="text-sm text-red-600 sm:col-span-2">{Object.values(state.fieldErrors).flat().filter(Boolean).join(" ")}</p> : null}
    {state.formError ? <p className="text-sm text-red-600 sm:col-span-2">{state.formError}</p> : null}
    {state.success ? <p className="text-sm text-brand">Adjustment recorded.</p> : null}
    <button disabled={pending} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Recording…" : "Record adjustment"}</button>
  </form>;
}
