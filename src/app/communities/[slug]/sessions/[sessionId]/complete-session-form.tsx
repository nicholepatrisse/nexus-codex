"use client";

import { useActionState, useState } from "react";
import { calculateEarnIncome, type DowntimeProficiency } from "@/character/sfs2-chronicle-rewards";
import { completeSessionAction, saveSessionNotesAction } from "../actions";
import { ChronicleSheetCompletion } from "./chronicle-sheet-completion";
import { StyledSelect } from "@/app/styled-select";

export type CompletionCharacter = {
  characterId: string;
  characterName: string;
  playerName: string;
  societyNumber?: string | null;
  level?: number | null;
  className?: string | null;
  relationship: "Player" | "Pregen Credit" | "GM Credit";
  playedAs?: string;
  gmNotes: string;
  advancementSpeed: "standard" | "slow";
  xp: number;
  baseCreditsMinor: number;
  downtimeDisposition: "earn_income" | "other" | "declined";
  downtimeCheckTotal: number | null; downtimeProficiency: "trained" | "expert" | "master" | null; downtimeOverrideCreditsMinor: number | null; downtimeCorrectionNote: string; downtimeActivity: string;
  chronicleNumber?: string; partnerCode: string; eventName: string; eventCode: string; gmOrganizedPlayId: string;
  chronicleId?: string; sheetFilename?: string | null;
  scenario?: string; playedOn?: string;
  startingXp?: number; startingCredits?: number;
};

type RewardPreview = Pick<CompletionCharacter, "xp" | "baseCreditsMinor" | "downtimeDisposition" | "downtimeCheckTotal" | "downtimeProficiency" | "downtimeOverrideCreditsMinor">;

function previewFor(character: CompletionCharacter): RewardPreview { return { xp: character.xp, baseCreditsMinor: character.baseCreditsMinor, downtimeDisposition: character.downtimeDisposition, downtimeCheckTotal: character.downtimeCheckTotal, downtimeProficiency: character.downtimeProficiency, downtimeOverrideCreditsMinor: character.downtimeOverrideCreditsMinor }; }

export function CompleteSessionForm({ slug, sessionId, characters, participantsWithoutCharacters = [], completed, future }: { slug: string; sessionId: string; characters: CompletionCharacter[]; participantsWithoutCharacters?: string[]; completed: boolean; future: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previews, setPreviews] = useState<Record<string, RewardPreview>>(() => Object.fromEntries(characters.map((character) => [character.characterId, previewFor(character)])));
  const updatePreview = <K extends keyof RewardPreview>(characterId: string, field: K, value: RewardPreview[K]) => setPreviews((current) => ({ ...current, [characterId]: { ...(current[characterId] ?? previewFor(characters.find((character) => character.characterId === characterId)!)), [field]: value } }));
  const action = completed ? saveSessionNotesAction : completeSessionAction;
  const [state, formAction, pending] = useActionState(action.bind(null, slug, sessionId), {});
  const hasSavedReporting = !completed && characters.some(({ chronicleId }) => chronicleId);
  if (hasSavedReporting && !open) return <ChronicleSheetCompletion slug={slug} sessionId={sessionId} characters={characters} onEditReporting={() => setOpen(true)} />;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand ${completed ? "mt-5" : ""}`}>{completed ? "Edit session Chronicles" : "Enter reporting"}</button>;
  return <><section className="mt-8 rounded-2xl border border-brand/30 bg-surface-raised p-5" aria-labelledby="completion-heading">
    <h2 id="completion-heading" className="text-xl font-semibold">{completed ? "Edit session Chronicles" : "Enter reporting"}</h2>
    <p className="mt-2 text-sm text-text-muted">Review Chronicle values for participating characters and add optional private GM notes.</p>
    {future && !completed ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">This session is scheduled in the future. Completing it early will remove it from upcoming games.</p> : null}
    <form action={formAction} className="mt-5 space-y-4">
      {characters.length > 1 ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"><button type="button" className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand" onClick={(event) => {
        const form = event.currentTarget.form;
        const firstId = characters[0]?.characterId;
        if (!form || !firstId) return;
        for (const field of ["advancementSpeed", "xp", "baseCreditsMinor", "note"] as const) {
          const source = form.elements.namedItem(`${field}:${firstId}`) as HTMLInputElement | HTMLSelectElement | null;
          if (!source) continue;
          for (const character of characters.slice(1)) {
            const target = form.elements.namedItem(`${field}:${character.characterId}`) as HTMLInputElement | HTMLSelectElement | null;
            if (target) { target.value = source.value; target.dispatchEvent(new Event("input", { bubbles: true })); target.dispatchEvent(new Event("change", { bubbles: true })); }
          }
        }
        setCopied(true);
      }}>Apply first Chronicle to all</button><span className="text-sm text-text-muted">Copies advancement, adventure rewards, and GM notes. Each character’s level and Downtime choices stay unchanged.</span>{copied ? <span role="status" className="text-sm font-semibold text-success">Applied.</span> : null}</div> : null}
      {characters.length ? <fieldset className="rounded-xl border border-brand/30 bg-brand/5 p-4"><legend className="px-2 text-sm font-semibold text-brand">Shared by every Chronicle</legend><p className="mb-4 text-sm text-text-muted">These session values are written to every character’s Chronicle.</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Event name<input name="eventName" required defaultValue={characters[0]?.eventName} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Event number<input name="eventCode" required inputMode="numeric" pattern="[0-9]+" defaultValue={characters[0]?.eventCode.replaceAll(",", "")} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal tabular-nums" /></label><label className="text-sm font-semibold">GM Society number<input name="gmOrganizedPlayId" required inputMode="numeric" pattern="[0-9]+" defaultValue={characters[0]?.gmOrganizedPlayId} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal tabular-nums" /></label></div></fieldset> : null}
      {characters.length ? characters.map((character) => { const preview = previews[character.characterId] ?? previewFor(character); const downtimeDays = preview.xp * 2; let earned: ReturnType<typeof calculateEarnIncome> | null = null; if (preview.downtimeDisposition === "earn_income" && preview.downtimeCheckTotal != null && preview.downtimeProficiency) { try { earned = calculateEarnIncome(character.level ?? 1, preview.downtimeCheckTotal, preview.downtimeProficiency, downtimeDays); } catch { earned = null; } } const downtimeCredits = preview.downtimeOverrideCreditsMinor ?? earned?.calculatedCreditsMinor ?? 0; const totalCredits = preview.baseCreditsMinor + downtimeCredits; return <div key={character.characterId} className="rounded-xl border border-border bg-surface p-4">
        <input type="hidden" name="characterId" value={character.characterId} />
        <input type="hidden" name={`partnerCode:${character.characterId}`} value={character.partnerCode} />
        <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{character.playedAs ? <><span className="text-text-muted">Playing as:</span> {character.playedAs}<br /><span className="text-text-muted">Credit goes to:</span> {character.characterName}</> : character.characterName}</p><span className="text-xs font-semibold text-brand">{character.relationship}</span></div>
        <p className="mt-1 text-sm text-text-muted">{character.playerName}{character.societyNumber ? ` · ${character.societyNumber}` : ""}{character.level ? ` · Level ${character.level}` : ""}{character.className ? ` ${character.className}` : ""}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-sm font-semibold">Character level</p><p className="mt-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">{character.level ?? 1}</p><input name={`characterLevel:${character.characterId}`} type="hidden" value={character.level ?? 1} /></div>
          <div><span className="block text-sm font-semibold">Advancement</span><StyledSelect compact name={`advancementSpeed:${character.characterId}`} label="Advancement" defaultValue={character.advancementSpeed} options={[{ value: "standard", label: "Standard" }, { value: "slow", label: "Slow" }]} /></div>
          <Reward label="XP" name={`xp:${character.characterId}`} value={character.xp} disabled={false} onValueChange={(value) => updatePreview(character.characterId, "xp", value ?? 0)} />
          <Reward label="Base credits" name={`baseCreditsMinor:${character.characterId}`} value={character.baseCreditsMinor} disabled={false} onValueChange={(value) => updatePreview(character.characterId, "baseCreditsMinor", value ?? 0)} />
          <div><p className="text-sm font-semibold">Downtime days</p><p className="mt-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">{downtimeDays}</p></div>
          <div><span className="block text-sm font-semibold">Downtime disposition</span><StyledSelect compact name={`downtimeDisposition:${character.characterId}`} label="Downtime disposition" defaultValue={character.downtimeDisposition} options={[{ value: "earn_income", label: "Earn Income" }, { value: "other", label: "Another activity" }, { value: "declined", label: "Declined / lost" }]} onValueChange={(value) => updatePreview(character.characterId, "downtimeDisposition", value as RewardPreview["downtimeDisposition"])} /></div>
          <Reward label="Earn Income roll" name={`downtimeCheckTotal:${character.characterId}`} value={character.downtimeCheckTotal ?? undefined} disabled={false} required={false} onValueChange={(value) => updatePreview(character.characterId, "downtimeCheckTotal", value)} />
          <div><span className="block text-sm font-semibold">Earn Income proficiency</span><StyledSelect compact name={`downtimeProficiency:${character.characterId}`} label="Earn Income proficiency" defaultValue={character.downtimeProficiency ?? ""} options={[{ value: "", label: "—" }, { value: "trained", label: "Trained" }, { value: "expert", label: "Expert" }, { value: "master", label: "Master" }]} onValueChange={(value) => updatePreview(character.characterId, "downtimeProficiency", (value || null) as DowntimeProficiency | null)} /></div>
          <Reward label="Downtime credit override" name={`downtimeOverrideCreditsMinor:${character.characterId}`} value={character.downtimeOverrideCreditsMinor ?? undefined} disabled={false} required={false} onValueChange={(value) => updatePreview(character.characterId, "downtimeOverrideCreditsMinor", value)} />
        </div>
        <div aria-live="polite" className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4"><p className="text-xs font-semibold tracking-wide text-brand uppercase">Chronicle credit total</p>{preview.downtimeDisposition === "earn_income" && !earned ? <p className="mt-2 text-sm text-text-muted">Enter an Earn Income roll and proficiency to calculate the award.</p> : null}{earned ? <p className="mt-2 text-sm text-text-muted">DC {earned.dc} · {earned.degree.replaceAll("_", " ")} · {earned.calculatedCreditsMinor} calculated Downtime credits{preview.downtimeOverrideCreditsMinor != null ? ` · overridden to ${preview.downtimeOverrideCreditsMinor}` : ""}</p> : null}<p className="mt-2 text-lg font-semibold tabular-nums">{preview.baseCreditsMinor} base + {downtimeCredits} Downtime = {totalCredits} credits</p></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{[["downtimeCorrectionNote","Override correction note",character.downtimeCorrectionNote],["downtimeActivity","Other activity",character.downtimeActivity]].map(([field,label,value]) => <label key={field} className="text-sm font-semibold">{label}<input name={`${field}:${character.characterId}`} defaultValue={value} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal" /></label>)}</div>
        <label className="mt-3 block text-sm font-semibold" htmlFor={`note-${character.characterId}`}>GM notes <span className="font-normal text-text-muted">(optional)</span></label>
        <textarea id={`note-${character.characterId}`} name={`note:${character.characterId}`} defaultValue={character.gmNotes} maxLength={5000} rows={3} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" />
      </div> }) : <p className="rounded-xl border border-border p-4 text-sm text-text-muted">No characters are associated with this session. You can still mark it complete.</p>}
      {participantsWithoutCharacters.length ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-4"><p className="text-sm font-semibold text-warning">Participants without characters</p><ul className="mt-2 list-disc pl-5 text-sm text-text-muted">{participantsWithoutCharacters.map((name) => <li key={name}>{name} — no Chronicle will be created</li>)}</ul></div> : null}
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.saved ? <p role="status" className="text-sm text-success">Chronicles saved.</p> : null}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : completed ? "Save Chronicle changes" : "Save reporting"}</button>{!completed ? <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold">Cancel</button> : null}</div>
    </form>
  </section>{!completed && characters.some(({ chronicleId }) => chronicleId) ? <ChronicleSheetCompletion slug={slug} sessionId={sessionId} characters={characters} /> : null}</>;
}

function Reward({ label, name, value, disabled, required = true, onValueChange }: { label: string; name: string; value?: number; disabled: boolean; required?: boolean; onValueChange?: (value: number | null) => void }) {
  return <label className="text-sm font-semibold">{label}<input name={name} type="number" min={label === "Earn Income roll" ? undefined : 0} step={1} required={required} defaultValue={value} disabled={disabled} onChange={(event) => onValueChange?.(event.target.value === "" ? null : event.target.valueAsNumber)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal disabled:opacity-70" /></label>;
}
