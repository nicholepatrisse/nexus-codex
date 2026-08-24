"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelSessionAction } from "../actions";
function Button() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="rounded-full border border-red-300/40 px-5 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-60">{pending ? "Cancelling…" : "Cancel session"}</button>; }
export function CancelSessionButton({ slug, sessionId }: { slug: string; sessionId: string }) { const [state, action] = useActionState(cancelSessionAction.bind(null, slug, sessionId), {}); return <form action={action}><Button />{state.error ? <p role="alert" className="mt-2 text-sm text-red-300">{state.error}</p> : null}</form>; }
