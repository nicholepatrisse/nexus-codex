CREATE TABLE "character_inventory_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"content_item_id" text,
	"item_name_snapshot" text NOT NULL,
	"item_code_snapshot" text,
	"quantity" integer NOT NULL,
	"acquisition_type" text NOT NULL,
	"acquired_on" date NOT NULL,
	"amount_paid_minor" integer,
	"source_chronicle_id" text,
	"notes" text,
	"lot_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_inventory_name_check" CHECK (length(btrim("character_inventory_entries"."item_name_snapshot")) between 1 and 200),
	CONSTRAINT "character_inventory_code_length_check" CHECK ("character_inventory_entries"."item_code_snapshot" is null or length("character_inventory_entries"."item_code_snapshot") <= 100),
	CONSTRAINT "character_inventory_quantity_check" CHECK ("character_inventory_entries"."quantity" > 0),
	CONSTRAINT "character_inventory_acquisition_type_check" CHECK ("character_inventory_entries"."acquisition_type" in ('starting_equipment', 'purchased', 'crafted', 'boon_reward', 'other')),
	CONSTRAINT "character_inventory_amount_paid_check" CHECK ("character_inventory_entries"."amount_paid_minor" is null or "character_inventory_entries"."amount_paid_minor" >= 0),
	CONSTRAINT "character_inventory_notes_length_check" CHECK ("character_inventory_entries"."notes" is null or length("character_inventory_entries"."notes") <= 5000)
);
--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_entries_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_entries_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_entries_source_chronicle_id_chronicles_id_fk" FOREIGN KEY ("source_chronicle_id") REFERENCES "public"."chronicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_inventory_character_acquired_idx" ON "character_inventory_entries" USING btree ("character_id","acquired_on","created_at");--> statement-breakpoint
CREATE INDEX "character_inventory_content_item_idx" ON "character_inventory_entries" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "character_inventory_source_chronicle_idx" ON "character_inventory_entries" USING btree ("source_chronicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_inventory_character_lot_unique" ON "character_inventory_entries" USING btree ("character_id","lot_key");