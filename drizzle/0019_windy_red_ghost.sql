INSERT INTO "game_systems" ("id", "code", "name")
VALUES ('starfinder2e', 'starfinder2e', 'Starfinder 2E')
ON CONFLICT ("id") DO UPDATE SET "code" = excluded."code", "name" = excluded."name", "updated_at" = now();--> statement-breakpoint
UPDATE "characters" SET "game_system_id" = 'starfinder2e' WHERE "game_system_id" <> 'starfinder2e';--> statement-breakpoint
UPDATE "rulesets" SET "game_system_id" = 'starfinder2e' WHERE "game_system_id" <> 'starfinder2e';--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "game_system_id" SET DEFAULT 'starfinder2e';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "game_system_id" text DEFAULT 'starfinder2e' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_game_system_id_game_systems_id_fk" FOREIGN KEY ("game_system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_game_system_id_idx" ON "sessions" USING btree ("game_system_id");
