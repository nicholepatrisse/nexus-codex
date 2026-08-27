ALTER TABLE "chronicles" DROP CONSTRAINT "chronicles_downtime_earn_income_check";--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_entry_method" text DEFAULT 'calculated' NOT NULL;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "downtime_sheet_credits_minor" integer;--> statement-breakpoint
UPDATE "chronicles" AS "chronicle"
SET
  "event_name" = coalesce("chronicle"."event_name", "community"."event_name", "community"."name"),
  "event_code" = coalesce("chronicle"."event_code", "community"."event_code")
FROM "sessions" AS "session"
INNER JOIN "communities" AS "community" ON "community"."id" = "session"."community_id"
WHERE "chronicle"."session_id" = "session"."id"
  AND ("chronicle"."event_name" IS NULL OR "chronicle"."event_code" IS NULL);--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_entry_method_check" CHECK ("chronicles"."downtime_entry_method" in ('calculated', 'sheet'));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_downtime_earn_income_check" CHECK (coalesce(("chronicles"."downtime_disposition" <> 'earn_income') or ("chronicles"."downtime_entry_method" = 'calculated' and "chronicles"."downtime_check_total" is not null and "chronicles"."downtime_proficiency" in ('trained', 'expert', 'master') and "chronicles"."downtime_dc" is not null and "chronicles"."downtime_degree" in ('critical_success', 'success', 'failure', 'critical_failure') and "chronicles"."downtime_calculated_credits_minor" is not null and "chronicles"."downtime_sheet_credits_minor" is null) or ("chronicles"."downtime_entry_method" = 'sheet' and "chronicles"."downtime_sheet_credits_minor" >= 0 and "chronicles"."downtime_check_total" is null and "chronicles"."downtime_proficiency" is null and "chronicles"."downtime_dc" is null and "chronicles"."downtime_degree" is null and "chronicles"."downtime_calculated_credits_minor" is null), false));
