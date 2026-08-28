import type { ReactNode } from "react";

const tabBaseClassName = "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-4 sm:py-3";

export function tabClassName(selected: boolean, className = "") {
  return `${tabBaseClassName} ${selected ? "border-brand text-brand" : "border-transparent text-text-muted hover:border-border-strong hover:text-text-primary"} ${className}`;
}

export function TabRow({ children, className = "", tabListLabel }: { children: ReactNode; className?: string; tabListLabel?: string }) {
  return <div className={`overflow-x-auto border-b border-border ${className}`}>
    <div className="flex min-w-max gap-1" role={tabListLabel ? "tablist" : undefined} aria-label={tabListLabel}>
      {children}
    </div>
  </div>;
}
