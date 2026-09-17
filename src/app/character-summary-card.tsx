import Image from "next/image";
import Link from "next/link";
import { CharacterIdentity, type CharacterIdentityData } from "@/character/character-identity";
import { CharacterClassIcon } from "@/character/character-class-icon";
import type { CharacterValidationPresentation } from "@/character/character-validation-summary";

const validationStyles: Record<CharacterValidationPresentation, { rail: string; badge: string }> = {
  Validated: { rail: "text-success", badge: "border-success/35 bg-success/10 text-success" },
  "Needs Review": { rail: "text-warning", badge: "border-warning/35 bg-warning/10 text-warning" },
  "Rules Issue Found": { rail: "text-danger", badge: "border-danger/35 bg-danger/10 text-danger" },
};

export function CharacterSummaryCard({ character, validation }: { character: CharacterIdentityData & { id: string; portraitUrl?: string | null }; validation: CharacterValidationPresentation }) {
  const styles = validationStyles[validation];
  const portrait = character.portraitUrl || "/character-portrait-placeholder.png";
  const railGradientId = `character-rail-${character.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return <Link href={`/characters/${encodeURIComponent(character.id)}`} aria-label={`${character.name}, ${validation}`} className="character-card relative block min-h-24 select-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand">
    <span aria-hidden="true" className={`character-card-rail ${styles.rail}`}><svg viewBox="0 0 36 172" preserveAspectRatio="none"><defs><linearGradient id={railGradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--character-rail-shadow)" /><stop offset="0.32" stopColor="currentColor" /><stop offset="0.55" stopColor="var(--character-rail-highlight)" /><stop offset="0.78" stopColor="currentColor" /><stop offset="1" stopColor="var(--character-rail-shadow)" /></linearGradient></defs><path className="character-card-rail-mask" d="M0 0 H36 L7 32 H0 Z M0 144 H7 L22 172 H0 Z" /><path className="character-card-rail-cutout" d="M36 0 L7 32 L7 144 L22 172" fill="none" /><path d="M36 0 L7 32 L7 144 L22 172" fill="none" stroke={`url(#${railGradientId})`} strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter" /></svg></span>
    <span className="character-card-shell">
      <span className="character-card-portrait"><Image src={portrait} alt="" aria-hidden="true" fill sizes="(max-width: 639px) 88px, 160px" className="object-cover" /></span>
      <span className="character-card-content"><CharacterIdentity character={character} variant="selection" /><span className="mt-2 flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles.badge}`}>{validation}</span>{character.className ? <span className="character-card-chip">{character.className}</span> : null}{character.level != null ? <span className="character-card-chip">Level {character.level}</span> : null}</span></span>
      <span aria-hidden="true" className="character-card-class-icon"><CharacterClassIcon className={character.className} /></span>
      <span aria-hidden="true" className="character-card-arrow">›</span>
      <svg aria-hidden="true" className="character-card-shell-frame" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <path className="character-card-shell-frame-mobile" d="M100 2 H987 L998 13 V87 L987 98 H100" />
        <path className="character-card-shell-frame-desktop" d="M1 2 H987 L998 13 V87 L987 98 H1 Z" />
      </svg>
    </span>
  </Link>;
}
