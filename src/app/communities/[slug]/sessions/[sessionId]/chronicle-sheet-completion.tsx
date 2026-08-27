import type { CompletionCharacter } from "./complete-session-form";
import { attachChronicleSheetAction, finalizeSessionAction } from "../actions";
import { calculateEarnIncome } from "@/character/sfs2-chronicle-rewards";

type SheetField = { label: string; value: string | number | null | undefined };

function SheetValue({ label, value }: SheetField) {
  return <div className="rounded-xl border border-brand/30 bg-brand/5 p-4"><dt className="text-xs font-bold tracking-[0.12em] text-brand uppercase">{label}</dt><dd className="mt-2 text-xl font-bold leading-tight text-text-primary">{value === null || value === undefined || value === "" ? <span className="text-danger">Missing</span> : value}</dd></div>;
}

function SheetFields({ fields, columns = 2 }: { fields: SheetField[]; columns?: 2 | 3 }) {
  return <dl className={`grid gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{fields.map((field) => <SheetValue key={field.label} {...field} />)}</dl>;
}

export function ChronicleSheetCompletion({ slug, sessionId, characters, onEditReporting }: { slug: string; sessionId: string; characters: CompletionCharacter[]; onEditReporting?: () => void }) {
  const pending = characters.filter((character) => character.chronicleId && !character.sheetFilename);
  return <section className="mt-8 rounded-2xl border border-brand/30 bg-surface-raised p-5" aria-labelledby="sheet-completion-heading">
    <p className="text-sm font-semibold tracking-[0.16em] text-brand uppercase">Chronicle sheets</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h2 id="sheet-completion-heading" className="text-2xl font-semibold">Fill out and attach each official sheet</h2>{onEditReporting ? <button type="button" onClick={onEditReporting} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold">Edit reporting</button> : null}</div>
    <p className="mt-2 text-sm text-text-muted">The highlighted boxes below match the fields the GM must write on the official Chronicle. Transcribe them exactly, then upload the completed sheet.</p>
    <div className="mt-6 space-y-6">{characters.filter(({ chronicleId }) => chronicleId).map((character) => {
      const [organizedPlayNumber = character.societyNumber, characterNumber] = character.societyNumber?.split("-") ?? [];
      const calculatedDowntime = character.downtimeDisposition === "earn_income" && character.downtimeCheckTotal != null && character.downtimeProficiency ? calculateEarnIncome(character.level ?? 1, character.downtimeCheckTotal, character.downtimeProficiency, character.xp * 2).calculatedCreditsMinor : 0;
      const creditsGained = character.baseCreditsMinor + (character.downtimeOverrideCreditsMinor ?? calculatedDowntime);
      const startingXp = character.startingXp ?? 0;
      const startingCredits = character.startingCredits ?? 0;
      const formattedDate = character.playedOn ? new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${character.playedOn}T00:00:00Z`)) : undefined;
      return <article key={character.characterId} className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-raised px-5 py-4"><div><h3 className="text-xl font-semibold">{character.characterName}</h3><p className="mt-1 text-sm text-text-muted">{character.scenario}</p></div><span className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-bold text-brand uppercase">{character.relationship}</span></header>
        <div className="p-5">
          <section aria-labelledby={`header-fields-${character.characterId}`}><div className="mb-3"><p className="text-xs font-bold tracking-[0.14em] text-text-muted uppercase">Top of Chronicle</p><h4 id={`header-fields-${character.characterId}`} className="mt-1 text-lg font-semibold">Write these character fields</h4></div><SheetFields fields={[
            { label: "Character Name", value: character.characterName }, { label: "Organized Play #", value: organizedPlayNumber }, { label: "Character #", value: characterNumber },
          ]} columns={3} /></section>
          <section className="mt-6 border-t border-border pt-6" aria-labelledby={`gm-fields-${character.characterId}`}><div className="mb-4"><p className="text-xs font-bold tracking-[0.14em] text-warning uppercase">For GM only</p><h4 id={`gm-fields-${character.characterId}`} className="mt-1 text-lg font-semibold">Write these reward and event fields</h4></div>
            <p className="mb-2 text-xs font-bold tracking-[0.12em] text-text-muted uppercase">Experience</p><dl className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3"><SheetValue label="Starting XP" value={startingXp.toLocaleString("en-US")} /><div aria-hidden="true" className="hidden self-center text-2xl font-bold text-text-muted sm:block">+</div><SheetValue label="XP Gained" value={character.xp.toLocaleString("en-US")} /><div aria-hidden="true" className="hidden self-center text-2xl font-bold text-text-muted sm:block">=</div><SheetValue label="Final XP Total" value={(startingXp + character.xp).toLocaleString("en-US")} /></dl>
            <p className="mb-2 mt-5 text-xs font-bold tracking-[0.12em] text-text-muted uppercase">Credits</p><SheetFields fields={[{ label: "Starting Credits", value: startingCredits.toLocaleString("en-US") }, { label: "Credits Gained (GM ONLY)", value: creditsGained.toLocaleString("en-US") }]} />
            <p className="mb-2 mt-5 text-xs font-bold tracking-[0.12em] text-text-muted uppercase">For GM Only footer</p><SheetFields fields={[{ label: "Event", value: character.eventName }, { label: "Event Code", value: character.eventCode }, { label: "Date", value: formattedDate }, { label: "GM Organized Play #", value: character.gmOrganizedPlayId }]} />
          </section>
          <aside className="mt-5 rounded-xl border border-border bg-surface-raised p-4"><p className="text-xs font-bold tracking-[0.12em] text-text-muted uppercase">Reference while completing the sheet</p><p className="mt-2 text-sm"><span className="font-semibold">Character level:</span> {character.level ?? "Missing"} · <span className="font-semibold">Downtime:</span> {character.downtimeDisposition === "declined" ? "Declined / lost" : character.downtimeDisposition === "other" ? character.downtimeActivity || "Other activity" : `Earn Income, check ${character.downtimeCheckTotal ?? "missing"}`}</p></aside>
          <div className="mt-6 border-t border-border pt-5"><h4 className="font-semibold">Attach the completed official Chronicle</h4>{character.sheetFilename ? <div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold text-success">✓ {character.sheetFilename}</span><a className="font-semibold text-brand hover:underline" href={`/communities/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/chronicles/${encodeURIComponent(character.chronicleId!)}/sheet`} target="_blank">View</a><span className="text-text-muted">Choose a new file below to replace it.</span></div> : <p className="mt-2 text-sm font-semibold text-warning">Sheet required</p>}
            <form action={attachChronicleSheetAction.bind(null, slug, sessionId, character.chronicleId!)} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><input type="file" name="sheet" accept="application/pdf,image/png,image/jpeg" required aria-label="Choose completed Chronicle sheet" className="block w-full cursor-pointer rounded-xl border border-border-strong bg-surface-raised text-sm text-text-muted file:mr-4 file:cursor-pointer file:border-0 file:border-r file:border-border file:bg-surface file:px-4 file:py-3 file:font-semibold file:text-text-primary hover:border-brand hover:file:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" /><button className="w-full rounded-full border border-border-strong px-5 py-3 text-sm font-semibold hover:border-brand hover:text-brand sm:w-auto">{character.sheetFilename ? "Replace sheet" : "Attach completed sheet"}</button></form>
          </div>
        </div>
      </article>;
    })}</div>
    {pending.length ? <p className="mt-5 rounded-xl bg-warning/10 p-4 text-sm text-warning">Attach a completed official Chronicle sheet for each character before completing the game. Remaining: {pending.map(({ characterName }) => characterName).join(", ")}.</p> : null}
    <form action={finalizeSessionAction.bind(null, slug, sessionId)} className="mt-5"><button disabled={pending.length > 0 || !characters.some(({ chronicleId }) => chronicleId)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand disabled:cursor-not-allowed disabled:opacity-50">Save and complete game</button></form>
  </section>;
}
