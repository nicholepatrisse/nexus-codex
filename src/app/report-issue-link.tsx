import { REPORT_ISSUE_URL } from "@/app/external-links";

export function ReportIssueLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={REPORT_ISSUE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <span>Report an issue</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="size-4 shrink-0"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5m0-5-8 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </svg>
    </a>
  );
}
