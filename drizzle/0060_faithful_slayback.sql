ALTER TABLE "source_materials" DROP CONSTRAINT "source_materials_isbn_format";--> statement-breakpoint
DROP INDEX "source_materials_isbn_unique";--> statement-breakpoint
ALTER TABLE "source_materials" ALTER COLUMN "isbn" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "source_materials_product_code_unique" ON "source_materials" USING btree ("product_code") WHERE "source_materials"."product_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "source_materials_nethys_url_unique" ON "source_materials" USING btree ("nethys_source_url") WHERE "source_materials"."nethys_source_url" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "source_materials_isbn_unique" ON "source_materials" USING btree ("isbn") WHERE "source_materials"."isbn" is not null;--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_identity_check" CHECK ("source_materials"."isbn" is not null or "source_materials"."product_code" is not null);--> statement-breakpoint
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_isbn_format" CHECK ("source_materials"."isbn" is null or "source_materials"."isbn" ~ '^[0-9]{13}$');