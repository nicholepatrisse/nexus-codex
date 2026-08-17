import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
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
    description: text("description"),
    defaultTimeZone: text("default_time_zone").notNull().default("UTC"),
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
    check(
      "communities_default_time_zone_check",
      sql`length(${table.defaultTimeZone}) <= 255 and ${table.defaultTimeZone} ~ '^(UTC|[A-Za-z][A-Za-z0-9._+-]*(/[A-Za-z][A-Za-z0-9._+-]*)+)$'`,
    ),
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
      sql`${table.eventType} in ('community.settings.updated', 'community.archived', 'community.restored', 'community.invitation.created', 'community.invitation.accepted', 'community.invitation.revoked', 'community.invitation.expired', 'community.membership.requested', 'community.membership.approved', 'community.membership.rejected', 'community.membership.cancelled')`,
    ),
    check("community_audit_events_details_object_check", sql`jsonb_typeof(${table.details}) = 'object'`),
  ],
);

/**
 * A single-recipient community invitation. Only a one-way digest of the bearer
 * token is persisted; callers are responsible for normalizing recipientEmail.
 */
export const communityInvitations = pgTable(
  "community_invitations",
  {
    id: text("id").primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "restrict" }),
    recipientEmail: text("recipient_email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    createdByPersonId: text("created_by_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    acceptedByPersonId: text("accepted_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
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
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("community_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("community_invitations_id_community_unique").on(table.id, table.communityId),
    uniqueIndex("community_invitations_live_recipient_unique")
      .on(table.communityId, table.recipientEmail)
      .where(sql`${table.status} = 'pending'`),
    index("community_invitations_community_status_idx").on(table.communityId, table.status),
    index("community_invitations_recipient_email_idx").on(table.recipientEmail),
    check("community_invitations_recipient_email_normalized", sql`${table.recipientEmail} = lower(btrim(${table.recipientEmail})) and length(${table.recipientEmail}) > 0`),
    check(
      "community_invitations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'revoked', 'expired')`,
    ),
    check(
      "community_invitations_terminal_state_check",
      sql`(${table.status} = 'pending' and ${table.acceptedAt} is null and ${table.acceptedByPersonId} is null and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)
        or (${table.status} = 'accepted' and ${table.acceptedAt} is not null and ${table.acceptedByPersonId} is not null and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)
        or (${table.status} = 'revoked' and ${table.revokedAt} is not null and ${table.revokedByPersonId} is not null and ${table.acceptedAt} is null and ${table.acceptedByPersonId} is null)
        or (${table.status} = 'expired' and ${table.acceptedAt} is null and ${table.acceptedByPersonId} is null and ${table.revokedAt} is null and ${table.revokedByPersonId} is null and ${table.revocationReason} is null)`,
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
    uniqueIndex("community_membership_requests_invitation_unique")
      .on(table.invitationId)
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
