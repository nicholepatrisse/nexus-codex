import Image from "next/image";
import type { CharacterClass } from "@/character/class-options";

type ClassIcon = { label: string; src: string };

const classIcons: Record<Lowercase<CharacterClass>, ClassIcon> = {
  envoy: { label: "Envoy", src: "/character-class-icons/envoy.png" },
  mystic: { label: "Mystic", src: "/character-class-icons/mystic.png" },
  operative: { label: "Operative", src: "/character-class-icons/operative.png" },
  solarian: { label: "Solarian", src: "/character-class-icons/solarian.png" },
  soldier: { label: "Soldier", src: "/character-class-icons/soldier.png" },
  witchwarper: { label: "Witchwarper", src: "/character-class-icons/witchwarper.png" },
};

export function getCharacterClassIcon(className: string | null | undefined): ClassIcon | null {
  const normalizedClassName = className?.trim().toLowerCase() ?? "";
  return classIcons[normalizedClassName as Lowercase<CharacterClass>] ?? null;
}

export function CharacterClassIcon({ className }: { className: string | null | undefined }) {
  const icon = getCharacterClassIcon(className);
  if (!icon) return null;
  const accessibleLabel = `Class: ${icon.label}`;

  return <span className="inline-flex size-20 shrink-0 items-center justify-center sm:size-24" aria-label={accessibleLabel} title={accessibleLabel}>
    <Image src={icon.src} alt="" aria-hidden="true" width={96} height={96} className="size-full object-contain" />
  </span>;
}
