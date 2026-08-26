CREATE TABLE "session_gm_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"gm_person_id" text NOT NULL,
	"character_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_gm_credits" ADD CONSTRAINT "session_gm_credits_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_gm_credits" ADD CONSTRAINT "session_gm_credits_gm_person_id_people_id_fk" FOREIGN KEY ("gm_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_gm_credits" ADD CONSTRAINT "session_gm_credits_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_gm_credits_session_gm_unique" ON "session_gm_credits" USING btree ("session_id","gm_person_id");--> statement-breakpoint
CREATE INDEX "session_gm_credits_character_id_idx" ON "session_gm_credits" USING btree ("character_id");