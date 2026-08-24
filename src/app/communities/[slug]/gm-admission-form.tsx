"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelGmAction, requestGmAction } from "./gm-actions";
import type { GmActionState } from "./gm-state";

function Submit({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={destructive ? "rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-60" : "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#07110f] disabled:opacity-60"}>{pending ? "Working…" : children}</button>;
}

function Feedback({ state }: { state: GmActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-300">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-emerald-200">{state.message}</p>;
  return null;
}

export function GmAdmissionForm({ slug, pendingRequestId }: { slug: string; pendingRequestId?: string }) {
  const action = pendingRequestId ? cancelGmAction.bind(null, slug, pendingRequestId) : requestGmAction.bind(null, slug);
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3"><Submit destructive={Boolean(pendingRequestId)}>{pendingRequestId ? "Cancel GM request" : "Request GM access"}</Submit>{pendingRequestId ? <p className="text-sm text-[var(--muted)]">Awaiting owner review.</p> : null}<Feedback state={state} /></form>;
}
