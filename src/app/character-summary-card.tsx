import Link from "next/link";
import { CharacterIdentity, type CharacterIdentityData } from "@/character/character-identity";
import { CharacterClassIcon } from "@/character/character-class-icon";
import type { CharacterValidationPresentation } from "@/character/character-validation-summary";

const validationStyles: Record<CharacterValidationPresentation, { rail: string; badge: string }> = {
  Validated: { rail: "border-l-success", badge: "border-success/35 bg-success/10 text-success" },
  "Needs Review": { rail: "border-l-warning", badge: "border-warning/35 bg-warning/10 text-warning" },
  "Rules Issue Found": { rail: "border-l-danger", badge: "border-danger/35 bg-danger/10 text-danger" },
};

export function CharacterSummaryCard({ character, validation }: { character: CharacterIdentityData & { id: string }; validation: CharacterValidationPresentation }) {
  const styles = validationStyles[validation];
  return <Link href={`/characters/${encodeURIComponent(character.id)}`} aria-label={`${character.name}, ${validation}`} className={`card-standard card-interactive relative block min-h-24 select-none overflow-hidden rounded-2xl border-l-4 ${styles.rail} px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand sm:min-h-32 sm:px-6 sm:py-5`}>
    <div className="pr-28 sm:pr-32"><CharacterIdentity character={character} variant="selection" /><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles.badge}`}>{validation}</span></div>
    <span aria-hidden="true" className="absolute top-1/2 right-11 -translate-y-1/2 sm:right-14"><CharacterClassIcon className={character.className} /></span>
    <span aria-hidden="true" className="absolute top-1/2 right-4 -translate-y-1/2 text-2xl text-brand">›</span>
  </Link>;
}
