"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCharacterAction, type CreateCharacterFormState } from "./actions";

const inputClass = "w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand";

export function normalizeCharacterNumber(value: string) {
  const trimmed = value.trim();
  return /^[1-9]$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
}

export function nextAvailableCharacterNumber(usedCharacterNumbers: string[]) {
  const used = new Set(usedCharacterNumbers.map((number) => normalizeCharacterNumber(number)));
  for (let number = 1; number <= 99; number += 1) {
    const candidate = String(number).padStart(2, "0");
    if (!used.has(candidate)) return candidate;
  }
  return "";
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Creating…" : "Create character"}</button>;
}

export function CharacterForm({ societyPlayNumber, usedCharacterNumbers, returnTo }: { societyPlayNumber: string; usedCharacterNumbers: string[]; returnTo?: string }) {
  const [state, action] = useActionState<CreateCharacterFormState, FormData>(createCharacterAction, {});
  const suggestedCharacterNumber = nextAvailableCharacterNumber(usedCharacterNumbers);
  const [characterNumber, setCharacterNumber] = useState(suggestedCharacterNumber);
  const normalizedCharacterNumber = normalizeCharacterNumber(characterNumber);
  const characterNumberTaken = usedCharacterNumbers.map(normalizeCharacterNumber).includes(normalizedCharacterNumber);
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  return <form action={action} className="mt-10 space-y-7" noValidate>
    {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
    <div><label htmlFor="name" className="block text-sm font-semibold">Character name</label><input id="name" name="name" required maxLength={100} aria-invalid={Boolean(field("name"))} className={`mt-2 ${inputClass}`} />{field("name") ? <p role="alert" className="mt-2 text-sm text-danger">{field("name")}</p> : null}</div>
    <fieldset><legend className="block text-sm font-semibold">Society identification</legend><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
      <div aria-label="Society player number" className="rounded-xl border border-border bg-surface px-4 py-3 text-text-muted">{societyPlayNumber || "Not set"}</div>
      <span aria-hidden="true" className="pt-3 text-text-muted">—</span>
      <div><label htmlFor="characterNumber" className="sr-only">Character sequence number</label><div className="flex rounded-xl border border-border-strong bg-surface-raised focus-within:border-brand"><span aria-hidden="true" className="border-r border-border-strong px-4 py-3 text-text-muted">27</span><input id="characterNumber" name="characterNumber" required inputMode="numeric" maxLength={2} pattern="(?:0?[1-9]|[1-9][0-9])" placeholder="01" value={characterNumber} aria-label="Character sequence number, 1 to 99" aria-invalid={characterNumberTaken || Boolean(field("characterNumber"))} aria-describedby={characterNumberTaken ? "character-number-error" : undefined} onChange={(event) => setCharacterNumber(event.currentTarget.value)} onBlur={(event) => { const normalized = normalizeCharacterNumber(event.currentTarget.value); setCharacterNumber(normalized); }} className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none" /></div>{characterNumberTaken ? <p id="character-number-error" role="alert" className="mt-2 text-sm text-danger">Character {normalizedCharacterNumber} already exists. Choose another number.</p> : field("characterNumber") ? <p role="alert" className="mt-2 text-sm text-danger">{field("characterNumber")}</p> : null}</div>
    </div><p className="mt-2 text-sm text-text-muted">Your society player number comes from your profile. Enter the character sequence from 1 to 99.</p></fieldset>
    <fieldset><legend className="block text-sm font-semibold">Character details</legend><p className="mt-1 text-sm text-text-muted">Choose the permanent Society starting level. You can fill in or change the other details later.</p><div className="mt-4 grid gap-5 sm:grid-cols-2">
      <div><span id="starting-level-label" className="block text-sm font-semibold">Starting level</span><div role="radiogroup" aria-labelledby="starting-level-label" aria-describedby={field("startingLevel") ? "starting-level-error" : undefined} aria-invalid={Boolean(field("startingLevel"))} className="mt-2 grid grid-cols-4 overflow-hidden rounded-xl border border-border-strong bg-surface-raised">{[1, 3, 5, 7].map((level) => <label key={level} className="relative cursor-pointer border-r border-border-strong last:border-r-0"><input type="radio" name="startingLevel" value={level} required defaultChecked={level === 1} className="peer sr-only" /><span className="flex min-h-12 items-center justify-center font-semibold text-text-muted transition-colors peer-checked:bg-brand peer-checked:text-on-brand peer-hover:bg-surface-hover peer-checked:peer-hover:bg-brand-hover peer-focus-visible:outline-3 peer-focus-visible:-outline-offset-3 peer-focus-visible:outline-brand-hover">{level}</span></label>)}</div>{field("startingLevel") ? <p id="starting-level-error" role="alert" className="mt-2 text-sm text-danger">{field("startingLevel")}</p> : null}</div>
      <div><label htmlFor="className" className="block text-sm font-semibold">Class <span className="font-normal text-text-muted">(optional)</span></label><input id="className" name="className" maxLength={100} aria-invalid={Boolean(field("className"))} className={`mt-2 ${inputClass}`} />{field("className") ? <p role="alert" className="mt-2 text-sm text-danger">{field("className")}</p> : null}</div>
      <div><label htmlFor="ancestry" className="block text-sm font-semibold">Ancestry <span className="font-normal text-text-muted">(optional)</span></label><input id="ancestry" name="ancestry" maxLength={100} aria-invalid={Boolean(field("ancestry"))} className={`mt-2 ${inputClass}`} />{field("ancestry") ? <p role="alert" className="mt-2 text-sm text-danger">{field("ancestry")}</p> : null}</div>
      <div><label htmlFor="background" className="block text-sm font-semibold">Background <span className="font-normal text-text-muted">(optional)</span></label><input id="background" name="background" maxLength={100} aria-invalid={Boolean(field("background"))} className={`mt-2 ${inputClass}`} />{field("background") ? <p role="alert" className="mt-2 text-sm text-danger">{field("background")}</p> : null}</div>
      <div className="sm:col-span-2"><label htmlFor="backstory" className="block text-sm font-semibold">Backstory <span className="font-normal text-text-muted">(optional)</span></label><textarea id="backstory" name="backstory" rows={6} maxLength={5000} aria-invalid={Boolean(field("backstory"))} className={`mt-2 resize-y ${inputClass}`} />{field("backstory") ? <p role="alert" className="mt-2 text-sm text-danger">{field("backstory")}</p> : null}</div>
      <div className="sm:col-span-2"><label htmlFor="notes" className="block text-sm font-semibold">Notes <span className="font-normal text-text-muted">(optional)</span></label><textarea id="notes" name="notes" rows={6} maxLength={5000} aria-invalid={Boolean(field("notes"))} className={`mt-2 resize-y ${inputClass}`} />{field("notes") ? <p role="alert" className="mt-2 text-sm text-danger">{field("notes")}</p> : null}</div>
    </div></fieldset>
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton disabled={characterNumberTaken || !suggestedCharacterNumber} /><Link href={returnTo ?? "/characters"} className="text-sm text-text-muted hover:text-text-primary">Cancel</Link></div>
  </form>;
}
