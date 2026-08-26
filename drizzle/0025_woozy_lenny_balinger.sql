CREATE TABLE "chronicles" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"session_id" text,
	"content_item_id" text,
	"scenario_number_snapshot" text NOT NULL,
	"scenario_name_snapshot" text NOT NULL,
	"date_played" date NOT NULL,
	"character_level" integer NOT NULL,
	"advancement_speed" text NOT NULL,
	"xp" integer NOT NULL,
	"credits_minor" integer NOT NULL,
	"reputation" integer NOT NULL,
	"downtime" integer NOT NULL,
	"player_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chronicles_scenario_number_length_check" CHECK (length(btrim("chronicles"."scenario_number_snapshot")) between 1 and 100),
	CONSTRAINT "chronicles_scenario_name_length_check" CHECK (length(btrim("chronicles"."scenario_name_snapshot")) between 1 and 200),
	CONSTRAINT "chronicles_character_level_check" CHECK ("chronicles"."character_level" between 1 and 20),
	CONSTRAINT "chronicles_advancement_speed_check" CHECK ("chronicles"."advancement_speed" in ('standard', 'slow')),
	CONSTRAINT "chronicles_xp_check" CHECK ("chronicles"."xp" >= 0),
	CONSTRAINT "chronicles_credits_minor_check" CHECK ("chronicles"."credits_minor" >= 0),
	CONSTRAINT "chronicles_reputation_check" CHECK ("chronicles"."reputation" >= 0),
	CONSTRAINT "chronicles_downtime_check" CHECK ("chronicles"."downtime" >= 0),
	CONSTRAINT "chronicles_player_notes_length_check" CHECK ("chronicles"."player_notes" is null or length("chronicles"."player_notes") <= 5000)
);
--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chronicles_character_date_id_idx" ON "chronicles" USING btree ("character_id","date_played","id");--> statement-breakpoint
CREATE INDEX "chronicles_session_id_idx" ON "chronicles" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chronicles_content_item_id_idx" ON "chronicles" USING btree ("content_item_id");