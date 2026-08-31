import type { ReactNode } from "react";

type Density = "compact" | "comfortable";
type Columns = 1 | 2 | 3;

const densityClasses: Record<Density, string> = {
  compact: "gap-x-4 gap-y-2",
  comfortable: "gap-x-6 gap-y-5",
};

const columnClasses: Record<Columns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function DescriptionList({ children, density = "comfortable", columns = 1, className = "" }: {
  children: ReactNode;
  density?: Density;
  columns?: Columns;
  className?: string;
}) {
  return <dl className={`grid min-w-0 ${densityClasses[density]} ${columnClasses[columns]} ${className}`}>{children}</dl>;
}

export function DescriptionItem({ label, children, empty = "omit", placeholder = "—", className = "", valueClassName = "" }: {
  label: ReactNode;
  children?: ReactNode;
  empty?: "omit" | "placeholder";
  placeholder?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  const missing = children === null || children === undefined || children === "";
  if (missing && empty === "omit") return null;

  return <div className={`min-w-0 ${className}`}>
    <dt className="text-sm leading-5 text-text-muted">{label}</dt>
    <dd className={`mt-1 min-w-0 break-words font-semibold ${missing ? "text-text-muted" : "text-text-primary"} ${valueClassName}`}>{missing ? placeholder : children}</dd>
  </div>;
}
