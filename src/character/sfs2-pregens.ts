export const SFS2_PREGEN_LEVELS = [1, 3, 5, 7] as const;

export function isValidPregenLevel(minimumLevel: number, maximumLevel: number, pregenLevel: number) {
  return SFS2_PREGEN_LEVELS.some((level) => level === pregenLevel) && pregenLevel >= minimumLevel && pregenLevel <= maximumLevel;
}

export function defaultPregenLevel(minimumLevel?: number, maximumLevel?: number) {
  return SFS2_PREGEN_LEVELS.find((level) => (minimumLevel == null || level >= minimumLevel) && (maximumLevel == null || level <= maximumLevel)) ?? SFS2_PREGEN_LEVELS[0];
}
