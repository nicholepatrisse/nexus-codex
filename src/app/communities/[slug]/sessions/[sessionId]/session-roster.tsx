export type SessionRosterEntry = { id: string; personName: string; discordHandle?: string | null; societyPlayNumber?: string | null; status: "confirmed" | "waitlisted"; waitlistPosition?: number };

function Player({ entry }: { entry: SessionRosterEntry }) {
  return <><span className="font-semibold">{entry.personName}</span>{entry.discordHandle ? <span className="mt-1 block text-[var(--muted)]">Discord: {entry.discordHandle}</span> : null}{entry.societyPlayNumber ? <span className="block text-[var(--muted)]">Society #: {entry.societyPlayNumber}</span> : null}</>;
}

export function SessionRoster({ capacity, confirmedCount, waitlistedCount, entries }: { capacity: number; confirmedCount: number; waitlistedCount: number; entries?: SessionRosterEntry[] }) {
  const confirmed = entries?.filter(({ status }) => status === "confirmed") ?? [];
  const waitlisted = entries?.filter(({ status }) => status === "waitlisted").sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0)) ?? [];
  return <section className="mt-8 border-t border-white/10 pt-6"><h2 className="text-xl font-semibold">Players</h2><p className="mt-2 text-sm text-[var(--muted)]">{confirmedCount} of {capacity} seats confirmed · {waitlistedCount} waitlisted</p>{entries ? <div className="mt-5 grid gap-6 sm:grid-cols-2"><div><h3 className="text-sm font-semibold text-[var(--muted)]">Confirmed</h3>{confirmed.length ? <ol className="mt-2 space-y-2">{confirmed.map((entry) => <li key={entry.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm"><Player entry={entry} /></li>)}</ol> : <p className="mt-2 text-sm text-[var(--muted)]">No confirmed players.</p>}</div><div><h3 className="text-sm font-semibold text-[var(--muted)]">Waitlist</h3>{waitlisted.length ? <ol className="mt-2 space-y-2">{waitlisted.map((entry) => <li key={entry.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm"><span className="mr-2 text-[var(--muted)]">#{entry.waitlistPosition}</span><Player entry={entry} /></li>)}</ol> : <p className="mt-2 text-sm text-[var(--muted)]">No one is waiting.</p>}</div></div> : null}</section>;
}
