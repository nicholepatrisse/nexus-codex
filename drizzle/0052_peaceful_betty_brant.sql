CREATE TABLE "character_options" (
	"id" text PRIMARY KEY NOT NULL,
	"game_system_id" text DEFAULT 'starfinder2e' NOT NULL,
	"option_type" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"source_material_identity" text,
	"source_material_title" text,
	"source_url" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_options_type_check" CHECK ("character_options"."option_type" in ('class', 'ancestry', 'background', 'item')),
	CONSTRAINT "character_options_name_not_blank" CHECK (length(btrim("character_options"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "player_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"identity" text NOT NULL,
	"product_code" text,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_materials_identity_not_blank" CHECK (length(btrim("player_materials"."identity")) > 0),
	CONSTRAINT "player_materials_title_not_blank" CHECK (length(btrim("player_materials"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "character_options" ADD CONSTRAINT "character_options_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_materials" ADD CONSTRAINT "player_materials_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_options_source_url_unique" ON "character_options" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "character_options_type_name_idx" ON "character_options" USING btree ("option_type","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "player_materials_person_identity_unique" ON "player_materials" USING btree ("person_id","identity");--> statement-breakpoint
CREATE INDEX "player_materials_person_id_idx" ON "player_materials" USING btree ("person_id");