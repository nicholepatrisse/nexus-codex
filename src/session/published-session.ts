import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformSessionOperation } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { communityAuditEvents, sessions } from "@/db/schema";
import { deliverSessionChange } from "@/notifications/deliveries";
import { type SessionDraftInput, updateSessionDraft } from "./session-drafts";

type Database = ReturnType<typeof getDb>;
export type PublishedSessionMutationResult =
  | { status: "updated" | "cancelled"; sessionId: string; replayed?: boolean }
  | { status: "not-found" | "forbidden" | "not-published" };

function mayManage(access: { roles: ("owner" | "gm")[] }, gmPersonId: string, actorId: string) {
  if (access.roles.includes("owner")) return canPerformSessionOperation("owner", "session.manage.any");
  return access.roles.includes("gm")
    && gmPersonId === actorId
    && canPerformSessionOperation("gm", "session.manage.assigned");
}

export async function updatePublishedSession(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  input: SessionDraftInput,
  database: Database = getDb(),
): Promise<PublishedSessionMutationResult> {
  // updateSessionDraft owns the shared validation/write contract. Temporarily lock the
  // lifecycle inside one transaction so validation failure rolls the status back too.
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available") return { status: "not-found" };
    const [current] = await transaction.select({ status: sessions.status, gmPersonId: sessions.gmPersonId })
      .from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id)))
      .limit(1).for("update");
    if (!current) return { status: "not-found" };
    if (current.status !== "published") return { status: "not-published" };
    if (!mayManage(access, current.gmPersonId, actor.personId)) return { status: "forbidden" };
    await transaction.update(sessions).set({ status: "draft" }).where(eq(sessions.id, sessionId));
    const result = await updateSessionDraft(actor, slug, sessionId, input, transaction as Database);
    if (result.status !== "updated") throw new Error("Published session authorization changed during update.");
    const now = new Date();
    await transaction.update(sessions).set({ status: "published", updatedAt: now })
      .where(eq(sessions.id, sessionId));
    const auditEventId = randomUUID();
    await transaction.insert(communityAuditEvents).values({
      id: auditEventId, communityId: access.community.id, actorPersonId: actor.personId,
      eventType: "session.published.updated", details: { sessionId }, occurredAt: now,
    });
    await deliverSessionChange(transaction as Database, access.community.id, sessionId, actor.personId, auditEventId, "session.changed", now);
    return { status: "updated", sessionId };
  });
}

export async function cancelPublishedSession(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  database: Database = getDb(),
): Promise<PublishedSessionMutationResult> {
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available") return { status: "not-found" };
    const [current] = await transaction.select({ status: sessions.status, gmPersonId: sessions.gmPersonId })
      .from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id)))
      .limit(1).for("update");
    if (!current) return { status: "not-found" };
    if (!mayManage(access, current.gmPersonId, actor.personId)) return { status: "forbidden" };
    if (current.status === "cancelled") return { status: "cancelled", sessionId, replayed: true };
    if (current.status !== "published") return { status: "not-published" };
    const now = new Date();
    await transaction.update(sessions).set({ status: "cancelled", updatedByPersonId: actor.personId, updatedAt: now })
      .where(and(eq(sessions.id, sessionId), eq(sessions.status, "published")));
    const auditEventId = randomUUID();
    await transaction.insert(communityAuditEvents).values({
      id: auditEventId, communityId: access.community.id, actorPersonId: actor.personId,
      eventType: "session.cancelled", details: { sessionId }, occurredAt: now,
    });
    await deliverSessionChange(transaction as Database, access.community.id, sessionId, actor.personId, auditEventId, "session.cancelled", now);
    return { status: "cancelled", sessionId, replayed: false };
  });
}
