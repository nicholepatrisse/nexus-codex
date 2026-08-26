CREATE TABLE "character_credit_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"display_scale" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"effective_on" date NOT NULL,
	"source" text NOT NULL,
	"source_chronicle_id" text,
	"reverses_entry_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_amount_nonzero_check" CHECK ("character_credit_ledger_entries"."amount_minor" <> 0 or "character_credit_ledger_entries"."type" in ('starting_credits', 'chronicle_reward')),
	CONSTRAINT "credit_ledger_display_scale_check" CHECK ("character_credit_ledger_entries"."display_scale" = 1),
	CONSTRAINT "credit_ledger_type_check" CHECK ("character_credit_ledger_entries"."type" in ('starting_credits', 'chronicle_reward', 'adjustment')),
	CONSTRAINT "credit_ledger_source_check" CHECK ("character_credit_ledger_entries"."source" in ('character_creation', 'chronicle', 'owner_adjustment', 'chronicle_reversal', 'chronicle_correction')),
	CONSTRAINT "credit_ledger_source_relationship_check" CHECK (coalesce(("character_credit_ledger_entries"."type" = 'chronicle_reward' and "character_credit_ledger_entries"."source_chronicle_id" is not null and "character_credit_ledger_entries"."reverses_entry_id" is null) or ("character_credit_ledger_entries"."type" = 'starting_credits' and "character_credit_ledger_entries"."source_chronicle_id" is null and "character_credit_ledger_entries"."reverses_entry_id" is null) or ("character_credit_ledger_entries"."type" = 'adjustment'), false)),
	CONSTRAINT "credit_ledger_notes_length_check" CHECK ("character_credit_ledger_entries"."notes" is null or length("character_credit_ledger_entries"."notes") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "character_credit_ledger_entries_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "character_credit_ledger_entries_source_chronicle_id_chronicles_id_fk" FOREIGN KEY ("source_chronicle_id") REFERENCES "public"."chronicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "credit_ledger_reverses_entry_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "public"."character_credit_ledger_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_character_effective_created_id_idx" ON "character_credit_ledger_entries" USING btree ("character_id","effective_on","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_chronicle_reward_unique" ON "character_credit_ledger_entries" USING btree ("source_chronicle_id") WHERE "character_credit_ledger_entries"."type" = 'chronicle_reward';--> statement-breakpoint
INSERT INTO "character_credit_ledger_entries" ("id", "character_id", "amount_minor", "display_scale", "type", "effective_on", "source", "notes", "created_at")
SELECT 'starting-credits-' || "id", "id", 0, 1, 'starting_credits', "created_at"::date, 'character_creation', 'Opening balance (migration)', "created_at"
FROM "characters";--> statement-breakpoint
INSERT INTO "character_credit_ledger_entries" ("id", "character_id", "amount_minor", "display_scale", "type", "effective_on", "source", "source_chronicle_id", "notes", "created_at")
SELECT 'chronicle-reward-' || "id", "character_id", "credits_minor", 1, 'chronicle_reward', "played_on", 'chronicle', "id", "scenario_number_snapshot" || ' — ' || "scenario_name_snapshot", "applied_at"
FROM "chronicles"
WHERE "status" = 'applied';
