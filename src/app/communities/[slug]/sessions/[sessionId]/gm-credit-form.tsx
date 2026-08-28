"use client";
import { useActionState, useState } from "react";
import { StyledSelect } from "@/app/styled-select";
import { applyGmCreditAction, type GmCreditState } from "./gm-credit-actions";

type CharacterOption = { id: string; name: string; societyNumber: string; currentLevel: number; className: string | null };
export function GmCreditForm({ slug, sessionId, characters, current }: { slug: string; sessionId: string; characters: CharacterOption[]; current?: { characterId: string; characterName: string } | null }) {
  const [state, action, pending] = useActionState(applyGmCreditAction.bind(null, slug, sessionId), {} as GmCreditState);
  const [characterId, setCharacterId] = useState(current?.characterId ?? "");
  return <section className="mt-8 rounded-2xl border border-border bg-surface-raised p-5" aria-labelledby="gm-credit-heading"><h2 id="gm-credit-heading" className="text-lg font-semibold">Apply GM credit</h2>
    {current ? <p className="mt-2 text-sm text-text-muted">Currently credited to <strong className="text-text-primary">{current.characterName}</strong>. Choose another character to move it.</p> : <p className="mt-2 text-sm text-text-muted">Record this session in one of your character histories as GM Credit.</p>}
    {characters.length ? <form action={action} className="mt-4 grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><label htmlFor="characterId" className="block text-sm font-semibold">Character</label><StyledSelect name="characterId" label="Character" value={characterId} required options={[{ value: "", label: "Choose a character" }, ...characters.map((character) => ({ value: character.id, label: character.name, description: `${character.societyNumber} · Level ${character.currentLevel}`, metadata: character.className ?? undefined }))]} onValueChange={setCharacterId} /></div><button type="submit" disabled={pending || !characterId} className="w-fit rounded-full bg-brand px-4 py-2 text-sm font-semibold whitespace-nowrap text-on-brand disabled:opacity-60">{pending ? "Saving…" : current ? "Move GM credit" : "Apply GM credit"}</button></form> : <p className="mt-4 text-sm text-text-muted">You have no characters eligible for this session’s game system.</p>}
    {state.error ? <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p> : null}{state.status === "saved" ? <p role="status" className="mt-3 text-sm text-success">GM credit saved.</p> : null}
  </section>;
}
