"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changeCommunityLifecycleAction } from "./actions";
import type { CommunityLifecycleFormState } from "./state";

function LifecycleButton({ action }: { action: "archive" | "restore" }) {
  const { pending } = useFormStatus();
  const label = action === "archive" ? "Archive community" : "Restore community";
  return <button disabled={pending} className="rounded-full border border-danger/50 px-5 py-2.5 font-semibold text-danger disabled:opacity-60">{pending ? "Working…" : label}</button>;
}

export function CommunityLifecycleForm({ slug, action }: { slug: string; action: "archive" | "restore" }) {
  const boundAction = changeCommunityLifecycleAction.bind(null, slug, action);
  const [state, formAction] = useActionState(boundAction, {} as CommunityLifecycleFormState);
  return <form action={formAction} className="mt-5 space-y-4"><label htmlFor="confirmation" className="block text-sm">Type <strong>{slug}</strong> to confirm.</label><input id="confirmation" name="confirmation" autoComplete="off" required className="w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3" />{state.formError ? <p role="alert" className="text-sm text-danger">{state.formError}</p> : null}<LifecycleButton action={action} /></form>;
}
