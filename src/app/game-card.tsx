import type { ReactNode } from "react";
import Link from "next/link";
import { SessionStatusPill, type SessionLifecycleStatus } from "@/app/session-status-pill";

export type GameCardRelationship = "gm" | "registered" | "waitlisted";

export type GameCardProps = Readonly<{
  href: string;
  scenarioCode?: string | null;
  scenarioTitle: string;
  startsAt: Date;
  displayTimeZone?: string | null;
  status: SessionLifecycleStatus;
  paizoReportedAt?: Date | null;
  gmName?: string | null;
  communityName?: string | null;
  confirmedCount?: number | null;
  capacity?: number | null;
  relationship?: GameCardRelationship | null;
  waitlistPosition?: number | null;
  characterName?: string | null;
  warning?: string | null;
  actions?: ReactNode;
}>;

export function formatGameDateTime(startsAt: Date, displayTimeZone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    ...(displayTimeZone ? { timeZone: displayTimeZone } : {}),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(startsAt);
}

function RelationshipPill({ relationship, waitlistPosition }: { relationship: GameCardRelationship; waitlistPosition?: number | null }) {
  const styles = relationship === "waitlisted"
    ? "border-warning/30 bg-warning/10 text-warning"
    : relationship === "gm"
      ? "border-info/30 bg-info/10 text-info"
      : "border-success/30 bg-success/10 text-success";
  const label = relationship === "gm" ? "GM" : relationship === "waitlisted"
    ? `Waitlisted${waitlistPosition ? ` · #${waitlistPosition}` : ""}`
    : "Registered";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>{label}</span>;
}

export function GameCard({ href, scenarioCode, scenarioTitle, startsAt, displayTimeZone, status, paizoReportedAt, gmName, communityName, confirmedCount, capacity, relationship, waitlistPosition, characterName, warning, actions }: GameCardProps) {
  const cancelled = status === "cancelled";
  const scenario = scenarioCode ? `${scenarioCode} — ${scenarioTitle}` : scenarioTitle;
  return <article className={`card-standard flex h-full min-w-0 flex-col p-4 sm:p-5 ${cancelled ? "border-danger/40" : warning ? "border-warning/40" : ""}`}>
    <div className="min-w-0">
      <h3 className="min-w-0 font-semibold text-text-primary">
        <Link href={href} className="break-words hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">{scenario}</Link>
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {relationship ? <RelationshipPill relationship={relationship} waitlistPosition={waitlistPosition} /> : null}
        {characterName ? <span className="rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-xs font-semibold text-info">{characterName}</span> : null}
        <SessionStatusPill status={status} startsAt={startsAt} paizoReportedAt={paizoReportedAt} />
      </div>
    </div>
    <dl className="mt-4 grid min-w-0 grid-cols-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2"><dt className="sr-only">Date and time</dt><dd><time dateTime={startsAt.toISOString()} className={cancelled ? "text-danger line-through" : "text-text-muted"}>{formatGameDateTime(startsAt, displayTimeZone)}</time></dd></div>
      {gmName ? <div className="min-w-0"><dt className="sr-only">Game Master</dt><dd className="break-words text-text-muted">GM: {gmName}</dd></div> : null}
      {communityName ? <div className="min-w-0"><dt className="sr-only">Community</dt><dd className="break-words text-text-muted">{communityName}</dd></div> : null}
      {capacity != null ? <div><dt className="sr-only">Player capacity</dt><dd className="text-text-muted">{confirmedCount != null ? `${confirmedCount} / ${capacity} players` : `${capacity} player capacity`}</dd></div> : null}
    </dl>
    {warning ? <p className="mt-3 text-sm font-medium text-warning">{warning}</p> : null}
    {cancelled ? <span className="sr-only">This game was cancelled.</span> : null}
    {actions ? <div className="mt-auto flex flex-wrap gap-3 pt-4">{actions}</div> : null}
  </article>;
}
