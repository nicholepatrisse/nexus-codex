"use client";
import { useState, type ReactNode } from "react";

export const characterFormSectionByField: Record<string, string> = {
  name: "core-identity",
  characterNumber: "core-identity",
  className: "core-identity",
  ancestry: "core-identity",
  ancestrySourceChronicleId: "core-identity",
  background: "core-identity",
  backgroundSourceChronicleId: "core-identity",
  startingLevel: "society-setup",
  startingCredits: "society-setup",
  startingItems: "society-setup",
  characterOptions: "heritage-feats-section",
  backstory: "notes",
  notes: "notes",
};

export function expandCharacterFormSection(form: HTMLFormElement, fieldName: string) {
  const sectionId = characterFormSectionByField[fieldName];
  const section = sectionId ? form.querySelector<HTMLDetailsElement>(`#${sectionId}`) : null;
  if (!section) return false;
  section.open = true;
  return true;
}

export function focusFirstCharacterFormError(form: HTMLFormElement, fieldErrors: Record<string, string[] | undefined>) {
  const invalidFields = new Set(Object.entries(fieldErrors).filter(([, errors]) => errors?.length).map(([name]) => name));
  for (const name of invalidFields) expandCharacterFormSection(form, name);
  const controls = [...form.querySelectorAll<HTMLElement>('input:not([type="hidden"]), button, textarea, select, [role="radiogroup"], [tabindex]')];
  const target = controls.find((control) => control.getAttribute("aria-invalid") === "true" || invalidFields.has(control.getAttribute("name") ?? "") || invalidFields.has(control.id));
  if (!target) return false;
  const focusTarget = target.getAttribute("role") === "radiogroup" ? target.querySelector<HTMLElement>('input:not([type="hidden"])') ?? target : target;
  focusTarget.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

export function CharacterFormSection({ id, title, summary, children, defaultOpen = false, hasError = false }: { id: string; title: string; summary: ReactNode; children: ReactNode; defaultOpen?: boolean; hasError?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || hasError);
  return <details id={id} className={`group scroll-mt-6 rounded-2xl border bg-surface ${hasError ? "border-danger" : "border-border"}`} open={open || hasError} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 marker:content-none focus-visible:outline-3 focus-visible:outline-brand sm:px-5">
      <span><span className="block font-semibold">{title}</span><span className={`mt-0.5 block text-sm ${hasError ? "text-danger" : "text-text-muted"}`}>{hasError ? "Needs attention · " : ""}{summary}</span></span>
      <span aria-hidden="true" className="text-xl text-text-muted transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <div className="border-t border-border px-4 py-5 sm:px-5">{children}</div>
  </details>;
}
