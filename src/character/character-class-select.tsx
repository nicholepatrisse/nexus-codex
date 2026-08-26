"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { CHARACTER_CLASSES, type CharacterClass } from "@/character/class-options";
import { getCharacterClassIcon } from "@/character/character-class-icon";

function isCharacterClass(value: string): value is CharacterClass {
  return CHARACTER_CLASSES.some((className) => className === value);
}

export function CharacterClassSelect({ defaultValue, invalid = false, onValueChange }: { defaultValue?: string | null; invalid?: boolean; onValueChange?: (value: CharacterClass | "") => void }) {
  const initialValue = defaultValue && isCharacterClass(defaultValue) ? defaultValue : "";
  const [value, setValue] = useState<CharacterClass | "">(initialValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const options: readonly (CharacterClass | "")[] = ["", ...CHARACTER_CLASSES];

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  function select(nextValue: CharacterClass | "") {
    setValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    const currentIndex = options.indexOf(value);
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    const nextValue = options[nextIndex] ?? "";
    setValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(true);
  }

  const selectedIcon = value ? getCharacterClassIcon(value) : null;

  return <div ref={rootRef} className="relative mt-2">
    <input type="hidden" name="className" value={value} />
    <button id="className" type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} aria-invalid={invalid} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(event.key === "ArrowDown" ? 1 : -1); }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    }} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-4 py-2.5 text-left outline-none transition-colors hover:border-brand focus:border-brand focus:ring-3 focus:ring-brand/20">
      {selectedIcon ? <Image src={selectedIcon.src} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" /> : null}
      <span className={value ? "flex-1 text-text-primary" : "flex-1 text-text-muted"}>{value || "No class selected"}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.1 0L10 11l3.7-3.8a.75.75 0 1 1 1.1 1L10.5 13a.75.75 0 0 1-1.1 0L5.2 8.3a.75.75 0 0 1 0-1.1Z" clipRule="evenodd" /></svg>
    </button>
    {open ? <div id={listboxId} role="listbox" aria-label="Character class" className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border-strong bg-surface-raised p-1.5 shadow-xl">
      {options.map((option) => {
        const icon = option ? getCharacterClassIcon(option) : null;
        const selected = option === value;
        return <button key={option || "none"} type="button" role="option" aria-selected={selected} onClick={() => select(option)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${selected ? "bg-brand text-on-brand" : "text-text-primary hover:bg-surface-hover"}`}>
          <span className="flex size-8 shrink-0 items-center justify-center">{icon ? <Image src={icon.src} alt="" width={32} height={32} className="size-8 object-contain" /> : <span aria-hidden="true" className={`size-2 rounded-full border ${selected ? "border-on-brand" : "border-border-strong"}`} />}</span>
          <span className="flex-1">{option || "No class selected"}</span>
          {selected ? <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 10 4 4 8-8" /></svg> : null}
        </button>;
      })}
    </div> : null}
  </div>;
}
