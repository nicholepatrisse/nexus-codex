import { sql } from "drizzle-orm";
import snapshotData from "../../data/catalog/sfs2-paizo.json";
import { prepareContentItem } from "@/catalog/content-item";
import { sfs2CatalogSnapshotSchema } from "@/catalog/paizo";
import { getDb } from "@/db/client";
import { contentItems, gameSystems, organizedPlayPrograms, rulesets } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

export const STARFINDER_SYSTEM_ID = SUPPORTED_GAME_SYSTEM.id;
export const SF2E_RULESET_ID = "ruleset-starfinder-2e";
export const SFS2_PROGRAM_ID = SUPPORTED_GAME_SYSTEM.organizedPlayProgramId;

export const sfs2CatalogSnapshot = sfs2CatalogSnapshotSchema.parse(snapshotData);

export async function seedSfs2Catalog(database = getDb()) {
  return database.transaction(async (transaction) => {
    const [system] = await transaction
      .insert(gameSystems)
      .values({ id: STARFINDER_SYSTEM_ID, code: SUPPORTED_GAME_SYSTEM.code, name: SUPPORTED_GAME_SYSTEM.name })
      .onConflictDoUpdate({
        target: gameSystems.code,
        set: { name: "Starfinder 2E" },
      })
      .returning({ id: gameSystems.id });
    if (!system) throw new Error("Failed to seed the Starfinder game system.");

    const [ruleset] = await transaction
      .insert(rulesets)
      .values({
        id: SF2E_RULESET_ID,
        gameSystemId: system.id,
        code: "sf2e",
        name: "Starfinder Second Edition",
        edition: "2e",
      })
      .onConflictDoUpdate({
        target: [rulesets.gameSystemId, rulesets.code],
        set: {
          name: "Starfinder Second Edition",
          edition: "2e",
        },
      })
      .returning({ id: rulesets.id });
    if (!ruleset) throw new Error("Failed to seed the SF2E ruleset.");

    const [program] = await transaction
      .insert(organizedPlayPrograms)
      .values({
        id: SFS2_PROGRAM_ID,
        rulesetId: ruleset.id,
        code: "sfs2",
        name: "Starfinder Society Second Edition",
      })
      .onConflictDoUpdate({
        target: [organizedPlayPrograms.rulesetId, organizedPlayPrograms.code],
        set: { name: "Starfinder Society Second Edition" },
      })
      .returning({ id: organizedPlayPrograms.id });
    if (!program) throw new Error("Failed to seed the SFS2 program.");

    for (const item of sfs2CatalogSnapshot.items) {
      const prepared = prepareContentItem({
        id: `sfs2-${item.code}`,
        programId: program.id,
        code: item.code,
        title: item.title,
        contentType: item.contentType,
        minimumLevel: item.minimumLevel,
        maximumLevel: item.maximumLevel,
      });
      await transaction
        .insert(contentItems)
        .values(prepared)
        .onConflictDoUpdate({
          target: [contentItems.programId, contentItems.normalizedCode],
          set: {
            code: sql`excluded.code`,
            title: sql`excluded.title`,
            normalizedTitle: sql`excluded.normalized_title`,
            contentType: sql`excluded.content_type`,
            minimumLevel: sql`excluded.minimum_level`,
            maximumLevel: sql`excluded.maximum_level`,
            updatedAt: new Date(),
          },
        });
    }

    return { programId: program.id, itemCount: sfs2CatalogSnapshot.items.length };
  });
}
