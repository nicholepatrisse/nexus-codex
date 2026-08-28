import Link from "next/link";
import { StatusBadge } from "@/app/status-badge";

export function PlayerSummaryCard({
  personName,
  discordHandle,
  societyPlayNumber,
  characterId,
  characterName,
  characterSocietyNumber,
  characterLevel,
  characterClassName,
  characterAncestry,
  characterBackground,
  waitlistPosition,
}: {
  personName: string;
  discordHandle?: string | null;
  societyPlayNumber?: string | null;
  characterId?: string | null;
  characterName?: string | null;
  characterSocietyNumber?: string | null;
  characterLevel?: number | null;
  characterClassName?: string | null;
  characterAncestry?: string | null;
  characterBackground?: string | null;
  waitlistPosition?: number;
}) {
  return <details className="card-standard group">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-text-primary">{personName}</span>
        {characterName ? <span className="mt-1 block truncate text-sm text-text-muted">{characterName}{characterLevel ? ` · Level ${characterLevel}` : ""}</span> : <span className="mt-1 block text-sm text-text-muted">No character assigned</span>}
      </span>
      <StatusBadge tone={waitlistPosition ? "warning" : "success"}>{waitlistPosition ? `Waitlist #${waitlistPosition}` : "Confirmed"}</StatusBadge>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" fill="currentColor"><path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.1 0L10 11l3.7-3.8a.75.75 0 1 1 1.1 1L10.5 13a.75.75 0 0 1-1.1 0L5.2 8.3a.75.75 0 0 1 0-1.1Z" clipRule="evenodd" /></svg>
    </summary>
    <div className="border-t border-border px-4 pb-4 pt-3">
      {characterName ? <div>
        <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Character</p>
        <p className="mt-1 font-semibold">{characterId ? <Link className="hover:text-brand hover:underline" href={`/characters/${characterId}`}>{characterName}</Link> : characterName}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {characterSocietyNumber ? <><dt className="text-text-muted">Society #</dt><dd>{characterSocietyNumber}</dd></> : null}
          {characterLevel ? <><dt className="text-text-muted">Level</dt><dd>{characterLevel}</dd></> : null}
          {characterClassName ? <><dt className="text-text-muted">Class</dt><dd>{characterClassName}</dd></> : null}
          {characterAncestry ? <><dt className="text-text-muted">Ancestry</dt><dd>{characterAncestry}</dd></> : null}
          {characterBackground ? <><dt className="text-text-muted">Background</dt><dd>{characterBackground}</dd></> : null}
        </dl>
      </div> : null}
    {discordHandle || societyPlayNumber ? <dl className={`${characterName ? "mt-3 border-t border-border pt-3" : ""} grid gap-1 text-sm text-text-muted`}>
      {discordHandle ? <div className="flex gap-2"><dt className="font-medium text-text-primary">Discord</dt><dd className="min-w-0 break-words">{discordHandle}</dd></div> : null}
      {societyPlayNumber ? <div className="flex gap-2"><dt className="font-medium text-text-primary">Society #</dt><dd>{societyPlayNumber}</dd></div> : null}
    </dl> : null}
    </div>
  </details>;
}
