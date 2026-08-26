ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "character_credit_ledger_entries_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" DROP CONSTRAINT "character_credit_ledger_entries_source_chronicle_id_chronicles_id_fk";
--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "character_credit_ledger_entries_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_credit_ledger_entries" ADD CONSTRAINT "character_credit_ledger_entries_source_chronicle_id_chronicles_id_fk" FOREIGN KEY ("source_chronicle_id") REFERENCES "public"."chronicles"("id") ON DELETE set null ON UPDATE no action;