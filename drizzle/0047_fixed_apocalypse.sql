ALTER TABLE "characters" ADD COLUMN "starting_level_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "characters" AS "character"
SET "starting_level_locked" = true
WHERE EXISTS (
  SELECT 1 FROM "chronicles" AS "chronicle"
  WHERE "chronicle"."character_id" = "character"."id"
    AND "chronicle"."status" = 'applied'
)
OR EXISTS (
  SELECT 1 FROM "character_credit_ledger_entries" AS "entry"
  WHERE "entry"."character_id" = "character"."id"
    AND "entry"."source_chronicle_id" IS NOT NULL
);
