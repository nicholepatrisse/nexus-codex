import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { prepareContentItem } from "@/catalog/content-item";
import { lookupContentItems } from "@/catalog/repository";
import { getDb } from "@/db/client";
import { contentItems, gameSystems, organizedPlayPrograms, rulesets } from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const systemId = `system-${suffix}`;
const rulesetId = `ruleset-${suffix}`;
const programId = `program-${suffix}`;
const otherProgramId = `other-program-${suffix}`;

describeWithDatabase("organized-play catalog", () => {
  beforeAll(async () => {
    await getDb().insert(gameSystems).values({
      id: systemId,
      code: `starfinder-${suffix}`,
      name: "Starfinder",
    });
    await getDb().insert(rulesets).values({
      id: rulesetId,
      gameSystemId: systemId,
      code: "sf2e",
      name: "Starfinder Second Edition",
      edition: "2e",
    });
    await getDb().insert(organizedPlayPrograms).values([
      {
        id: programId,
        rulesetId,
        code: "sfs2",
        name: "Starfinder Society Second Edition",
      },
      {
        id: otherProgramId,
        rulesetId,
        code: "synthetic",
        name: "Synthetic Test Program",
      },
    ]);
    await getDb().insert(contentItems).values([
      prepareContentItem({
        id: `scenario-1-${suffix}`,
        programId,
        code: "1-01",
        title: "Invasion’s Edge",
        contentType: "scenario",
        minimumLevel: 1,
        maximumLevel: 2,
      }),
      prepareContentItem({
        id: `scenario-2-${suffix}`,
        programId,
        code: "1-02",
        title: "Mystery of the Frozen Moon",
        contentType: "scenario",
        minimumLevel: 1,
        maximumLevel: 2,
      }),
      prepareContentItem({
        id: `other-program-scenario-${suffix}`,
        programId: otherProgramId,
        code: "1-01",
        title: "A Different Program’s Scenario",
        contentType: "scenario",
        minimumLevel: 3,
        maximumLevel: 4,
      }),
    ]);
  });

  afterAll(async () => {
    await getDb().delete(contentItems).where(eq(contentItems.programId, programId));
    await getDb().delete(contentItems).where(eq(contentItems.programId, otherProgramId));
    await getDb().delete(organizedPlayPrograms).where(eq(organizedPlayPrograms.id, programId));
    await getDb()
      .delete(organizedPlayPrograms)
      .where(eq(organizedPlayPrograms.id, otherProgramId));
    await getDb().delete(rulesets).where(eq(rulesets.id, rulesetId));
    await getDb().delete(gameSystems).where(eq(gameSystems.id, systemId));
  });

  it("finds an SFS2 scenario by normalized code", async () => {
    const matches = await lookupContentItems({ programId, query: " #1 – 01 " });
    expect(matches).toEqual([
      expect.objectContaining({ code: "1-01", title: "Invasion’s Edge" }),
    ]);
  });

  it("finds an SFS2 scenario by a case-insensitive title fragment", async () => {
    const matches = await lookupContentItems({ programId, query: "FROZEN moon" });
    expect(matches).toEqual([
      expect.objectContaining({ code: "1-02", title: "Mystery of the Frozen Moon" }),
    ]);
  });

  it("rejects duplicate normalized codes inside one program", async () => {
    await expect(
      getDb().insert(contentItems).values(
        prepareContentItem({
          id: `duplicate-${suffix}`,
          programId,
          code: "1 – 01",
          title: "Duplicate Scenario",
          contentType: "scenario",
          minimumLevel: 1,
          maximumLevel: 2,
        }),
      ),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23505" }) });
  });

  it("allows the same normalized code in a different program without leaking lookup results", async () => {
    const matches = await lookupContentItems({ programId, query: "1-01" });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ title: "Invasion’s Edge" });
  });
});
