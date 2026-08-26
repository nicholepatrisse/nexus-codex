"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelGmAction, requestGmAction } from "./gm-actions";
import type { GmActionState } from "./gm-state";

function Submit({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={destructive ? "rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60" : "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"}>{pending ? "Working…" : children}</button>;
}

function Feedback({ state }: { state: GmActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-success">{state.message}</p>;
  return null;
}

export function GmAdmissionForm({ slug, pendingRequestId }: { slug: string; pendingRequestId?: string }) {
  const action = pendingRequestId ? cancelGmAction.bind(null, slug, pendingRequestId) : requestGmAction.bind(null, slug);
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3"><Submit destructive={Boolean(pendingRequestId)}>{pendingRequestId ? "Cancel GM request" : "Request GM access"}</Submit>{pendingRequestId ? <p className="text-sm text-text-muted">Awaiting owner review.</p> : null}<Feedback state={state} /></form>;
}
