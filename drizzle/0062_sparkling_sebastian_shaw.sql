CREATE TABLE "new_game_notification_deliveries" (
	"person_id" text NOT NULL,
	"audit_event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "new_game_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "new_game_notification_deliveries" ADD CONSTRAINT "new_game_notification_deliveries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "new_game_notification_deliveries" ADD CONSTRAINT "new_game_notification_deliveries_audit_event_id_community_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "public"."community_audit_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "new_game_notification_deliveries_person_event_unique" ON "new_game_notification_deliveries" USING btree ("person_id","audit_event_id");--> statement-breakpoint
CREATE INDEX "new_game_notification_deliveries_person_id_idx" ON "new_game_notification_deliveries" USING btree ("person_id");