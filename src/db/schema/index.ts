import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("people_auth_user_id_unique").on(table.authUserId)],
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_items_program_normalized_code_unique").on(
      table.programId,
      table.normalizedCode,
    ),
    index("content_items_program_title_idx").on(table.programId, table.normalizedTitle),
    check(
      "content_items_type_check",
      sql`${table.contentType} in ('scenario', 'special', 'adventure')`,
    ),
    check("content_items_minimum_level_check", sql`${table.minimumLevel} >= 1`),
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
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
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
      "community_role_grants_revocation_time_check",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.grantedAt}`,
    ),
  ],
);
