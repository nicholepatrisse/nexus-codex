"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createInvitationAction, decideAdmissionAction, revokeInvitationAction } from "./admission-actions";
import type { OwnerAdmissionState } from "./admission-state";

type Invitation = { id: string; recipientEmail: string; status: string; expiresAt: Date };
type Request = { id: string; displayName: string; requestedAt: Date };

function Button({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${destructive ? "border border-red-300/30 text-red-200" : "bg-[var(--accent)] text-[#07110f]"}`}>{pending ? "Working…" : children}</button>;
}

function Feedback({ state }: { state: OwnerAdmissionState }) {
  return <>{state.error ? <p role="alert" className="mt-3 text-sm text-red-300">{state.error}</p> : null}{state.success ? <p role="status" className="mt-3 text-sm text-emerald-200">{state.success}</p> : null}{state.invitationPath ? <input aria-label="Invitation link" readOnly value={state.invitationPath} className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" /> : null}</>;
}

function CreateInvitation({ slug }: { slug: string }) {
  const [state, action] = useActionState(createInvitationAction.bind(null, slug), {});
  return <form action={action}><label htmlFor="recipientEmail" className="text-sm font-semibold">Recipient email</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="recipientEmail" name="recipientEmail" type="email" required className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3" /><Button>Create invitation</Button></div><Feedback state={state} /></form>;
}

function RevokeInvitation({ slug, invitation }: { slug: string; invitation: Invitation }) {
  const [state, action] = useActionState(revokeInvitationAction.bind(null, slug, invitation.id), {});
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Revoke this invitation?")) event.preventDefault(); }}><Button destructive>Revoke</Button><Feedback state={state} /></form>;
}

function DecideRequest({ slug, request }: { slug: string; request: Request }) {
  const [approveState, approve] = useActionState(decideAdmissionAction.bind(null, slug, request.id, "approve"), {});
  const [rejectState, reject] = useActionState(decideAdmissionAction.bind(null, slug, request.id, "reject"), {});
  return <li className="rounded-xl border border-white/10 p-4"><p className="font-semibold">{request.displayName}</p><p className="mt-1 text-sm text-[var(--muted)]">Requested {new Date(request.requestedAt).toLocaleDateString()}</p><form action={approve} className="mt-4"><Button>Approve</Button><Feedback state={approveState} /></form><form action={reject} className="mt-3 space-y-3" onSubmit={(event) => { if (!window.confirm("Reject this membership request?")) event.preventDefault(); }}><label className="block text-sm">Private decision note (optional)<input name="reason" maxLength={500} className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2" /></label><Button destructive>Reject</Button><Feedback state={rejectState} /></form></li>;
}

export function AdmissionManagement({ slug, invitations, requests }: { slug: string; invitations: Invitation[]; requests: Request[] }) {
  return <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8"><h2 className="text-2xl font-semibold">Invitations and membership</h2><p className="mt-3 text-sm text-[var(--muted)]">Invitation links are recipient-specific. Share them privately.</p><div className="mt-6"><CreateInvitation slug={slug} /></div><h3 className="mt-8 text-lg font-semibold">Pending invitations</h3>{invitations.filter(({ status }) => status === "pending").length ? <ul className="mt-3 space-y-3">{invitations.filter(({ status }) => status === "pending").map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4"><div><p>{invitation.recipientEmail}</p><p className="text-sm text-[var(--muted)]">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><RevokeInvitation slug={slug} invitation={invitation} /></li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No pending invitations.</p>}<h3 className="mt-8 text-lg font-semibold">Pending membership requests</h3>{requests.length ? <ul className="mt-3 space-y-3">{requests.map((request) => <DecideRequest key={request.id} slug={slug} request={request} />)}</ul> : <p className="mt-3 text-sm text-[var(--muted)]">No pending membership requests.</p>}</section>;
}
