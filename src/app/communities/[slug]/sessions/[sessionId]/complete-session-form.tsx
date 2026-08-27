"use client";

import { useActionState, useState } from "react";
import { completeSessionAction, saveSessionNotesAction } from "../actions";

export type CompletionCharacter = {
  characterId: string;
  characterName: string;
  playerName: string;
  societyNumber?: string | null;
  level?: number | null;
  className?: string | null;
  relationship: "Player" | "GM Credit";
  gmNotes: string;
  advancementSpeed: "standard" | "slow";
  xp: number;
  creditsMinor: number;
  reputation: number;
  downtime: number;
};

export function CompleteSessionForm({ slug, sessionId, characters, participantsWithoutCharacters = [], completed, future }: { slug: string; sessionId: string; characters: CompletionCharacter[]; participantsWithoutCharacters?: string[]; completed: boolean; future: boolean }) {
  const [open, setOpen] = useState(completed);
  const [copied, setCopied] = useState(false);
  const action = completed ? saveSessionNotesAction : completeSessionAction;
  const [state, formAction, pending] = useActionState(action.bind(null, slug, sessionId), {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">Mark complete</button>;
  return <section className="mt-8 rounded-2xl border border-brand/30 bg-surface-raised p-5" aria-labelledby="completion-heading">
    <h2 id="completion-heading" className="text-xl font-semibold">{completed ? "Edit session Chronicles" : "Complete session"}</h2>
    <p className="mt-2 text-sm text-text-muted">Review Chronicle values for participating characters and add optional private GM notes.</p>
    {future && !completed ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">This session is scheduled in the future. Completing it early will remove it from upcoming games.</p> : null}
    <form action={formAction} className="mt-5 space-y-4" onSubmit={(event) => { if (!completed && !window.confirm(future ? "This session is in the future. Mark it complete anyway?" : "Mark this session complete?")) event.preventDefault(); }}>
      {characters.length > 1 ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"><button type="button" className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand" onClick={(event) => {
        const form = event.currentTarget.form;
        const firstId = characters[0]?.characterId;
        if (!form || !firstId) return;
        for (const field of ["advancementSpeed", "xp", "creditsMinor", "reputation", "downtime", "note"] as const) {
          const source = form.elements.namedItem(`${field}:${firstId}`) as HTMLInputElement | HTMLSelectElement | null;
          if (!source) continue;
          for (const character of characters.slice(1)) {
            const target = form.elements.namedItem(`${field}:${character.characterId}`) as HTMLInputElement | HTMLSelectElement | null;
            if (target) target.value = source.value;
          }
        }
        setCopied(true);
      }}>Apply first Chronicle to all</button><span className="text-sm text-text-muted">Copies advancement, rewards, and GM notes; keeps each character’s level.</span>{copied ? <span role="status" className="text-sm font-semibold text-success">Applied.</span> : null}</div> : null}
      {characters.length ? characters.map((character) => <div key={character.characterId} className="rounded-xl border border-border bg-surface p-4">
        <input type="hidden" name="characterId" value={character.characterId} />
        <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{character.characterName}</p><span className="text-xs font-semibold text-brand">{character.relationship}</span></div>
        <p className="mt-1 text-sm text-text-muted">{character.playerName}{character.societyNumber ? ` · ${character.societyNumber}` : ""}{character.level ? ` · Level ${character.level}` : ""}{character.className ? ` ${character.className}` : ""}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-sm font-semibold">Character level</p><p className="mt-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">{character.level ?? 1}</p><input name={`characterLevel:${character.characterId}`} type="hidden" value={character.level ?? 1} /></div>
          <label className="text-sm font-semibold">Advancement<select name={`advancementSpeed:${character.characterId}`} defaultValue={character.advancementSpeed} disabled={false} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal disabled:opacity-70"><option value="standard">Standard</option><option value="slow">Slow</option></select></label>
          <Reward label="XP" name={`xp:${character.characterId}`} value={character.xp} disabled={false} />
          <Reward label="Credits" name={`creditsMinor:${character.characterId}`} value={character.creditsMinor} disabled={false} />
          <Reward label="Reputation" name={`reputation:${character.characterId}`} value={character.reputation} disabled={false} />
          <Reward label="Downtime" name={`downtime:${character.characterId}`} value={character.downtime} disabled={false} />
        </div>
        <label className="mt-3 block text-sm font-semibold" htmlFor={`note-${character.characterId}`}>GM notes <span className="font-normal text-text-muted">(optional)</span></label>
        <textarea id={`note-${character.characterId}`} name={`note:${character.characterId}`} defaultValue={character.gmNotes} maxLength={5000} rows={3} className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2" />
      </div>) : <p className="rounded-xl border border-border p-4 text-sm text-text-muted">No characters are associated with this session. You can still mark it complete.</p>}
      {participantsWithoutCharacters.length ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-4"><p className="text-sm font-semibold text-warning">Participants without characters</p><ul className="mt-2 list-disc pl-5 text-sm text-text-muted">{participantsWithoutCharacters.map((name) => <li key={name}>{name} — no Chronicle will be created</li>)}</ul></div> : null}
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.saved ? <p role="status" className="text-sm text-success">Chronicles saved.</p> : null}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : completed ? "Save Chronicle changes" : "Save notes and mark complete"}</button>{!completed ? <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold">Cancel</button> : null}</div>
    </form>
  </section>;
}

function Reward({ label, name, value, disabled }: { label: string; name: string; value: number; disabled: boolean }) {
  return <label className="text-sm font-semibold">{label}<input name={name} type="number" min={0} step={1} required defaultValue={value} disabled={disabled} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-normal disabled:opacity-70" /></label>;
}
