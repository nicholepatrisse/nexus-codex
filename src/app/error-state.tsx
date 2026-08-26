import Link from "next/link";
import { ReportIssueLink } from "@/app/report-issue-link";

interface ErrorStateProps {
  errorId: string;
  onRetry: () => void;
  global?: boolean;
}

export function ErrorState({ errorId, onRetry, global = false }: ErrorStateProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-20">
      <section
        className="w-full rounded-2xl border border-border bg-surface/95 p-8 shadow-2xl sm:p-12"
        aria-labelledby="error-title"
      >
        <p className="text-sm font-semibold tracking-[0.24em] text-brand uppercase">
          Nexus Codex
        </p>
        <h1 id="error-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {global ? "Nexus Codex couldn’t start" : "Something went wrong"}
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-text-muted">
          We couldn’t complete that request. You can try again or return home and continue from
          there.
        </p>
        <p className="mt-5 text-sm text-text-muted">
          Error reference: <code className="text-text-primary">{errorId}</code>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-md bg-brand px-5 py-3 font-semibold text-background hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-border-strong px-5 py-3 font-semibold text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Return home
          </Link>
          <ReportIssueLink className="inline-flex items-center gap-2 rounded-md border border-border-strong px-5 py-3 font-semibold text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
        </div>
      </section>
    </main>
  );
}
