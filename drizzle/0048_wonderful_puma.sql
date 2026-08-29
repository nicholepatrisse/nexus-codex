ALTER TABLE "chronicles" ADD COLUMN "credit_type" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "eligibility_state" text DEFAULT 'unverifiable' NOT NULL;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "scenario_minimum_level_snapshot" integer;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "scenario_maximum_level_snapshot" integer;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "eligibility_note" text;--> statement-breakpoint
UPDATE "chronicles" AS "chronicle"
SET "scenario_minimum_level_snapshot" = "content"."minimum_level",
    "scenario_maximum_level_snapshot" = "content"."maximum_level",
    "eligibility_state" = CASE
      WHEN "chronicle"."character_level" BETWEEN "content"."minimum_level" AND "content"."maximum_level" THEN 'eligible'
      ELSE 'ineligible'
    END
FROM "content_items" AS "content"
WHERE "chronicle"."content_item_id" = "content"."id";--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_credit_type_check" CHECK ("chronicles"."credit_type" in ('normal', 'pregen', 'gm', 'correction'));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_eligibility_state_check" CHECK ("chronicles"."eligibility_state" in ('eligible', 'held', 'ineligible', 'unverifiable'));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_level_snapshot_check" CHECK (("chronicles"."scenario_minimum_level_snapshot" is null and "chronicles"."scenario_maximum_level_snapshot" is null) or ("chronicles"."scenario_minimum_level_snapshot" >= 1 and "chronicles"."scenario_maximum_level_snapshot" >= "chronicles"."scenario_minimum_level_snapshot"));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_eligibility_note_check" CHECK ("chronicles"."eligibility_note" is null or length(btrim("chronicles"."eligibility_note")) between 1 and 1000);
