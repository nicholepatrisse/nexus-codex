"use client";
import { useFormStatus } from "react-dom";
function Button() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="inline-flex items-center text-sm leading-5 font-semibold text-danger hover:underline disabled:opacity-60">{pending ? "Deleting…" : "Delete"}</button>; }
export function DeleteChronicleButton({ action, scenario }: { action: () => Promise<void>; scenario: string }) { return <form className="inline-flex items-center" action={action} onSubmit={(event) => { if (!window.confirm(`Delete the Chronicle for ${scenario}? This cannot be undone.`)) event.preventDefault(); }}><Button /></form>; }
