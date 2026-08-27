export type SessionLifecycleStatus = "draft" | "published" | "completed" | "cancelled";

export function sessionLifecycleLabel({ status, startsAt, paizoReportedAt, now = new Date() }: { status: SessionLifecycleStatus; startsAt: Date; paizoReportedAt?: Date | null; now?: Date }) {
  if (status === "cancelled") return { label: "Cancelled", tone: "danger" as const };
  if (status === "draft") return { label: "Draft", tone: "muted" as const };
  if (status === "completed" && paizoReportedAt) return { label: "Reporting complete", tone: "success" as const };
  if (status === "completed") return { label: "Chronicles issued", tone: "info" as const };
  if (startsAt < now) return { label: "Awaiting reporting", tone: "warning" as const };
  return { label: "Upcoming", tone: "success" as const };
}

export function SessionStatusPill(props: { status: SessionLifecycleStatus; startsAt: Date; paizoReportedAt?: Date | null; now?: Date }) {
  const state = sessionLifecycleLabel(props);
  const tones = { danger: "border-danger/30 bg-danger/10 text-danger", muted: "border-border bg-surface-raised text-text-muted", success: "border-success/30 bg-success/10 text-success", info: "border-info/30 bg-info/10 text-info", warning: "border-warning/30 bg-warning/10 text-warning" };
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[state.tone]}`}>{state.label}</span>;
}
