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
}: {
  slug: string;
  sessionId: string;
  initialStatus?: "confirmed" | "waitlisted";
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
    {status ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-emerald-100">{status === "confirmed" ? "You’re confirmed." : `You’re waitlisted${signupState.waitlistPosition ? ` at position ${signupState.waitlistPosition}` : ""}.`}</p><form action={cancelAction}><button type="submit" disabled={cancelPending} className="text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-60">{cancelPending ? "Cancelling…" : "Cancel signup"}</button></form></div> : <form action={signupAction}><button type="submit" disabled={signupPending} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#07110f] disabled:opacity-60">{signupPending ? "Signing up…" : "Sign up"}</button></form>}
    {error ? <p className="mt-2 text-sm text-red-200" role="alert">{error}</p> : null}
  </div>;
}
