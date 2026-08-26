"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelAdmissionAction, requestAdmissionAction } from "./admission-actions";
import type { AdmissionActionState } from "./admission-state";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-background disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

function Result({ state }: { state: AdmissionActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-success">{state.message}</p>;
  return null;
}

export function AdmissionForm({ slug, pendingRequestId }: { slug: string; pendingRequestId?: string }) {
  const action = pendingRequestId
    ? cancelAdmissionAction.bind(null, slug, pendingRequestId)
    : requestAdmissionAction.bind(null, slug);
  const [state, formAction] = useActionState(action, {});
  if (state.status === "pending" && !pendingRequestId) {
    return <div className="mt-8"><Result state={state} /></div>;
  }
  if (state.status === "admitted" || state.status === "cancelled") {
    return <div className="mt-8"><Result state={state} /></div>;
  }
  return (
    <form action={formAction} className="mt-8 flex flex-wrap items-center gap-4">
      <SubmitButton>{pendingRequestId ? "Cancel membership request" : "Request membership"}</SubmitButton>
      {pendingRequestId && !state.message ? <p className="text-sm text-text-muted">Your request is awaiting review.</p> : null}
      <Result state={state} />
    </form>
  );
}
