-- SKU is the stable application identity. ISBN remains a unique catalog deduplication key.
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "person_id", lower("product_code") ORDER BY "created_at", "id") AS identity_rank
  FROM "player_materials"
  WHERE "product_code" IS NOT NULL
)
UPDATE "player_materials" AS material
SET "identity" = lower(material."product_code"), "updated_at" = now()
FROM ranked
WHERE material."id" = ranked."id"
  AND ranked.identity_rank = 1
  AND material."identity" <> lower(material."product_code")
  AND NOT EXISTS (
    SELECT 1 FROM "player_materials" AS existing
    WHERE existing."person_id" = material."person_id"
      AND existing."identity" = lower(material."product_code")
      AND existing."id" <> material."id"
  );--> statement-breakpoint

UPDATE "character_inventory_entries" AS inventory
SET "source_material_identity" = lower(material."product_code"), "updated_at" = now()
FROM "source_materials" AS material
WHERE inventory."source_material_id" = material."id"
  AND material."product_code" IS NOT NULL
  AND inventory."source_material_identity" IS DISTINCT FROM lower(material."product_code");
