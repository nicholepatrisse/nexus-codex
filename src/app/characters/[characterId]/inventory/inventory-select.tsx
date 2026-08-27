"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface InventorySelectOption { value: string; label: string }

export function InventorySelect({ name, defaultValue, options, invalid = false, onValueChange }: { name: string; defaultValue: string; options: readonly InventorySelectOption[]; invalid?: boolean; onValueChange?: (value: string) => void }) {
  const [value, setValue] = useState(defaultValue);
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
    setValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const next = options[(currentIndex + direction + options.length) % options.length];
    if (next) { setValue(next.value); onValueChange?.(next.value); }
    setOpen(true);
  }

  return <div ref={rootRef} className="relative mt-2">
    <input type="hidden" name={name} value={value} />
    <button id={name} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} aria-invalid={invalid} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(event.key === "ArrowDown" ? 1 : -1); }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    }} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-4 py-2.5 text-left outline-none transition-colors hover:border-brand focus:border-brand focus:ring-3 focus:ring-brand/20">
      <span className={value ? "flex-1 text-text-primary" : "flex-1 text-text-muted"}>{selected?.label}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.1 0L10 11l3.7-3.8a.75.75 0 1 1 1.1 1L10.5 13a.75.75 0 0 1-1.1 0L5.2 8.3a.75.75 0 0 1 0-1.1Z" clipRule="evenodd" /></svg>
    </button>
    {open ? <div id={listboxId} role="listbox" aria-label={name === "acquisitionType" ? "Acquisition type" : "Source Chronicle"} className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border-strong bg-surface-raised p-1.5 shadow-xl">
      {options.map((option) => { const isSelected = option.value === value; return <button key={option.value || "none"} type="button" role="option" aria-selected={isSelected} onClick={() => choose(option.value)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${isSelected ? "bg-brand text-on-brand" : "text-text-primary hover:bg-surface-hover"}`}><span className="flex-1">{option.label}</span>{isSelected ? <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 10 4 4 8-8" /></svg> : null}</button>; })}
    </div> : null}
  </div>;
}
