ALTER TABLE "chronicles" RENAME COLUMN "credits_minor" TO "base_credits_minor";--> statement-breakpoint
ALTER TABLE "chronicles" RENAME COLUMN "downtime" TO "downtime_days";--> statement-breakpoint
ALTER TABLE "chronicles" DROP CONSTRAINT "chronicles_credits_minor_check";--> statement-breakpoint
ALTER TABLE "chronicles" DROP CONSTRAINT "chronicles_reputation_check";--> statement-breakpoint
ALTER TABLE "chronicles" DROP CONSTRAINT "chronicles_downtime_check";--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_credits_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_disposition" text DEFAULT 'declined' NOT NULL;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_check_total" integer;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_proficiency" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_dc" integer;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_degree" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_calculated_credits_minor" integer;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_override_credits_minor" integer;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_correction_note" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_activity" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "chronicle_number" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "partner_code" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "event_name" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "event_code" text;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "gm_organized_play_id" text;--> statement-breakpoint
UPDATE "chronicles" SET "downtime_days" = "xp" * 2;--> statement-breakpoint
ALTER TABLE "chronicles" ALTER COLUMN "downtime_disposition" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chronicles" DROP COLUMN "reputation";--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_base_credits_check" CHECK ("chronicles"."base_credits_minor" >= 0);--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_credits_check" CHECK ("chronicles"."downtime_credits_minor" >= 0);--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_days_check" CHECK ("chronicles"."downtime_days" = "chronicles"."xp" * 2);--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_disposition_check" CHECK ("chronicles"."downtime_disposition" in ('earn_income', 'other', 'declined'));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_earn_income_check" CHECK (coalesce(("chronicles"."downtime_disposition" <> 'earn_income') or ("chronicles"."downtime_check_total" is not null and "chronicles"."downtime_proficiency" in ('trained', 'expert', 'master') and "chronicles"."downtime_dc" is not null and "chronicles"."downtime_degree" in ('critical_success', 'success', 'failure', 'critical_failure') and "chronicles"."downtime_calculated_credits_minor" is not null), false));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_override_check" CHECK ("chronicles"."downtime_override_credits_minor" is null or ("chronicles"."downtime_override_credits_minor" >= 0 and length(btrim("chronicles"."downtime_correction_note")) > 0));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_metadata_lengths_check" CHECK (("chronicles"."chronicle_number" is null or length("chronicles"."chronicle_number") <= 100) and ("chronicles"."partner_code" is null or length("chronicles"."partner_code") <= 100) and ("chronicles"."event_name" is null or length("chronicles"."event_name") <= 200) and ("chronicles"."event_code" is null or length("chronicles"."event_code") <= 100) and ("chronicles"."gm_organized_play_id" is null or length("chronicles"."gm_organized_play_id") <= 100));
