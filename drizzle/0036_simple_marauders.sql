CREATE TABLE "character_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"content_item_id" text,
	"item_name_snapshot" text NOT NULL,
	"item_link_snapshot" text,
	"quantity" integer NOT NULL,
	"acquired_on" date NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"total_price_minor" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_purchases_name_check" CHECK (length(btrim("character_purchases"."item_name_snapshot")) between 1 and 200),
	CONSTRAINT "character_purchases_link_length_check" CHECK ("character_purchases"."item_link_snapshot" is null or length("character_purchases"."item_link_snapshot") <= 2000),
	CONSTRAINT "character_purchases_quantity_check" CHECK ("character_purchases"."quantity" > 0),
	CONSTRAINT "character_purchases_unit_price_check" CHECK ("character_purchases"."unit_price_minor" > 0),
	CONSTRAINT "character_purchases_total_price_check" CHECK ("character_purchases"."total_price_minor" > 0 and "character_purchases"."total_price_minor" = "character_purchases"."unit_price_minor" * "character_purchases"."quantity"),
	CONSTRAINT "character_purchases_idempotency_key_check" CHECK (length(btrim("character_purchases"."idempotency_key")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "credit_ledger_type_check";--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "credit_ledger_source_check";--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "credit_ledger_source_relationship_check";--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD COLUMN "source_purchase_id" text;--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD COLUMN "source_purchase_id" text;--> statement-breakpoint
ALTER TABLE "character_purchases" ADD CONSTRAINT "character_purchases_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_purchases" ADD CONSTRAINT "character_purchases_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_purchases_character_acquired_idx" ON "character_purchases" USING btree ("character_id","acquired_on","created_at");--> statement-breakpoint
CREATE INDEX "character_purchases_content_item_idx" ON "character_purchases" USING btree ("content_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_purchases_character_idempotency_unique" ON "character_purchases" USING btree ("character_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "character_credit_ledger_entries_source_purchase_id_character_purchases_id_fk" FOREIGN KEY ("source_purchase_id") REFERENCES "public"."character_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_entries_source_purchase_id_character_purchases_id_fk" FOREIGN KEY ("source_purchase_id") REFERENCES "public"."character_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_purchase_unique" ON "character_credit_ledger_entries" USING btree ("source_purchase_id") WHERE "character_credit_ledger_entries"."type" = 'purchase';--> statement-breakpoint
CREATE UNIQUE INDEX "character_inventory_source_purchase_unique" ON "character_inventory_entries" USING btree ("source_purchase_id") WHERE "character_inventory_entries"."source_purchase_id" is not null;--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_type_check" CHECK ("character_credit_ledger_entries"."type" in ('starting_credits', 'chronicle_reward', 'adjustment', 'purchase'));--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_source_check" CHECK ("character_credit_ledger_entries"."source" in ('character_creation', 'chronicle', 'owner_adjustment', 'chronicle_reversal', 'chronicle_correction', 'purchase'));--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_source_relationship_check" CHECK (coalesce(("character_credit_ledger_entries"."type" = 'chronicle_reward' and "character_credit_ledger_entries"."source_chronicle_id" is not null and "character_credit_ledger_entries"."source_purchase_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null) or ("character_credit_ledger_entries"."type" = 'starting_credits' and "character_credit_ledger_entries"."source_chronicle_id" is null and "character_credit_ledger_entries"."source_purchase_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null) or ("character_credit_ledger_entries"."type" = 'purchase' and "character_credit_ledger_entries"."source_purchase_id" is not null and "character_credit_ledger_entries"."source_chronicle_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null and "character_credit_ledger_entries"."amount_minor" < 0) or ("character_credit_ledger_entries"."type" = 'adjustment' and "character_credit_ledger_entries"."source_purchase_id" is null), false));