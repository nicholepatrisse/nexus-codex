"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SelectionCard } from "@/app/selection-card";
import { StyledSelect } from "@/app/styled-select";
import { CharacterIdentity } from "@/character/character-identity";
import { SFS2_PREGEN_CLASSES, SFS2_PREGENS } from "@/character/sfs2-pregens";
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
  initialPregenName,
  initialPregenLevel,
  initialCreditRecipientCharacterId,
  scenarioPregenLevel = 1,
  characters,
}: {
  slug: string;
  sessionId: string;
  initialStatus?: "confirmed" | "waitlisted";
  initialCharacterName?: string;
  initialCharacterId?: string;
  initialPregenName?: string;
  initialPregenLevel?: number;
  initialCreditRecipientCharacterId?: string;
  scenarioPregenLevel?: number;
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
  const [signupKind, setSignupKind] = useState<"character" | "pregen">(initialPregenName ? "pregen" : "character");
  const [pregenName, setPregenName] = useState(initialPregenName ?? "");
  const pregenLevel = initialPregenLevel ?? scenarioPregenLevel;
  const [creditRecipientCharacterId, setCreditRecipientCharacterId] = useState(initialCreditRecipientCharacterId ?? "");
  const editorOpen = editing && (updateState.status !== "updated" || editorOpenedForState === updateState);
  const status = cancelState.status === "cancelled"
    ? undefined
    : signupState.status ?? initialStatus;
  const error = cancelState.error ?? updateState.error ?? signupState.error;
  const returnTo = `/communities/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}`;

  const choices = <><fieldset><legend className="text-sm font-semibold">Playing as</legend><div className="mt-2 flex gap-4"><label><input type="radio" name="signupKind" value="character" checked={signupKind === "character"} onChange={() => setSignupKind("character")} /> My character</label><label><input type="radio" name="signupKind" value="pregen" checked={signupKind === "pregen"} onChange={() => setSignupKind("pregen")} /> Use a pregen</label></div></fieldset>{signupKind === "character" ? <fieldset className="mt-4"><legend className="text-sm font-semibold">Choose a character</legend><div className="mt-2 grid gap-3">{characters.map((character) => <SelectionCard key={character.id} name="characterId" value={character.id} required title={<CharacterIdentity character={{ ...character, level: character.currentLevel }} variant="selection" />} checked={characterId === character.id} onChange={() => setCharacterId(character.id)} />)}</div></fieldset> : <div className="mt-4 grid gap-4 rounded-xl border border-brand/30 bg-surface-raised p-4"><div><label className="text-sm font-semibold">Pregen</label><StyledSelect name="pregenName" label="Pregen" required value={pregenName} onValueChange={setPregenName} compact options={[{ value: "", label: "Choose a pregen", disabled: true }, ...SFS2_PREGENS.map((name) => ({ value: name, label: name, description: SFS2_PREGEN_CLASSES[name], className: SFS2_PREGEN_CLASSES[name] }))]} /></div><div><p className="text-sm font-semibold">Pregen level</p><input type="hidden" name="pregenLevel" value={pregenLevel} /><p className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold">Level {pregenLevel}</p><p className="mt-1 text-xs text-text-muted">Determined by this scenario’s level range.</p></div><fieldset><legend className="text-sm font-semibold">Credit goes to</legend><p className="mt-1 text-xs text-text-muted">This is your persistent Society character receiving the Chronicle, not the character you are playing.</p><div className="mt-2 grid gap-3">{characters.map((character) => <SelectionCard key={character.id} name="creditRecipientCharacterId" value={character.id} required title={<CharacterIdentity character={{ ...character, level: character.currentLevel }} variant="selection" />} checked={creditRecipientCharacterId === character.id} onChange={() => setCreditRecipientCharacterId(character.id)} />)}</div></fieldset></div>}</>;

  const selectionComplete = signupKind === "character" ? Boolean(characterId) : Boolean(pregenName && creditRecipientCharacterId);
  return <div className="mt-4">
    {status ? <div><div className="flex flex-wrap items-center gap-3"><p className="text-sm text-success">{status === "confirmed" ? "You’re confirmed" : `You’re waitlisted${signupState.waitlistPosition ? ` at position ${signupState.waitlistPosition}` : ""}`}{initialPregenName ? ` playing as ${initialPregenName}` : initialCharacterName ? ` as ${initialCharacterName}` : ""}.</p><button type="button" onClick={() => { if (editorOpen) setEditing(false); else { setEditorOpenedForState(updateState); setEditing(true); } }} className="text-sm font-semibold text-brand hover:underline">Edit signup</button><form action={cancelAction} onSubmit={(event) => { if (!window.confirm("Cancel your signup? This will remove you from the game/session.")) event.preventDefault(); }}><button type="submit" disabled={cancelPending} className="text-sm font-semibold text-danger hover:underline disabled:opacity-60">{cancelPending ? "Cancelling…" : "Cancel signup"}</button></form></div>{editorOpen ? <form action={updateAction} className="mt-4">{choices}<button type="submit" disabled={updatePending || !selectionComplete} className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{updatePending ? "Saving…" : "Save signup"}</button></form> : null}</div> : characters.length ? <form action={signupAction}>{choices}<button type="submit" disabled={signupPending || !selectionComplete} className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{signupPending ? "Signing up…" : "Sign up"}</button></form> : <p className="text-sm text-text-muted">You need a Society character to receive credit before you can sign up, including with a pregen. <Link href={`/characters/new?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand hover:underline">Add a character</Link></p>}
    {characters.length ? <Link href={`/characters/new?returnTo=${encodeURIComponent(returnTo)}`} className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">Add another character</Link> : null}
    {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
  </div>;
}
