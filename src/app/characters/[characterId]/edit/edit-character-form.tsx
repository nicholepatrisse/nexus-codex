"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { CharacterDetail } from "@/character/characters";
import { updateCharacterAction, type EditCharacterFormState } from "./actions";

const inputClass = "w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand";
function SubmitButton() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : "Save changes"}</button>; }

export function EditCharacterForm({ character }: { character: CharacterDetail }) {
  const action = updateCharacterAction.bind(null, character.id);
  const [state, formAction] = useActionState<EditCharacterFormState, FormData>(action, {});
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  return <form action={formAction} className="mt-10 space-y-6" noValidate>
    <div><label htmlFor="name" className="block text-sm font-semibold">Character name</label><input id="name" name="name" required maxLength={100} defaultValue={character.name} aria-invalid={Boolean(field("name"))} className={`mt-2 ${inputClass}`} />{field("name") ? <p role="alert" className="mt-2 text-sm text-danger">{field("name")}</p> : null}</div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div><label htmlFor="level" className="block text-sm font-semibold">Level</label><input id="level" name="level" type="number" inputMode="numeric" required min={1} max={20} defaultValue={character.level} aria-invalid={Boolean(field("level"))} className={`mt-2 ${inputClass}`} />{field("level") ? <p role="alert" className="mt-2 text-sm text-danger">{field("level")}</p> : null}</div>
      <div><label htmlFor="className" className="block text-sm font-semibold">Class <span className="font-normal text-text-muted">(optional)</span></label><input id="className" name="className" maxLength={100} defaultValue={character.className ?? ""} aria-invalid={Boolean(field("className"))} className={`mt-2 ${inputClass}`} />{field("className") ? <p role="alert" className="mt-2 text-sm text-danger">{field("className")}</p> : null}</div>
      <div><label htmlFor="ancestry" className="block text-sm font-semibold">Ancestry <span className="font-normal text-text-muted">(optional)</span></label><input id="ancestry" name="ancestry" maxLength={100} defaultValue={character.ancestry ?? ""} aria-invalid={Boolean(field("ancestry"))} className={`mt-2 ${inputClass}`} />{field("ancestry") ? <p role="alert" className="mt-2 text-sm text-danger">{field("ancestry")}</p> : null}</div>
      <div><label htmlFor="background" className="block text-sm font-semibold">Background <span className="font-normal text-text-muted">(optional)</span></label><input id="background" name="background" maxLength={100} defaultValue={character.background ?? ""} aria-invalid={Boolean(field("background"))} className={`mt-2 ${inputClass}`} />{field("background") ? <p role="alert" className="mt-2 text-sm text-danger">{field("background")}</p> : null}</div>
      <div className="sm:col-span-2"><label htmlFor="backstory" className="block text-sm font-semibold">Backstory <span className="font-normal text-text-muted">(optional)</span></label><textarea id="backstory" name="backstory" rows={6} maxLength={5000} defaultValue={character.backstory ?? ""} aria-invalid={Boolean(field("backstory"))} className={`mt-2 resize-y ${inputClass}`} />{field("backstory") ? <p role="alert" className="mt-2 text-sm text-danger">{field("backstory")}</p> : null}</div>
      <div className="sm:col-span-2"><label htmlFor="notes" className="block text-sm font-semibold">Notes <span className="font-normal text-text-muted">(optional)</span></label><textarea id="notes" name="notes" rows={6} maxLength={5000} defaultValue={character.notes ?? ""} aria-invalid={Boolean(field("notes"))} className={`mt-2 resize-y ${inputClass}`} />{field("notes") ? <p role="alert" className="mt-2 text-sm text-danger">{field("notes")}</p> : null}</div>
    </div>
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton /><Link href={`/characters/${character.id}`} className="text-sm text-text-muted hover:text-text-primary">Cancel</Link></div>
  </form>;
}
