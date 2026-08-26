ALTER TABLE "chronicles" RENAME COLUMN "date_played" TO "played_on";--> statement-breakpoint
DROP INDEX "chronicles_character_date_id_idx";--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chronicles" ADD COLUMN "provenance" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
UPDATE "chronicles" SET "status" = 'applied', "applied_at" = "created_at", "provenance" = CASE WHEN "session_id" IS NULL THEN 'manual' ELSE 'nexus' END;--> statement-breakpoint
CREATE INDEX "chronicles_character_date_id_idx" ON "chronicles" USING btree ("character_id","played_on","id");--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_status_check" CHECK ("chronicles"."status" in ('pending', 'applied'));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_provenance_check" CHECK ("chronicles"."provenance" in ('manual', 'nexus'));--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_lifecycle_check" CHECK (coalesce(("chronicles"."status" = 'pending' and "chronicles"."applied_at" is null) or ("chronicles"."status" = 'applied' and "chronicles"."applied_at" is not null), false));
