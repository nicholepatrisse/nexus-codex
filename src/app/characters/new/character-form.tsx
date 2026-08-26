"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCharacterAction, type CreateCharacterFormState } from "./actions";

const inputClass = "w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand";

export function normalizeCharacterNumber(value: string) {
  const trimmed = value.trim();
  return /^[1-9]$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-background disabled:opacity-60">{pending ? "Creating…" : "Create character"}</button>;
}

export function CharacterForm({ societyPlayNumber, returnTo }: { societyPlayNumber: string; returnTo?: string }) {
  const [state, action] = useActionState<CreateCharacterFormState, FormData>(createCharacterAction, {});
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  return <form action={action} className="mt-10 space-y-7" noValidate>
    {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
    <div><label htmlFor="name" className="block text-sm font-semibold">Character name</label><input id="name" name="name" required maxLength={100} aria-invalid={Boolean(field("name"))} className={`mt-2 ${inputClass}`} />{field("name") ? <p role="alert" className="mt-2 text-sm text-danger">{field("name")}</p> : null}</div>
    <fieldset><legend className="block text-sm font-semibold">Society identification</legend><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
      <div aria-label="Society player number" className="rounded-xl border border-border bg-surface px-4 py-3 text-text-muted">{societyPlayNumber || "Not set"}</div>
      <span aria-hidden="true" className="pt-3 text-text-muted">—</span>
      <div><label htmlFor="characterNumber" className="sr-only">Character sequence number</label><div className="flex rounded-xl border border-border-strong bg-surface-raised focus-within:border-brand"><span aria-hidden="true" className="border-r border-border-strong px-4 py-3 text-text-muted">27</span><input id="characterNumber" name="characterNumber" required inputMode="numeric" maxLength={2} pattern="(?:0?[1-9]|[1-9][0-9])" placeholder="01" aria-label="Character sequence number, 1 to 99" aria-invalid={Boolean(field("characterNumber"))} onBlur={(event) => { event.currentTarget.value = normalizeCharacterNumber(event.currentTarget.value); }} className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none" /></div>{field("characterNumber") ? <p role="alert" className="mt-2 text-sm text-danger">{field("characterNumber")}</p> : null}</div>
    </div><p className="mt-2 text-sm text-text-muted">Your society player number comes from your profile. Enter the character sequence from 1 to 99.</p></fieldset>
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton /><Link href={returnTo ?? "/characters"} className="text-sm text-text-muted hover:text-text-primary">Cancel</Link></div>
  </form>;
}
