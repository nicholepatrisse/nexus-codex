export const SFS2_BASE_CREDITS: Readonly<Record<number, number>> = { 1: 140, 2: 220, 3: 380, 4: 640, 5: 1000, 6: 1500, 7: 2200, 8: 3000, 9: 4400, 10: 6000 };

export type AdvancementSpeed = "standard" | "slow";
export type DowntimeProficiency = "trained" | "expert" | "master";
export type DowntimeDegree = "critical_success" | "success" | "failure" | "critical_failure";

const income: Record<number, { dc: number; failure: number; trained: number; expert: number; master?: number }> = {
  1: { dc: 14, failure: 8, trained: 8, expert: 8 }, 2: { dc: 14, failure: 8, trained: 8, expert: 8 },
  3: { dc: 15, failure: 8, trained: 16, expert: 16 }, 4: { dc: 16, failure: 8, trained: 24, expert: 24 },
  5: { dc: 18, failure: 8, trained: 40, expert: 40 }, 6: { dc: 19, failure: 8, trained: 56, expert: 64 },
  7: { dc: 20, failure: 16, trained: 72, expert: 80 }, 8: { dc: 22, failure: 24, trained: 120, expert: 160 },
  9: { dc: 23, failure: 32, trained: 160, expert: 200, master: 200 }, 10: { dc: 24, failure: 40, trained: 200, expert: 240, master: 240 },
  11: { dc: 0, failure: 0, trained: 240, expert: 320, master: 320 },
};

export function scenarioRewardDefaults(level: number, speed: AdvancementSpeed = "standard") {
  const divisor = speed === "slow" ? 2 : 1;
  const xp = 4 / divisor;
  return { xp, baseCreditsMinor: (SFS2_BASE_CREDITS[level] ?? 0) / divisor, downtimeDays: xp * 2 };
}

export function downtimeDegree(checkTotal: number, dc: number): DowntimeDegree {
  if (checkTotal >= dc + 10) return "critical_success";
  if (checkTotal >= dc) return "success";
  if (checkTotal <= dc - 10) return "critical_failure";
  return "failure";
}

export function calculateEarnIncome(level: number, checkTotal: number, proficiency: DowntimeProficiency, downtimeDays: number) {
  const row = income[level];
  if (!row || level > 10) throw new Error("Earn Income is only supported for SFS2 character levels 1–10.");
  const degree = downtimeDegree(checkTotal, row.dc);
  const resultLevel = degree === "critical_success" ? Math.max(3, level + 1) : level;
  const result = income[resultLevel]!;
  const eightDayCredits = degree === "critical_failure" ? 0 : degree === "failure" ? row.failure : result[proficiency] ?? result.expert;
  return { dc: row.dc, degree, calculatedCreditsMinor: eightDayCredits * downtimeDays / 8 };
}

export function totalChronicleCredits(baseCreditsMinor: number, downtimeCreditsMinor: number) { return baseCreditsMinor + downtimeCreditsMinor; }
