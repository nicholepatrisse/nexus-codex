"use client";
import { useActionState } from "react";
import { applyGmCreditAction, type GmCreditState } from "./gm-credit-actions";

type CharacterOption = { id: string; name: string; societyNumber: string; currentLevel: number; className: string | null };
export function GmCreditForm({ slug, sessionId, characters, current }: { slug: string; sessionId: string; characters: CharacterOption[]; current?: { characterId: string; characterName: string } | null }) {
  const [state, action, pending] = useActionState(applyGmCreditAction.bind(null, slug, sessionId), {} as GmCreditState);
  return <section className="mt-8 rounded-2xl border border-border bg-surface-raised p-5" aria-labelledby="gm-credit-heading"><h2 id="gm-credit-heading" className="text-lg font-semibold">Apply GM credit</h2>
    {current ? <p className="mt-2 text-sm text-text-muted">Currently credited to <strong className="text-text-primary">{current.characterName}</strong>. Choose another character to move it.</p> : <p className="mt-2 text-sm text-text-muted">Record this session in one of your character histories as GM Credit.</p>}
    {characters.length ? <form action={action} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold"><span className="mb-1 block">Character</span><select name="characterId" required defaultValue={current?.characterId ?? ""} className="rounded-lg border border-border-strong bg-surface px-3 py-2 font-normal"><option value="" disabled>Choose a character</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} — {character.societyNumber} — Level {character.currentLevel}{character.className ? ` — ${character.className}` : ""}</option>)}</select></label><button type="submit" disabled={pending} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : current ? "Move GM credit" : "Apply GM credit"}</button></form> : <p className="mt-4 text-sm text-text-muted">You have no characters eligible for this session’s game system.</p>}
    {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}{state.status === "saved" ? <p role="status" className="mt-3 text-sm text-success">GM credit saved.</p> : null}
  </section>;
}
