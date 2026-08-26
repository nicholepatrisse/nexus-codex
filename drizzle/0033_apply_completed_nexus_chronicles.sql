-- Nexus Chronicles are authoritative when their session is completed. Backfill
-- rewards before applying the records so existing character balances remain exact.
INSERT INTO "character_credit_ledger_entries" (
  "id", "character_id", "amount_minor", "display_scale", "type", "effective_on",
  "source", "source_chronicle_id", "notes"
)
SELECT
  md5(c."id" || clock_timestamp()::text || random()::text),
  c."character_id",
  c."credits_minor",
  1,
  'chronicle_reward',
  c."played_on",
  'chronicle',
  c."id",
  c."scenario_number_snapshot" || ' — ' || c."scenario_name_snapshot"
FROM "chronicles" c
INNER JOIN "sessions" s ON s."id" = c."session_id"
WHERE c."provenance" = 'nexus'
  AND c."status" = 'pending'
  AND s."status" = 'completed'
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "chronicles" c
SET "status" = 'applied',
    "applied_at" = coalesce(s."updated_at", now()),
    "updated_at" = now()
FROM "sessions" s
WHERE s."id" = c."session_id"
  AND c."provenance" = 'nexus'
  AND c."status" = 'pending'
  AND s."status" = 'completed';
