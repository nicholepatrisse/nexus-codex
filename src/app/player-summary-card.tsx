import Link from "next/link";
import { StatusBadge } from "@/app/status-badge";
import { CharacterIdentity, characterIdentityCompactValues } from "@/character/character-identity";
import { DescriptionItem, DescriptionList } from "@/app/description-list";
import type { CharacterValidationSummary as CharacterValidationSummaryData } from "@/character/character-validation-summary";

const validationIndicatorStyles = {
  validated: "border-success/40 bg-success/10 text-success",
  unvalidated: "border-border-strong bg-surface text-text-muted",
  invalid: "border-danger/40 bg-danger/10 text-danger",
} as const;

function ValidationIndicator({ mark, label, count, tone, details, showCount = true }: { mark: string; label: string; count: number; tone: keyof typeof validationIndicatorStyles; details: string; showCount?: boolean }) {
  return <span className="group/indicator relative inline-flex" tabIndex={0} aria-label={showCount ? `${count} ${label}` : label}>
    <span aria-hidden="true" className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${validationIndicatorStyles[tone]}`}>{mark}{showCount ? <span className="ml-1">{count}</span> : null}</span>
    <span role="tooltip" className="pointer-events-none absolute top-full right-0 z-20 mt-2 hidden w-max max-w-72 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left text-xs font-normal text-text-primary shadow-lg group-hover/indicator:block group-focus/indicator:block"><span className="block font-semibold">{showCount ? `${count} ${label}` : label}</span>{details ? <span className="mt-1 block whitespace-normal text-text-muted">{details}</span> : null}</span>
  </span>;
}

function CharacterValidationIndicators({ summary }: { summary: CharacterValidationSummaryData }) {
  const detailText = (status: "unvalidated" | "invalid") => summary.details.filter((detail) => detail.status === status).map((detail) => `${detail.category}: ${detail.selection} — ${detail.issues.map(({ message }) => message).join(" ")}${detail.playerNote ? ` Player note: ${detail.playerNote}` : ""}`).join(" ");
  const allValidated = summary.unvalidatedCount === 0 && summary.invalidCount === 0;
  return <div className="flex gap-1.5" aria-label="Character validation">
    {summary.validatedCount ? <ValidationIndicator mark="✓" label={allValidated ? "Character validated" : "Validated selections"} count={summary.validatedCount} tone="validated" details={allValidated ? "Nexus confirmed every recorded class, ancestry, background, and inventory selection." : "Nexus confirmed the recorded selections represented by this checkmark."} showCount={false} /> : null}
    {summary.unvalidatedCount ? <ValidationIndicator mark="?" label="need review" count={summary.unvalidatedCount} tone="unvalidated" details={detailText("unvalidated")} /> : null}
    {summary.invalidCount ? <ValidationIndicator mark="!" label="rules issues" count={summary.invalidCount} tone="invalid" details={detailText("invalid")} /> : null}
  </div>;
}

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
  validationSummary,
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
  validationSummary?: CharacterValidationSummaryData | null;
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
    <div className="relative border-t border-border px-4 pb-4 pt-3">
      {validationSummary ? <div className="absolute top-3 right-4"><CharacterValidationIndicators summary={validationSummary} /></div> : null}
      {characterName ? <div>
        <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">{pregen ? "Playing as · Pregen" : "Character"}</p>
        <div className={`mt-1 ${validationSummary ? "pr-32" : ""}`}><CharacterIdentity variant="detail" detailFieldsClassName="lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-6" character={{ name: characterName, societyNumber: characterSocietyNumber, level: characterLevel, className: characterClassName, ancestry: characterAncestry, background: characterBackground }} name={characterId ? <Link className="hover:text-brand hover:underline" href={`/characters/${characterId}`}>{characterName}</Link> : characterName} /></div>
      </div> : null}
    {pregen && creditRecipientName ? <p className="mt-3 border-t border-border pt-3 text-sm"><span className="font-semibold">Credit goes to:</span> {creditRecipientName}</p> : null}
    {discordHandle ? <DescriptionList density="compact" className={characterName ? "mt-3 border-t border-border pt-3" : ""}>
      <DescriptionItem label="Discord">{discordHandle}</DescriptionItem>
    </DescriptionList> : null}
    </div>
  </details>;
}
