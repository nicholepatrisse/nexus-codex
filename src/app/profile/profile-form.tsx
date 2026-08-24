"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction, type ProfileFormState } from "./actions";

type ProfileValues = { displayName: string; discordHandle: string | null; societyPlayNumber: string | null };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] disabled:opacity-60">{pending ? "Saving…" : "Save profile"}</button>;
}

function Field({ name, label, value, maximum, help, state }: { name: keyof ProfileValues; label: string; value: string | null; maximum: number; help: string; state: ProfileFormState }) {
  const error = state.fieldErrors?.[name]?.[0];
  return <div><label htmlFor={name} className="block text-sm font-semibold">{label} <span className="font-normal text-[var(--muted)]">(optional)</span></label><input id={name} name={name} defaultValue={value ?? ""} maxLength={maximum} aria-describedby={`${name}-help${error ? ` ${name}-error` : ""}`} aria-invalid={Boolean(error)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-[var(--accent)]" /><p id={`${name}-help`} className="mt-2 text-sm text-[var(--muted)]">{help}</p>{error ? <p id={`${name}-error`} role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}</div>;
}

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return <form action={action} className="mt-8 space-y-7" noValidate>
    <Field name="displayName" label="Display name / nickname" value={profile.displayName} maximum={100} help="Shown to players and GMs. Clear it to use your account name." state={state} />
    <Field name="discordHandle" label="Discord handle" value={profile.discordHandle} maximum={100} help="Shown where session organizers need contact information." state={state} />
    <Field name="societyPlayNumber" label="Society play number" value={profile.societyPlayNumber} maximum={50} help="Shown to session organizers for organized-play reporting." state={state} />
    {state.formError ? <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-200">{state.formError}</p> : null}
    {state.saved ? <p role="status" className="rounded-xl bg-emerald-400/10 p-4 text-emerald-200">Profile saved.</p> : null}
    <SaveButton />
  </form>;
}
