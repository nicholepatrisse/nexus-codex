ALTER TABLE "character_inventory_entries" ADD COLUMN "validation_note" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "class_validation_note" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "ancestry_validation_note" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "background_validation_note" text;--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_validation_note_length_check" CHECK ("character_inventory_entries"."validation_note" is null or length("character_inventory_entries"."validation_note") <= 1000);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_class_validation_note_length_check" CHECK ("characters"."class_validation_note" is null or length("characters"."class_validation_note") <= 1000);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_ancestry_validation_note_length_check" CHECK ("characters"."ancestry_validation_note" is null or length("characters"."ancestry_validation_note") <= 1000);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_background_validation_note_length_check" CHECK ("characters"."background_validation_note" is null or length("characters"."background_validation_note") <= 1000);