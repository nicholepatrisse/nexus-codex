import { StatusBadge } from "@/app/status-badge";

export function GmCreditBadge({ className = "" }: { className?: string }) {
  return <StatusBadge ariaLabel="Earned as GM Credit" tone="info" className={className}>GM Credit</StatusBadge>;
}
