"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/app/dialog";
import { PathmuncherImport } from "@/app/characters/pathmuncher-import";
import { applyPathmuncherImportAction } from "@/app/characters/pathmuncher-import-actions";

export function PathmuncherHeaderImport({ characterId }: { characterId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <><button type="button" onClick={() => { setMessage(""); setOpen(true); }} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold text-brand hover:border-brand">Import Pathmuncher</button>{open ? <Dialog open title="Import from Pathmuncher" description="Review the export before replacing identity, heritage, and feat selections. Society history and Nexus-owned records stay protected." onClose={() => setOpen(false)} closeLabel="Close Pathmuncher import" className="max-w-3xl"><div className="mt-5"><PathmuncherImport characterId={characterId} onApply={(values) => startTransition(async () => { const result = await applyPathmuncherImportAction(characterId, values); setMessage(result.ok ? "Import applied. Close this dialog to see the updated character." : result.error); })} />{pending ? <p role="status" className="mt-3 text-sm text-text-muted">Applying reviewed import…</p> : message ? <p role="status" className={`mt-3 rounded-xl p-3 text-sm ${message.startsWith("Import applied") ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{message}</p> : null}</div></Dialog> : null}</>;
}
