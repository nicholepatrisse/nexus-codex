import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

type AccentSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  enabled?: boolean;
  glow?: boolean;
  gradient?: boolean;
  illuminatedBorder?: boolean;
};

/** An opt-in decorative surface for high-level branded moments. */
export function AccentSurface({
  children,
  className,
  enabled = true,
  glow = true,
  gradient = true,
  illuminatedBorder = true,
  ...props
}: AccentSurfaceProps) {
  const accentClasses = classes(
    enabled && "accent-surface",
    enabled && glow && "accent-radial-glow",
    enabled && gradient && "accent-brand-gradient",
    enabled && illuminatedBorder && "accent-illuminated-border",
    className,
  );

  return (
    <div
      className={accentClasses || undefined}
      {...props}
    >
      {children}
    </div>
  );
}

type SparkAccentProps = {
  className?: string;
  size?: number;
};

/** A purely decorative four-point star using the semantic accent color. */
export function SparkAccent({ className, size = 18 }: SparkAccentProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      fill="none"
    >
      <path d="M12 1.5c.55 6.4 4.1 9.95 10.5 10.5-6.4.55-9.95 4.1-10.5 10.5C11.45 16.1 7.9 12.55 1.5 12 7.9 11.45 11.45 7.9 12 1.5Z" fill="var(--theme-accent)" />
    </svg>
  );
}

type OrbitMotifProps = {
  className?: string;
};

/** A low-contrast orbit/circuit motif intended for decorative backgrounds. */
export function OrbitMotif({ className }: OrbitMotifProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 240 120"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
    >
      <ellipse cx="120" cy="60" rx="91" ry="31" stroke="var(--theme-border-strong)" />
      <path d="M20 60h25m150 0h25M120 16V4m0 112v-12" stroke="var(--theme-brand)" strokeLinecap="round" />
      <circle cx="46" cy="42" r="3" fill="var(--theme-accent)" />
      <circle cx="194" cy="78" r="3" fill="var(--theme-accent-secondary)" />
    </svg>
  );
}

type AccentDividerProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

/** A branded divider that remains meaningful as a separator without its decoration. */
export function AccentDivider({ className, label, ...props }: AccentDividerProps) {
  return (
    <div
      className={classes("accent-divider", className)}
      role="separator"
      {...props}
    >
      {label ? <span className="accent-divider-label">{label}</span> : <SparkAccent size={12} />}
    </div>
  );
}

export const accentPosition = (x: string, y: string): CSSProperties => ({
  "--accent-glow-x": x,
  "--accent-glow-y": y,
} as CSSProperties);
