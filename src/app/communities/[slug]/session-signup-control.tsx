"use client";

import { useActionState } from "react";
import {
  cancelSessionSignupAction,
  signupForSessionAction,
  type SessionSignupActionState,
} from "./session-signup-actions";

export function SessionSignupControl({
  slug,
  sessionId,
  initialStatus,
  initialCharacterName,
  characters,
}: {
  slug: string;
  sessionId: string;
  initialStatus?: "confirmed" | "waitlisted";
  initialCharacterName?: string;
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
  const status = cancelState.status === "cancelled"
    ? undefined
    : signupState.status ?? initialStatus;
  const error = cancelState.error ?? signupState.error;

  return <div className="mt-4">
    {status ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-emerald-100">{status === "confirmed" ? "You’re confirmed" : `You’re waitlisted${signupState.waitlistPosition ? ` at position ${signupState.waitlistPosition}` : ""}`}{initialCharacterName ? ` as ${initialCharacterName}` : ""}.</p><form action={cancelAction}><button type="submit" disabled={cancelPending} className="text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-60">{cancelPending ? "Cancelling…" : "Cancel signup"}</button></form></div> : characters.length ? <form action={signupAction} className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold"><span className="mb-1 block">Character</span><select name="characterId" required defaultValue="" className="rounded-lg border border-white/15 bg-[#101817] px-3 py-2 font-normal"><option value="" disabled>Choose a character</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} — {character.societyNumber}</option>)}</select></label><button type="submit" disabled={signupPending} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#07110f] disabled:opacity-60">{signupPending ? "Signing up…" : "Sign up"}</button></form> : <p className="text-sm text-[var(--muted)]">You need an eligible character before you can sign up. <a href="/characters/new" className="font-semibold text-[var(--accent)] hover:underline">Add a character</a></p>}
    {error ? <p className="mt-2 text-sm text-red-200" role="alert">{error}</p> : null}
  </div>;
}
