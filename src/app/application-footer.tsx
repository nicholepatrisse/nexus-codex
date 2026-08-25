import { ReportIssueLink } from "@/app/report-issue-link";

export function ApplicationFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#080b12]/80">
      <div className="mx-auto flex max-w-6xl justify-end px-6 py-5">
        <ReportIssueLink className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]" />
      </div>
    </footer>
  );
}
