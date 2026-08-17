CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"code" text NOT NULL,
	"normalized_code" text NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"content_type" text NOT NULL,
	"minimum_level" integer NOT NULL,
	"maximum_level" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_type_check" CHECK ("content_items"."content_type" in ('scenario', 'special', 'adventure')),
	CONSTRAINT "content_items_minimum_level_check" CHECK ("content_items"."minimum_level" >= 1),
	CONSTRAINT "content_items_level_range_check" CHECK ("content_items"."maximum_level" >= "content_items"."minimum_level")
);
--> statement-breakpoint
CREATE TABLE "game_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_systems_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organized_play_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"ruleset_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rulesets" (
	"id" text PRIMARY KEY NOT NULL,
	"game_system_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"edition" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_program_id_organized_play_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."organized_play_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organized_play_programs" ADD CONSTRAINT "organized_play_programs_ruleset_id_rulesets_id_fk" FOREIGN KEY ("ruleset_id") REFERENCES "public"."rulesets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulesets" ADD CONSTRAINT "rulesets_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_program_normalized_code_unique" ON "content_items" USING btree ("program_id","normalized_code");--> statement-breakpoint
CREATE INDEX "content_items_program_title_idx" ON "content_items" USING btree ("program_id","normalized_title");--> statement-breakpoint
CREATE UNIQUE INDEX "organized_play_programs_ruleset_code_unique" ON "organized_play_programs" USING btree ("ruleset_id","code");--> statement-breakpoint
CREATE INDEX "organized_play_programs_ruleset_id_idx" ON "organized_play_programs" USING btree ("ruleset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rulesets_system_code_unique" ON "rulesets" USING btree ("game_system_id","code");--> statement-breakpoint
CREATE INDEX "rulesets_game_system_id_idx" ON "rulesets" USING btree ("game_system_id");