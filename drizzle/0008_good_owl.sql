CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"content_item_id" text NOT NULL,
	"gm_person_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"display_time_zone" text NOT NULL,
	"player_capacity" integer DEFAULT 6 NOT NULL,
	"notes" text,
	"location_type" text NOT NULL,
	"created_by_person_id" text NOT NULL,
	"updated_by_person_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" in ('draft', 'published', 'cancelled')),
	CONSTRAINT "sessions_time_order_check" CHECK ("sessions"."ends_at" > "sessions"."starts_at"),
	CONSTRAINT "sessions_display_time_zone_check" CHECK (length("sessions"."display_time_zone") <= 100 and "sessions"."display_time_zone" ~ '^(UTC|[A-Za-z][A-Za-z0-9._+-]*(/[A-Za-z][A-Za-z0-9._+-]*)+)$'),
	CONSTRAINT "sessions_capacity_check" CHECK ("sessions"."player_capacity" = 6),
	CONSTRAINT "sessions_notes_length_check" CHECK ("sessions"."notes" is null or length("sessions"."notes") <= 4000),
	CONSTRAINT "sessions_location_type_check" CHECK ("sessions"."location_type" in ('virtual', 'physical'))
);
--> statement-breakpoint
ALTER TABLE "community_audit_events" DROP CONSTRAINT "community_audit_events_type_check";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_gm_person_id_people_id_fk" FOREIGN KEY ("gm_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_updated_by_person_id_people_id_fk" FOREIGN KEY ("updated_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_gm_membership_fk" FOREIGN KEY ("community_id","gm_person_id") REFERENCES "public"."community_memberships"("community_id","person_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_community_status_starts_at_idx" ON "sessions" USING btree ("community_id","status","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_gm_status_starts_at_idx" ON "sessions" USING btree ("gm_person_id","status","starts_at");--> statement-breakpoint
ALTER TABLE "community_audit_events" ADD CONSTRAINT "community_audit_events_type_check" CHECK ("community_audit_events"."event_type" in ('community.settings.updated', 'community.archived', 'community.restored', 'community.invitation.created', 'community.invitation.accepted', 'community.invitation.revoked', 'community.invitation.expired', 'community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled', 'community.gm.requested', 'community.gm.approved', 'community.gm.rejected', 'community.gm.cancelled', 'community.gm.revoked', 'community.gm.self_service_promoted', 'session.draft.created', 'session.draft.updated', 'session.gm.reassigned'));