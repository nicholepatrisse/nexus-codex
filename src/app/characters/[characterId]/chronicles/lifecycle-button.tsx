"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ChronicleLifecycleState } from "./actions";

function Button({ status }: { status: "pending" | "applied" }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={status === "pending" ? "rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60" : "text-sm font-semibold text-brand hover:underline disabled:opacity-60"}>{pending ? "Saving…" : status === "pending" ? "Apply rewards" : "Unapply rewards"}</button>;
}

export function ChronicleLifecycleButton({ status, action }: { status: "pending" | "applied"; action: (state: ChronicleLifecycleState) => Promise<ChronicleLifecycleState> }) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction}><Button status={status} />{state.error ? <p role="alert" className="mt-2 max-w-sm text-sm text-danger">{state.error}</p> : null}</form>;
}
