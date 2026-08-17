"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { redeemInvitationAction } from "../actions";

function AcceptButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] disabled:cursor-wait disabled:opacity-60">{pending ? "Accepting…" : "Accept invitation"}</button>;
}

export function RedeemInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(redeemInvitationAction.bind(null, token), {});
  return <form action={action} className="mt-8 space-y-4"><AcceptButton />{state.error ? <p role="alert" className="text-sm text-red-300">{state.error}</p> : null}</form>;
}
