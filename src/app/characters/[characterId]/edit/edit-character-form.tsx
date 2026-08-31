"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { SelectionCard } from "@/app/selection-card";
import { StyledSelect } from "@/app/styled-select";
import { StartingItemPicker, type StartingItemSelection } from "@/app/characters/new/starting-item-picker";
import { CharacterClassSelect } from "@/character/character-class-select";
import { CharacterClassIcon } from "@/character/character-class-icon";
import type { CharacterDetail } from "@/character/characters";
import { SFS2_STARTING_ITEM_LEVELS, SFS2_STARTING_WEALTH, type Sfs2StartingLevel } from "@/character/sfs2-starting-wealth";
import { updateCharacterAction, type EditCharacterFormState } from "./actions";

const inputClass = "w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand";
function SubmitButton({ disabled }: { disabled: boolean }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending || disabled} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : "Save changes"}</button>; }

export function EditCharacterForm({ character }: { character: CharacterDetail }) {
  const action = updateCharacterAction.bind(null, character.id);
  const [state, formAction] = useActionState<EditCharacterFormState, FormData>(action, {});
  const [className, setClassName] = useState(character.className ?? "");
  const [startingLevel, setStartingLevel] = useState<Sfs2StartingLevel>(character.startingLevel as Sfs2StartingLevel);
  const [startingCredits, setStartingCredits] = useState(character.startingCredits);
  const [startingItems, setStartingItems] = useState<(StartingItemSelection | undefined)[]>(character.startingItems);
  const usesItems = SFS2_STARTING_WEALTH[startingLevel].some((option) => option.kind === "permanent_items" && option.credits === startingCredits);
  const missingStartingItems = usesItems && startingItems.filter(Boolean).length !== SFS2_STARTING_ITEM_LEVELS[startingLevel].length;
  const field = (name: string) => state.fieldErrors?.[name]?.[0];
  return <form action={formAction} className="relative mt-10 space-y-6" noValidate>
    <div className="absolute -top-32 right-0"><CharacterClassIcon className={className} /></div>
    {!character.startingLevelLocked ? <input type="hidden" name="startingItems" value={JSON.stringify(startingItems.filter(Boolean))} /> : null}
    <div><label htmlFor="name" className="block text-sm font-semibold">Character name</label><input id="name" name="name" required maxLength={100} defaultValue={character.name} aria-invalid={Boolean(field("name"))} className={`mt-2 ${inputClass}`} />{field("name") ? <p role="alert" className="mt-2 text-sm text-danger">{field("name")}</p> : null}</div>
    <div className="grid gap-5 sm:grid-cols-2">
      <div>{character.startingLevelLocked ? <><span className="block text-sm font-semibold">Current level</span><div className={`mt-2 ${inputClass}`} aria-describedby="starting-level-locked">{character.currentLevel}</div><p id="starting-level-locked" className="mt-2 text-sm text-text-muted">Starting level and wealth are locked after Society play is recorded.</p></> : <><label htmlFor="startingLevel" className="block text-sm font-semibold">Starting level</label><StyledSelect name="startingLevel" label="Starting level" value={String(startingLevel)} invalid={Boolean(field("startingLevel"))} required options={([1, 3, 5, 7] as const).map((level) => ({ value: String(level), label: String(level) }))} onValueChange={(value) => { const level = Number(value) as Sfs2StartingLevel; setStartingLevel(level); setStartingCredits(SFS2_STARTING_WEALTH[level][0].credits); setStartingItems([]); }} />{field("startingLevel") ? <p role="alert" className="mt-2 text-sm text-danger">{field("startingLevel")}</p> : null}</>}</div>
      <div><label htmlFor="className" className="block text-sm font-semibold">Class <span className="font-normal text-text-muted">(optional)</span></label><CharacterClassSelect defaultValue={character.className} invalid={Boolean(field("className"))} onValueChange={setClassName} />{field("className") ? <p role="alert" className="mt-2 text-sm text-danger">{field("className")}</p> : null}</div>
      <div><label htmlFor="background" className="block text-sm font-semibold">Background <span className="font-normal text-text-muted">(optional)</span></label><input id="background" name="background" maxLength={100} defaultValue={character.background ?? ""} aria-invalid={Boolean(field("background"))} className={`mt-2 ${inputClass}`} />{field("background") ? <p role="alert" className="mt-2 text-sm text-danger">{field("background")}</p> : null}</div>
      <div><label htmlFor="ancestry" className="block text-sm font-semibold">Ancestry <span className="font-normal text-text-muted">(optional)</span></label><input id="ancestry" name="ancestry" maxLength={100} defaultValue={character.ancestry ?? ""} aria-invalid={Boolean(field("ancestry"))} className={`mt-2 ${inputClass}`} />{field("ancestry") ? <p role="alert" className="mt-2 text-sm text-danger">{field("ancestry")}</p> : null}</div>
      {!character.startingLevelLocked ? <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold">Starting wealth</legend><p className="mt-1 text-sm text-text-muted">Choose one option for your level {startingLevel} character.</p><div className={`mt-3 grid gap-3 ${SFS2_STARTING_WEALTH[startingLevel].length > 1 ? "sm:grid-cols-2" : ""}`}>{SFS2_STARTING_WEALTH[startingLevel].map((option) => <SelectionCard key={option.credits} name="startingCredits" value={option.credits} required title={option.kind === "credits_only" ? "Credits only" : "Permanent items"} description={option.label} checked={startingCredits === option.credits} onChange={() => { setStartingCredits(option.credits); setStartingItems([]); }} />)}</div>{field("startingCredits") ? <p role="alert" className="mt-2 text-sm text-danger">{field("startingCredits")}</p> : null}</fieldset> : null}
      {!character.startingLevelLocked && usesItems ? <div className="sm:col-span-2"><StartingItemPicker levels={SFS2_STARTING_ITEM_LEVELS[startingLevel]} selections={startingItems} onChange={setStartingItems} />{field("startingItems") ? <p role="alert" className="mt-2 text-sm text-danger">{field("startingItems")}</p> : null}</div> : null}
      <div className="sm:col-span-2"><label htmlFor="backstory" className="block text-sm font-semibold">Backstory <span className="font-normal text-text-muted">(optional)</span></label><textarea id="backstory" name="backstory" rows={6} maxLength={5000} defaultValue={character.backstory ?? ""} aria-invalid={Boolean(field("backstory"))} className={`mt-2 resize-y ${inputClass}`} />{field("backstory") ? <p role="alert" className="mt-2 text-sm text-danger">{field("backstory")}</p> : null}</div>
      <div className="sm:col-span-2"><label htmlFor="notes" className="block text-sm font-semibold">Notes <span className="font-normal text-text-muted">(optional)</span></label><textarea id="notes" name="notes" rows={6} maxLength={5000} defaultValue={character.notes ?? ""} aria-invalid={Boolean(field("notes"))} className={`mt-2 resize-y ${inputClass}`} />{field("notes") ? <p role="alert" className="mt-2 text-sm text-danger">{field("notes")}</p> : null}</div>
    </div>
    {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
    <div className="flex items-center gap-4"><SubmitButton disabled={missingStartingItems} /><Link href={`/characters/${character.id}`} className="text-sm text-text-muted hover:text-text-primary">Cancel</Link></div>
  </form>;
}
