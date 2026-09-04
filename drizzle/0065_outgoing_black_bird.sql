CREATE TABLE "character_option_selections" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"selection_kind" text NOT NULL,
	"feat_category" text,
	"acquired_level" integer NOT NULL,
	"acquisition_method" text,
	"grant_origin" text,
	"character_option_id" text,
	"name_snapshot" text NOT NULL,
	"source_material_identity_snapshot" text,
	"source_material_title_snapshot" text,
	"source_url_snapshot" text,
	"validation_note" text,
	"source_chronicle_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_option_selections_kind_check" CHECK ("character_option_selections"."selection_kind" in ('heritage', 'feat')),
	CONSTRAINT "character_option_selections_category_check" CHECK (("character_option_selections"."selection_kind" = 'heritage' and "character_option_selections"."feat_category" is null) or ("character_option_selections"."selection_kind" = 'feat' and ("character_option_selections"."feat_category" is null or "character_option_selections"."feat_category" in ('class', 'ancestry', 'skill', 'general')))),
	CONSTRAINT "character_option_selections_level_check" CHECK ("character_option_selections"."acquired_level" between 1 and 20),
	CONSTRAINT "character_option_selections_method_check" CHECK ("character_option_selections"."acquisition_method" is null or "character_option_selections"."acquisition_method" in ('selected', 'awarded')),
	CONSTRAINT "character_option_selections_name_check" CHECK (length(btrim("character_option_selections"."name_snapshot")) between 1 and 200),
	CONSTRAINT "character_option_selections_grant_origin_check" CHECK ("character_option_selections"."grant_origin" is null or length(btrim("character_option_selections"."grant_origin")) between 1 and 300),
	CONSTRAINT "character_option_selections_source_identity_check" CHECK ("character_option_selections"."source_material_identity_snapshot" is null or length(btrim("character_option_selections"."source_material_identity_snapshot")) between 1 and 200),
	CONSTRAINT "character_option_selections_source_title_check" CHECK ("character_option_selections"."source_material_title_snapshot" is null or length(btrim("character_option_selections"."source_material_title_snapshot")) between 1 and 300),
	CONSTRAINT "character_option_selections_source_url_check" CHECK ("character_option_selections"."source_url_snapshot" is null or length(btrim("character_option_selections"."source_url_snapshot")) between 1 and 2000),
	CONSTRAINT "character_option_selections_validation_note_check" CHECK ("character_option_selections"."validation_note" is null or length(btrim("character_option_selections"."validation_note")) between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "character_options" DROP CONSTRAINT "character_options_type_check";--> statement-breakpoint
ALTER TABLE "character_option_selections" ADD CONSTRAINT "character_option_selections_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_option_selections" ADD CONSTRAINT "character_option_selections_character_option_id_character_options_id_fk" FOREIGN KEY ("character_option_id") REFERENCES "public"."character_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_option_selections" ADD CONSTRAINT "character_option_selections_source_chronicle_id_chronicles_id_fk" FOREIGN KEY ("source_chronicle_id") REFERENCES "public"."chronicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_option_selections_one_heritage_unique" ON "character_option_selections" USING btree ("character_id") WHERE "character_option_selections"."selection_kind" = 'heritage';--> statement-breakpoint
CREATE INDEX "character_option_selections_character_idx" ON "character_option_selections" USING btree ("character_id","selection_kind","acquired_level");--> statement-breakpoint
CREATE INDEX "character_option_selections_catalog_idx" ON "character_option_selections" USING btree ("character_option_id");--> statement-breakpoint
CREATE INDEX "character_option_selections_chronicle_idx" ON "character_option_selections" USING btree ("source_chronicle_id");--> statement-breakpoint
ALTER TABLE "character_options" ADD CONSTRAINT "character_options_type_check" CHECK ("character_options"."option_type" in ('class', 'ancestry', 'background', 'heritage', 'feat', 'item'));