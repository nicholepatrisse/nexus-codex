"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSocietyNumberAction, type SocietyNumberFormState } from "./actions";
import { CharacterForm } from "./character-form";
function SaveButton() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="rounded-full bg-brand px-5 py-2.5 font-semibold text-background disabled:opacity-60">{pending ? "Saving…" : "Save society number"}</button>; }
export function SocietyNumberGate({ initialSocietyPlayNumber, returnTo }: { initialSocietyPlayNumber: string; returnTo?: string }) {
  const [state, action] = useActionState<SocietyNumberFormState, FormData>(saveSocietyNumberAction, {});
  const societyPlayNumber = state.savedNumber ?? initialSocietyPlayNumber;
  const error = state.fieldErrors?.societyPlayNumber?.[0];
  return <><CharacterForm societyPlayNumber={societyPlayNumber} returnTo={returnTo} />{!societyPlayNumber ? <div role="dialog" aria-modal="true" aria-labelledby="society-modal-title" className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-6 backdrop-blur-sm"><section className="w-full max-w-md rounded-3xl border border-border-strong bg-surface-raised p-8 shadow-2xl">
    <p className="text-sm font-semibold tracking-[0.18em] text-brand uppercase">Profile required</p><h2 id="society-modal-title" className="mt-3 text-2xl font-semibold">Add your society number</h2><p className="mt-3 text-text-muted">Your society number is needed to create organized-play characters.</p>
    <form action={action} className="mt-6 space-y-5" noValidate><div><label htmlFor="modalSocietyPlayNumber" className="block text-sm font-semibold">Society player number</label><input id="modalSocietyPlayNumber" name="societyPlayNumber" required inputMode="numeric" autoFocus placeholder="123456" aria-invalid={Boolean(error)} className="mt-2 w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand" />{error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}</div>
      <p className="text-sm text-text-muted">Society numbers can be modified later in <Link href="/profile" className="text-brand hover:underline">your profile</Link>.</p>{state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{state.formError}</p> : null}<SaveButton /></form>
  </section></div> : null}</>;
}
