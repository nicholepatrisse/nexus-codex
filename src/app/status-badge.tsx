import type { ReactNode } from "react";

const tones = {
  neutral: "border-border-strong bg-surface-raised text-text-muted",
  brand: "border-brand/40 bg-brand/10 text-brand",
  info: "border-info/40 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
} as const;

export function StatusBadge({ children, tone = "neutral", className = "", ariaLabel }: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
  ariaLabel?: string;
}) {
  return <span aria-label={ariaLabel} className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}
