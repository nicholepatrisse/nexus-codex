"use client";
import { useActionState, useRef } from "react";
import type { AdjustmentState } from "./actions";

export function CreditAdjustmentForm({ action }: { action: (state: AdjustmentState, data: FormData) => Promise<AdjustmentState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Adjust credits</button>
    <dialog ref={dialog} aria-labelledby="credit-adjustment-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-border-strong bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><h2 id="credit-adjustment-title" className="text-2xl font-semibold">Adjust credits</h2><p className="mt-2 text-sm text-text-muted">Record a manual correction to this character’s credit balance.</p></div><button type="button" onClick={() => dialog.current?.close()} aria-label="Close credit adjustment" className="rounded-full px-2 py-1 text-xl leading-none text-text-muted hover:bg-surface-raised hover:text-text-primary">×</button></div>
        <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Credit adjustment<input autoFocus name="amountMinor" type="number" step="1" required className="mt-2 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-normal" /><span className="mt-1 block font-normal text-text-muted">Use a negative number to subtract credits.</span></label>
          <label className="text-sm font-semibold">Effective date<input name="effectiveOn" type="date" required className="mt-2 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-normal" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Reason<textarea name="notes" required maxLength={1000} className="mt-2 min-h-24 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-normal" /></label>
          {state.fieldErrors ? <p role="alert" className="text-sm text-danger sm:col-span-2">{Object.values(state.fieldErrors).flat().filter(Boolean).join(" ")}</p> : null}
          {state.formError ? <p role="alert" className="text-sm text-danger sm:col-span-2">{state.formError}</p> : null}
          {state.success ? <p role="status" className="text-sm text-success sm:col-span-2">Adjustment recorded. You can close this window.</p> : null}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2"><button disabled={pending} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Recording…" : "Record adjustment"}</button><button type="button" onClick={() => dialog.current?.close()} className="text-sm font-semibold text-text-muted hover:text-text-primary">Cancel</button></div>
        </form>
      </div>
    </dialog>
  </>;
}
