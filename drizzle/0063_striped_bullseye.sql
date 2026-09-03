CREATE TABLE "community_notification_preferences" (
	"person_id" text NOT NULL,
	"community_id" text NOT NULL,
	"new_game_notifications_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_notification_preferences" ADD CONSTRAINT "community_notification_preferences_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notification_preferences" ADD CONSTRAINT "community_notification_preferences_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_notification_preferences_person_community_unique" ON "community_notification_preferences" USING btree ("person_id","community_id");--> statement-breakpoint
CREATE INDEX "community_notification_preferences_community_id_idx" ON "community_notification_preferences" USING btree ("community_id");--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "new_game_notifications_enabled";