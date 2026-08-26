ALTER TABLE "characters" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "class" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "ancestry" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "background" text;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_level_check" CHECK ("characters"."level" between 1 and 20);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_class_length_check" CHECK ("characters"."class" is null or length("characters"."class") <= 100);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_ancestry_length_check" CHECK ("characters"."ancestry" is null or length("characters"."ancestry") <= 100);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_background_length_check" CHECK ("characters"."background" is null or length("characters"."background") <= 100);
