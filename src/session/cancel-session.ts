import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { getDb } from "@/db/client";
import { communityAuditEvents, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export async function cancelSession(actor: AuthenticatedActor, slug: string, sessionId: string, database: Database = getDb()) {
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available") return { status: "not-found" } as const;
    const [session] = await transaction.select({ id: sessions.id, gmPersonId: sessions.gmPersonId, status: sessions.status }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.communityId, access.community.id))).limit(1).for("update");
    if (!session) return { status: "not-found" } as const;
    if (session.status === "cancelled") return { status: "unchanged" } as const;
    if (!access.roles.includes("owner") && !(access.roles.includes("gm") && session.gmPersonId === actor.personId)) return { status: "not-found" } as const;
    const now = new Date();
    await transaction.update(sessions).set({ status: "cancelled", updatedByPersonId: actor.personId, updatedAt: now }).where(eq(sessions.id, session.id));
    await transaction.insert(communityAuditEvents).values({ id: randomUUID(), communityId: access.community.id, actorPersonId: actor.personId, eventType: "session.cancelled", details: { sessionId: session.id }, occurredAt: now });
    return { status: "cancelled" } as const;
  });
}
