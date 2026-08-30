"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { SessionSocietyNumberState } from "../actions";

function SaveButton() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : "Save and continue"}</button>; }

export function SocietyNumberPrompt({ action }: { action: (state: SessionSocietyNumberState, formData: FormData) => Promise<SessionSocietyNumberState> }) {
  const [state, formAction] = useActionState(action, {});
  return <section role="alert" className="mt-8 rounded-2xl border border-warning/30 bg-warning/10 p-5 sm:p-6">
    <p className="text-sm font-semibold tracking-[0.14em] text-warning uppercase">Profile required</p>
    <h2 className="mt-2 text-xl font-semibold">Add your society number</h2>
    <p className="mt-2 text-sm text-text-muted">Your society number is required before you can create a session as its Game Master.</p>
    <form action={formAction} className="mt-5" noValidate><label htmlFor="sessionSocietyPlayNumber" className="block text-sm font-semibold">Society player number</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="sessionSocietyPlayNumber" name="societyPlayNumber" required inputMode="numeric" autoFocus placeholder="123456" aria-invalid={Boolean(state.fieldError)} className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand" /><SaveButton /></div>{state.fieldError ? <p role="alert" className="mt-2 text-sm text-danger">{state.fieldError}</p> : null}{state.formError ? <p role="alert" className="mt-3 text-sm text-danger">{state.formError}</p> : null}</form>
    <p className="mt-4 text-xs text-text-muted">You can manage this later from your <Link href="/profile" className="font-semibold text-brand hover:underline">profile</Link>.</p>
  </section>;
}
