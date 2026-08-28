ALTER TABLE "content_items" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "product_code" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "publication_date" date;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "created_by_person_id" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_source_url_unique" ON "content_items" USING btree ("source_url") WHERE "content_items"."source_url" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_source_product_code_unique" ON "content_items" USING btree ("source","product_code") WHERE "content_items"."product_code" is not null;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_source_check" CHECK ("content_items"."source" is null or "content_items"."source" in ('paizo'));