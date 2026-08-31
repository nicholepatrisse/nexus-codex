export const SFS2_PREGEN_LEVELS = [1, 3, 5, 7] as const;

/** Published Starfinder iconic characters offered by the lightweight signup flow. */
export const SFS2_PREGENS = ["Chk Chk", "Dae", "Iseph", "Navasi"] as const;

export const SFS2_PREGEN_CLASSES: Record<(typeof SFS2_PREGENS)[number], string> = {
  "Chk Chk": "Soldier",
  Dae: "Mystic",
  Iseph: "Operative",
  Navasi: "Envoy",
};

export function isValidPregenLevel(minimumLevel: number, maximumLevel: number, pregenLevel: number) {
  return SFS2_PREGEN_LEVELS.some((level) => level === pregenLevel) && pregenLevel >= minimumLevel && pregenLevel <= maximumLevel;
}

export function defaultPregenLevel(minimumLevel?: number, maximumLevel?: number) {
  return SFS2_PREGEN_LEVELS.find((level) => (minimumLevel == null || level >= minimumLevel) && (maximumLevel == null || level <= maximumLevel)) ?? SFS2_PREGEN_LEVELS[0];
}
