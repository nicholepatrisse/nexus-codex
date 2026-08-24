CREATE TABLE "session_signups" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"person_id" text NOT NULL,
	"status" text NOT NULL,
	"waitlist_position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "session_signups_status_check" CHECK ("session_signups"."status" in ('confirmed', 'waitlisted', 'cancelled')),
	CONSTRAINT "session_signups_lifecycle_check" CHECK (coalesce(("session_signups"."status" = 'confirmed' and "session_signups"."waitlist_position" is null and "session_signups"."cancelled_at" is null)
        or ("session_signups"."status" = 'waitlisted' and "session_signups"."waitlist_position" is not null and "session_signups"."waitlist_position" > 0 and "session_signups"."cancelled_at" is null)
        or ("session_signups"."status" = 'cancelled' and "session_signups"."cancelled_at" is not null), false))
);
--> statement-breakpoint
ALTER TABLE "community_audit_events" DROP CONSTRAINT "community_audit_events_type_check";--> statement-breakpoint
ALTER TABLE "session_signups" ADD CONSTRAINT "session_signups_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_signups" ADD CONSTRAINT "session_signups_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_signups_live_person_unique" ON "session_signups" USING btree ("session_id","person_id") WHERE "session_signups"."status" in ('confirmed', 'waitlisted');--> statement-breakpoint
CREATE UNIQUE INDEX "session_signups_waitlist_position_unique" ON "session_signups" USING btree ("session_id","waitlist_position") WHERE "session_signups"."status" = 'waitlisted';--> statement-breakpoint
CREATE INDEX "session_signups_session_status_idx" ON "session_signups" USING btree ("session_id","status");--> statement-breakpoint
ALTER TABLE "community_audit_events" ADD CONSTRAINT "community_audit_events_type_check" CHECK ("community_audit_events"."event_type" in ('community.settings.updated', 'community.archived', 'community.restored', 'community.invitation.created', 'community.invitation.accepted', 'community.invitation.revoked', 'community.invitation.expired', 'community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled', 'community.gm.requested', 'community.gm.approved', 'community.gm.rejected', 'community.gm.cancelled', 'community.gm.revoked', 'community.gm.self_service_promoted', 'session.draft.created', 'session.draft.updated', 'session.gm.reassigned', 'session.published', 'session.signup.confirmed', 'session.signup.waitlisted', 'session.signup.cancelled', 'session.signup.promoted'));