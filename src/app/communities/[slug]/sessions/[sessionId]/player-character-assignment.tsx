"use client";

import { useActionState, useState } from "react";
import { StyledSelect } from "@/app/styled-select";
import { assignPlayerCharacterAction } from "./player-character-assignment-action";

export type UnassignedParticipant = { signupId: string; personName: string; characters: { id: string; name: string; societyNumber: string; currentLevel: number; className: string | null }[] };

function Assignment({ slug, sessionId, participant }: { slug: string; sessionId: string; participant: UnassignedParticipant }) {
  const [state, action, pending] = useActionState(assignPlayerCharacterAction.bind(null, slug, sessionId, participant.signupId), {});
  const [characterId, setCharacterId] = useState("");
  return <form action={action} className="min-w-0 rounded-xl border border-warning/30 bg-warning/10 p-4"><p className="font-semibold">{participant.personName}</p>{participant.characters.length ? <div className="mt-3 grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><label htmlFor="characterId" className="text-sm font-semibold">Character</label><StyledSelect name="characterId" label="Character" value={characterId} required options={[{ value: "", label: "Choose a character", disabled: true }, ...participant.characters.map((character) => ({ value: character.id, label: character.name, character: { ...character, level: character.currentLevel } }))]} onValueChange={setCharacterId} /></div><button type="submit" disabled={pending || !characterId} className="w-fit rounded-full bg-brand px-4 py-2 text-sm font-semibold whitespace-nowrap text-on-brand disabled:opacity-60">{pending ? "Assigning…" : "Assign character"}</button></div> : <p className="mt-2 text-sm text-text-muted">This player has no eligible characters.</p>}{state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}</form>;
}

export function PlayerCharacterAssignments({ slug, sessionId, participants }: { slug: string; sessionId: string; participants: UnassignedParticipant[] }) {
  if (!participants.length) return null;
  return <section className="mt-8 space-y-3" aria-labelledby="missing-character-heading"><div><h2 id="missing-character-heading" className="text-lg font-semibold">Assign missing characters</h2><p className="mt-1 text-sm text-text-muted">Select a character on behalf of a confirmed player before completing the session.</p></div>{participants.map((participant) => <Assignment key={participant.signupId} slug={slug} sessionId={sessionId} participant={participant} />)}</section>;
}
