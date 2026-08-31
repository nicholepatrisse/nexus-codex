"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CharacterIdentity, type CharacterIdentityData } from "@/character/character-identity";

export type StyledSelectOption = {
  value: string;
  label: string;
  description?: string;
  metadata?: string;
  character?: CharacterIdentityData;
};

function OptionContent({ option, selected = false }: { option: StyledSelectOption; selected?: boolean }) {
  if (option.character) return <CharacterIdentity character={option.character} variant="dropdown-option" />;
  return <>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{option.label}</span>
      {option.description ? <span className={`mt-0.5 block truncate text-sm ${selected ? "text-on-brand/80" : "text-text-muted"}`}>{option.description}</span> : null}
    </span>
    {option.metadata ? <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? "border-on-brand/40 bg-on-brand/10 text-on-brand" : "border-border bg-surface text-text-muted"}`}>{option.metadata}</span> : null}
  </>;
}

export function StyledSelect({ name, label, value, options, disabled = false, invalid = false, required = false, onValueChange }: {
  name: string;
  label: string;
  value: string;
  options: readonly StyledSelectOption[];
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  function choose(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    if (disabled || options.length < 2) return;
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const next = options[(currentIndex + direction + options.length) % options.length];
    if (next) onValueChange(next.value);
    setOpen(true);
  }

  return <div ref={rootRef} className="relative mt-2">
    <input type="hidden" name={name} value={value} />
    <button id={name} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} aria-invalid={invalid} aria-required={required} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(event.key === "ArrowDown" ? 1 : -1); }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    }} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-4 py-2.5 text-left outline-none transition-colors hover:border-brand focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-muted disabled:opacity-70">
      <span className={`flex min-w-0 flex-1 items-center gap-3 ${value ? "text-text-primary" : "text-text-muted"}`}>{selected ? <OptionContent option={selected} /> : null}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.1 0L10 11l3.7-3.8a.75.75 0 1 1 1.1 1L10.5 13a.75.75 0 0 1-1.1 0L5.2 8.3a.75.75 0 0 1 0-1.1Z" clipRule="evenodd" /></svg>
    </button>
    {open && !disabled ? <div id={listboxId} role="listbox" aria-label={label} className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border-strong bg-surface-raised p-1.5 shadow-xl">
      {options.map((option) => { const isSelected = option.value === value; return <button key={option.value || "placeholder"} type="button" role="option" aria-selected={isSelected} onClick={() => choose(option.value)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${isSelected ? "bg-brand text-on-brand" : "text-text-primary hover:bg-surface-hover"}`}><OptionContent option={option} selected={isSelected} />{isSelected ? <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 10 4 4 8-8" /></svg> : null}</button>; })}
    </div> : null}
  </div>;
}
