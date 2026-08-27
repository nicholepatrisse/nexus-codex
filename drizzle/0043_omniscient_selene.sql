CREATE TABLE "chronicle_sheet_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"chronicle_id" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"contents" "bytea" NOT NULL,
	"uploaded_by_person_id" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	CONSTRAINT "chronicle_sheet_attachments_filename_check" CHECK (length(btrim("chronicle_sheet_attachments"."original_filename")) between 1 and 255),
	CONSTRAINT "chronicle_sheet_attachments_content_type_check" CHECK ("chronicle_sheet_attachments"."content_type" in ('application/pdf', 'image/png', 'image/jpeg')),
	CONSTRAINT "chronicle_sheet_attachments_size_check" CHECK ("chronicle_sheet_attachments"."byte_size" between 1 and 10485760)
);
--> statement-breakpoint
ALTER TABLE "chronicle_sheet_attachments" ADD CONSTRAINT "chronicle_sheet_attachments_chronicle_id_chronicles_id_fk" FOREIGN KEY ("chronicle_id") REFERENCES "public"."chronicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronicle_sheet_attachments" ADD CONSTRAINT "chronicle_sheet_attachments_uploaded_by_person_id_people_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chronicle_sheet_attachments_chronicle_idx" ON "chronicle_sheet_attachments" USING btree ("chronicle_id","uploaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chronicle_sheet_attachments_current_unique" ON "chronicle_sheet_attachments" USING btree ("chronicle_id") WHERE "chronicle_sheet_attachments"."is_current";