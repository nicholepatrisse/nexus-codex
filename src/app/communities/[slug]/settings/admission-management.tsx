"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createInvitationAction, decideAdmissionAction, revokeInvitationAction } from "./admission-actions";
import type { OwnerAdmissionState } from "./admission-state";

type Invitation = {
  id: string;
  status: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date;
  token?: string;
};
type Request = { id: string; displayName: string; requestedAt: Date };

function Button({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${destructive ? "border border-red-300/30 text-red-200" : "bg-[var(--accent)] text-[#07110f]"}`}>{pending ? "Working…" : children}</button>;
}

function Feedback({ state }: { state: OwnerAdmissionState }) {
  return <>{state.error ? <p role="alert" className="mt-3 text-sm text-red-300">{state.error}</p> : null}{state.success ? <p role="status" className="mt-3 text-sm text-emerald-200">{state.success}</p> : null}</>;
}

function RevokeInvitation({ slug, invitation }: { slug: string; invitation: Invitation }) {
  const [state, action] = useActionState(revokeInvitationAction.bind(null, slug, invitation.id), {});
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Revoke this invitation?")) event.preventDefault(); }}><Button destructive>Revoke</Button><Feedback state={state} /></form>;
}

function InvitationUsage({ invitation }: { invitation: Invitation }) {
  if (invitation.maxUses === null) {
    return <p>Unlimited invitations remaining · {invitation.useCount} used</p>;
  }

  const remaining = Math.max(0, invitation.maxUses - invitation.useCount);
  return (
    <p>
      {remaining} {remaining === 1 ? "invitation" : "invitations"} remaining · {invitation.useCount} used
    </p>
  );
}

function DecideRequest({ slug, request }: { slug: string; request: Request }) {
  const [approveState, approve] = useActionState(decideAdmissionAction.bind(null, slug, request.id, "approve"), {});
  const [rejectState, reject] = useActionState(decideAdmissionAction.bind(null, slug, request.id, "reject"), {});
  return <li className="rounded-xl border border-white/10 p-4"><p className="font-semibold">{request.displayName}</p><p className="mt-1 text-sm text-[var(--muted)]">Requested {new Date(request.requestedAt).toLocaleDateString()}</p><form action={approve} className="mt-4"><Button>Approve</Button><Feedback state={approveState} /></form><form action={reject} className="mt-3 space-y-3" onSubmit={(event) => { if (!window.confirm("Reject this membership request?")) event.preventDefault(); }}><label className="block text-sm">Private decision note (optional)<input name="reason" maxLength={500} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2" /></label><Button destructive>Reject</Button><Feedback state={rejectState} /></form></li>;
}

export function AdmissionManagement({ slug, invitations, requests }: { slug: string; invitations: Invitation[]; requests: Request[] }) {
  const [createState, createAction] = useActionState(createInvitationAction.bind(null, slug), {});
  const activeInvitations = invitations.filter(
    ({ status, maxUses, useCount }) =>
      status === "pending" &&
      (maxUses === null || useCount < maxUses),
  );

  return <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8"><h2 className="text-2xl font-semibold">Sharing links and membership</h2><p className="mt-3 text-sm text-[var(--muted)]">Generate a link and share it wherever you coordinate your community. Email delivery can be added later.</p><form action={createAction} className="mt-6"><label htmlFor="maxUses" className="text-sm font-semibold">Number of people who can use this link</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><select id="maxUses" name="maxUses" defaultValue="1" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111722] px-4 py-3"><option value="1">1 person</option><option value="2">2 people</option><option value="5">5 people</option><option value="10">10 people</option><option value="25">25 people</option><option value="100">100 people</option><option value="unlimited">Unlimited</option></select><Button>Generate sharing link</Button></div><Feedback state={createState} /></form><h3 className="mt-8 text-lg font-semibold">Active sharing links</h3>{activeInvitations.length ? <ul className="mt-3 space-y-3">{activeInvitations.map((invitation) => <li key={invitation.id} className={`rounded-xl border p-4 ${invitation.id === createState.invitationId ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]" : "border-white/10"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div>{invitation.id === createState.invitationId ? <p className="mb-1 text-sm font-semibold text-[var(--accent)]">New sharing link</p> : null}<InvitationUsage invitation={invitation} /><p className="text-sm text-[var(--muted)]">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><RevokeInvitation slug={slug} invitation={invitation} /></div>{invitation.token ? <input aria-label="Sharing link" readOnly value={`/invitations/${invitation.token}`} className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm" /> : null}</li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No active sharing links.</p>}<h3 className="mt-8 text-lg font-semibold">Pending membership requests</h3>{requests.length ? <ul className="mt-3 space-y-3">{requests.map((request) => <DecideRequest key={request.id} slug={slug} request={request} />)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No pending membership requests.</p>}</section>;
}
