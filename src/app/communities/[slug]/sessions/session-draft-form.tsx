"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { SessionDraftFormState } from "./actions";

type Option = { id: string; label: string };
type InitialDraft = {
  contentItemId: string;
  gmPersonId: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  locationType: "virtual" | "physical";
};

function localInputValue(instant?: string) {
  if (!instant) return "";
  const date = new Date(instant);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultEndFromStart(localStart: string) {
  if (!localStart) return "";
  return localInputValue(new Date(new Date(localStart).getTime() + 4 * 60 * 60 * 1_000).toISOString());
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] disabled:opacity-60">{pending ? "Saving…" : editing ? "Save draft" : "Create draft"}</button>;
}

export function SessionDraftForm({
  action,
  slug,
  scenarios,
  gms,
  canAssignGm,
  actorPersonId,
  initial,
}: {
  action: (state: SessionDraftFormState, data: FormData) => Promise<SessionDraftFormState>;
  slug: string;
  scenarios: Option[];
  gms: Option[];
  canAssignGm: boolean;
  actorPersonId: string;
  initial?: InitialDraft;
}) {
  const [state, formAction] = useActionState(action, {});
  const editing = Boolean(initial);
  const values = state.values;
  const [contentItemId, setContentItemId] = useState(values?.contentItemId ?? initial?.contentItemId ?? "");
  const [gmPersonId, setGmPersonId] = useState(values?.gmPersonId ?? initial?.gmPersonId ?? "");
  const [localStartsAt, setLocalStartsAt] = useState(values?.localStartsAt ?? localInputValue(initial?.startsAt));
  const [localEndsAt, setLocalEndsAt] = useState(values?.localEndsAt ?? localInputValue(initial?.endsAt));
  const [locationType, setLocationType] = useState<"virtual" | "physical">(
    values?.locationType === "physical" || (!values && initial?.locationType === "physical")
      ? "physical"
      : "virtual",
  );
  const [notes, setNotes] = useState(values?.notes ?? initial?.notes ?? "");

  return <form action={formAction} className="mt-10 space-y-6" noValidate onSubmit={(event) => {
    const form = event.currentTarget;
    const start = form.elements.namedItem("localStartsAt") as HTMLInputElement;
    const end = form.elements.namedItem("localEndsAt") as HTMLInputElement;
    const startsAt = form.elements.namedItem("startsAt") as HTMLInputElement;
    const endsAt = form.elements.namedItem("endsAt") as HTMLInputElement;
    const zone = form.elements.namedItem("displayTimeZone") as HTMLInputElement;
    startsAt.value = start.value ? new Date(start.value).toISOString() : "";
    endsAt.value = end.value ? new Date(end.value).toISOString() : "";
    zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }}>
    <input type="hidden" name="startsAt" />
    <input type="hidden" name="endsAt" />
    <input type="hidden" name="displayTimeZone" />
    <div><label htmlFor="contentItemId" className="block text-sm font-semibold">Scenario</label><select id="contentItemId" name="contentItemId" required value={contentItemId} onChange={(event) => setContentItemId(event.currentTarget.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101917] px-4 py-3"><option value="" disabled>Choose a scenario</option>{scenarios.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>{state.fieldErrors?.contentItemId ? <p role="alert" className="mt-2 text-sm text-red-300">{state.fieldErrors.contentItemId[0]}</p> : null}</div>
    {canAssignGm ? <div><label htmlFor="gmPersonId" className="block text-sm font-semibold">Game Master</label><select id="gmPersonId" name="gmPersonId" required value={gmPersonId} onChange={(event) => setGmPersonId(event.currentTarget.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101917] px-4 py-3"><option value="" disabled>Choose an active GM</option>{gms.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div> : <input type="hidden" name="gmPersonId" value={actorPersonId} />}
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="localStartsAt" className="block text-sm font-semibold">Starts</label><input id="localStartsAt" name="localStartsAt" type="datetime-local" required value={localStartsAt} onChange={(event) => { const start = event.currentTarget.value; setLocalStartsAt(start); setLocalEndsAt(defaultEndFromStart(start)); }} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" /></div><div><label htmlFor="localEndsAt" className="block text-sm font-semibold">Ends</label><input id="localEndsAt" name="localEndsAt" type="datetime-local" required value={localEndsAt} onChange={(event) => setLocalEndsAt(event.currentTarget.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" />{state.fieldErrors?.endsAt ? <p role="alert" className="mt-2 text-sm text-red-300">{state.fieldErrors.endsAt[0]}</p> : null}</div></div>
    <p className="text-sm text-[var(--muted)]">Times use this device’s time zone. The saved instant will not change if its display zone changes later.</p>
    <fieldset><legend className="text-sm font-semibold">Location type</legend><div className="mt-3 flex gap-6"><label><input type="radio" name="locationType" value="virtual" checked={locationType === "virtual"} onChange={() => setLocationType("virtual")} /> <span className="ml-2">Virtual</span></label><label><input type="radio" name="locationType" value="physical" checked={locationType === "physical"} onChange={() => setLocationType("physical")} /> <span className="ml-2">Physical</span></label></div></fieldset>
    <div><label htmlFor="notes" className="block text-sm font-semibold">Notes <span className="font-normal text-[var(--muted)]">(optional)</span></label><textarea id="notes" name="notes" maxLength={4000} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} rows={5} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" /></div>
    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--muted)]">Player capacity is fixed at the standard Society table size of six.</p>
    {state.formError ? <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-200">{state.formError}</p> : null}{state.success ? <p role="status" className="rounded-xl bg-emerald-400/10 p-4 text-emerald-200">{state.success}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton editing={editing} /><Link href={`/communities/${slug}`} className="text-sm text-[var(--muted)] hover:text-white">Back to community</Link></div>
  </form>;
}
