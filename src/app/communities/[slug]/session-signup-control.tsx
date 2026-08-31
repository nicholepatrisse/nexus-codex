"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SelectionCard } from "@/app/selection-card";
import { CharacterIdentity } from "@/character/character-identity";
import {
  cancelSessionSignupAction,
  signupForSessionAction,
  updateSessionSignupAction,
  type SessionSignupActionState,
} from "./session-signup-actions";

export function SessionSignupControl({
  slug,
  sessionId,
  initialStatus,
  initialCharacterName,
  initialCharacterId,
  characters,
}: {
  slug: string;
  sessionId: string;
  initialStatus?: "confirmed" | "waitlisted";
  initialCharacterName?: string;
  initialCharacterId?: string;
  characters: { id: string; name: string; societyNumber: string; currentLevel: number }[];
}) {
  const [signupState, signupAction, signupPending] = useActionState<SessionSignupActionState, FormData>(
    signupForSessionAction.bind(null, slug, sessionId),
    {},
  );
  const [cancelState, cancelAction, cancelPending] = useActionState<SessionSignupActionState, FormData>(
    cancelSessionSignupAction.bind(null, slug, sessionId),
    {},
  );
  const [updateState, updateAction, updatePending] = useActionState<SessionSignupActionState, FormData>(
    updateSessionSignupAction.bind(null, slug, sessionId),
    {},
  );
  const [editing, setEditing] = useState(false);
  const [editorOpenedForState, setEditorOpenedForState] = useState<SessionSignupActionState | null>(null);
  const [characterId, setCharacterId] = useState(initialCharacterId ?? "");
  const editorOpen = editing && (updateState.status !== "updated" || editorOpenedForState === updateState);
  const status = cancelState.status === "cancelled"
    ? undefined
    : signupState.status ?? initialStatus;
  const error = cancelState.error ?? updateState.error ?? signupState.error;
  const returnTo = `/communities/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}`;

  return <div className="mt-4">
    {status ? <div><div className="flex flex-wrap items-center gap-3"><p className="text-sm text-success">{status === "confirmed" ? "You’re confirmed" : `You’re waitlisted${signupState.waitlistPosition ? ` at position ${signupState.waitlistPosition}` : ""}`}{initialCharacterName ? ` as ${initialCharacterName}` : ""}.</p><button type="button" onClick={() => { if (editorOpen) setEditing(false); else { setEditorOpenedForState(updateState); setEditing(true); } }} className="text-sm font-semibold text-brand hover:underline">Edit signup</button><form action={cancelAction} onSubmit={(event) => { if (!window.confirm("Cancel your signup? This will remove you from the game/session.")) event.preventDefault(); }}><button type="submit" disabled={cancelPending} className="text-sm font-semibold text-danger hover:underline disabled:opacity-60">{cancelPending ? "Cancelling…" : "Cancel signup"}</button></form></div>{editorOpen ? <form action={updateAction} className="mt-4"><fieldset><legend className="text-sm font-semibold">Character</legend><div className="mt-2 grid gap-3">{characters.map((character) => <SelectionCard key={character.id} name="characterId" value={character.id} required title={<CharacterIdentity character={{ ...character, level: character.currentLevel }} variant="selection" />} checked={characterId === character.id} onChange={() => setCharacterId(character.id)} />)}</div></fieldset><div className="mt-3 flex items-center gap-3"><button type="submit" disabled={updatePending} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{updatePending ? "Saving…" : "Save signup"}</button></div></form> : null}</div> : characters.length ? <form action={signupAction}><fieldset><legend className="text-sm font-semibold">Choose a character</legend><div className="mt-2 grid gap-3">{characters.map((character) => <SelectionCard key={character.id} name="characterId" value={character.id} required title={<CharacterIdentity character={{ ...character, level: character.currentLevel }} variant="selection" />} checked={characterId === character.id} onChange={() => setCharacterId(character.id)} />)}</div></fieldset><button type="submit" disabled={signupPending || !characterId} className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{signupPending ? "Signing up…" : "Sign up"}</button></form> : <p className="text-sm text-text-muted">You need an eligible character before you can sign up. <Link href={`/characters/new?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand hover:underline">Add a character</Link></p>}
    {characters.length ? <Link href={`/characters/new?returnTo=${encodeURIComponent(returnTo)}`} className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">Add another character</Link> : null}
    {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
  </div>;
}
