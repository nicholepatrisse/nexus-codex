import Link from "next/link";
import type { CharacterValidationSummary as Summary } from "@/character/character-validation-summary";

const statusStyles: Record<Summary["presentation"], string> = { Validated: "border-success/40 bg-success/5", "Needs Review": "border-warning/50 bg-warning/5", "Rules Issue Found": "border-danger/50 bg-danger/5" };

export function CharacterValidationSummary({ summary }: { summary: Summary }) {
  return <section aria-label="Character validation" className="mt-6">
    <details className={`group rounded-2xl border ${statusStyles[summary.presentation]}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl p-5 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <span><span className="block text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">Validation summary</span><span className="mt-1 block text-lg font-semibold">{summary.presentation}</span></span>
        <span className="flex items-center gap-3"><span className="text-sm text-text-muted"><span className="font-semibold text-text-primary">{summary.validatedCount}</span> validated · <span className="font-semibold text-text-primary">{summary.unvalidatedCount}</span> need review · <span className="font-semibold text-text-primary">{summary.invalidCount}</span> rules issues</span><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180"><path d="m5 7.5 5 5 5-5" /></svg></span>
      </summary>
      <div className="border-t border-border px-5 pt-4 pb-5">
        {summary.presentation === "Validated" ? <p className="text-sm text-text-muted">Nexus confirmed every recorded class, ancestry, background, and inventory selection.</p> : <><p className="text-sm text-text-muted">This is advisory only. You can keep editing and using this character while these selections are reviewed.</p><ul className="mt-4 space-y-3">{summary.details.map((detail) => <li key={detail.key} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold tracking-wide text-text-muted uppercase">{detail.category}</p><p className="mt-1 font-semibold">{detail.selection}</p></div><Link className="text-sm font-semibold text-brand hover:underline" href={detail.href}>Review option</Link></div><dl className="mt-3 grid gap-2 text-sm"><div><dt className="inline font-semibold">Source: </dt><dd className="inline text-text-muted">{detail.source ?? "Not recorded"}</dd></div><div><dt className="inline font-semibold">Reason: </dt><dd className="inline text-text-muted">{detail.issues.map(({ message }) => message).join(" ")}</dd></div><div><dt className="inline font-semibold">Player note: </dt><dd className="inline whitespace-pre-wrap text-text-muted">{detail.playerNote ?? "No note added."}</dd></div></dl></li>)}</ul></>}
      </div>
    </details>
  </section>;
}
