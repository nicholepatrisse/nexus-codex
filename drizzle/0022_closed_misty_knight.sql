ALTER TABLE "characters" ADD COLUMN "backstory" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_backstory_length_check" CHECK ("characters"."backstory" is null or length("characters"."backstory") <= 5000);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_notes_length_check" CHECK ("characters"."notes" is null or length("characters"."notes") <= 5000);