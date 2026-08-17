"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateCommunitySettingsAction } from "./actions";
import type { CommunitySettingsFormState } from "./state";

interface Program { id: string; name: string }
interface Settings {
  name: string;
  slug: string;
  description: string | null;
  defaultTimeZone: string;
  visibility: string;
  membershipApproval: string;
  gmAdmission: string;
  scheduleVisibility: string;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] disabled:opacity-60">{pending ? "Saving…" : "Save settings"}</button>;
}

export function CommunitySettingsForm({ settings, programs, selectedProgramIds }: { settings: Settings; programs: Program[]; selectedProgramIds: string[] }) {
  const action = useMemo(
    () => updateCommunitySettingsAction.bind(null, settings.slug),
    [settings.slug],
  );
  const [state, formAction] = useActionState(action, {} as CommunitySettingsFormState);
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white";

  return (
    <form
      action={formAction}
      className="space-y-6"
      noValidate
      onKeyDown={(event) => {
        if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
          event.preventDefault();
        }
      }}
    >
      <div><label htmlFor="name" className="text-sm font-semibold">Name</label><input id="name" name="name" defaultValue={settings.name} maxLength={120} required className={inputClass} />{error("name") ? <p role="alert" className="mt-2 text-sm text-red-300">{error("name")}</p> : null}</div>
      <div><label htmlFor="requestedSlug" className="text-sm font-semibold">Web address</label><input id="requestedSlug" name="requestedSlug" defaultValue={settings.slug} maxLength={80} required className={inputClass} />{error("requestedSlug") ? <p role="alert" className="mt-2 text-sm text-red-300">{error("requestedSlug")}</p> : null}</div>
      <div><label htmlFor="description" className="text-sm font-semibold">Description</label><textarea id="description" name="description" defaultValue={settings.description ?? ""} maxLength={2000} rows={4} className={inputClass} /></div>
      <div><label htmlFor="defaultTimeZone" className="text-sm font-semibold">Default time zone</label><input id="defaultTimeZone" name="defaultTimeZone" defaultValue={settings.defaultTimeZone} required className={inputClass} />{error("defaultTimeZone") ? <p role="alert" className="mt-2 text-sm text-red-300">{error("defaultTimeZone")}</p> : null}</div>
      <fieldset><legend className="text-sm font-semibold">Supported programs</legend><div className="mt-3 space-y-2">{programs.map((program) => <label key={program.id} className="flex gap-3"><input type="checkbox" name="supportedProgramIds" value={program.id} defaultChecked={selectedProgramIds.includes(program.id)} />{program.name}</label>)}</div></fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Select key={`visibility:${state.saved?.visibility ?? "initial"}`} label="Community visibility" name="visibility" value={state.saved?.visibility ?? settings.visibility} options={[["private", "Private"], ["public", "Public"]]} />
        <Select key={`scheduleVisibility:${state.saved?.scheduleVisibility ?? "initial"}`} label="Schedule visibility" name="scheduleVisibility" value={state.saved?.scheduleVisibility ?? settings.scheduleVisibility} options={[["members", "Members"], ["public", "Public"]]} />
        <Select key={`membershipApproval:${state.saved?.membershipApproval ?? "initial"}`} label="Membership approval" name="membershipApproval" value={state.saved?.membershipApproval ?? settings.membershipApproval} options={[["manual", "Manual"], ["automatic", "Automatic"]]} />
        <Select key={`gmAdmission:${state.saved?.gmAdmission ?? "initial"}`} label="GM admission" name="gmAdmission" value={state.saved?.gmAdmission ?? settings.gmAdmission} options={[["approved_only", "Approved only"], ["self_service", "Self service"]]} />
      </div>
      {state.formError ? <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-200">{state.formError}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-emerald-400/10 p-4 text-emerald-200">{state.success}</p> : null}
      <SaveButton />
    </form>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: [string, string][] }) {
  const [selected, setSelected] = useState(value);

  return <label className="text-sm font-semibold">{label}<select name={name} value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#111722] px-4 py-3">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
