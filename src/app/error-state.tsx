interface ErrorStateProps {
  errorId: string;
  onRetry: () => void;
  global?: boolean;
}

export function ErrorState({ errorId, onRetry, global = false }: ErrorStateProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-20">
      <section
        className="w-full rounded-2xl border border-white/10 bg-[#0d1420]/95 p-8 shadow-2xl sm:p-12"
        aria-labelledby="error-title"
      >
        <p className="text-sm font-semibold tracking-[0.24em] text-[var(--accent)] uppercase">
          Nexus Codex
        </p>
        <h1 id="error-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {global ? "Nexus Codex couldn’t start" : "Something went wrong"}
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">
          We couldn’t complete that request. You can try again or return home and continue from
          there.
        </p>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Error reference: <code className="text-[var(--foreground)]">{errorId}</code>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-[#07110f] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-white/20 px-5 py-3 font-semibold text-[var(--foreground)] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Return home
          </a>
        </div>
      </section>
    </main>
  );
}

