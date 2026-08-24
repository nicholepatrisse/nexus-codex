import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformSessionOperation, type CommunityRole } from "@/authorization/policy";
import { createAssignedGameWithSelfServiceGm } from "@/community/create-assigned-game-with-self-service-gm";
import type { InspectFutureGmSessionImpact } from "@/community/revoke-community-gm-grant";
import { getDb } from "@/db/client";
import {
  communityAuditEvents,
  communityMemberships,
  communityRoleGrants,
  communitySupportedPrograms,
  contentItems,
  sessions,
} from "@/db/schema";

const explicitInstantSchema = z.string().datetime({ offset: true });
const ianaTimeZoneSchema = z.string().trim().min(1).max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Enter a valid IANA time zone.");

export const sessionDraftInputSchema = z.object({
  contentItemId: z.string().trim().min(1, "Choose a scenario."),
  gmPersonId: z.string().trim().min(1).optional(),
  startsAt: explicitInstantSchema,
  endsAt: explicitInstantSchema,
  displayTimeZone: ianaTimeZoneSchema,
  notes: z.string().trim().max(4_000).nullish().transform((value) => value || null),
  locationType: z.enum(["virtual", "physical"]),
}).superRefine((value, context) => {
  if (new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End must be later than start.",
    });
  }
});

export type SessionDraftInput =
  | z.input<typeof sessionDraftInputSchema>
  | z.output<typeof sessionDraftInputSchema>;
type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type SessionDraftResult =
  | { status: "created" | "updated"; sessionId: string; promoted?: boolean }
  | { status: "not-found" | "forbidden" | "unavailable" };

export class SessionDraftValidationError extends Error {
  constructor(message = "The session draft is not valid.") {
    super(message);
    this.name = "SessionDraftValidationError";
  }
}

function effectiveRole(access: {
  isActiveMember: boolean;
  roles: ("owner" | "gm")[];
}): CommunityRole {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}

async function lockAndValidateAssignedGm(
  transaction: Transaction,
  communityId: string,
  gmPersonId: string,
) {
  const [membership] = await transaction
    .select({ id: communityMemberships.id })
    .from(communityMemberships)
    .where(and(
      eq(communityMemberships.communityId, communityId),
      eq(communityMemberships.personId, gmPersonId),
      eq(communityMemberships.status, "active"),
    ))
    .limit(1);
  if (!membership) throw new SessionDraftValidationError("Choose an active community GM.");

  const [grant] = await transaction
    .select({ id: communityRoleGrants.id })
    .from(communityRoleGrants)
    .where(and(
      eq(communityRoleGrants.communityId, communityId),
      eq(communityRoleGrants.personId, gmPersonId),
      eq(communityRoleGrants.role, "gm"),
      eq(communityRoleGrants.status, "active"),
      isNull(communityRoleGrants.revokedAt),
    ))
    .limit(1)
    .for("update");
  if (!grant) throw new SessionDraftValidationError("Choose an active community GM.");
}

async function validateSupportedScenario(
  transaction: Transaction,
  communityId: string,
  contentItemId: string,
) {
  const [scenario] = await transaction
    .select({ id: contentItems.id })
    .from(contentItems)
    .innerJoin(
      communitySupportedPrograms,
      and(
        eq(communitySupportedPrograms.communityId, communityId),
        eq(communitySupportedPrograms.programId, contentItems.programId),
      ),
    )
    .where(and(
      eq(contentItems.id, contentItemId),
      eq(contentItems.contentType, "scenario"),
    ))
    .limit(1);
  if (!scenario) {
    throw new SessionDraftValidationError("Choose a scenario supported by this community.");
  }
}

async function insertDraft(
  transaction: Transaction,
  actorPersonId: string,
  communityId: string,
  gmPersonId: string,
  input: z.output<typeof sessionDraftInputSchema>,
) {
  await validateSupportedScenario(transaction, communityId, input.contentItemId);
  await lockAndValidateAssignedGm(transaction, communityId, gmPersonId);

  const id = randomUUID();
  await transaction.insert(sessions).values({
    id,
    communityId,
    contentItemId: input.contentItemId,
    gmPersonId,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    displayTimeZone: input.displayTimeZone,
    playerCapacity: 6,
    notes: input.notes,
    locationType: input.locationType,
    createdByPersonId: actorPersonId,
    updatedByPersonId: actorPersonId,
  });
  await transaction.insert(communityAuditEvents).values({
    id: randomUUID(),
    communityId,
    actorPersonId,
    eventType: "session.draft.created",
    details: { sessionId: id },
  });
  return id;
}

export async function createSessionDraft(
  actor: AuthenticatedActor,
  slug: string,
  rawInput: SessionDraftInput,
  database: Database = getDb(),
): Promise<SessionDraftResult> {
  const input = sessionDraftInputSchema.parse(rawInput);
  const access = await resolveCommunityAccessBySlug(slug, actor.personId, database);
  if (access.status !== "available") return { status: "not-found" };
  const role = effectiveRole(access);

  if (role === "member") {
    if (access.community.gmAdmission !== "self_service") return { status: "forbidden" };
    if (input.gmPersonId && input.gmPersonId !== actor.personId) return { status: "forbidden" };
    const result = await createAssignedGameWithSelfServiceGm(
      actor,
      access.community.id,
      async (transaction, context) => ({
        sessionId: await insertDraft(
          transaction,
          actor.personId,
          context.communityId,
          context.gmPersonId,
          input,
        ),
      }),
      database,
    );
    return result.status === "created"
      ? { status: "created", sessionId: result.value.sessionId, promoted: result.promoted }
      : { status: "unavailable" };
  }

  if (!canPerformSessionOperation(role, "session.create")) return { status: "forbidden" };
  const gmPersonId = role === "owner" ? input.gmPersonId : actor.personId;
  if (!gmPersonId) throw new SessionDraftValidationError("Choose an active community GM.");
  if (role === "gm" && input.gmPersonId && input.gmPersonId !== actor.personId) {
    return { status: "forbidden" };
  }

  return database.transaction(async (transaction) => {
    const current = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (current.status !== "available") return { status: "not-found" };
    const currentRole = effectiveRole(current);
    if (!canPerformSessionOperation(currentRole, "session.create")) return { status: "forbidden" };
    if (currentRole === "gm" && gmPersonId !== actor.personId) return { status: "forbidden" };
    const sessionId = await insertDraft(
      transaction,
      actor.personId,
      current.community.id,
      gmPersonId,
      input,
    );
    return { status: "created", sessionId };
  });
}

export async function updateSessionDraft(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  rawInput: SessionDraftInput,
  database: Database = getDb(),
): Promise<SessionDraftResult> {
  const input = sessionDraftInputSchema.parse(rawInput);
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available") return { status: "not-found" };
    const role = effectiveRole(access);
    const [existing] = await transaction
      .select({ id: sessions.id, gmPersonId: sessions.gmPersonId })
      .from(sessions)
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.communityId, access.community.id),
        eq(sessions.status, "draft"),
      ))
      .limit(1)
      .for("update");
    if (!existing) return { status: "not-found" };

    const isOwner = role === "owner" && canPerformSessionOperation(role, "session.manage.any");
    const isAssignedGm = role === "gm"
      && canPerformSessionOperation(role, "session.manage.assigned")
      && existing.gmPersonId === actor.personId;
    if (!isOwner && !isAssignedGm) return { status: "forbidden" };

    const gmPersonId = isOwner ? (input.gmPersonId ?? existing.gmPersonId) : actor.personId;
    if (!isOwner && input.gmPersonId && input.gmPersonId !== actor.personId) {
      return { status: "forbidden" };
    }
    await validateSupportedScenario(transaction, access.community.id, input.contentItemId);
    await lockAndValidateAssignedGm(transaction, access.community.id, gmPersonId);

    const now = new Date();
    await transaction.update(sessions).set({
      contentItemId: input.contentItemId,
      gmPersonId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      displayTimeZone: input.displayTimeZone,
      playerCapacity: 6,
      notes: input.notes,
      locationType: input.locationType,
      updatedByPersonId: actor.personId,
      updatedAt: now,
    }).where(eq(sessions.id, existing.id));

    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId: access.community.id,
      actorPersonId: actor.personId,
      eventType: existing.gmPersonId === gmPersonId
        ? "session.draft.updated"
        : "session.gm.reassigned",
      details: { sessionId: existing.id },
      occurredAt: now,
    });
    return { status: "updated", sessionId: existing.id };
  });
}

export const inspectFutureGmSessions: InspectFutureGmSessionImpact = async ({
  communityId,
  gmPersonId,
  transaction,
}) => {
  const rows = await transaction
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(
      eq(sessions.communityId, communityId),
      eq(sessions.gmPersonId, gmPersonId),
      ne(sessions.status, "cancelled"),
      gt(sessions.startsAt, new Date()),
    ));
  return rows.length > 0
    ? { status: "affected", futureSessionIds: rows.map(({ id }) => id) }
    : { status: "clear" };
};
