export const CHARACTER_CLASSES = ["Envoy", "Mystic", "Operative", "Solarian", "Soldier", "Witchwarper"] as const;

export type CharacterClass = (typeof CHARACTER_CLASSES)[number];
