ALTER TABLE "people" ADD COLUMN "discord_handle" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "society_play_number" text;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_display_name_not_blank" CHECK (length(btrim("people"."display_name")) > 0);--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_discord_handle_length_check" CHECK ("people"."discord_handle" is null or length("people"."discord_handle") <= 100);--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_society_play_number_length_check" CHECK ("people"."society_play_number" is null or length("people"."society_play_number") <= 50);