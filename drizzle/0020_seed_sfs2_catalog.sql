INSERT INTO "game_systems" ("id", "code", "name")
VALUES ('starfinder2e', 'starfinder2e', 'Starfinder 2E')
ON CONFLICT ("id") DO UPDATE SET "code" = excluded."code", "name" = excluded."name", "updated_at" = now();--> statement-breakpoint
INSERT INTO "rulesets" ("id", "game_system_id", "code", "name", "edition")
VALUES ('ruleset-starfinder-2e', 'starfinder2e', 'sf2e', 'Starfinder Second Edition', '2e')
ON CONFLICT ("id") DO UPDATE SET "game_system_id" = excluded."game_system_id", "code" = excluded."code", "name" = excluded."name", "edition" = excluded."edition", "updated_at" = now();--> statement-breakpoint
INSERT INTO "organized_play_programs" ("id", "ruleset_id", "code", "name")
VALUES ('program-starfinder-society-2e', 'ruleset-starfinder-2e', 'sfs2', 'Starfinder Society Second Edition')
ON CONFLICT ("id") DO UPDATE SET "ruleset_id" = excluded."ruleset_id", "code" = excluded."code", "name" = excluded."name", "updated_at" = now();--> statement-breakpoint
INSERT INTO "content_items" ("id", "program_id", "code", "normalized_code", "title", "normalized_title", "content_type", "minimum_level", "maximum_level") VALUES
  ('sfs2-1-00', 'program-starfinder-society-2e', '1-00', '1-00', 'Collision''s Wake', 'collision s wake', 'special', 3, 3),
  ('sfs2-1-01', 'program-starfinder-society-2e', '1-01', '1-01', 'Invasion''s Edge', 'invasion s edge', 'scenario', 1, 2),
  ('sfs2-1-02', 'program-starfinder-society-2e', '1-02', '1-02', 'Mystery of the Frozen Moon', 'mystery of the frozen moon', 'scenario', 1, 2),
  ('sfs2-1-03', 'program-starfinder-society-2e', '1-03', '1-03', 'Disaster at Dreamlink Labs', 'disaster at dreamlink labs', 'scenario', 1, 2),
  ('sfs2-1-04', 'program-starfinder-society-2e', '1-04', '1-04', 'The Great Absalom Relay', 'the great absalom relay', 'scenario', 1, 2),
  ('sfs2-1-05', 'program-starfinder-society-2e', '1-05', '1-05', 'Sloughscar Summit', 'sloughscar summit', 'scenario', 1, 2),
  ('sfs2-1-06', 'program-starfinder-society-2e', '1-06', '1-06', 'Magic in the Mist', 'magic in the mist', 'scenario', 1, 2),
  ('sfs2-1-07', 'program-starfinder-society-2e', '1-07', '1-07', 'Seize and Destroy', 'seize and destroy', 'scenario', 1, 2),
  ('sfs2-1-08', 'program-starfinder-society-2e', '1-08', '1-08', 'Compliance Protocol', 'compliance protocol', 'scenario', 1, 2),
  ('sfs2-1-09', 'program-starfinder-society-2e', '1-09', '1-09', 'Abduction', 'abduction', 'scenario', 1, 2),
  ('sfs2-1-10', 'program-starfinder-society-2e', '1-10', '1-10', 'Rites of Rekindling', 'rites of rekindling', 'scenario', 1, 2),
  ('sfs2-1-11', 'program-starfinder-society-2e', '1-11', '1-11', 'Friends of the Forest', 'friends of the forest', 'scenario', 1, 2),
  ('sfs2-1-12', 'program-starfinder-society-2e', '1-12', '1-12', 'Take the Bait', 'take the bait', 'scenario', 3, 4),
  ('sfs2-1-13', 'program-starfinder-society-2e', '1-13', '1-13', 'Foul Humors', 'foul humors', 'scenario', 1, 2),
  ('sfs2-1-14', 'program-starfinder-society-2e', '1-14', '1-14', 'The Beasts of Bo: Part One', 'the beasts of bo part one', 'scenario', 3, 4),
  ('sfs2-1-15', 'program-starfinder-society-2e', '1-15', '1-15', 'Ruins of the World Soul', 'ruins of the world soul', 'scenario', 3, 4),
  ('sfs2-1-16', 'program-starfinder-society-2e', '1-16', '1-16', 'The Beasts of Bo: Part Two', 'the beasts of bo part two', 'scenario', 3, 4),
  ('sfs2-1-17', 'program-starfinder-society-2e', '1-17', '1-17', 'Corpse Fleet Conflict', 'corpse fleet conflict', 'scenario', 3, 4),
  ('sfs2-1-18', 'program-starfinder-society-2e', '1-18', '1-18', 'Midnights in Maro', 'midnights in maro', 'scenario', 3, 4),
  ('sfs2-1-20', 'program-starfinder-society-2e', '1-20', '1-20', 'Magic Unleashed', 'magic unleashed', 'scenario', 3, 4),
  ('sfs2-1-21', 'program-starfinder-society-2e', '1-21', '1-21', 'Breaching the Wreck', 'breaching the wreck', 'scenario', 3, 4),
  ('sfs2-1-22', 'program-starfinder-society-2e', '1-22', '1-22', 'Rescue in the Wreck', 'rescue in the wreck', 'scenario', 3, 4),
  ('sfs2-1-23', 'program-starfinder-society-2e', '1-23', '1-23', 'Psychic Echoes', 'psychic echoes', 'scenario', 1, 2),
  ('sfs2-1-24', 'program-starfinder-society-2e', '1-24', '1-24', 'Final Gambit: Part One', 'final gambit part one', 'scenario', 5, 6),
  ('sfs2-1-25', 'program-starfinder-society-2e', '1-25', '1-25', 'The Hollowed Shell', 'the hollowed shell', 'scenario', 3, 4),
  ('sfs2-1-26', 'program-starfinder-society-2e', '1-26', '1-26', 'Final Gambit: Part Two', 'final gambit part two', 'scenario', 5, 6),
  ('sfs2-2-00', 'program-starfinder-society-2e', '2-00', '2-00', 'Moon Busters', 'moon busters', 'special', 1, 4),
  ('sfs2-2-01', 'program-starfinder-society-2e', '2-01', '2-01', 'The First Cut', 'the first cut', 'scenario', 1, 2),
  ('sfs2-2-02', 'program-starfinder-society-2e', '2-02', '2-02', 'Solar Shake Up', 'solar shake up', 'scenario', 1, 2),
  ('sfs2-2-03', 'program-starfinder-society-2e', '2-03', '2-03', 'Bittersweet', 'bittersweet', 'scenario', 1, 2),
  ('sfs2-2-04', 'program-starfinder-society-2e', '2-04', '2-04', 'A Watery Grave', 'a watery grave', 'scenario', 3, 4),
  ('sfs2-2-05', 'program-starfinder-society-2e', '2-05', '2-05', 'File Corrupted', 'file corrupted', 'scenario', 1, 2),
  ('sfs2-2-06', 'program-starfinder-society-2e', '2-06', '2-06', 'An Inside Job', 'an inside job', 'scenario', 1, 2),
  ('sfs2-2-07', 'program-starfinder-society-2e', '2-07', '2-07', 'Attack at the Freemarkets', 'attack at the freemarkets', 'scenario', 1, 2),
  ('sfs2-2-08', 'program-starfinder-society-2e', '2-08', '2-08', 'Murder on the Tourmaline Comet', 'murder on the tourmaline comet', 'scenario', 3, 4),
  ('sfs2-2-09', 'program-starfinder-society-2e', '2-09', '2-09', 'Nyori Nightlife', 'nyori nightlife', 'scenario', 1, 2)
ON CONFLICT ("program_id", "normalized_code") DO UPDATE SET "code" = excluded."code", "title" = excluded."title", "normalized_title" = excluded."normalized_title", "content_type" = excluded."content_type", "minimum_level" = excluded."minimum_level", "maximum_level" = excluded."maximum_level", "updated_at" = now();--> statement-breakpoint
INSERT INTO "community_supported_programs" ("id", "community_id", "program_id")
SELECT gen_random_uuid()::text, "id", 'program-starfinder-society-2e'
FROM "communities"
ON CONFLICT ("community_id", "program_id") DO NOTHING;
