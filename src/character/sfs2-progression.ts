export const SFS2_XP_PER_LEVEL = 12;
export const SFS2_MAXIMUM_LEVEL = 20;
export const SFS2_SUPPORTED_STARTING_LEVELS = [1, 3, 5, 7] as const;

export type Sfs2StartingLevel = (typeof SFS2_SUPPORTED_STARTING_LEVELS)[number];

export interface Sfs2Progression {
  totalXp: number;
  currentLevel: number;
  atLevelCap: boolean;
}

/** Starfinder Society 2E progression from immutable starting level and applied XP rewards. */
export function deriveSfs2Progression(startingLevel: number, appliedXpRewards: Iterable<number>): Sfs2Progression {
  if (!SFS2_SUPPORTED_STARTING_LEVELS.includes(startingLevel as Sfs2StartingLevel)) {
    throw new RangeError(`Unsupported Starfinder Society 2E starting level: ${startingLevel}.`);
  }

  let totalXp = 0;
  for (const reward of appliedXpRewards) {
    if (!Number.isSafeInteger(reward) || reward < 0) {
      throw new RangeError(`Invalid Starfinder Society 2E XP reward: ${reward}.`);
    }
    const nextTotal = totalXp + reward;
    if (!Number.isSafeInteger(nextTotal)) {
      throw new RangeError("Starfinder Society 2E total XP exceeds the supported numeric range.");
    }
    totalXp = nextTotal;
  }

  const uncappedLevel = startingLevel + Math.floor(totalXp / SFS2_XP_PER_LEVEL);
  return {
    totalXp,
    currentLevel: Math.min(uncappedLevel, SFS2_MAXIMUM_LEVEL),
    atLevelCap: uncappedLevel >= SFS2_MAXIMUM_LEVEL,
  };
}
