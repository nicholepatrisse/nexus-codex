import Link from "next/link";
import { StatusBadge } from "@/app/status-badge";
import { CharacterIdentity, characterIdentityCompactValues } from "@/character/character-identity";
import { DescriptionItem, DescriptionList } from "@/app/description-list";

export function PlayerSummaryCard({
  personName,
  discordHandle,
  characterId,
  characterName,
  characterSocietyNumber,
  characterLevel,
  characterClassName,
  characterAncestry,
  characterBackground,
  waitlistPosition,
  expandable = true,
  pregen = false,
  creditRecipientName,
}: {
  personName: string;
  discordHandle?: string | null;
  characterId?: string | null;
  characterName?: string | null;
  characterSocietyNumber?: string | null;
  characterLevel?: number | null;
  characterClassName?: string | null;
  characterAncestry?: string | null;
  characterBackground?: string | null;
  waitlistPosition?: number;
  expandable?: boolean;
  pregen?: boolean;
  creditRecipientName?: string | null;
}) {
  const compactCharacterDetails = characterIdentityCompactValues({ name: characterName ?? "", level: characterLevel, className: characterClassName, ancestry: characterAncestry, background: characterBackground });
  const summaryContent = <>
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-text-primary">{personName}</span>
      {characterName ? <span className={`mt-1 block break-words text-sm text-text-muted ${expandable ? "group-open:hidden" : ""}`}>{pregen ? "Pregen · " : ""}{[characterName, ...compactCharacterDetails].join(" · ")}</span> : <span className={`mt-1 block text-sm text-text-muted ${expandable ? "group-open:hidden" : ""}`}>No character assigned</span>}
    </span>
    <StatusBadge tone={waitlistPosition ? "warning" : "success"}>{waitlistPosition ? `Waitlist #${waitlistPosition}` : "Confirmed"}</StatusBadge>
  </>;
  if (!expandable) return <div className="card-standard flex items-center gap-3 p-4">{summaryContent}</div>;

  return <details className="card-standard group">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden">
      {summaryContent}
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180" fill="currentColor"><path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.1 0L10 11l3.7-3.8a.75.75 0 1 1 1.1 1L10.5 13a.75.75 0 0 1-1.1 0L5.2 8.3a.75.75 0 0 1 0-1.1Z" clipRule="evenodd" /></svg>
    </summary>
    <div className="border-t border-border px-4 pb-4 pt-3">
      {characterName ? <div>
        <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">{pregen ? "Playing as · Pregen" : "Character"}</p>
        <div className="mt-1"><CharacterIdentity variant="detail" character={{ name: characterName, societyNumber: characterSocietyNumber, level: characterLevel, className: characterClassName, ancestry: characterAncestry, background: characterBackground }} name={characterId ? <Link className="hover:text-brand hover:underline" href={`/characters/${characterId}`}>{characterName}</Link> : characterName} /></div>
      </div> : null}
    {pregen && creditRecipientName ? <p className="mt-3 border-t border-border pt-3 text-sm"><span className="font-semibold">Credit goes to:</span> {creditRecipientName}</p> : null}
    {discordHandle ? <DescriptionList density="compact" className={characterName ? "mt-3 border-t border-border pt-3" : ""}>
      <DescriptionItem label="Discord">{discordHandle}</DescriptionItem>
    </DescriptionList> : null}
    </div>
  </details>;
}
