"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { decideGmAction, revokeGmAction } from "./gm-actions";
import type { OwnerGmActionState } from "./gm-state";

type GmRequest = { id: string; displayName: string; requestedAt: Date };
type GmGrant = { id: string; displayName: string; status: string };

function Button({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={destructive ? "rounded-full border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-60" : "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#07110f] disabled:opacity-60"}>{pending ? "Working…" : children}</button>;
}

function Feedback({ state }: { state: OwnerGmActionState }) {
  return <>{state.error ? <p role="alert" className="mt-2 text-sm text-red-300">{state.error}</p> : null}{state.success ? <p role="status" className="mt-2 text-sm text-emerald-200">{state.success}</p> : null}</>;
}

function Decision({ slug, request, decision }: { slug: string; request: GmRequest; decision: "approve" | "reject" }) {
  const [state, action] = useActionState(decideGmAction.bind(null, slug, request.id, decision), {});
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`${decision === "approve" ? "Approve" : "Reject"} GM access for ${request.displayName}?`)) event.preventDefault(); }}><Button destructive={decision === "reject"}>{decision === "approve" ? "Approve" : "Reject"}</Button><Feedback state={state} /></form>;
}

function RevokeGrant({ slug, grant }: { slug: string; grant: GmGrant }) {
  const [state, formAction] = useActionState(revokeGmAction.bind(null, slug, grant.id), {});
  return <form action={formAction} onSubmit={(event) => { if (!window.confirm(`Revoke GM access for ${grant.displayName}?`)) event.preventDefault(); }}><Button destructive>Revoke</Button><Feedback state={state} /></form>;
}

export function GmManagement({ slug, requests, grants }: { slug: string; requests: GmRequest[]; grants: GmGrant[] }) {
  return <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8"><h2 className="text-2xl font-semibold">Game Masters</h2><h3 className="mt-6 text-lg font-semibold">Pending GM requests</h3>{requests.length ? <ul className="mt-3 space-y-3">{requests.map((request) => <li key={request.id} className="rounded-xl border border-white/10 p-4"><p className="font-semibold">{request.displayName}</p><p className="mt-1 text-sm text-[var(--muted)]">Requested {new Date(request.requestedAt).toLocaleDateString()}</p><div className="mt-4 flex flex-wrap gap-3"><Decision slug={slug} request={request} decision="approve" /><Decision slug={slug} request={request} decision="reject" /></div></li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No pending GM requests.</p>}<h3 className="mt-8 text-lg font-semibold">GM grant history</h3>{grants.length ? <ul className="mt-3 space-y-3">{grants.map((grant) => <li key={grant.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{grant.displayName}</p><p className="text-sm capitalize text-[var(--muted)]">{grant.status}</p></div>{grant.status === "active" ? <RevokeGrant slug={slug} grant={grant} /> : null}</div></li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No GM grants.</p>}</section>;
}
