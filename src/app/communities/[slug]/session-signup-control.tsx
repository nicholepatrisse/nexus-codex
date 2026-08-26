"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  characters: { id: string; name: string; societyNumber: string }[];
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
  const status = cancelState.status === "cancelled"
    ? undefined
    : signupState.status ?? initialStatus;
  const error = cancelState.error ?? updateState.error ?? signupState.error;
  const returnTo = `/communities/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}`;

  return <div className="mt-4">
    {status ? <div><div className="flex flex-wrap items-center gap-3"><p className="text-sm text-success">{status === "confirmed" ? "You’re confirmed" : `You’re waitlisted${signupState.waitlistPosition ? ` at position ${signupState.waitlistPosition}` : ""}`}{initialCharacterName ? ` as ${initialCharacterName}` : ""}.</p><button type="button" onClick={() => setEditing((value) => !value)} className="text-sm font-semibold text-brand hover:underline">Edit signup</button><form action={cancelAction} onSubmit={(event) => { if (!window.confirm("Cancel your signup? This will remove you from the game/session.")) event.preventDefault(); }}><button type="submit" disabled={cancelPending} className="text-sm font-semibold text-danger hover:underline disabled:opacity-60">{cancelPending ? "Cancelling…" : "Cancel signup"}</button></form></div>{editing ? <form action={updateAction} className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold"><span className="mb-1 block">Character</span><select name="characterId" required defaultValue={initialCharacterId} className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 font-normal">{characters.map((character) => <option key={character.id} value={character.id}>{character.name} — {character.societyNumber}</option>)}</select></label><button type="submit" disabled={updatePending} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">{updatePending ? "Saving…" : "Save signup"}</button>{updateState.status === "updated" ? <p role="status" className="text-sm text-success">Signup updated.</p> : null}</form> : null}</div> : characters.length ? <form action={signupAction} className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold"><span className="mb-1 block">Character</span><select name="characterId" required defaultValue="" className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 font-normal"><option value="" disabled>Choose a character</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} — {character.societyNumber}</option>)}</select></label><button type="submit" disabled={signupPending} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">{signupPending ? "Signing up…" : "Sign up"}</button></form> : <p className="text-sm text-text-muted">You need an eligible character before you can sign up. <Link href={`/characters/new?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand hover:underline">Add a character</Link></p>}
    {characters.length ? <Link href={`/characters/new?returnTo=${encodeURIComponent(returnTo)}`} className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">Add another character</Link> : null}
    {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
  </div>;
}
