export function CalendarLink({ slug, sessionId, className = "" }: { slug: string; sessionId: string; className?: string }) {
  return <a href={`/communities/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/calendar`} className={`${className} inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text-primary hover:border-brand hover:text-brand`}>
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2"><path d="M7 2v3M17 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" /></svg>
    Add to calendar
  </a>;
}
