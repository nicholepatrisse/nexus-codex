import { PlayerSummaryCard } from "@/app/player-summary-card";
import type { CharacterValidationSummary } from "@/character/character-validation-summary";

export type SessionRosterEntry = { id: string; personName: string; discordHandle?: string | null; characterId?: string | null; characterName?: string | null; characterSocietyNumber?: string | null; characterLevel?: number | null; characterClassName?: string | null; characterAncestry?: string | null; characterBackground?: string | null; validationSummary?: CharacterValidationSummary | null; pregen?: boolean; creditRecipientName?: string | null; status: "confirmed" | "waitlisted"; waitlistPosition?: number };

export function canViewPrivateRosterDetails(isManager: boolean) {
  return isManager;
}

export function SessionRoster({ capacity, confirmedCount, waitlistedCount, entries, expandable = false }: { capacity: number; confirmedCount: number; waitlistedCount: number; entries?: SessionRosterEntry[]; expandable?: boolean }) {
  const confirmed = entries?.filter(({ status }) => status === "confirmed") ?? [];
  const waitlisted = entries?.filter(({ status }) => status === "waitlisted").sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0)) ?? [];
  return <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl font-semibold">Players</h2><p className="mt-2 text-sm text-text-muted">{confirmedCount} of {capacity} seats confirmed · {waitlistedCount} waitlisted</p>{entries ? <div className="mt-5 space-y-6"><div><h3 className="text-sm font-semibold text-text-muted">Confirmed</h3>{confirmed.length ? <ol className="mt-3 space-y-3">{confirmed.map((entry) => <li key={entry.id}><PlayerSummaryCard {...entry} expandable={expandable} /></li>)}</ol> : <p className="mt-2 text-sm text-text-muted">No confirmed players.</p>}</div><div className="border-t border-border pt-5"><h3 className="text-sm font-semibold text-text-muted">Waitlist</h3>{waitlisted.length ? <ol className="mt-3 space-y-3">{waitlisted.map((entry) => <li key={entry.id}><PlayerSummaryCard {...entry} expandable={expandable} /></li>)}</ol> : <p className="mt-2 text-sm text-text-muted">No one is waiting.</p>}</div></div> : null}</section>;
}
