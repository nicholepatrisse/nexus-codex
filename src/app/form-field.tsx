import { useId, type ReactNode } from "react";

export type FormFieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid": boolean;
};

type FormFieldProps = {
  id?: string;
  label: ReactNode;
  optional?: boolean;
  description?: ReactNode;
  errors?: string | string[];
  className?: string;
  children: (controlProps: FormFieldControlProps) => ReactNode;
};

export function FormField({ id: suppliedId, label, optional = false, description, errors, className, children }: FormFieldProps) {
  const generatedId = useId();
  const id = suppliedId ?? `field-${generatedId.replaceAll(":", "")}`;
  const error = Array.isArray(errors) ? errors[0] : errors;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return <div className={className}>
    <label htmlFor={id} className="block text-sm font-semibold">
      {label} <span className="font-normal text-text-muted">({optional ? "optional" : "required"})</span>
    </label>
    <div className="mt-2">{children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}</div>
    {description ? <p id={descriptionId} className="mt-2 text-sm text-text-muted">{description}</p> : null}
    {error ? <p id={errorId} role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
  </div>;
}
