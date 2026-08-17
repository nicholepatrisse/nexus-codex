import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { AuthorizationDenialSink } from "@/authorization/denial-audit";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import {
  authUsers,
  communityAuditEvents,
  communityInvitations,
} from "@/db/schema";

const DEFAULT_INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type InvitationDatabase = Database | Transaction;

export type InvitationAcceptance =
  | { status: "accepted"; invitation: { id: string; communityId: string } }
  | { status: "invalid" };

export type InvitationMutationResult =
  | { status: "created"; invitation: InvitationSummary; token: string }
  | { status: "already-pending"; invitation: InvitationSummary }
  | { status: "revoked"; invitation: InvitationSummary }
  | { status: "not-found" }
  | { status: "forbidden" };

export type InvitationSummary = {
  id: string;
  recipientEmail: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

function invitationDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function asDatabase(database: InvitationDatabase): Database {
  // Drizzle transactions expose the same query-builder methods used here, but
  // intentionally omit the root client's `$client` property.
  return database as Database;
}

async function actorEmail(actor: AuthenticatedActor, database: InvitationDatabase) {
  const [user] = await asDatabase(database)
    .select({ email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.id, actor.authUserId))
    .limit(1);
  return user?.email.trim().toLowerCase() ?? null;
}

/**
 * Creates a recipient-bound bearer invitation. The raw token is returned by
 * this call only; only its SHA-256 digest is persisted or audited.
 */
export async function createCommunityInvitation(
  actor: AuthenticatedActor,
  slug: string,
  input: { recipientEmail: string; expiresAt?: Date },
  options: {
    database?: Database;
    denialSink?: AuthorizationDenialSink;
    now?: Date;
  } = {},
): Promise<InvitationMutationResult> {
  const recipientEmail = emailSchema.parse(input.recipientEmail);
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_INVITATION_LIFETIME_MS);
  if (expiresAt <= now || expiresAt.getTime() - now.getTime() > MAX_INVITATION_LIFETIME_MS) {
    throw new z.ZodError([
      { code: "custom", path: ["expiresAt"], message: "Expiration must be within 30 days." },
    ]);
  }

  return database.transaction(async (transaction) => {
    const authorization = await authorizeCommunityBySlug({
      actor,
      slug,
      operation: "membership.manage",
      resolveAccess: (candidate, personId) =>
        resolveCommunityAccessBySlug(candidate, personId, transaction),
      denialSink: options.denialSink,
    });
    if (authorization.status !== "authorized") return authorization;

    const communityId = authorization.access.community.id;
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${communityId}:${recipientEmail}`}, 0))`,
    );
    const expired = await transaction
      .update(communityInvitations)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(communityInvitations.communityId, communityId),
          eq(communityInvitations.recipientEmail, recipientEmail),
          eq(communityInvitations.status, "pending"),
          lte(communityInvitations.expiresAt, now),
        ),
      )
      .returning({ id: communityInvitations.id });
    for (const invitation of expired) {
      await transaction.insert(communityAuditEvents).values({
        id: randomUUID(),
        communityId,
        actorPersonId: actor.personId,
        eventType: "community.invitation.expired",
        details: { invitationId: invitation.id },
        occurredAt: now,
      });
    }

    const [existing] = await transaction
      .select({
        id: communityInvitations.id,
        recipientEmail: communityInvitations.recipientEmail,
        status: communityInvitations.status,
        expiresAt: communityInvitations.expiresAt,
        createdAt: communityInvitations.createdAt,
        acceptedAt: communityInvitations.acceptedAt,
        revokedAt: communityInvitations.revokedAt,
      })
      .from(communityInvitations)
      .where(
        and(
          eq(communityInvitations.communityId, communityId),
          eq(communityInvitations.recipientEmail, recipientEmail),
          eq(communityInvitations.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) return { status: "already-pending", invitation: existing };

    const token = randomBytes(32).toString("base64url");
    const [invitation] = await transaction
      .insert(communityInvitations)
      .values({
        id: randomUUID(),
        communityId,
        recipientEmail,
        tokenHash: invitationDigest(token),
        createdByPersonId: actor.personId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: communityInvitations.id,
        recipientEmail: communityInvitations.recipientEmail,
        status: communityInvitations.status,
        expiresAt: communityInvitations.expiresAt,
        createdAt: communityInvitations.createdAt,
        acceptedAt: communityInvitations.acceptedAt,
        revokedAt: communityInvitations.revokedAt,
      });
    if (!invitation) throw new Error("Invitation creation returned no record.");

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId,
      actorPersonId: actor.personId,
      eventType: "community.invitation.created",
      details: { invitationId: invitation.id },
      occurredAt: now,
    });

    return { status: "created", invitation, token };
  });
}

/** Lists invitation metadata for an owner without exposing bearer hashes. */
export async function listCommunityInvitations(
  actor: AuthenticatedActor,
  slug: string,
  options: { database?: Database; denialSink?: AuthorizationDenialSink } = {},
): Promise<
  | { status: "found"; invitations: InvitationSummary[] }
  | { status: "not-found" }
  | { status: "forbidden" }
> {
  const database = options.database ?? getDb();
  const authorization = await authorizeCommunityBySlug({
    actor,
    slug,
    operation: "membership.manage",
    resolveAccess: (candidate, personId) => resolveCommunityAccessBySlug(candidate, personId, database),
    denialSink: options.denialSink,
  });
  if (authorization.status !== "authorized") return authorization;

  const invitations = await database
    .select({
      id: communityInvitations.id,
      recipientEmail: communityInvitations.recipientEmail,
      status: communityInvitations.status,
      expiresAt: communityInvitations.expiresAt,
      createdAt: communityInvitations.createdAt,
      acceptedAt: communityInvitations.acceptedAt,
      revokedAt: communityInvitations.revokedAt,
    })
    .from(communityInvitations)
    .where(eq(communityInvitations.communityId, authorization.access.community.id))
    .orderBy(asc(communityInvitations.createdAt), asc(communityInvitations.id));
  return { status: "found", invitations };
}

export async function revokeCommunityInvitation(
  actor: AuthenticatedActor,
  slug: string,
  invitationId: string,
  input: { reason?: string } = {},
  options: { database?: Database; denialSink?: AuthorizationDenialSink; now?: Date } = {},
): Promise<InvitationMutationResult> {
  const database = options.database ?? getDb();
  const now = options.now ?? new Date();
  return database.transaction(async (transaction) => {
    const authorization = await authorizeCommunityBySlug({
      actor,
      slug,
      operation: "membership.manage",
      resolveAccess: (candidate, personId) =>
        resolveCommunityAccessBySlug(candidate, personId, transaction),
      denialSink: options.denialSink,
    });
    if (authorization.status !== "authorized") return authorization;

    const [expired] = await transaction
      .update(communityInvitations)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(communityInvitations.id, invitationId),
          eq(communityInvitations.communityId, authorization.access.community.id),
          eq(communityInvitations.status, "pending"),
          lte(communityInvitations.expiresAt, now),
        ),
      )
      .returning({ id: communityInvitations.id });
    if (expired) {
      await transaction.insert(communityAuditEvents).values({
        id: randomUUID(),
        communityId: authorization.access.community.id,
        actorPersonId: actor.personId,
        eventType: "community.invitation.expired",
        details: { invitationId },
        occurredAt: now,
      });
      return { status: "not-found" };
    }

    const [invitation] = await transaction
      .update(communityInvitations)
      .set({
        status: "revoked",
        revokedAt: now,
        revokedByPersonId: actor.personId,
        revocationReason: input.reason?.trim().slice(0, 500) || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(communityInvitations.id, invitationId),
          eq(communityInvitations.communityId, authorization.access.community.id),
          eq(communityInvitations.status, "pending"),
        ),
      )
      .returning({
        id: communityInvitations.id,
        recipientEmail: communityInvitations.recipientEmail,
        status: communityInvitations.status,
        expiresAt: communityInvitations.expiresAt,
        createdAt: communityInvitations.createdAt,
        acceptedAt: communityInvitations.acceptedAt,
        revokedAt: communityInvitations.revokedAt,
      });
    if (!invitation) return { status: "not-found" };

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId: authorization.access.community.id,
      actorPersonId: actor.personId,
      eventType: "community.invitation.revoked",
      details: { invitationId },
      occurredAt: now,
    });
    return { status: "revoked", invitation };
  });
}

/**
 * Atomically claims a recipient-bound token for admission. The conditional
 * update is the security boundary: a concurrent revocation can either win
 * before this claim or lose after it, but admission can never proceed from a
 * stale read. Calling this inside the admission transaction also means a later
 * failure rolls the claim back.
 */
export async function acceptInvitationForAdmission(
  rawToken: string,
  actor: AuthenticatedActor,
  database: InvitationDatabase = getDb(),
  now = new Date(),
): Promise<InvitationAcceptance> {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(rawToken)) return { status: "invalid" };
  const db = asDatabase(database);
  const email = await actorEmail(actor, database);
  if (!email) return { status: "invalid" };

  const digest = invitationDigest(rawToken);
  const [accepted] = await db
    .update(communityInvitations)
    .set({
      status: "accepted",
      acceptedAt: now,
      acceptedByPersonId: actor.personId,
      updatedAt: now,
    })
    .where(
      and(
        eq(communityInvitations.tokenHash, digest),
        eq(communityInvitations.recipientEmail, email),
        eq(communityInvitations.status, "pending"),
        gt(communityInvitations.expiresAt, now),
      ),
    )
    .returning({ id: communityInvitations.id, communityId: communityInvitations.communityId });

  if (accepted) {
    await db.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId: accepted.communityId,
      actorPersonId: actor.personId,
      eventType: "community.invitation.accepted",
      details: { invitationId: accepted.id },
      occurredAt: now,
    });
    return { status: "accepted", invitation: accepted };
  }

  const [invitation] = await db
    .select({
      id: communityInvitations.id,
      communityId: communityInvitations.communityId,
      recipientEmail: communityInvitations.recipientEmail,
      status: communityInvitations.status,
      acceptedByPersonId: communityInvitations.acceptedByPersonId,
      expiresAt: communityInvitations.expiresAt,
    })
    .from(communityInvitations)
    .where(
      and(
        eq(communityInvitations.tokenHash, digest),
        eq(communityInvitations.recipientEmail, email),
      ),
    )
    .limit(1);

  if (!invitation) return { status: "invalid" };
  if (invitation.status === "accepted") {
    return invitation.acceptedByPersonId === actor.personId
      ? { status: "accepted", invitation: { id: invitation.id, communityId: invitation.communityId } }
      : { status: "invalid" };
  }
  if (invitation.status === "pending" && invitation.expiresAt <= now) {
    const [expired] = await db
      .update(communityInvitations)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(communityInvitations.id, invitation.id),
          eq(communityInvitations.status, "pending"),
          lte(communityInvitations.expiresAt, now),
        ),
      )
      .returning({ id: communityInvitations.id });
    if (expired) {
      await db.insert(communityAuditEvents).values({
        id: randomUUID(),
        communityId: invitation.communityId,
        actorPersonId: actor.personId,
        eventType: "community.invitation.expired",
        details: { invitationId: invitation.id },
        occurredAt: now,
      });
    }
    return { status: "invalid" };
  }
  return { status: "invalid" };
}
