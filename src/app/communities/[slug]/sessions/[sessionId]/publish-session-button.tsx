"use client";

import { useActionState } from "react";
import { publishSessionAction, type PublishSessionState } from "../actions";

export function PublishSessionButton({ slug, sessionId }: { slug: string; sessionId: string }) {
  const [state, action, pending] = useActionState<PublishSessionState, FormData>(
    publishSessionAction.bind(null, slug, sessionId),
    {},
  );

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish session"}
      </button>
      {state.error ? <p className="mt-2 max-w-xs text-sm text-danger" role="alert">{state.error}</p> : null}
    </form>
  );
}
