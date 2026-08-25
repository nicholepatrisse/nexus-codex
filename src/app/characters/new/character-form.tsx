"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCharacterAction, type CreateCharacterFormState } from "./actions";

type CharacterSystem = { id: string; name: string; characterNumberPrefix: string };
const inputClass = "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-[var(--accent)]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] disabled:opacity-60">{pending ? "Creating…" : "Create character"}</button>;
}

export function CharacterForm({ systems, societyPlayNumber }: { systems: CharacterSystem[]; societyPlayNumber: string }) {
  const [state, action] = useActionState<CreateCharacterFormState, FormData>(createCharacterAction, {});
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const prefix = systems.find(({ id }) => id === selectedSystemId)?.characterNumberPrefix;
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  return <form action={action} className="mt-10 space-y-7" noValidate>
    <div><label htmlFor="name" className="block text-sm font-semibold">Character name</label><input id="name" name="name" required maxLength={100} aria-invalid={Boolean(field("name"))} className={`mt-2 ${inputClass}`} />{field("name") ? <p role="alert" className="mt-2 text-sm text-red-300">{field("name")}</p> : null}</div>
    <div><label htmlFor="gameSystemId" className="block text-sm font-semibold">Game / system</label><select id="gameSystemId" name="gameSystemId" required value={selectedSystemId} onChange={(event) => setSelectedSystemId(event.target.value)} aria-invalid={Boolean(field("gameSystemId"))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#111722] px-4 py-3 outline-none focus:border-[var(--accent)]"><option value="" disabled>Choose a system</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select>{field("gameSystemId") ? <p role="alert" className="mt-2 text-sm text-red-300">{field("gameSystemId")}</p> : null}</div>
    <fieldset><legend className="block text-sm font-semibold">Society identification</legend><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
      <div aria-label="Society player number" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[var(--muted)]">{societyPlayNumber || "Not set"}</div>
      <span aria-hidden="true" className="pt-3 text-[var(--muted)]">—</span>
      <div><label htmlFor="characterNumber" className="sr-only">Character sequence number</label><div className="flex rounded-xl border border-white/15 bg-white/5 focus-within:border-[var(--accent)]">{prefix ? <span aria-hidden="true" className="border-r border-white/15 px-4 py-3 text-[var(--muted)]">{prefix}</span> : null}<input id="characterNumber" name="characterNumber" required inputMode="numeric" maxLength={2} pattern="(?:0?[1-9]|[1-9][0-9])" placeholder={prefix === "" ? "1" : "01"} aria-label="Character sequence number, 1 to 99" aria-invalid={Boolean(field("characterNumber"))} className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none" /></div>{field("characterNumber") ? <p role="alert" className="mt-2 text-sm text-red-300">{field("characterNumber")}</p> : null}</div>
    </div><p className="mt-2 text-sm text-[var(--muted)]">Your society player number comes from your profile. Enter the character sequence from 1 to 99.</p></fieldset>
    {state.formError ? <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-200">{state.formError}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton /><Link href="/characters" className="text-sm text-[var(--muted)] hover:text-white">Cancel</Link></div>
  </form>;
}
