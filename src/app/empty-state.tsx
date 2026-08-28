import type { ElementType, ReactNode } from "react";

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  align = "left",
  as: Component = "div",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  align?: "left" | "center";
  as?: ElementType;
  className?: string;
}) {
  return (
    <Component className={classes("card-subtle border-dashed p-6", align === "center" && "text-center", className)}>
      <div className={classes("flex items-center gap-2 font-semibold", align === "center" && "justify-center")}>
        {icon}
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {description ? <p className="mt-2 leading-6 text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Component>
  );
}
