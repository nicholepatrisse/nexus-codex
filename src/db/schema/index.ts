import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { sql } from "drizzle-orm";

/** Infrastructure metadata only. Product tables begin with the M0 domain change. */
export const appMetadata = pgTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Application identity. A database trigger creates this in the auth-user transaction. */
export const people = pgTable(
  "people",
  {
    id: text("id").primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    discordHandle: text("discord_handle"),
    societyPlayNumber: text("society_play_number"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("people_auth_user_id_unique").on(table.authUserId),
    check("people_display_name_not_blank", sql`length(btrim(${table.displayName})) > 0`),
    check(
      "people_discord_handle_length_check",
      sql`${table.discordHandle} is null or length(${table.discordHandle}) <= 100`,
    ),
    check(
      "people_society_play_number_length_check",
      sql`${table.societyPlayNumber} is null or length(${table.societyPlayNumber}) <= 50`,
    ),
  ],
);

/** Per-person state for synthesized in-app notifications. */
export const notificationReads = pgTable(
  "notification_reads",
  {
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    notificationId: text("notification_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    clearedAt: timestamp("cleared_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("notification_reads_person_notification_unique").on(table.personId, table.notificationId),
    index("notification_reads_person_id_idx").on(table.personId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_subject_unique").on(table.providerId, table.accountId),
    index("auth_accounts_user_id_idx").on(table.userId),
    check(
      "auth_accounts_no_provider_tokens",
      sql`${table.accessToken} is null and ${table.refreshToken} is null and ${table.idToken} is null`,
    ),
  ],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const gameSystems = pgTable("game_systems", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const characters = pgTable(
  "characters",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    gameSystemId: text("game_system_id").notNull().default(SUPPORTED_GAME_SYSTEM.id).references(() => gameSystems.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    societyNumber: text("society_number").notNull(),
    startingLevel: integer("starting_level").notNull().default(1),
    startingLevelLocked: boolean("starting_level_locked").notNull().default(false),
    className: text("class"),
    classValidationNote: text("class_validation_note"),
    ancestry: text("ancestry"),
    ancestryValidationNote: text("ancestry_validation_note"),
    ancestrySourceChronicleId: text("ancestry_source_chronicle_id").references((): AnyPgColumn => chronicles.id, { onDelete: "set null" }),
    background: text("background"),
    backgroundValidationNote: text("background_validation_note"),
    backgroundSourceChronicleId: text("background_source_chronicle_id").references((): AnyPgColumn => chronicles.id, { onDelete: "set null" }),
    backstory: text("backstory"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("characters_person_id_idx").on(table.personId),
    index("characters_game_system_id_idx").on(table.gameSystemId),
    index("characters_ancestry_source_chronicle_idx").on(table.ancestrySourceChronicleId),
    index("characters_background_source_chronicle_idx").on(table.backgroundSourceChronicleId),
    uniqueIndex("characters_person_society_number_unique").on(table.personId, table.societyNumber),
    check("characters_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("characters_name_length_check", sql`length(${table.name}) <= 100`),
    check("characters_starting_level_check", sql`${table.startingLevel} in (1, 3, 5, 7)`),
    check("characters_class_length_check", sql`${table.className} is null or length(${table.className}) <= 100`),
    check("characters_class_validation_note_length_check", sql`${table.classValidationNote} is null or length(${table.classValidationNote}) <= 1000`),
    check("characters_ancestry_length_check", sql`${table.ancestry} is null or length(${table.ancestry}) <= 100`),
    check("characters_ancestry_validation_note_length_check", sql`${table.ancestryValidationNote} is null or length(${table.ancestryValidationNote}) <= 1000`),
    check("characters_background_length_check", sql`${table.background} is null or length(${table.background}) <= 100`),
    check("characters_background_validation_note_length_check", sql`${table.backgroundValidationNote} is null or length(${table.backgroundValidationNote}) <= 1000`),
    check("characters_backstory_length_check", sql`${table.backstory} is null or length(${table.backstory}) <= 5000`),
    check("characters_notes_length_check", sql`${table.notes} is null or length(${table.notes}) <= 5000`),
    check("characters_society_number_format", sql`${table.societyNumber} ~ '^[0-9]+-[0-9]+$'`),
  ],
);

/** Paizo rulebooks/products a player owns. Player Core is implicit and is not stored. */
export const playerMaterials = pgTable(
  "player_materials",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
    identity: text("identity").notNull(),
    isbn: text("isbn"),
    productCode: text("product_code"),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_materials_person_identity_unique").on(table.personId, table.identity),
    uniqueIndex("player_materials_person_isbn_unique").on(table.personId, table.isbn).where(sql`${table.isbn} is not null`),
    index("player_materials_person_id_idx").on(table.personId),
    check("player_materials_identity_not_blank", sql`length(btrim(${table.identity})) > 0`),
    check("player_materials_isbn_format", sql`${table.isbn} is null or ${table.isbn} ~ '^[0-9]{13}$'`),
    check("player_materials_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  ],
);

/** Canonical Paizo source products discovered while importing rules content. */
export const sourceMaterials = pgTable("source_materials", {
  id: text("id").primaryKey(),
  isbn: text("isbn"),
  title: text("title").notNull(),
  productCode: text("product_code"),
  nethysSourceUrl: text("nethys_source_url"),
  paizoProductUrl: text("paizo_product_url").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("source_materials_isbn_unique").on(table.isbn).where(sql`${table.isbn} is not null`),
  uniqueIndex("source_materials_product_code_unique").on(table.productCode).where(sql`${table.productCode} is not null`),
  uniqueIndex("source_materials_nethys_url_unique").on(table.nethysSourceUrl).where(sql`${table.nethysSourceUrl} is not null`),
  check("source_materials_identity_check", sql`${table.isbn} is not null or ${table.productCode} is not null`),
  check("source_materials_isbn_format", sql`${table.isbn} is null or ${table.isbn} ~ '^[0-9]{13}$'`),
  check("source_materials_title_not_blank", sql`length(btrim(${table.title})) > 0`),
]);

/** Reusable, globally deduplicated character options imported from Archives of Nethys. */
export const characterOptions = pgTable(
  "character_options",
  {
    id: text("id").primaryKey(),
    gameSystemId: text("game_system_id").notNull().default(SUPPORTED_GAME_SYSTEM.id).references(() => gameSystems.id, { onDelete: "restrict" }),
    optionType: text("option_type").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    sourceMaterialIdentity: text("source_material_identity"),
    sourceMaterialTitle: text("source_material_title"),
    sourceUrl: text("source_url").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("character_options_source_url_unique").on(table.sourceUrl),
    index("character_options_type_name_idx").on(table.optionType, table.normalizedName),
    check("character_options_type_check", sql`${table.optionType} in ('class', 'ancestry', 'background', 'item')`),
    check("character_options_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const rulesets = pgTable(
  "rulesets",
  {
    id: text("id").primaryKey(),
    gameSystemId: text("game_system_id")
      .notNull()
      .references(() => gameSystems.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    edition: text("edition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rulesets_system_code_unique").on(table.gameSystemId, table.code),
    index("rulesets_game_system_id_idx").on(table.gameSystemId),
  ],
);

export const organizedPlayPrograms = pgTable(
  "organized_play_programs",
  {
    id: text("id").primaryKey(),
    rulesetId: text("ruleset_id")
      .notNull()
      .references(() => rulesets.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organized_play_programs_ruleset_code_unique").on(table.rulesetId, table.code),
    index("organized_play_programs_ruleset_id_idx").on(table.rulesetId),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => organizedPlayPrograms.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    normalizedCode: text("normalized_code").notNull(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    contentType: text("content_type").notNull(),
    minimumLevel: integer("minimum_level").notNull(),
    maximumLevel: integer("maximum_level").notNull(),
    source: text("source"),
    sourceUrl: text("source_url"),
    productCode: text("product_code"),
    publicationDate: date("publication_date"),
    description: text("description"),
    createdByPersonId: text("created_by_person_id").references(() => people.id, { onDelete: "set null" }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_items_program_normalized_code_unique").on(
      table.programId,
      table.normalizedCode,
    ),
    index("content_items_program_title_idx").on(table.programId, table.normalizedTitle),
    uniqueIndex("content_items_source_url_unique").on(table.sourceUrl).where(sql`${table.sourceUrl} is not null`),
    uniqueIndex("content_items_source_product_code_unique").on(table.source, table.productCode).where(sql`${table.productCode} is not null`),
    check(
      "content_items_type_check",
      sql`${table.contentType} in ('scenario', 'special', 'adventure')`,
    ),
    check("content_items_minimum_level_check", sql`${table.minimumLevel} >= 1`),
    check("content_items_source_check", sql`${table.source} is null or ${table.source} in ('paizo')`),
    check(
      "content_items_level_range_check",
      sql`${table.maximumLevel} >= ${table.minimumLevel}`,
    ),
  ],
);

export const communities = pgTable(
  "communities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    eventName: text("event_name"),
    eventCode: text("event_code"),
    visibility: text("visibility").notNull().default("private"),
    scheduleVisibility: text("schedule_visibility").notNull().default("members"),
    membershipApproval: text("membership_approval").notNull().default("manual"),
    gmAdmission: text("gm_admission").notNull().default("approved_only"),
    lifecycleStatus: text("lifecycle_status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("communities_slug_unique").on(table.slug),
    check("communities_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "communities_description_length_check",
      sql`${table.description} is null or length(${table.description}) <= 2000`,
    ),
    check("communities_event_name_length_check", sql`${table.eventName} is null or length(btrim(${table.eventName})) between 1 and 200`),
    check("communities_event_code_length_check", sql`${table.eventCode} is null or length(btrim(${table.eventCode})) between 1 and 100`),
    check("communities_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check("communities_visibility_check", sql`${table.visibility} in ('private', 'public')`),
    check(
      "communities_schedule_visibility_check",
      sql`${table.scheduleVisibility} in ('members', 'public')`,
    ),
    check(
      "communities_membership_approval_check",
      sql`${table.membershipApproval} in ('manual', 'automatic')`,
    ),
    check(
      "communities_gm_admission_check",
      sql`${table.gmAdmission} in ('approved_only', 'self_service')`,
    ),
    check(
      "communities_lifecycle_status_check",
      sql`${table.lifecycleStatus} in ('active', 'archived')`,
    ),
  ],
);

export const communitySupportedPrograms = pgTable(
  "community_supported_programs",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => organizedPlayPrograms.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("community_supported_programs_community_program_unique").on(
      table.communityId,
      table.programId,
    ),
    index("community_supported_programs_program_id_idx").on(table.programId),
  ],
);

export const communityMemberships = pgTable(
  "community_memberships",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("community_memberships_community_person_unique").on(
      table.communityId,
      table.personId,
    ),
    index("community_memberships_person_id_idx").on(table.personId),
    check(
      "community_memberships_status_check",
      sql`${table.status} in ('pending', 'active', 'suspended', 'left')`,
    ),
  ],
);

export const communityRoleGrants = pgTable(
  "community_role_grants",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id").notNull(),
    personId: text("person_id").notNull(),
    role: text("role").notNull(),
    grantedByPersonId: text("granted_by_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("active"),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokedByPersonId: text("revoked_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    revocationReason: text("revocation_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId, table.personId],
      foreignColumns: [communityMemberships.communityId, communityMemberships.personId],
      name: "community_role_grants_membership_fk",
    }).onDelete("restrict"),
    uniqueIndex("community_role_grants_active_role_unique")
      .on(table.communityId, table.personId, table.role)
      .where(sql`${table.revokedAt} is null`),
    index("community_role_grants_person_id_idx").on(table.personId),
    check("community_role_grants_role_check", sql`${table.role} in ('owner', 'gm')`),
    check(
      "community_role_grants_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
    check(
      "community_role_grants_reason_length_check",
      sql`${table.revocationReason} is null or length(${table.revocationReason}) <= 500`,
    ),
    check(
      "community_role_grants_revocation_time_check",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.grantedAt}`,
    ),
    check(
      "community_role_grants_lifecycle_check",
      sql`coalesce((${table.role} = 'owner' and ${table.status} = 'active' and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)
        or (${table.role} = 'gm' and ${table.status} = 'active' and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)
        or (${table.role} = 'gm' and ${table.status} = 'revoked' and ${table.revokedAt} is not null and (${table.revokedByPersonId} is not null or (${table.revokedByPersonId} is null and ${table.revocationReason} = 'Legacy revocation: actor unavailable'))), false)`,
    ),
  ],
);

export const communityAuditEvents = pgTable(
  "community_audit_events",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    actorPersonId: text("actor_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("community_audit_events_community_occurred_at_idx").on(
      table.communityId,
      table.occurredAt,
    ),
    index("community_audit_events_actor_person_id_idx").on(table.actorPersonId),
    check(
      "community_audit_events_type_check",
      sql`${table.eventType} in ('community.settings.updated', 'community.archived', 'community.restored', 'community.invitation.created', 'community.invitation.accepted', 'community.invitation.revoked', 'community.invitation.expired', 'community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled', 'community.gm.requested', 'community.gm.approved', 'community.gm.rejected', 'community.gm.cancelled', 'community.gm.revoked', 'community.gm.self_service_promoted', 'session.draft.created', 'session.draft.updated', 'session.gm.reassigned', 'session.published', 'session.published.updated', 'session.cancelled', 'session.completed', 'session.notes.updated', 'session.signup.confirmed', 'session.signup.waitlisted', 'session.signup.cancelled', 'session.signup.promoted', 'session.signup.updated')`,
    ),
    check("community_audit_events_details_object_check", sql`jsonb_typeof(${table.details}) = 'object'`),
  ],
);

/** M0 session drafts. Location details and additional staff roles are added by later milestones. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "restrict" }),
    gameSystemId: text("game_system_id")
      .notNull()
      .default(SUPPORTED_GAME_SYSTEM.id)
      .references(() => gameSystems.id, { onDelete: "restrict" }),
    gmPersonId: text("gm_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    displayTimeZone: text("display_time_zone").notNull(),
    playerCapacity: integer("player_capacity").notNull().default(6),
    notes: text("notes"),
    locationType: text("location_type").notNull(),
    createdByPersonId: text("created_by_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    updatedByPersonId: text("updated_by_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    paizoReportedAt: timestamp("paizo_reported_at", { withTimezone: true, mode: "date" }),
    paizoReportedByPersonId: text("paizo_reported_by_person_id").references(() => people.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId, table.gmPersonId],
      foreignColumns: [communityMemberships.communityId, communityMemberships.personId],
      name: "sessions_gm_membership_fk",
    }).onDelete("restrict"),
    index("sessions_community_status_starts_at_idx").on(
      table.communityId,
      table.status,
      table.startsAt,
    ),
    index("sessions_gm_status_starts_at_idx").on(table.gmPersonId, table.status, table.startsAt),
    index("sessions_game_system_id_idx").on(table.gameSystemId),
    check("sessions_status_check", sql`${table.status} in ('draft', 'published', 'completed', 'cancelled')`),
    check("sessions_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "sessions_display_time_zone_check",
      sql`length(${table.displayTimeZone}) <= 100 and ${table.displayTimeZone} ~ '^(UTC|[A-Za-z][A-Za-z0-9._+-]*(/[A-Za-z][A-Za-z0-9._+-]*)+)$'`,
    ),
    check("sessions_capacity_check", sql`${table.playerCapacity} = 6`),
    check("sessions_notes_length_check", sql`${table.notes} is null or length(${table.notes}) <= 4000`),
    check("sessions_location_type_check", sql`${table.locationType} in ('virtual', 'physical')`),
    check("sessions_paizo_reporting_check", sql`(${table.paizoReportedAt} is null) = (${table.paizoReportedByPersonId} is null)`),
  ],
);

export const sessionSignups = pgTable(
  "session_signups",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    characterId: text("character_id")
      .references(() => characters.id, { onDelete: "restrict" }),
    pregenName: text("pregen_name"),
    pregenLevel: integer("pregen_level"),
    creditRecipientCharacterId: text("credit_recipient_character_id")
      .references(() => characters.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    waitlistPosition: integer("waitlist_position"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("session_signups_live_person_unique")
      .on(table.sessionId, table.personId)
      .where(sql`${table.status} in ('confirmed', 'waitlisted')`),
    uniqueIndex("session_signups_waitlist_position_unique")
      .on(table.sessionId, table.waitlistPosition)
      .where(sql`${table.status} = 'waitlisted'`),
    index("session_signups_session_status_idx").on(table.sessionId, table.status),
    index("session_signups_credit_recipient_idx").on(table.creditRecipientCharacterId),
    check(
      "session_signups_status_check",
      sql`${table.status} in ('confirmed', 'waitlisted', 'cancelled')`,
    ),
    check(
      "session_signups_lifecycle_check",
      sql`coalesce((${table.status} = 'confirmed' and ${table.waitlistPosition} is null and ${table.cancelledAt} is null)
        or (${table.status} = 'waitlisted' and ${table.waitlistPosition} is not null and ${table.waitlistPosition} > 0 and ${table.cancelledAt} is null)
        or (${table.status} = 'cancelled' and ${table.cancelledAt} is not null), false)`,
    ),
    check(
      "session_signups_character_choice_check",
      sql`coalesce((${table.characterId} is not null and ${table.pregenName} is null and ${table.pregenLevel} is null and ${table.creditRecipientCharacterId} is null)
        or (${table.characterId} is null and length(btrim(${table.pregenName})) between 1 and 100 and ${table.pregenLevel} in (1, 3, 5, 7) and ${table.creditRecipientCharacterId} is not null)
        or (${table.characterId} is null and ${table.pregenName} is null and ${table.pregenLevel} is null and ${table.creditRecipientCharacterId} is null), false)`,
    ),
  ],
);

/** A GM's character credit for a real Nexus session; never represents player participation. */
export const sessionGmCredits = pgTable(
  "session_gm_credits",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "restrict" }),
    gmPersonId: text("gm_person_id").notNull().references(() => people.id, { onDelete: "restrict" }),
    characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("session_gm_credits_session_gm_unique").on(table.sessionId, table.gmPersonId),
    index("session_gm_credits_character_id_idx").on(table.characterId),
  ],
);

/** Immutable play/reward history owned by a character. Manual rows have no session. */
export const chronicles = pgTable(
  "chronicles",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "restrict" }),
    contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
    scenarioNumberSnapshot: text("scenario_number_snapshot").notNull(),
    scenarioNameSnapshot: text("scenario_name_snapshot").notNull(),
    playedOn: date("played_on", { mode: "string" }).notNull(),
    playedAt: timestamp("played_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("pending"),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    provenance: text("provenance").notNull().default("manual"),
    creditType: text("credit_type").notNull().default("normal"),
    eligibilityState: text("eligibility_state").notNull().default("unverifiable"),
    scenarioMinimumLevelSnapshot: integer("scenario_minimum_level_snapshot"),
    scenarioMaximumLevelSnapshot: integer("scenario_maximum_level_snapshot"),
    eligibilityNote: text("eligibility_note"),
    characterLevel: integer("character_level").notNull(),
    advancementSpeed: text("advancement_speed").notNull(),
    xp: integer("xp").notNull(),
    baseCreditsMinor: integer("base_credits_minor").notNull(),
    downtimeCreditsMinor: integer("downtime_credits_minor").notNull().default(0),
    downtimeDays: integer("downtime_days").notNull(),
    downtimeDisposition: text("downtime_disposition").notNull(),
    downtimeEntryMethod: text("downtime_entry_method").notNull().default("calculated"),
    downtimeCheckTotal: integer("downtime_check_total"),
    downtimeProficiency: text("downtime_proficiency"),
    downtimeDc: integer("downtime_dc"),
    downtimeDegree: text("downtime_degree"),
    downtimeCalculatedCreditsMinor: integer("downtime_calculated_credits_minor"),
    downtimeSheetCreditsMinor: integer("downtime_sheet_credits_minor"),
    downtimeOverrideCreditsMinor: integer("downtime_override_credits_minor"),
    downtimeCorrectionNote: text("downtime_correction_note"),
    downtimeActivity: text("downtime_activity"),
    chronicleNumber: text("chronicle_number"),
    partnerCode: text("partner_code"),
    eventName: text("event_name"),
    eventCode: text("event_code"),
    gmOrganizedPlayId: text("gm_organized_play_id"),
    playerNotes: text("player_notes"),
    gmNotes: text("gm_notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("chronicles_character_date_id_idx").on(table.characterId, table.playedOn, table.id),
    uniqueIndex("chronicles_character_scenario_unique").on(table.characterId, sql`lower(btrim(${table.scenarioNumberSnapshot}))`),
    index("chronicles_session_id_idx").on(table.sessionId),
    uniqueIndex("chronicles_session_character_unique").on(table.sessionId, table.characterId).where(sql`${table.sessionId} is not null`),
    index("chronicles_content_item_id_idx").on(table.contentItemId),
    check("chronicles_scenario_number_length_check", sql`length(btrim(${table.scenarioNumberSnapshot})) between 1 and 100`),
    check("chronicles_scenario_name_length_check", sql`length(btrim(${table.scenarioNameSnapshot})) between 1 and 200`),
    check("chronicles_character_level_check", sql`${table.characterLevel} between 1 and 20`),
    check("chronicles_advancement_speed_check", sql`${table.advancementSpeed} in ('standard', 'slow')`),
    check("chronicles_status_check", sql`${table.status} in ('pending', 'applied')`),
    check("chronicles_provenance_check", sql`${table.provenance} in ('manual', 'nexus')`),
    check("chronicles_credit_type_check", sql`${table.creditType} in ('normal', 'pregen', 'gm', 'correction')`),
    check("chronicles_eligibility_state_check", sql`${table.eligibilityState} in ('eligible', 'held', 'ineligible', 'unverifiable')`),
    check("chronicles_level_snapshot_check", sql`(${table.scenarioMinimumLevelSnapshot} is null and ${table.scenarioMaximumLevelSnapshot} is null) or (${table.scenarioMinimumLevelSnapshot} >= 1 and ${table.scenarioMaximumLevelSnapshot} >= ${table.scenarioMinimumLevelSnapshot})`),
    check("chronicles_eligibility_note_check", sql`${table.eligibilityNote} is null or length(btrim(${table.eligibilityNote})) between 1 and 1000`),
    check("chronicles_provenance_session_check", sql`coalesce((${table.provenance} = 'manual' and ${table.sessionId} is null) or (${table.provenance} = 'nexus' and ${table.sessionId} is not null), false)`),
    check("chronicles_lifecycle_check", sql`coalesce((${table.status} = 'pending' and ${table.appliedAt} is null) or (${table.status} = 'applied' and ${table.appliedAt} is not null), false)`),
    check("chronicles_xp_check", sql`${table.xp} >= 0`),
    check("chronicles_base_credits_check", sql`${table.baseCreditsMinor} >= 0`),
    check("chronicles_downtime_credits_check", sql`${table.downtimeCreditsMinor} >= 0`),
    check("chronicles_downtime_days_check", sql`${table.downtimeDays} = ${table.xp} * 2`),
    check("chronicles_downtime_disposition_check", sql`${table.downtimeDisposition} in ('earn_income', 'other', 'declined')`),
    check("chronicles_downtime_entry_method_check", sql`${table.downtimeEntryMethod} in ('calculated', 'sheet')`),
    check("chronicles_downtime_earn_income_check", sql`coalesce((${table.downtimeDisposition} <> 'earn_income') or (${table.downtimeEntryMethod} = 'calculated' and ${table.downtimeCheckTotal} is not null and ${table.downtimeProficiency} in ('trained', 'expert', 'master') and ${table.downtimeDc} is not null and ${table.downtimeDegree} in ('critical_success', 'success', 'failure', 'critical_failure') and ${table.downtimeCalculatedCreditsMinor} is not null and ${table.downtimeSheetCreditsMinor} is null) or (${table.downtimeEntryMethod} = 'sheet' and ${table.downtimeSheetCreditsMinor} >= 0 and ${table.downtimeCheckTotal} is null and ${table.downtimeProficiency} is null and ${table.downtimeDc} is null and ${table.downtimeDegree} is null and ${table.downtimeCalculatedCreditsMinor} is null), false)`),
    check("chronicles_downtime_override_check", sql`${table.downtimeOverrideCreditsMinor} is null or (${table.downtimeOverrideCreditsMinor} >= 0 and length(btrim(${table.downtimeCorrectionNote})) > 0)`),
    check("chronicles_metadata_lengths_check", sql`(${table.chronicleNumber} is null or length(${table.chronicleNumber}) <= 100) and (${table.partnerCode} is null or length(${table.partnerCode}) <= 100) and (${table.eventName} is null or length(${table.eventName}) <= 200) and (${table.eventCode} is null or length(${table.eventCode}) <= 100) and (${table.gmOrganizedPlayId} is null or length(${table.gmOrganizedPlayId}) <= 100)`),
    check("chronicles_player_notes_length_check", sql`${table.playerNotes} is null or length(${table.playerNotes}) <= 5000`),
    check("chronicles_gm_notes_length_check", sql`${table.gmNotes} is null or length(${table.gmNotes}) <= 5000`),
  ],
);

const bytea = customType<{ data: Buffer }>({ dataType() { return "bytea"; } });

/** Auditable copies of official sheets issued by a GM. Replaced rows remain as history. */
export const chronicleSheetAttachments = pgTable(
  "chronicle_sheet_attachments",
  {
    id: text("id").primaryKey(),
    chronicleId: text("chronicle_id").notNull().references(() => chronicles.id, { onDelete: "restrict" }),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    contents: bytea("contents").notNull(),
    uploadedByPersonId: text("uploaded_by_person_id").notNull().references(() => people.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    isCurrent: boolean("is_current").notNull().default(true),
  },
  (table) => [
    index("chronicle_sheet_attachments_chronicle_idx").on(table.chronicleId, table.uploadedAt),
    uniqueIndex("chronicle_sheet_attachments_current_unique").on(table.chronicleId).where(sql`${table.isCurrent}`),
    check("chronicle_sheet_attachments_filename_check", sql`length(btrim(${table.originalFilename})) between 1 and 255`),
    check("chronicle_sheet_attachments_content_type_check", sql`${table.contentType} in ('application/pdf', 'image/png', 'image/jpeg')`),
    check("chronicle_sheet_attachments_size_check", sql`${table.byteSize} between 1 and 10485760`),
  ],
);

/** Immutable acquisition history. Inventory may later disappear, but this record remains. */
export const characterPurchases = pgTable(
  "character_purchases",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    itemLinkSnapshot: text("item_link_snapshot"),
    bulkSnapshot: text("bulk_snapshot"),
    quantity: integer("quantity").notNull(),
    acquiredOn: date("acquired_on", { mode: "string" }).notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    totalPriceMinor: integer("total_price_minor").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("character_purchases_character_acquired_idx").on(table.characterId, table.acquiredOn, table.createdAt),
    index("character_purchases_content_item_idx").on(table.contentItemId),
    uniqueIndex("character_purchases_character_idempotency_unique").on(table.characterId, table.idempotencyKey),
    check("character_purchases_name_check", sql`length(btrim(${table.itemNameSnapshot})) between 1 and 200`),
    check("character_purchases_link_length_check", sql`${table.itemLinkSnapshot} is null or length(${table.itemLinkSnapshot}) <= 2000`),
    check("character_purchases_bulk_length_check", sql`${table.bulkSnapshot} is null or length(btrim(${table.bulkSnapshot})) between 1 and 20`),
    check("character_purchases_quantity_check", sql`${table.quantity} > 0`),
    check("character_purchases_unit_price_check", sql`${table.unitPriceMinor} > 0`),
    check("character_purchases_total_price_check", sql`${table.totalPriceMinor} > 0 and ${table.totalPriceMinor} = ${table.unitPriceMinor} * ${table.quantity}`),
    check("character_purchases_idempotency_key_check", sql`length(btrim(${table.idempotencyKey})) between 1 and 200`),
  ],
);

/** Immutable disposition history. Sale rows retain the acquisition-lot snapshot. */
export const characterSales = pgTable(
  "character_sales",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    inventoryEntryId: text("inventory_entry_id").notNull().references((): AnyPgColumn => characterInventoryEntries.id, { onDelete: "restrict" }),
    sourcePurchaseId: text("source_purchase_id").references(() => characterPurchases.id, { onDelete: "restrict" }),
    contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    itemLinkSnapshot: text("item_link_snapshot"),
    quantity: integer("quantity").notNull(),
    unitValueMinor: integer("original_unit_paid_minor").notNull(),
    totalValueMinor: integer("original_total_paid_minor").notNull(),
    saleAmountMinor: integer("sale_amount_minor").notNull(),
    soldOn: date("sold_on", { mode: "string" }).notNull(),
    saleKind: text("sale_kind").notNull().default("ordinary"),
    pricingPolicy: text("pricing_policy").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("character_sales_character_sold_idx").on(table.characterId, table.soldOn, table.createdAt),
    index("character_sales_inventory_entry_idx").on(table.inventoryEntryId),
    uniqueIndex("character_sales_character_idempotency_unique").on(table.characterId, table.idempotencyKey),
    check("character_sales_name_check", sql`length(btrim(${table.itemNameSnapshot})) between 1 and 200`),
    check("character_sales_quantity_check", sql`${table.quantity} > 0`),
    check("character_sales_paid_price_check", sql`${table.unitValueMinor} >= 0 and ${table.totalValueMinor} = ${table.unitValueMinor} * ${table.quantity}`),
    check("character_sales_amount_check", sql`${table.saleAmountMinor} > 0`),
    check("character_sales_kind_check", sql`${table.saleKind} in ('ordinary', 'refund')`),
    check("character_sales_policy_check", sql`length(btrim(${table.pricingPolicy})) between 1 and 100`),
    check("character_sales_idempotency_key_check", sql`length(btrim(${table.idempotencyKey})) between 1 and 200`),
  ],
);

/** Append-only, exact-value financial history. Posted rows are never updated or deleted. */
export const characterCreditLedgerEntries = pgTable(
  "character_credit_ledger_entries",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    displayScale: integer("display_scale").notNull().default(1),
    type: text("type").notNull(),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    source: text("source").notNull(),
    sourceChronicleId: text("source_chronicle_id").references(() => chronicles.id, { onDelete: "set null" }),
    sourcePurchaseId: text("source_purchase_id").references(() => characterPurchases.id, { onDelete: "restrict" }),
    sourceSaleId: text("source_sale_id").references(() => characterSales.id, { onDelete: "restrict" }),
    reversesEntryId: text("reverses_entry_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_ledger_character_effective_created_id_idx").on(table.characterId, table.effectiveOn, table.createdAt, table.id),
    uniqueIndex("credit_ledger_chronicle_reward_unique").on(table.sourceChronicleId).where(sql`${table.type} = 'chronicle_reward'`),
    uniqueIndex("credit_ledger_starting_credits_unique").on(table.characterId).where(sql`${table.type} = 'starting_credits'`),
    uniqueIndex("credit_ledger_purchase_unique").on(table.sourcePurchaseId).where(sql`${table.type} = 'purchase'`),
    uniqueIndex("credit_ledger_sale_unique").on(table.sourceSaleId).where(sql`${table.type} = 'sale'`),
    foreignKey({ columns: [table.reversesEntryId], foreignColumns: [table.id], name: "credit_ledger_reverses_entry_fk" }).onDelete("restrict"),
    check("credit_ledger_amount_nonzero_check", sql`${table.amountMinor} <> 0 or ${table.type} in ('starting_credits', 'chronicle_reward')`),
    check("credit_ledger_display_scale_check", sql`${table.displayScale} = 1`),
    check("credit_ledger_type_check", sql`${table.type} in ('starting_credits', 'chronicle_reward', 'adjustment', 'purchase', 'sale')`),
    check("credit_ledger_source_check", sql`${table.source} in ('character_creation', 'chronicle', 'owner_adjustment', 'chronicle_reversal', 'chronicle_correction', 'purchase', 'sale')`),
    check("credit_ledger_source_relationship_check", sql`coalesce((${table.type} = 'chronicle_reward' and ${table.sourceChronicleId} is not null and ${table.sourcePurchaseId} is null and ${table.sourceSaleId} is null and ${table.reversesEntryId} is null) or (${table.type} = 'starting_credits' and ${table.sourceChronicleId} is null and ${table.sourcePurchaseId} is null and ${table.sourceSaleId} is null and ${table.reversesEntryId} is null) or (${table.type} = 'purchase' and ${table.sourcePurchaseId} is not null and ${table.sourceChronicleId} is null and ${table.sourceSaleId} is null and ${table.reversesEntryId} is null and ${table.amountMinor} < 0) or (${table.type} = 'sale' and ${table.sourceSaleId} is not null and ${table.sourcePurchaseId} is null and ${table.sourceChronicleId} is null and ${table.reversesEntryId} is null and ${table.amountMinor} > 0) or (${table.type} = 'adjustment' and ${table.sourcePurchaseId} is null and ${table.sourceSaleId} is null), false)`),
    check("credit_ledger_notes_length_check", sql`${table.notes} is null or length(${table.notes}) <= 1000`),
  ],
);

/** Current owned equipment. Each row is an acquisition lot, never transaction history. */
export const characterInventoryEntries = pgTable(
  "character_inventory_entries",
  {
    id: text("id").primaryKey(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    itemLinkSnapshot: text("item_link_snapshot"),
    bulkSnapshot: text("bulk_snapshot"),
    sourceMaterialIdentity: text("source_material_identity"),
    sourceMaterialTitle: text("source_material_title"),
    sourceMaterialId: text("source_material_id").references(() => sourceMaterials.id, { onDelete: "set null" }),
    societyLegal: boolean("society_legal"),
    societyStatus: text("society_status"),
    rarity: text("rarity"),
    quantity: integer("quantity").notNull(),
    acquisitionType: text("acquisition_type").notNull(),
    acquiredOn: date("acquired_on", { mode: "string" }).notNull(),
    amountPaidMinor: integer("amount_paid_minor"),
    valueMinor: integer("value_minor"),
    sourceChronicleId: text("source_chronicle_id").references(() => chronicles.id, { onDelete: "set null" }),
    sourcePurchaseId: text("source_purchase_id").references(() => characterPurchases.id, { onDelete: "restrict" }),
    notes: text("notes"),
    validationNote: text("validation_note"),
    /** Stable provenance identity keeps otherwise-similar cost/source lots distinct. */
    lotKey: text("lot_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("character_inventory_character_acquired_idx").on(table.characterId, table.acquiredOn, table.createdAt),
    index("character_inventory_content_item_idx").on(table.contentItemId),
    index("character_inventory_source_chronicle_idx").on(table.sourceChronicleId),
    index("character_inventory_source_material_idx").on(table.sourceMaterialId),
    uniqueIndex("character_inventory_source_purchase_unique").on(table.sourcePurchaseId).where(sql`${table.sourcePurchaseId} is not null`),
    uniqueIndex("character_inventory_character_lot_unique").on(table.characterId, table.lotKey),
    check("character_inventory_name_check", sql`length(btrim(${table.itemNameSnapshot})) between 1 and 200`),
    check("character_inventory_link_length_check", sql`${table.itemLinkSnapshot} is null or length(${table.itemLinkSnapshot}) <= 2000`),
    check("character_inventory_bulk_length_check", sql`${table.bulkSnapshot} is null or length(btrim(${table.bulkSnapshot})) between 1 and 20`),
    check("character_inventory_source_material_identity_length_check", sql`${table.sourceMaterialIdentity} is null or length(btrim(${table.sourceMaterialIdentity})) between 1 and 200`),
    check("character_inventory_source_material_title_length_check", sql`${table.sourceMaterialTitle} is null or length(btrim(${table.sourceMaterialTitle})) between 1 and 300`),
    check("character_inventory_rarity_length_check", sql`${table.rarity} is null or length(btrim(${table.rarity})) between 1 and 30`),
    check("character_inventory_society_status_check", sql`${table.societyStatus} is null or ${table.societyStatus} in ('standard', 'limited', 'restricted')`),
    check("character_inventory_quantity_check", sql`${table.quantity} >= 0`),
    check("character_inventory_acquisition_type_check", sql`${table.acquisitionType} in ('starting_equipment', 'purchased', 'crafted', 'boon_reward', 'other')`),
    check("character_inventory_amount_paid_check", sql`${table.amountPaidMinor} is null or ${table.amountPaidMinor} >= 0`),
    check("character_inventory_value_check", sql`${table.valueMinor} is null or ${table.valueMinor} >= 0`),
    check("character_inventory_notes_length_check", sql`${table.notes} is null or length(${table.notes}) <= 5000`),
    check("character_inventory_validation_note_length_check", sql`${table.validationNote} is null or length(${table.validationNote}) <= 1000`),
  ],
);

/** A reusable community share link. Only a one-way digest of its bearer token is persisted. */
export const communityInvitations = pgTable(
  "community_invitations",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    createdByPersonId: text("created_by_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    revokedByPersonId: text("revoked_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    revocationReason: text("revocation_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("community_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("community_invitations_id_community_unique").on(table.id, table.communityId),
    index("community_invitations_community_status_idx").on(table.communityId, table.status),
    check(
      "community_invitations_status_check",
      sql`${table.status} in ('pending', 'exhausted', 'revoked', 'expired')`,
    ),
    check("community_invitations_max_uses_check", sql`${table.maxUses} is null or ${table.maxUses} >= 1`),
    check("community_invitations_use_count_check", sql`${table.useCount} >= 0 and (${table.maxUses} is null or ${table.useCount} <= ${table.maxUses})`),
    check(
      "community_invitations_terminal_state_check",
      sql`(${table.status} = 'pending' and (${table.maxUses} is null or ${table.useCount} < ${table.maxUses}) and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)
        or (${table.status} = 'exhausted' and ${table.maxUses} is not null and ${table.useCount} = ${table.maxUses} and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)
        or (${table.status} = 'revoked' and ${table.revokedAt} is not null and ${table.revokedByPersonId} is not null)
        or (${table.status} = 'expired' and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)`,
    ),
    check("community_invitations_expiration_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

/** Admission attempts are immutable history except for their explicit state transition fields. */
export const communityMembershipRequests = pgTable(
  "community_membership_requests",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    invitationId: text("invitation_id"),
    status: text("status").notNull().default("pending"),
    approvalPolicy: text("approval_policy").notNull(),
    decidedByPersonId: text("decided_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    decisionReason: text("decision_reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.invitationId, table.communityId],
      foreignColumns: [communityInvitations.id, communityInvitations.communityId],
      name: "community_membership_requests_invitation_community_fk",
    }).onDelete("restrict"),
    uniqueIndex("community_membership_requests_live_person_unique")
      .on(table.communityId, table.personId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("community_membership_requests_invitation_person_unique")
      .on(table.invitationId, table.personId)
      .where(sql`${table.invitationId} is not null`),
    index("community_membership_requests_community_status_idx").on(
      table.communityId,
      table.status,
    ),
    index("community_membership_requests_person_id_idx").on(table.personId),
    check(
      "community_membership_requests_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'cancelled')`,
    ),
    check(
      "community_membership_requests_approval_policy_check",
      sql`${table.approvalPolicy} in ('manual', 'automatic')`,
    ),
    check(
      "community_membership_requests_terminal_state_check",
      sql`(${table.status} = 'pending' and ${table.decidedAt} is null and ${table.decidedByPersonId} is null and ${table.decisionReason} is null and ${table.cancelledAt} is null)
        or (${table.status} = 'approved' and ${table.decidedAt} is not null and ${table.cancelledAt} is null and ((${table.approvalPolicy} = 'manual' and ${table.decidedByPersonId} is not null) or (${table.approvalPolicy} = 'automatic' and ${table.decidedByPersonId} is null)))
        or (${table.status} = 'rejected' and ${table.decidedAt} is not null and ${table.decidedByPersonId} is not null and ${table.cancelledAt} is null)
        or (${table.status} = 'cancelled' and ${table.cancelledAt} is not null and ${table.decidedAt} is null and ${table.decidedByPersonId} is null and ${table.decisionReason} is null)`,
    ),
  ],
);

/** Requests for community-wide GM authority, separate from ordinary membership admission. */
export const communityGmRequests = pgTable(
  "community_gm_requests",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending"),
    admissionPolicy: text("admission_policy").notNull(),
    decidedByPersonId: text("decided_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    decisionReason: text("decision_reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("community_gm_requests_live_person_unique")
      .on(table.communityId, table.personId)
      .where(sql`${table.status} = 'pending'`),
    index("community_gm_requests_community_status_idx").on(table.communityId, table.status),
    index("community_gm_requests_person_id_idx").on(table.personId),
    check(
      "community_gm_requests_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'cancelled')`,
    ),
    check(
      "community_gm_requests_admission_policy_check",
      sql`${table.admissionPolicy} in ('approved_only', 'self_service')`,
    ),
    check(
      "community_gm_requests_decision_reason_length_check",
      sql`${table.decisionReason} is null or length(${table.decisionReason}) <= 500`,
    ),
    check(
      "community_gm_requests_terminal_state_check",
      sql`(${table.status} = 'pending' and ${table.decidedAt} is null and ${table.decidedByPersonId} is null and ${table.decisionReason} is null and ${table.cancelledAt} is null)
        or (${table.status} = 'approved' and ${table.decidedAt} is not null and ${table.cancelledAt} is null and ((${table.admissionPolicy} = 'approved_only' and ${table.decidedByPersonId} is not null) or (${table.admissionPolicy} = 'self_service' and ${table.decidedByPersonId} is null)))
        or (${table.status} = 'rejected' and ${table.decidedAt} is not null and ${table.decidedByPersonId} is not null and ${table.cancelledAt} is null)
        or (${table.status} = 'cancelled' and ${table.cancelledAt} is not null and ${table.decidedAt} is null and ${table.decidedByPersonId} is null and ${table.decisionReason} is null)`,
    ),
  ],
);
