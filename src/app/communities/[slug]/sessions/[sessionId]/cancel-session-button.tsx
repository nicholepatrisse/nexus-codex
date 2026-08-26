"use client";

import { useActionState } from "react";
import { cancelSessionAction } from "../actions";

export function CancelSessionButton({ slug, sessionId }: { slug: string; sessionId: string }) {
  const [state, action, pending] = useActionState<{ error?: string }, FormData>(cancelSessionAction.bind(null, slug, sessionId), {});
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Cancel this session? Players will no longer be able to sign up.")) event.preventDefault(); }}><button type="submit" disabled={pending} className="rounded-full border border-danger/30 px-5 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{pending ? "Cancelling…" : "Cancel session"}</button>{state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}</form>;
}
