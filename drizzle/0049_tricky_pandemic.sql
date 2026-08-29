ALTER TABLE "chronicles" ADD COLUMN "played_at" timestamp with time zone;--> statement-breakpoint
UPDATE "chronicles" AS "chronicle"
SET "played_at" = "session"."starts_at"
FROM "sessions" AS "session"
WHERE "chronicle"."session_id" = "session"."id";--> statement-breakpoint
WITH "ranked" AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "character_id"
    ORDER BY "played_on", "played_at" NULLS LAST, "id"
  ) AS "position"
  FROM "chronicles"
)
UPDATE "chronicles" AS "chronicle"
SET "chronicle_number" = "ranked"."position"
FROM "ranked"
WHERE "chronicle"."id" = "ranked"."id";
