"use client";

import { useState, useTransition } from "react";
import { StyledSelect } from "@/app/styled-select";
import { Dialog } from "@/app/dialog";

export type ScenarioOption = { id: string; code: string; title: string; minimumLevel?: number; maximumLevel?: number };
export type ScenarioGroup = { label: string; options: ScenarioOption[] };
export type ScenarioLookupState = { scenario?: { code: string; title: string; minimumLevel: number; maximumLevel: number; productCode?: string | null }; contentItemId?: string; existing?: boolean; error?: string };

function seasonFor(code: string) {
  const number = code.match(/^(\d+)-/)?.[1];
  return number ? `Season ${Number(number)}` : "Other scenarios";
}

export function groupScenarioOptions(items: ScenarioOption[]): ScenarioGroup[] {
  const groups = new Map<string, ScenarioOption[]>();
  for (const item of items) groups.set(seasonFor(item.code), [...(groups.get(seasonFor(item.code)) ?? []), item]);
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return [...groups.entries()]
    .sort(([left], [right]) => left === "Other scenarios" ? 1 : right === "Other scenarios" ? -1 : collator.compare(left, right))
    .map(([label, options]) => ({ label, options: options.sort((left, right) => collator.compare(left.code, right.code)) }));
}

export function ScenarioSelector({ groups, value, invalid, onValueChange, previewScenario, addScenario }: {
  groups: ScenarioGroup[];
  value: string;
  invalid?: boolean;
  onValueChange: (id: string, scenario?: ScenarioOption) => void;
  previewScenario: (url: string) => Promise<ScenarioLookupState>;
  addScenario: (url: string) => Promise<ScenarioLookupState>;
}) {
  const initialSeason = groups.find((group) => group.options.some((option) => option.id === value))?.label ?? "";
  const [season, setSeason] = useState(initialSeason);
  const [showDialog, setShowDialog] = useState(false);
  const [scenarioUrl, setScenarioUrl] = useState("");
  const [lookup, setLookup] = useState<ScenarioLookupState>({});
  const [added, setAdded] = useState<ScenarioOption | null>(null);
  const [pending, startTransition] = useTransition();
  const seasons = [...groups.map(({ label }) => label), ...(added && !groups.some(({ label }) => label === seasonFor(added.code)) ? [seasonFor(added.code)] : [])];
  const options = [...(groups.find((group) => group.label === season)?.options ?? []), ...(added && season === seasonFor(added.code) ? [added] : [])];
  const select = (id: string) => onValueChange(id, options.find((option) => option.id === id));
  return <>
    <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="season" className="block text-sm font-semibold">Season</label><StyledSelect name="season" label="Season" value={season} options={[{ value: "", label: "Choose a season" }, ...seasons.map((label) => ({ value: label, label }))]} onValueChange={(next) => { setSeason(next); onValueChange(""); }} /></div><div><div className="flex items-center justify-between gap-3"><label htmlFor="contentItemId" className="block text-sm font-semibold">Scenario</label><button type="button" onClick={() => { setShowDialog(true); setLookup({}); }} className="text-sm font-semibold text-brand hover:underline">+ Add scenario</button></div><StyledSelect name="contentItemId" label="Scenario" value={value} disabled={!season} invalid={invalid} options={[{ value: "", label: season ? "Choose a scenario" : "Choose a season first" }, ...options.map((option) => ({ value: option.id, label: `${option.code}: ${option.title}` }))]} onValueChange={select} /></div></div>
    {showDialog ? <Dialog open title="Add scenario" description="Paste an official Paizo store URL. Nothing is added until you review and confirm." onClose={() => setShowDialog(false)} closeLabel="Close add scenario"><label htmlFor="paizoScenarioUrl" className="mt-5 block text-sm font-semibold">Paizo scenario URL</label><input id="paizoScenarioUrl" type="url" value={scenarioUrl} onChange={(event) => { setScenarioUrl(event.currentTarget.value); setLookup({}); }} placeholder="https://store.paizo.com/..." autoFocus className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-4 py-3" />{lookup.error ? <p role="alert" className="mt-3 text-sm text-danger">{lookup.error}</p> : null}{lookup.scenario ? <div className="mt-5 rounded-xl border border-border bg-surface p-4"><h3 className="font-semibold">{lookup.scenario.code}: {lookup.scenario.title}</h3><p className="mt-2 text-sm text-text-muted">Levels {lookup.scenario.minimumLevel}–{lookup.scenario.maximumLevel} · Paizo</p>{lookup.existing ? <p role="status" className="mt-3 text-sm text-warning">This scenario already exists and will be selected.</p> : null}</div> : null}<div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setShowDialog(false)} className="rounded-full border border-border-strong px-4 py-2 font-semibold">Cancel</button>{!lookup.scenario ? <button type="button" disabled={pending || !scenarioUrl.trim()} onClick={() => startTransition(async () => setLookup(await previewScenario(scenarioUrl)))} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{pending ? "Fetching…" : "Fetch details"}</button> : <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = lookup.existing && lookup.contentItemId ? lookup : await addScenario(scenarioUrl); setLookup(result); if (result.scenario && result.contentItemId) { const item = { id: result.contentItemId, ...result.scenario }; setAdded(item); setSeason(seasonFor(item.code)); onValueChange(item.id, item); setShowDialog(false); } })} className="rounded-full bg-brand px-4 py-2 font-semibold text-on-brand disabled:opacity-60">{pending ? "Adding…" : lookup.existing ? "Select existing" : "Add to catalog"}</button>}</div></Dialog> : null}
  </>;
}
