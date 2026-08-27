CREATE TABLE "character_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"inventory_entry_id" text NOT NULL,
	"source_purchase_id" text,
	"content_item_id" text,
	"item_name_snapshot" text NOT NULL,
	"item_link_snapshot" text,
	"quantity" integer NOT NULL,
	"original_unit_paid_minor" integer NOT NULL,
	"original_total_paid_minor" integer NOT NULL,
	"sale_amount_minor" integer NOT NULL,
	"sold_on" date NOT NULL,
	"sale_kind" text DEFAULT 'ordinary' NOT NULL,
	"pricing_policy" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_sales_name_check" CHECK (length(btrim("character_sales"."item_name_snapshot")) between 1 and 200),
	CONSTRAINT "character_sales_quantity_check" CHECK ("character_sales"."quantity" > 0),
	CONSTRAINT "character_sales_paid_price_check" CHECK ("character_sales"."original_unit_paid_minor" >= 0 and "character_sales"."original_total_paid_minor" = "character_sales"."original_unit_paid_minor" * "character_sales"."quantity"),
	CONSTRAINT "character_sales_amount_check" CHECK ("character_sales"."sale_amount_minor" > 0),
	CONSTRAINT "character_sales_kind_check" CHECK ("character_sales"."sale_kind" in ('ordinary', 'refund')),
	CONSTRAINT "character_sales_policy_check" CHECK (length(btrim("character_sales"."pricing_policy")) between 1 and 100),
	CONSTRAINT "character_sales_idempotency_key_check" CHECK (length(btrim("character_sales"."idempotency_key")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "credit_ledger_type_check";--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "credit_ledger_source_check";--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "credit_ledger_source_relationship_check";--> statement-breakpoint
ALTER TABLE "character_inventory_entries" DROP CONSTRAINT "character_inventory_quantity_check";--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD COLUMN "source_sale_id" text;--> statement-breakpoint
ALTER TABLE "character_sales" ADD CONSTRAINT "character_sales_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sales" ADD CONSTRAINT "character_sales_source_purchase_id_character_purchases_id_fk" FOREIGN KEY ("source_purchase_id") REFERENCES "public"."character_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sales" ADD CONSTRAINT "character_sales_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_sales_character_sold_idx" ON "character_sales" USING btree ("character_id","sold_on","created_at");--> statement-breakpoint
CREATE INDEX "character_sales_inventory_entry_idx" ON "character_sales" USING btree ("inventory_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_sales_character_idempotency_unique" ON "character_sales" USING btree ("character_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "character_credit_ledger_entries_source_sale_id_character_sales_id_fk" FOREIGN KEY ("source_sale_id") REFERENCES "public"."character_sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_sale_unique" ON "character_credit_ledger_entries" USING btree ("source_sale_id") WHERE "character_credit_ledger_entries"."type" = 'sale';--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_type_check" CHECK ("character_credit_ledger_entries"."type" in ('starting_credits', 'chronicle_reward', 'adjustment', 'purchase', 'sale'));--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_source_check" CHECK ("character_credit_ledger_entries"."source" in ('character_creation', 'chronicle', 'owner_adjustment', 'chronicle_reversal', 'chronicle_correction', 'purchase', 'sale'));--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_source_relationship_check" CHECK (coalesce(("character_credit_ledger_entries"."type" = 'chronicle_reward' and "character_credit_ledger_entries"."source_chronicle_id" is not null and "character_credit_ledger_entries"."source_purchase_id" is null and "character_credit_ledger_entries"."source_sale_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null) or ("character_credit_ledger_entries"."type" = 'starting_credits' and "character_credit_ledger_entries"."source_chronicle_id" is null and "character_credit_ledger_entries"."source_purchase_id" is null and "character_credit_ledger_entries"."source_sale_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null) or ("character_credit_ledger_entries"."type" = 'purchase' and "character_credit_ledger_entries"."source_purchase_id" is not null and "character_credit_ledger_entries"."source_chronicle_id" is null and "character_credit_ledger_entries"."source_sale_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null and "character_credit_ledger_entries"."amount_minor" < 0) or ("character_credit_ledger_entries"."type" = 'sale' and "character_credit_ledger_entries"."source_sale_id" is not null and "character_credit_ledger_entries"."source_purchase_id" is null and "character_credit_ledger_entries"."source_chronicle_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null and "character_credit_ledger_entries"."amount_minor" > 0) or ("character_credit_ledger_entries"."type" = 'adjustment' and "character_credit_ledger_entries"."source_purchase_id" is null and "character_credit_ledger_entries"."source_sale_id" is null), false));--> statement-breakpoint
ALTER TABLE "character_inventory_entries" ADD CONSTRAINT "character_inventory_quantity_check" CHECK ("character_inventory_entries"."quantity" >= 0);