import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import { canPerformCommunityOperation, type CommunityRole } from "@/authorization/policy";
import { getDb } from "@/db/client";
import { communities, communityAuditEvents, sessionSignups, sessions } from "@/db/schema";

type Database = ReturnType<typeof getDb>;

export type SessionSignupResult =
  | { status: "confirmed" | "waitlisted"; signupId: string; replayed: boolean; waitlistPosition?: number }
  | { status: "not-found" | "unavailable" };

export type CancelSessionSignupResult =
  | { status: "cancelled"; promotedSignupId?: string }
  | { status: "not-found" };

function effectiveRole(access: { isActiveMember: boolean; roles: ("owner" | "gm")[] }): CommunityRole {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}

function canViewSchedule(access: {
  isActiveMember: boolean;
  roles: ("owner" | "gm")[];
  community: { visibility: string; scheduleVisibility: string };
}) {
  return canPerformCommunityOperation(effectiveRole(access), "schedule.view", {
    visibility: access.community.visibility === "public" ? "public" : "private",
    scheduleVisibility: access.community.scheduleVisibility === "public" ? "public" : "members",
  });
}

export async function signupForSession(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  database: Database = getDb(),
): Promise<SessionSignupResult> {
  return database.transaction(async (transaction) => {
    const access = await resolveCommunityAccessBySlug(slug, actor.personId, transaction);
    if (access.status !== "available" || !canViewSchedule(access)) return { status: "not-found" };

    const [session] = await transaction.select({
      id: sessions.id,
      capacity: sessions.playerCapacity,
      gmPersonId: sessions.gmPersonId,
    })
      .from(sessions).where(and(
        eq(sessions.id, sessionId),
        eq(sessions.communityId, access.community.id),
        eq(sessions.status, "published"),
      )).limit(1).for("update");
    if (!session) return { status: "not-found" };
    if (session.gmPersonId === actor.personId) return { status: "unavailable" };

    const [existing] = await transaction.select({
      id: sessionSignups.id,
      status: sessionSignups.status,
      waitlistPosition: sessionSignups.waitlistPosition,
    }).from(sessionSignups).where(and(
      eq(sessionSignups.sessionId, session.id),
      eq(sessionSignups.personId, actor.personId),
      inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
    )).limit(1).for("update");
    if (existing && (existing.status === "confirmed" || existing.status === "waitlisted")) {
      return {
        status: existing.status,
        signupId: existing.id,
        replayed: true,
        ...(existing.waitlistPosition ? { waitlistPosition: existing.waitlistPosition } : {}),
      };
    }

    const [confirmed] = await transaction.select({ value: count() })
      .from(sessionSignups).where(and(
        eq(sessionSignups.sessionId, session.id),
        eq(sessionSignups.status, "confirmed"),
      ));
    const status = (confirmed?.value ?? 0) < session.capacity
      ? "confirmed" as const
      : "waitlisted" as const;
    let waitlistPosition: number | undefined;
    if (status === "waitlisted") {
      const [last] = await transaction.select({ position: sessionSignups.waitlistPosition })
        .from(sessionSignups).where(and(
          eq(sessionSignups.sessionId, session.id),
          eq(sessionSignups.status, "waitlisted"),
        )).orderBy(desc(sessionSignups.waitlistPosition)).limit(1);
      waitlistPosition = (last?.position ?? 0) + 1;
    }

    const signupId = randomUUID();
    const now = new Date();
    await transaction.insert(sessionSignups).values({
      id: signupId,
      sessionId: session.id,
      personId: actor.personId,
      status,
      waitlistPosition,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(), communityId: access.community.id, actorPersonId: actor.personId,
      eventType: status === "confirmed" ? "session.signup.confirmed" : "session.signup.waitlisted",
      details: { sessionId: session.id, signupId }, occurredAt: now,
    });
    return { status, signupId, replayed: false, ...(waitlistPosition ? { waitlistPosition } : {}) };
  });
}

export async function cancelOwnSessionSignup(
  actor: AuthenticatedActor,
  slug: string,
  sessionId: string,
  database: Database = getDb(),
): Promise<CancelSessionSignupResult> {
  return database.transaction(async (transaction) => {
    const [session] = await transaction.select({ id: sessions.id, communityId: sessions.communityId })
      .from(sessions).innerJoin(communities, eq(communities.id, sessions.communityId)).where(and(
        eq(sessions.id, sessionId), eq(communities.slug, slug),
      ))
      .limit(1).for("update");
    if (!session) return { status: "not-found" };
    const [signup] = await transaction.select({ id: sessionSignups.id, status: sessionSignups.status })
      .from(sessionSignups).where(and(
        eq(sessionSignups.sessionId, session.id),
        eq(sessionSignups.personId, actor.personId),
        inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
      )).limit(1).for("update");
    if (!signup) return { status: "not-found" };

    const now = new Date();
    await transaction.update(sessionSignups).set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(sessionSignups.id, signup.id));
    await transaction.insert(communityAuditEvents).values({
      id: randomUUID(), communityId: session.communityId, actorPersonId: actor.personId,
      eventType: "session.signup.cancelled", details: { sessionId: session.id, signupId: signup.id },
      occurredAt: now,
    });

    let promotedSignupId: string | undefined;
    if (signup.status === "confirmed") {
      const [next] = await transaction.select({ id: sessionSignups.id, personId: sessionSignups.personId })
        .from(sessionSignups).where(and(
          eq(sessionSignups.sessionId, session.id), eq(sessionSignups.status, "waitlisted"),
        )).orderBy(asc(sessionSignups.waitlistPosition)).limit(1).for("update");
      if (next) {
        promotedSignupId = next.id;
        await transaction.update(sessionSignups).set({
          status: "confirmed", waitlistPosition: null, updatedAt: now,
        }).where(eq(sessionSignups.id, next.id));
        await transaction.insert(communityAuditEvents).values({
          id: randomUUID(), communityId: session.communityId, actorPersonId: actor.personId,
          eventType: "session.signup.promoted", details: { sessionId: session.id, signupId: next.id },
          occurredAt: now,
        });
      }
    }
    return { status: "cancelled", ...(promotedSignupId ? { promotedSignupId } : {}) };
  });
}
