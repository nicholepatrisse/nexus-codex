import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manualChronicleInputSchema, parseManualChronicleInput } from "@/character/chronicles";

const valid = { scenarioNumber: " 1-01 ", scenarioName: "  The Commencement ", datePlayed: "2026-08-25", characterLevel: "3", advancementSpeed: "standard" as const, xp: "4", creditsMinor: "1250", reputation: "2", downtime: "8", playerNotes: "  Great table.  " };

describe("manual Chronicles", () => {
  it("trims snapshots and notes while preserving rewards as exact integers", () => {
    expect(parseManualChronicleInput(valid, new Date("2026-08-26T12:00:00Z"))).toEqual({ contentItemId: null, scenarioNumber: "1-01", scenarioName: "The Commencement", datePlayed: "2026-08-25", characterLevel: 3, advancementSpeed: "standard", xp: 4, creditsMinor: 1250, reputation: 2, downtime: 8, playerNotes: "Great table." });
  });

  it("rejects future dates, fractions, negative rewards, invalid levels, and oversized notes", () => {
    expect(() => parseManualChronicleInput({ ...valid, datePlayed: "2026-08-27" }, new Date("2026-08-26T12:00:00Z"))).toThrow("Play date cannot be in the future");
    for (const input of [{ ...valid, xp: "1.5" }, { ...valid, creditsMinor: "-1" }, { ...valid, characterLevel: "21" }, { ...valid, playerNotes: "x".repeat(5001) }]) expect(manualChronicleInputSchema.safeParse(input).success).toBe(false);
  });

  it("ships database constraints, provenance guards, deterministic ordering, and confirmation", () => {
    const migration = readFileSync(new URL("../../drizzle/0025_woozy_lenny_balinger.sql", import.meta.url), "utf8");
    const service = readFileSync(new URL("../../src/character/chronicles.ts", import.meta.url), "utf8");
    const button = readFileSync(new URL("../../src/app/characters/[characterId]/chronicles/delete-chronicle-button.tsx", import.meta.url), "utf8");
    expect(migration).toContain('CREATE TABLE "chronicles"');
    expect(migration).toContain('"credits_minor" integer NOT NULL');
    expect(service).toContain("desc(chronicles.datePlayed), desc(chronicles.id)");
    expect(service).toContain("isNull(chronicles.sessionId)");
    expect(service).toContain("eq(characters.personId, actor.personId)");
    expect(button).toContain("window.confirm");
  });
});
