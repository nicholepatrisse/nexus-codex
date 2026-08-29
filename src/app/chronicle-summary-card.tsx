import type { ReactNode } from "react";
import Link from "next/link";
import { GmCreditBadge } from "@/app/gm-credit-badge";
import { StatusBadge } from "@/app/status-badge";

export function formatChronicleDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function ChronicleSummaryCard({ href, scenarioNumber, scenarioName, playedOn, characterLevel, xp, isGmCredit = false, source, chronicleNumber, characterName, actions, secondaryActions }: {
  href: string;
  scenarioNumber: string;
  scenarioName: string;
  playedOn: string;
  characterLevel: number;
  xp: number;
  isGmCredit?: boolean;
  source?: "nexus" | "external";
  chronicleNumber?: string | null;
  characterName?: string;
  actions?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return <article className="card-standard card-interactive h-full p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {chronicleNumber ? <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Chronicle {chronicleNumber}</p> : null}
        <div className={`${chronicleNumber ? "mt-1" : ""} flex flex-wrap items-center gap-2`}>
          <h3><Link className="font-semibold text-text-primary hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand" href={href}>{scenarioNumber} — {scenarioName}</Link></h3>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {source ? <StatusBadge>{source === "nexus" ? "Nexus" : "External"}</StatusBadge> : null}
        {isGmCredit ? <GmCreditBadge /> : null}
        {actions}
      </div>
    </div>
    {characterName ? <p className="mt-3 text-sm font-semibold text-text-primary">{characterName}</p> : null}
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-muted">{formatChronicleDate(playedOn)} · Level {characterLevel} · {xp} XP</p>
      {secondaryActions}
    </div>
  </article>;
}
