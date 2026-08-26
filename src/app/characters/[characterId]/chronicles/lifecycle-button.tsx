"use client";
import { useFormStatus } from "react-dom";

function Button({ status }: { status: "pending" | "applied" }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="text-sm font-semibold text-brand hover:underline disabled:opacity-60">{pending ? "Saving…" : status === "pending" ? "Apply rewards" : "Unapply rewards"}</button>;
}

export function ChronicleLifecycleButton({ status, action }: { status: "pending" | "applied"; action: () => Promise<void> }) {
  return <form action={action}><Button status={status} /></form>;
}
