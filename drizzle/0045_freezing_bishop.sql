ALTER TABLE "character_inventory_entries" ADD COLUMN "value_minor" integer;--> statement-breakpoint
UPDATE "character_inventory_entries" AS inventory
SET "value_minor" = purchases."unit_price_minor"
FROM "character_purchases" AS purchases
WHERE inventory."source_purchase_id" = purchases."id";--> statement-breakpoint
UPDATE "character_inventory_entries"
SET "value_minor" = replace(substring("notes" from 'Price: ([0-9][0-9,]*) credits'), ',', '')::integer
WHERE "value_minor" IS NULL
  AND "notes" ~ 'Price: [0-9][0-9,]* credits';--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_value_check" CHECK ("character_inventory_entries"."value_minor" is null or "character_inventory_entries"."value_minor" >= 0);
