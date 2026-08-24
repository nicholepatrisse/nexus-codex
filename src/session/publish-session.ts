import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformSessionOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { communityAuditEvents, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export type PublishSessionResult =
  | { status: "published"; sessionId: string; replayed: boolean }
  | { status: "not-found" | "forbidden" | "not-publishable" };

function effectiveRole(access: {
  isActiveMember: boolean;
  roles: ("owner" | "gm")[];
}): CommunityRole {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}

export async function publishSession(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  database: Database = getDb(),
): Promise<PublishSessionResult> {
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available") return { status: "not-found" };

    const [session] = await transaction
      .select({
        id: sessions.id,
        status: sessions.status,
        gmPersonId: sessions.gmPersonId,
      })
      .from(sessions)
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.communityId, access.community.id),
      ))
      .limit(1)
      .for("update");
    if (!session) return { status: "not-found" };

    const role = effectiveRole(access);
    const canPublishAny = canPerformSessionOperation(role, "session.publish.any");
    const canPublishAssigned = canPerformSessionOperation(role, "session.publish.assigned")
      && session.gmPersonId === actor.personId;
    if (!canPublishAny && !canPublishAssigned) return { status: "forbidden" };

    if (session.status === "published") {
      return { status: "published", sessionId: session.id, replayed: true };
    }
    if (session.status !== "draft") return { status: "not-publishable" };
    const now = new Date();
    await transaction
      .update(sessions)
      .set({ status: "published", updatedByPersonId: actor.personId, updatedAt: now })
      .where(and(eq(sessions.id, session.id), eq(sessions.status, "draft")));
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(),
      communityId: access.community.id,
      actorPersonId: actor.personId,
      eventType: "session.published",
      details: { sessionId: session.id },
      occurredAt: now,
    });

    return { status: "published", sessionId: session.id, replayed: false };
  });
}
