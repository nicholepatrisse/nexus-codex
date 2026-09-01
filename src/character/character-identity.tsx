import type { ReactNode } from "react";
import { CharacterClassIcon } from "@/character/character-class-icon";

export type CharacterIdentityData = { name: string; societyNumber?: string | null; level?: number | null; className?: string | null; ancestry?: string | null; background?: string | null; totalXp?: number | null };
export type CharacterIdentityVariant = "compact" | "selection" | "dropdown-option" | "detail";

/** Canonical labels and ordering for character identity everywhere it is summarized. */
export function characterIdentityFields(character: CharacterIdentityData) {
  return [
    character.societyNumber ? { label: "Society #", value: character.societyNumber } : null,
    character.level != null ? { label: "Level", value: String(character.level) } : null,
    character.className ? { label: "Class", value: character.className } : null,
    character.ancestry ? { label: "Ancestry", value: character.ancestry } : null,
    character.background ? { label: "Background", value: character.background } : null,
    character.totalXp != null ? { label: "XP", value: String(character.totalXp) } : null,
  ].filter((field): field is { label: string; value: string } => field !== null);
}

export function formatCharacterIdentityText(character: CharacterIdentityData) {
  return [character.name, ...characterIdentityFields(character).map(({ label, value }) => `${label} ${value}`)].join(" · ");
}

export function characterIdentityCompactValues(character: CharacterIdentityData) {
  return [
    character.level != null ? `Level ${character.level}` : null,
    character.ancestry,
    character.background,
    character.className,
  ].filter((value): value is string => Boolean(value));
}

/** Class artwork is reserved for compact index summaries; denser variants retain class text. */
export function CharacterIdentity({ character, variant = "compact", name, supplementary }: { character: CharacterIdentityData; variant?: CharacterIdentityVariant; name?: ReactNode; supplementary?: ReactNode }) {
  const fields = characterIdentityFields(character);
  const renderedName = name ?? character.name;
  if (variant === "detail") return <div className="min-w-0"><p className="break-words font-semibold">{renderedName}</p>{fields.length ? <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">{fields.map(({ label, value }) => <div className="contents" key={label}><dt className="text-text-muted">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl> : null}</div>;
  const metadata = [...fields.map(({ label, value }) => `${label} ${value}`), ...(supplementary != null ? [supplementary] : [])];
  return <span className={`flex min-w-0 items-center ${variant === "compact" ? "h-full gap-3" : "gap-0"}`}><span className="min-w-0 flex-1"><span className="block break-words font-semibold text-text-primary">{renderedName}</span>{metadata.length ? <span className={`mt-1 block text-sm leading-5 text-text-muted ${variant === "dropdown-option" ? "truncate" : "break-words"}`}>{metadata.map((item, index) => <span key={index}>{index ? " · " : null}{item}</span>)}</span> : null}</span>{variant === "compact" ? <CharacterClassIcon className={character.className} /> : null}</span>;
}
