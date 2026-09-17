ALTER TABLE "character_option_selections" ADD COLUMN "import_source" text;--> statement-breakpoint
ALTER TABLE "character_option_selections" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "import_adapter_version" integer;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "import_digest" text;--> statement-breakpoint
CREATE UNIQUE INDEX "character_option_selections_import_key_unique" ON "character_option_selections" USING btree ("character_id","import_source","import_key") WHERE "character_option_selections"."import_source" is not null;--> statement-breakpoint
ALTER TABLE "character_option_selections" ADD CONSTRAINT "character_option_selections_import_source_check" CHECK ("character_option_selections"."import_source" is null or "character_option_selections"."import_source" = 'pathbuilder-pathmuncher');--> statement-breakpoint
ALTER TABLE "character_option_selections" ADD CONSTRAINT "character_option_selections_import_key_check" CHECK ("character_option_selections"."import_key" is null or length(btrim("character_option_selections"."import_key")) between 1 and 300);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_import_adapter_version_check" CHECK ("characters"."import_adapter_version" is null or "characters"."import_adapter_version" > 0);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_import_digest_check" CHECK ("characters"."import_digest" is null or length("characters"."import_digest") = 64);