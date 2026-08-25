CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"game_system_id" text NOT NULL,
	"name" text NOT NULL,
	"society_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_name_not_blank" CHECK (length(btrim("characters"."name")) > 0),
	CONSTRAINT "characters_name_length_check" CHECK (length("characters"."name") <= 100),
	CONSTRAINT "characters_society_number_format" CHECK ("characters"."society_number" ~ '^[0-9]+-[0-9]{2}$')
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_person_id_idx" ON "characters" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "characters_game_system_id_idx" ON "characters" USING btree ("game_system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_person_society_number_unique" ON "characters" USING btree ("person_id","society_number");