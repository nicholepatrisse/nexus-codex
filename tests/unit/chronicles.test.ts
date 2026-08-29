import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manualChronicleInputSchema, parseManualChronicleInput } from "@/character/chronicles";
import { creditAdjustmentInputSchema, formatCredits } from "@/character/credit-ledger";
import { calculateEarnIncome, scenarioRewardDefaults } from "@/character/sfs2-chronicle-rewards";

const valid = { scenarioNumber: " 1-01 ", scenarioName: "  The Commencement ", datePlayed: "2026-08-25", characterLevel: "3", advancementSpeed: "standard" as const, xp: "4", baseCreditsMinor: "380", downtimeDisposition: "declined" as const, eventName: "Starfinder Nexus", eventCode: "2,690,298", playerNotes: "  Great table.  " };

describe("manual Chronicles", () => {
  it.each([1, 3, 5, 7])("accepts published Iconic Pregen level %i", (characterLevel) => {
    expect(manualChronicleInputSchema.safeParse({ ...valid, creditType: "pregen", characterLevel }).success).toBe(true);
  });

  it.each([2, 4, 6, 8])("rejects unavailable Iconic Pregen level %i", (characterLevel) => {
    expect(manualChronicleInputSchema.safeParse({ ...valid, creditType: "pregen", characterLevel }).success).toBe(false);
  });

  it("trims snapshots and notes while preserving rewards as exact integers", () => {
    expect(parseManualChronicleInput(valid, new Date("2026-08-26T12:00:00Z"))).toEqual(expect.objectContaining({ contentItemId: null, scenarioNumber: "1-01", scenarioName: "The Commencement", datePlayed: "2026-08-25", characterLevel: 3, advancementSpeed: "standard", xp: 4, baseCreditsMinor: 380, downtimeDisposition: "declined", playerNotes: "Great table." }));
  });

  it("prefills SFS2 rewards and calculates Earn Income from the official table", () => {
    expect(scenarioRewardDefaults(1)).toEqual({ xp: 4, baseCreditsMinor: 140, downtimeDays: 8 });
    expect(scenarioRewardDefaults(2)).toEqual({ xp: 4, baseCreditsMinor: 220, downtimeDays: 8 });
    expect(scenarioRewardDefaults(1, "slow")).toEqual({ xp: 2, baseCreditsMinor: 70, downtimeDays: 4 });
    expect(calculateEarnIncome(3, 25, "trained", 8)).toEqual({ dc: 15, degree: "critical_success", calculatedCreditsMinor: 24 });
    expect(calculateEarnIncome(10, 14, "master", 8)).toEqual({ dc: 24, degree: "critical_failure", calculatedCreditsMinor: 0 });
  });

  it("accepts either a calculated check or credits copied from a physical Chronicle", () => {
    expect(manualChronicleInputSchema.safeParse({ ...valid, downtimeDisposition: "earn_income", downtimeEntryMethod: "calculated", downtimeCheckTotal: 20, downtimeProficiency: "trained" }).success).toBe(true);
    expect(manualChronicleInputSchema.safeParse({ ...valid, downtimeDisposition: "earn_income", downtimeEntryMethod: "sheet", downtimeSheetCreditsMinor: 32 }).success).toBe(true);
    expect(manualChronicleInputSchema.safeParse({ ...valid, downtimeDisposition: "earn_income", downtimeEntryMethod: "sheet" }).success).toBe(false);
  });

  it("requires event details", () => {
    expect(manualChronicleInputSchema.safeParse({ ...valid, eventName: "" }).success).toBe(false);
    expect(manualChronicleInputSchema.safeParse({ ...valid, eventCode: "" }).success).toBe(false);
  });

  it("accepts today but rejects future dates, fractions, negative rewards, invalid levels, and oversized notes", () => {
    expect(parseManualChronicleInput({ ...valid, datePlayed: "2026-08-26" }, new Date("2026-08-26T12:00:00Z")).datePlayed).toBe("2026-08-26");
    expect(() => parseManualChronicleInput({ ...valid, datePlayed: "2026-08-27" }, new Date("2026-08-26T12:00:00Z"))).toThrow("Play date cannot be in the future");
    for (const input of [{ ...valid, xp: "1.5" }, { ...valid, baseCreditsMinor: "-1" }, { ...valid, characterLevel: "21" }, { ...valid, playerNotes: "x".repeat(5001) }]) expect(manualChronicleInputSchema.safeParse(input).success).toBe(false);
  });

  it("keeps ledger amounts exact and permits signed owner adjustments", () => {
    expect(creditAdjustmentInputSchema.parse({ amountMinor: "-125", effectiveOn: "2026-08-25", notes: " correction " })).toEqual({ amountMinor: -125, effectiveOn: "2026-08-25", notes: "correction" });
    expect(creditAdjustmentInputSchema.safeParse({ amountMinor: "0.1", effectiveOn: "2026-08-25", notes: "fraction" }).success).toBe(false);
    expect(formatCredits(-125)).toBe("-125");
  });

  it("ships database constraints, provenance guards, deterministic ordering, and confirmation", () => {
    const migration = readFileSync(new URL("../../drizzle/0025_woozy_lenny_balinger.sql", import.meta.url), "utf8");
    const service = readFileSync(new URL("../../src/character/chronicles.ts", import.meta.url), "utf8");
    const button = readFileSync(new URL("../../src/app/characters/[characterId]/chronicles/delete-chronicle-button.tsx", import.meta.url), "utf8");
    expect(migration).toContain('CREATE TABLE "chronicles"');
    expect(migration).toContain('"credits_minor" integer NOT NULL');
    expect(service).toContain("const chronicleOrder = [asc(chronicles.playedOn)");
    expect(service).toContain("isNull(chronicles.sessionId)");
    expect(service).toContain("eq(characters.personId, actor.personId)");
    expect(button).toContain("window.confirm");
    const lifecycleMigration = readFileSync(new URL("../../drizzle/0026_violet_the_santerians.sql", import.meta.url), "utf8");
    expect(lifecycleMigration).toContain('RENAME COLUMN "date_played" TO "played_on"');
    expect(lifecycleMigration).toContain('CONSTRAINT "chronicles_lifecycle_check"');
    expect(lifecycleMigration).toContain("'pending', 'applied'");
  });
});
