DO $$
DECLARE
  unsupported_rows text;
BEGIN
  SELECT string_agg(id || '=' || level::text, ', ' ORDER BY id)
  INTO unsupported_rows
  FROM characters
  WHERE level NOT IN (1, 3, 5, 7);

  IF unsupported_rows IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot migrate characters with unsupported Society starting levels: %', unsupported_rows;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "characters" RENAME COLUMN "level" TO "starting_level";--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT "characters_level_check";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_starting_level_check" CHECK ("characters"."starting_level" in (1, 3, 5, 7));
