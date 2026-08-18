import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";
import type { AuthorizationDenialSink } from "@/authorization/denial-audit";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import {
  communityAuditEvents,
  communityInvitations,
  communityMembershipRequests,
} from "@/db/schema";

const DEFAULT_INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

const maxUsesSchema = z.number().int().min(1).max(1_000).nullable();

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type InvitationDatabase = Database | Transaction;

export type InvitationAcceptance =
  | { status: "accepted"; invitation: { id: string; communityId: string } }
  | { status: "invalid" };

export type InvitationMutationResult =
  | { status: "created"; invitation: InvitationSummary; token: string }
  | { status: "revoked"; invitation: InvitationSummary }
  | { status: "not-found" }
  | { status: "forbidden" };

export type InvitationSummary = {
  id: string;
  status: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date;
  createdAt: Date;
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

/**
 * Creates a reusable bearer link. The raw token is returned by
 * this call only; only its SHA-256 digest is persisted or audited.
 */
export async function createCommunityInvitation(
  actor: AuthenticatedActor,
  slug: string,
  input: { maxUses?: number | null; expiresAt?: Date } = {},
  options: {
    database?: Database;
    denialSink?: AuthorizationDenialSink;
    now?: Date;
  } = {},
): Promise<InvitationMutationResult> {
  const maxUses = maxUsesSchema.parse(input.maxUses === undefined ? 1 : input.maxUses);
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
    const token = randomBytes(32).toString("base64url");
    const [invitation] = await transaction
      .insert(communityInvitations)
      .values({
        id: randomUUID(),
        communityId,
        tokenHash: invitationDigest(token),
        maxUses,
        createdByPersonId: actor.personId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: communityInvitations.id,
        status: communityInvitations.status,
        maxUses: communityInvitations.maxUses,
        useCount: communityInvitations.useCount,
        expiresAt: communityInvitations.expiresAt,
        createdAt: communityInvitations.createdAt,
        revokedAt: communityInvitations.revokedAt,
      });
    if (!invitation) throw new Error("Invitation creation returned no record.");

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId,
      actorPersonId: actor.personId,
      eventType: "community.invitation.created",
      details: { invitationId: invitation.id, maxUses },
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
      status: communityInvitations.status,
      maxUses: communityInvitations.maxUses,
      useCount: communityInvitations.useCount,
      expiresAt: communityInvitations.expiresAt,
      createdAt: communityInvitations.createdAt,
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
        status: communityInvitations.status,
        maxUses: communityInvitations.maxUses,
        useCount: communityInvitations.useCount,
        expiresAt: communityInvitations.expiresAt,
        createdAt: communityInvitations.createdAt,
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

/** Atomically consumes one use for a new person while making same-person retries free. */
export async function acceptInvitationForAdmission(
  rawToken: string,
  actor: AuthenticatedActor,
  database: InvitationDatabase = getDb(),
  now = new Date(),
): Promise<InvitationAcceptance> {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(rawToken)) return { status: "invalid" };
  const db = asDatabase(database);
  const digest = invitationDigest(rawToken);
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${digest}:${actor.personId}`}, 0))`,
  );

  const [invitation] = await db
    .select({
      id: communityInvitations.id,
      communityId: communityInvitations.communityId,
      status: communityInvitations.status,
      expiresAt: communityInvitations.expiresAt,
    })
    .from(communityInvitations)
    .where(eq(communityInvitations.tokenHash, digest))
    .limit(1);

  if (!invitation) return { status: "invalid" };

  const [existingRequest] = await db
    .select({ id: communityMembershipRequests.id })
    .from(communityMembershipRequests)
    .where(
      and(
        eq(communityMembershipRequests.invitationId, invitation.id),
        eq(communityMembershipRequests.personId, actor.personId),
      ),
    )
    .limit(1);
  if (existingRequest) {
    return {
      status: "accepted",
      invitation: { id: invitation.id, communityId: invitation.communityId },
    };
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

  const [accepted] = await db
    .update(communityInvitations)
    .set({
      useCount: sql`${communityInvitations.useCount} + 1`,
      status: sql`case
        when ${communityInvitations.maxUses} is not null
          and ${communityInvitations.useCount} + 1 >= ${communityInvitations.maxUses}
        then 'exhausted'
        else 'pending'
      end`,
      updatedAt: now,
    })
    .where(
      and(
        eq(communityInvitations.id, invitation.id),
        eq(communityInvitations.status, "pending"),
        gt(communityInvitations.expiresAt, now),
        sql`(${communityInvitations.maxUses} is null or ${communityInvitations.useCount} < ${communityInvitations.maxUses})`,
      ),
    )
    .returning({ id: communityInvitations.id, communityId: communityInvitations.communityId });
  if (!accepted) return { status: "invalid" };

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
