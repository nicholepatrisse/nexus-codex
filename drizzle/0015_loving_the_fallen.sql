CREATE TABLE "notification_reads" (
	"person_id" text NOT NULL,
	"notification_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_reads_person_notification_unique" ON "notification_reads" USING btree ("person_id","notification_id");--> statement-breakpoint
CREATE INDEX "notification_reads_person_id_idx" ON "notification_reads" USING btree ("person_id");