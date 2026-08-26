"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Chronicle } from "@/character/chronicles";
import type { ChronicleFormState } from "./actions";

type CatalogItem = { id: string; code: string; title: string };
const inputClass = "mt-2 w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand";
const rewardFields = [["xp", "XP"], ["creditsMinor", "Credits (minor units)"], ["reputation", "Reputation"], ["downtime", "Downtime"]] as const;
const standardScenarioCredits: Record<number, number> = { 1: 140, 2: 220, 3: 380, 4: 640, 5: 1000, 6: 1500, 7: 2200, 8: 3000, 9: 4400, 10: 6000 };
function SubmitButton({ editing }: { editing: boolean }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : editing ? "Save Chronicle" : "Add Chronicle"}</button>; }

export function ChronicleForm({ characterId, chronicle, catalogItems, action }: { characterId: string; chronicle?: Chronicle; catalogItems: CatalogItem[]; action: (state: ChronicleFormState, formData: FormData) => Promise<ChronicleFormState> }) {
  const [state, formAction] = useActionState(action, {});
  const [scenarioNumber, setScenarioNumber] = useState(chronicle?.scenarioNumberSnapshot ?? "");
  const [scenarioName, setScenarioName] = useState(chronicle?.scenarioNameSnapshot ?? "");
  const [characterLevel, setCharacterLevel] = useState(String(chronicle?.characterLevel ?? 1));
  const [advancementSpeed, setAdvancementSpeed] = useState(chronicle?.advancementSpeed ?? "standard");
  const rewardPlaceholder = (name: typeof rewardFields[number][0]) => {
    const divisor = advancementSpeed === "slow" ? 2 : 1;
    if (name === "xp") return `Usually ${4 / divisor}`;
    if (name === "downtime") return `Usually ${8 / divisor} days`;
    if (name === "reputation") return "See Chronicle";
    const credits = standardScenarioCredits[Number(characterLevel)];
    return credits ? `Usually ${credits / divisor}` : "See Chronicle";
  };
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  const error = (name: string) => field(name) ? <p role="alert" className="mt-2 text-sm text-danger">{field(name)}</p> : null;
  return <form action={formAction} className="mt-10 space-y-6" noValidate>
    <div><label htmlFor="contentItemId" className="block text-sm font-semibold">Catalog scenario <span className="font-normal text-text-muted">(optional)</span></label><select id="contentItemId" name="contentItemId" defaultValue={chronicle?.contentItemId ?? ""} onChange={(event) => { const item = catalogItems.find((candidate) => candidate.id === event.target.value); if (item) { setScenarioNumber(item.code); setScenarioName(item.title); } }} className={inputClass}><option value="">Manually enter the scenario</option>{catalogItems.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select><p className="mt-2 text-xs text-text-muted">Selecting a catalog scenario fills the number and name and stores them as a permanent snapshot.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div><label htmlFor="scenarioNumber" className="block text-sm font-semibold">Scenario number</label><input id="scenarioNumber" name="scenarioNumber" required maxLength={100} value={scenarioNumber} onChange={(event) => setScenarioNumber(event.target.value)} aria-invalid={Boolean(field("scenarioNumber"))} className={inputClass} />{error("scenarioNumber")}</div>
      <div><label htmlFor="scenarioName" className="block text-sm font-semibold">Scenario name</label><input id="scenarioName" name="scenarioName" required maxLength={200} value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} aria-invalid={Boolean(field("scenarioName"))} className={inputClass} />{error("scenarioName")}</div>
      <div><label htmlFor="datePlayed" className="block text-sm font-semibold">Date played</label><input id="datePlayed" name="datePlayed" type="date" required max={new Date().toISOString().slice(0, 10)} defaultValue={chronicle?.datePlayed ?? ""} aria-invalid={Boolean(field("datePlayed"))} className={inputClass} />{error("datePlayed")}</div>
      <div><label htmlFor="characterLevel" className="block text-sm font-semibold">Character level at play</label><input id="characterLevel" name="characterLevel" type="number" min={1} max={20} required value={characterLevel} onChange={(event) => setCharacterLevel(event.target.value)} className={inputClass} />{error("characterLevel")}</div>
      <div><label htmlFor="advancementSpeed" className="block text-sm font-semibold">Advancement speed</label><select id="advancementSpeed" name="advancementSpeed" value={advancementSpeed} onChange={(event) => setAdvancementSpeed(event.target.value as "standard" | "slow")} className={inputClass}><option value="standard">Standard</option><option value="slow">Slow</option></select>{error("advancementSpeed")}</div>
      {rewardFields.map(([name, label]) => <div key={name}><label htmlFor={name} className="block text-sm font-semibold">{label}</label><input id={name} name={name} type="number" min={0} step={1} required defaultValue={chronicle?.[name] ?? undefined} placeholder={rewardPlaceholder(name)} className={inputClass} />{error(name)}</div>)}
      <div className="sm:col-span-2"><label htmlFor="playerNotes" className="block text-sm font-semibold">Player notes <span className="font-normal text-text-muted">(optional)</span></label><textarea id="playerNotes" name="playerNotes" rows={6} maxLength={5000} defaultValue={chronicle?.playerNotes ?? ""} className={`${inputClass} resize-y`} />{error("playerNotes")}</div>
    </div>
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton editing={Boolean(chronicle)} /><Link href={`/characters/${characterId}`} className="text-sm text-text-muted hover:text-text-primary">Cancel</Link></div>
  </form>;
}
