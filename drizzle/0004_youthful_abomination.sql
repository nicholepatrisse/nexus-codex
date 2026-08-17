CREATE TABLE "community_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"actor_person_id" text NOT NULL,
	"event_type" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_audit_events_type_check" CHECK ("community_audit_events"."event_type" in ('community.settings.updated', 'community.archived', 'community.restored')),
	CONSTRAINT "community_audit_events_details_object_check" CHECK (jsonb_typeof("community_audit_events"."details") = 'object')
);
--> statement-breakpoint
CREATE TABLE "community_supported_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"program_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "default_time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_audit_events" ADD CONSTRAINT "community_audit_events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_audit_events" ADD CONSTRAINT "community_audit_events_actor_person_id_people_id_fk" FOREIGN KEY ("actor_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_supported_programs" ADD CONSTRAINT "community_supported_programs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_supported_programs" ADD CONSTRAINT "community_supported_programs_program_id_organized_play_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."organized_play_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_audit_events_community_occurred_at_idx" ON "community_audit_events" USING btree ("community_id","occurred_at");--> statement-breakpoint
CREATE INDEX "community_audit_events_actor_person_id_idx" ON "community_audit_events" USING btree ("actor_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_supported_programs_community_program_unique" ON "community_supported_programs" USING btree ("community_id","program_id");--> statement-breakpoint
CREATE INDEX "community_supported_programs_program_id_idx" ON "community_supported_programs" USING btree ("program_id");--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_description_length_check" CHECK ("communities"."description" is null or length("communities"."description") <= 2000);--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_default_time_zone_check" CHECK (length("communities"."default_time_zone") <= 255 and "communities"."default_time_zone" ~ '^(UTC|[A-Za-z][A-Za-z0-9._+-]*(/[A-Za-z][A-Za-z0-9._+-]*)+)$');
