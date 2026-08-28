"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { StyledSelect } from "@/app/styled-select";
import type { ScenarioLookupState, SessionDraftFormState } from "./actions";

type Option = { id: string; label: string; disabled?: boolean };
type OptionGroup = { label: string; options: Option[] };
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
  return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : editing ? "Save draft" : "Create draft"}</button>;
}

export function SessionDraftForm({
  action,
  slug,
  scenarioGroups,
  gms,
  canAssignGm,
  actorPersonId,
  initial,
  previewScenario,
  addScenario,
}: {
  action: (state: SessionDraftFormState, data: FormData) => Promise<SessionDraftFormState>;
  slug: string;
  scenarioGroups: OptionGroup[];
  gms: Option[];
  canAssignGm: boolean;
  actorPersonId: string;
  initial?: InitialDraft;
  previewScenario: (url: string) => Promise<ScenarioLookupState>;
  addScenario: (url: string) => Promise<ScenarioLookupState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const editing = Boolean(initial);
  const values = state.values;
  const [contentItemId, setContentItemId] = useState(values?.contentItemId ?? initial?.contentItemId ?? "");
  const initialSeason = scenarioGroups.find((group) => group.options.some((option) => option.id === (values?.contentItemId ?? initial?.contentItemId)))?.label ?? "";
  const [season, setSeason] = useState(initialSeason);
  const [gmPersonId, setGmPersonId] = useState(values?.gmPersonId ?? initial?.gmPersonId ?? "");
  const [localStartsAt, setLocalStartsAt] = useState(values?.localStartsAt ?? localInputValue(initial?.startsAt));
  const [localEndsAt, setLocalEndsAt] = useState(values?.localEndsAt ?? localInputValue(initial?.endsAt));
  const [locationType, setLocationType] = useState<"virtual" | "physical">(
    values?.locationType === "physical" || (!values && initial?.locationType === "physical")
      ? "physical"
      : "virtual",
  );
  const [notes, setNotes] = useState(values?.notes ?? initial?.notes ?? "");
  const [showScenarioDialog, setShowScenarioDialog] = useState(false);
  const [scenarioUrl, setScenarioUrl] = useState("");
  const [scenarioLookup, setScenarioLookup] = useState<ScenarioLookupState>({});
  const [addedScenario, setAddedScenario] = useState<{ id: string; code: string; title: string } | null>(null);
  const [scenarioPending, startScenarioTransition] = useTransition();
  const soleGm = canAssignGm && gms.length === 1 ? gms[0] : null;
  const scenarioOptions = [
    ...(scenarioGroups.find((group) => group.label === season)?.options ?? []),
    ...(addedScenario && season === `Season ${Number(addedScenario.code.split("-")[0])}` ? [{ id: addedScenario.id, label: `${addedScenario.code}: ${addedScenario.title}` }] : []),
  ];
  const selectOptions = (options: Option[]) => options.map((option) => ({ value: option.id, label: option.label }));

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
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="season" className="block text-sm font-semibold">Season</label><StyledSelect name="season" label="Season" value={season} options={[{ value: "", label: "Choose a season" }, ...scenarioGroups.map((group) => ({ value: group.label, label: group.label })), ...(addedScenario && !scenarioGroups.some((group) => group.label === `Season ${Number(addedScenario.code.split("-")[0])}`) ? [{ value: `Season ${Number(addedScenario.code.split("-")[0])}`, label: `Season ${Number(addedScenario.code.split("-")[0])}` }] : [])]} onValueChange={(nextSeason) => { setSeason(nextSeason); setContentItemId(""); }} /></div><div><div className="flex items-center justify-between gap-3"><label htmlFor="contentItemId" className="block text-sm font-semibold">Scenario</label><button type="button" onClick={() => { setShowScenarioDialog(true); setScenarioLookup({}); }} className="text-sm font-semibold text-brand hover:underline">+ Add scenario</button></div><StyledSelect name="contentItemId" label="Scenario" value={contentItemId} disabled={!season} invalid={Boolean(state.fieldErrors?.contentItemId)} options={[{ value: "", label: season ? "Choose a scenario" : "Choose a season first" }, ...selectOptions(scenarioOptions)]} onValueChange={setContentItemId} />{state.fieldErrors?.contentItemId ? <p role="alert" className="mt-2 text-sm text-danger">{state.fieldErrors.contentItemId[0]}</p> : null}</div></div>
    {showScenarioDialog ? <div role="dialog" aria-modal="true" aria-labelledby="add-scenario-title" className="rounded-2xl border border-border-strong bg-surface-raised p-5 shadow-lg"><div className="flex items-start justify-between gap-4"><div><h2 id="add-scenario-title" className="text-xl font-semibold">Add scenario</h2><p className="mt-1 text-sm text-text-muted">Paste an official Paizo store URL. Nothing is added until you review and confirm.</p></div><button type="button" aria-label="Close add scenario" onClick={() => setShowScenarioDialog(false)} className="text-xl text-text-muted">×</button></div><label htmlFor="paizoScenarioUrl" className="mt-5 block text-sm font-semibold">Paizo scenario URL</label><input id="paizoScenarioUrl" type="url" value={scenarioUrl} onChange={(event) => { setScenarioUrl(event.currentTarget.value); setScenarioLookup({}); }} placeholder="https://store.paizo.com/..." className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-4 py-3" />{scenarioLookup.error ? <p role="alert" className="mt-3 text-sm text-danger">{scenarioLookup.error}</p> : null}{scenarioLookup.scenario ? <div className="mt-5 rounded-xl border border-border bg-surface p-4"><h3 className="font-semibold">{scenarioLookup.scenario.code}: {scenarioLookup.scenario.title}</h3><dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"><dt className="text-text-muted">Scenario</dt><dd>{scenarioLookup.scenario.code}</dd><dt className="text-text-muted">Levels</dt><dd>{scenarioLookup.scenario.minimumLevel}–{scenarioLookup.scenario.maximumLevel}</dd><dt className="text-text-muted">Source</dt><dd>Paizo</dd>{scenarioLookup.scenario.productCode ? <><dt className="text-text-muted">SKU</dt><dd>{scenarioLookup.scenario.productCode}</dd></> : null}</dl>{scenarioLookup.existing ? <p role="status" className="mt-3 text-sm text-warning">This scenario already exists and will be selected.</p> : null}</div> : null}<div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setShowScenarioDialog(false)} className="rounded-full border border-border-strong px-4 py-2 font-semibold">Cancel</button>{!scenarioLookup.scenario ? <button type="button" disabled={scenarioPending || !scenarioUrl.trim()} onClick={() => startScenarioTransition(async () => setScenarioLookup(await previewScenario(scenarioUrl)))} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{scenarioPending ? "Fetching…" : "Fetch details"}</button> : <button type="button" disabled={scenarioPending} onClick={() => startScenarioTransition(async () => { const result = scenarioLookup.existing && scenarioLookup.contentItemId ? scenarioLookup : await addScenario(scenarioUrl); setScenarioLookup(result); if (result.scenario && result.contentItemId) { const selectedSeason = `Season ${Number(result.scenario.code.split("-")[0])}`; setAddedScenario({ id: result.contentItemId, code: result.scenario.code, title: result.scenario.title }); setSeason(selectedSeason); setContentItemId(result.contentItemId); setShowScenarioDialog(false); } })} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{scenarioPending ? "Adding…" : scenarioLookup.existing ? "Select existing" : "Add to catalog"}</button>}</div></div> : null}
    {canAssignGm ? soleGm ? <input type="hidden" name="gmPersonId" value={soleGm.id} /> : <div><label htmlFor="gmPersonId" className="block text-sm font-semibold">Game Master</label><StyledSelect name="gmPersonId" label="Game Master" value={gmPersonId} options={[{ value: "", label: "Choose an active GM" }, ...selectOptions(gms)]} onValueChange={setGmPersonId} /></div> : <input type="hidden" name="gmPersonId" value={actorPersonId} />}
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="localStartsAt" className="block text-sm font-semibold">Starts</label><input id="localStartsAt" name="localStartsAt" type="datetime-local" required value={localStartsAt} onChange={(event) => { const start = event.currentTarget.value; setLocalStartsAt(start); setLocalEndsAt(defaultEndFromStart(start)); }} className="mt-2 w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3" /></div><div><label htmlFor="localEndsAt" className="block text-sm font-semibold">Ends</label><input id="localEndsAt" name="localEndsAt" type="datetime-local" required value={localEndsAt} onChange={(event) => setLocalEndsAt(event.currentTarget.value)} className="mt-2 w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3" />{state.fieldErrors?.endsAt ? <p role="alert" className="mt-2 text-sm text-danger">{state.fieldErrors.endsAt[0]}</p> : null}</div></div>
    <p className="text-sm text-text-muted">Times use this device’s time zone. The saved instant will not change if its display zone changes later.</p>
    <div><label htmlFor="locationType" className="block text-sm font-semibold">Style</label><StyledSelect name="locationType" label="Style" value={locationType} options={[{ value: "virtual", label: "Virtual — played online" }, { value: "physical", label: "Physical — played in person" }]} onValueChange={(value) => setLocationType(value as "virtual" | "physical")} /></div>
    <div><label htmlFor="notes" className="block text-sm font-semibold">Notes <span className="font-normal text-text-muted">(optional)</span></label><textarea id="notes" name="notes" maxLength={4000} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} rows={5} className="mt-2 w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3" /></div>
    <p className="rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-muted">Player capacity is fixed at the standard Society table size of six.</p>
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}{state.success ? <p role="status" className="rounded-xl bg-success/10 p-4 text-success">{state.success}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton editing={editing} /><Link href={`/communities/${slug}`} className="text-sm text-text-muted hover:text-text-primary">Back to community</Link></div>
  </form>;
}
