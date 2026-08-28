import type { ReactNode } from "react";

export function SelectionCard({ name, value, title, description, metadata, checked, defaultChecked, required, disabled, onChange }: {
  name: string;
  value: string | number;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  required?: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return <label className="card-standard card-interactive group relative flex min-h-16 items-start gap-3 p-4 has-checked:card-selected has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:translate-y-0">
    <input type="radio" name={name} value={value} checked={checked} defaultChecked={defaultChecked} required={required} disabled={disabled} onChange={onChange} className="peer sr-only" />
    <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface shadow-inner transition peer-checked:border-[5px] peer-checked:border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-brand" />
    <span className="min-w-0 flex-1"><span className="block font-semibold text-text-primary">{title}</span>{description ? <span className="mt-1 block text-sm leading-6 text-text-muted">{description}</span> : null}</span>
    {metadata ? <span className="shrink-0 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-semibold text-text-muted shadow-sm">{metadata}</span> : null}
  </label>;
}
