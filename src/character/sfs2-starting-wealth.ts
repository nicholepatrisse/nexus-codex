export const SFS2_STARTING_WEALTH = {
  1: [{ credits: 150, label: "150 credits", kind: "credits_only" }],
  3: [
    { credits: 750, label: "750 credits", kind: "credits_only" },
    { credits: 250, label: "One 2nd-level item, two 1st-level items, and 250 credits", kind: "permanent_items" },
  ],
  5: [
    { credits: 2700, label: "2,700 credits", kind: "credits_only" },
    { credits: 500, label: "One 4th-level item, two 3rd-level items, one 2nd-level item, two 1st-level items, and 500 credits", kind: "permanent_items" },
  ],
  7: [
    { credits: 7200, label: "7,200 credits", kind: "credits_only" },
    { credits: 1250, label: "One 6th-level item, two 5th-level items, one 4th-level item, two 3rd-level items, and 1,250 credits", kind: "permanent_items" },
  ],
} as const;

export type Sfs2StartingLevel = keyof typeof SFS2_STARTING_WEALTH;

export const SFS2_STARTING_ITEM_LEVELS: Record<Sfs2StartingLevel, readonly number[]> = {
  1: [],
  3: [2, 1, 1],
  5: [4, 3, 3, 2, 1, 1],
  7: [6, 5, 5, 4, 3, 3],
};

export function startingWealthOptions(level: Sfs2StartingLevel) {
  return SFS2_STARTING_WEALTH[level];
}

export function isValidStartingCredits(level: Sfs2StartingLevel, credits: number) {
  return startingWealthOptions(level).some((option) => option.credits === credits);
}

export function startingWealthNote(level: Sfs2StartingLevel, credits: number) {
  const option = startingWealthOptions(level).find((candidate) => candidate.credits === credits);
  return option?.kind === "permanent_items" ? "Starting wealth — permanent items option" : "Starting wealth — credits-only option";
}

export function usesPermanentStartingItems(level: Sfs2StartingLevel, credits: number) {
  return startingWealthOptions(level).some((option) => option.credits === credits && option.kind === "permanent_items");
}
