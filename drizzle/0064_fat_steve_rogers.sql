CREATE TABLE "account_notification_preferences" (
	"person_id" text PRIMARY KEY NOT NULL,
	"membership_status_notifications_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"person_id" text NOT NULL,
	"audit_event_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_kind_check" CHECK ("notification_deliveries"."kind" in ('owner.membership.pending', 'applicant.membership.status', 'gm.session.signup', 'session.changed', 'session.cancelled'))
);
--> statement-breakpoint
ALTER TABLE "community_notification_preferences" ADD COLUMN "membership_request_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "community_notification_preferences" ADD COLUMN "gm_signup_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "community_notification_preferences" ADD COLUMN "joined_game_change_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "community_notification_preferences" ADD COLUMN "joined_game_cancellation_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "account_notification_preferences" ADD CONSTRAINT "account_notification_preferences_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_audit_event_id_community_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "public"."community_audit_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_person_event_kind_unique" ON "notification_deliveries" USING btree ("person_id","audit_event_id","kind");--> statement-breakpoint
CREATE INDEX "notification_deliveries_person_id_idx" ON "notification_deliveries" USING btree ("person_id");
--> statement-breakpoint
INSERT INTO "notification_deliveries" ("person_id", "audit_event_id", "kind", "created_at")
SELECT grants."person_id", events."id", 'owner.membership.pending', events."occurred_at"
FROM "community_audit_events" events
JOIN "community_membership_requests" requests ON requests."id" = events."details"->>'requestId' AND requests."status" = 'pending'
JOIN "community_role_grants" grants ON grants."community_id" = events."community_id" AND grants."role" = 'owner' AND grants."status" = 'active' AND grants."revoked_at" IS NULL
WHERE events."event_type" = 'community.membership.requested'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_deliveries" ("person_id", "audit_event_id", "kind", "created_at")
SELECT requests."person_id", events."id", 'applicant.membership.status', events."occurred_at"
FROM "community_audit_events" events
JOIN "community_membership_requests" requests ON requests."id" = events."details"->>'requestId'
WHERE events."event_type" IN ('community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_deliveries" ("person_id", "audit_event_id", "kind", "created_at")
SELECT sessions."gm_person_id", events."id", 'gm.session.signup', events."occurred_at"
FROM "community_audit_events" events
JOIN "sessions" sessions ON sessions."id" = events."details"->>'sessionId'
WHERE events."event_type" IN ('session.signup.confirmed', 'session.signup.waitlisted')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_deliveries" ("person_id", "audit_event_id", "kind", "created_at")
SELECT signups."person_id", events."id", CASE WHEN events."event_type" = 'session.cancelled' THEN 'session.cancelled' ELSE 'session.changed' END, events."occurred_at"
FROM "community_audit_events" events
JOIN "sessions" sessions ON sessions."id" = events."details"->>'sessionId'
JOIN "session_signups" signups ON signups."session_id" = sessions."id" AND signups."status" IN ('confirmed', 'waitlisted') AND signups."person_id" <> events."actor_person_id"
WHERE events."event_type" IN ('session.published.updated', 'session.cancelled')
ON CONFLICT DO NOTHING;
