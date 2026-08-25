export type ErrorBoundaryKind = "route" | "global";

export interface ApplicationErrorReport {
  boundary: ErrorBoundaryKind;
  errorId: string;
  error: Error & { digest?: string };
}

/**
 * The production integration point for unexpected UI failures.
 *
 * Keep vendor-specific monitoring out of error boundaries. A future monitoring
 * adapter can replace this implementation without changing either fallback.
 */
export function reportApplicationError(report: ApplicationErrorReport): void {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${report.boundary} error: ${report.errorId}]`, report.error);
    return;
  }

  // Intentionally a no-op until a production monitoring provider is selected.
  // Never send reports containing request, session, or community data from here.
}

