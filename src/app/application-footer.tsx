import { ReportIssueLink } from "@/app/report-issue-link";

export function ApplicationFooter() {
  return (
    <footer className="border-t border-border bg-surface/80">
      <div className="mx-auto flex max-w-6xl justify-end px-6 py-5">
        <ReportIssueLink className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-raised hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
      </div>
    </footer>
  );
}
