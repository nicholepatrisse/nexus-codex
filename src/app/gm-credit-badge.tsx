export function GmCreditBadge({ className = "" }: { className?: string }) {
  return <span aria-label="Earned as GM Credit" className={`inline-flex shrink-0 rounded-full border border-info/40 bg-info/10 px-2.5 py-1 text-xs font-semibold text-info ${className}`}>GM Credit</span>;
}
