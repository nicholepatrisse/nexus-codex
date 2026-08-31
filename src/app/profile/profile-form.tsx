"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormField } from "@/app/form-field";
import { updateProfileAction, type ProfileFormState } from "./actions";

type ProfileValues = { displayName: string; discordHandle: string | null; societyPlayNumber: string | null };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : "Save profile"}</button>;
}

function Field({ name, label, value, maximum, help, state }: { name: keyof ProfileValues; label: string; value: string | null; maximum: number; help: string; state: ProfileFormState }) {
  return <FormField id={name} label={label} optional description={help} errors={state.fieldErrors?.[name]}>{(controlProps) => <input {...controlProps} name={name} defaultValue={value ?? ""} maxLength={maximum} className="w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand" />}</FormField>;
}

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return <form action={action} className="space-y-6 sm:space-y-7" noValidate>
    <Field name="displayName" label="Display name / nickname" value={profile.displayName} maximum={100} help="Shown to players and GMs. Clear it to use your account name." state={state} />
    <Field name="discordHandle" label="Discord handle" value={profile.discordHandle} maximum={100} help="Shown where session organizers need contact information." state={state} />
    <Field name="societyPlayNumber" label="Society play number" value={profile.societyPlayNumber} maximum={50} help="Shown to session organizers for organized-play reporting." state={state} />
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
    {state.saved ? <p role="status" className="rounded-xl bg-success/10 p-4 text-success">Profile saved.</p> : null}
    <SaveButton />
  </form>;
}
