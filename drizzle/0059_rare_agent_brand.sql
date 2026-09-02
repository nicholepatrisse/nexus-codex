CREATE TABLE "source_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"isbn" text NOT NULL,
	"title" text NOT NULL,
	"product_code" text,
	"nethys_source_url" text,
	"paizo_product_url" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_materials_isbn_format" CHECK ("source_materials"."isbn" ~ '^[0-9]{13}$'),
	CONSTRAINT "source_materials_title_not_blank" CHECK (length(btrim("source_materials"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD COLUMN "source_material_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "source_materials_isbn_unique" ON "source_materials" USING btree ("isbn");--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_entries_source_material_id_source_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."source_materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_inventory_source_material_idx" ON "character_inventory_entries" USING btree ("source_material_id");