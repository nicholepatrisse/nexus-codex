import { and, count, desc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  communities,
  communityAuditEvents,
  communityMembershipRequests,
  communityMemberships,
  communityRoleGrants,
  contentItems,
  notificationReads,
  sessionSignups,
  sessions,
} from "@/db/schema";
import { applicantNotificationDestination, type AppNotification } from "@/notifications/model";

const applicantMessages: Record<string, string> = {
  pending: "Your membership request is awaiting review.", approved: "Your membership request was approved.",
  rejected: "Your membership request was not approved.", cancelled: "Your membership request was cancelled.",
};

/** Produces only notifications the person is currently authorized to know about. */
export async function listNotificationsForPerson(personId: string, database = getDb()) {
  const [ownerRows, applicantRows, sessionRows] = await Promise.all([
    database.select({
      communityId: communities.id,
      communityName: communities.name,
      communitySlug: communities.slug,
      pendingCount: count(communityMembershipRequests.id),
      latestPendingAt: max(communityMembershipRequests.requestedAt),
    })
      .from(communityRoleGrants).innerJoin(communities, eq(communities.id, communityRoleGrants.communityId))
      .innerJoin(communityMembershipRequests, and(eq(communityMembershipRequests.communityId, communities.id), eq(communityMembershipRequests.status, "pending")))
      .where(and(eq(communityRoleGrants.personId, personId), eq(communityRoleGrants.role, "owner"), eq(communityRoleGrants.status, "active"), isNull(communityRoleGrants.revokedAt)))
      .groupBy(communities.id, communities.name, communities.slug),
    database.selectDistinctOn([communityMembershipRequests.communityId], {
      requestId: communityMembershipRequests.id, communityName: communities.name, communitySlug: communities.slug,
      communityVisibility: communities.visibility, status: communityMembershipRequests.status,
      updatedAt: communityMembershipRequests.updatedAt, activeMembershipId: communityMemberships.id,
    }).from(communityMembershipRequests).innerJoin(communities, eq(communities.id, communityMembershipRequests.communityId))
      .leftJoin(communityMemberships, and(eq(communityMemberships.communityId, communities.id), eq(communityMemberships.personId, personId), eq(communityMemberships.status, "active")))
      .where(eq(communityMembershipRequests.personId, personId))
      .orderBy(communityMembershipRequests.communityId, desc(communityMembershipRequests.requestedAt), desc(communityMembershipRequests.id)),
    database.select({
      eventId: communityAuditEvents.id,
      eventType: communityAuditEvents.eventType,
      occurredAt: communityAuditEvents.occurredAt,
      communityName: communities.name,
      communitySlug: communities.slug,
      sessionId: sessions.id,
      scenarioCode: contentItems.code,
      scenarioTitle: contentItems.title,
    }).from(communityAuditEvents)
      .innerJoin(communities, and(
        eq(communities.id, communityAuditEvents.communityId),
        eq(communities.lifecycleStatus, "active"),
      ))
      .innerJoin(sessions, and(
        eq(sessions.communityId, communities.id),
        eq(sessions.id, sql<string>`${communityAuditEvents.details}->>'sessionId'`),
      ))
      .innerJoin(sessionSignups, and(
        eq(sessionSignups.sessionId, sessions.id),
        eq(sessionSignups.personId, personId),
        inArray(sessionSignups.status, ["confirmed", "waitlisted"]),
      ))
      .innerJoin(contentItems, eq(contentItems.id, sessions.contentItemId))
      .where(and(
        inArray(communityAuditEvents.eventType, ["session.published.updated", "session.cancelled"]),
        ne(communityAuditEvents.actorPersonId, personId),
      ))
      .orderBy(desc(communityAuditEvents.occurredAt))
      .limit(50),
  ]);

  const ownerNotifications: AppNotification[] = ownerRows.map((row) => ({
    id: `owner-membership:${row.communityId}:${row.pendingCount}:${row.latestPendingAt?.toISOString() ?? "unknown"}`, kind: "owner.membership.pending", title: row.communityName,
    message: `${row.pendingCount} membership ${row.pendingCount === 1 ? "request needs" : "requests need"} review.`,
    href: `/communities/${encodeURIComponent(row.communitySlug)}/settings`, occurredAt: new Date(0), actionable: true, isRead: false,
  }));
  const applicantNotifications: AppNotification[] = applicantRows.map((row) => ({
    id: `applicant-membership:${row.requestId}:${row.status}`, kind: "applicant.membership.status", title: row.communityName,
    message: applicantMessages[row.status] ?? "Your membership request changed status.",
    href: applicantNotificationDestination(row.communityVisibility, Boolean(row.activeMembershipId), row.communitySlug),
    occurredAt: row.updatedAt, actionable: row.status === "pending", isRead: false,
  }));
  const sessionNotifications: AppNotification[] = sessionRows.map((row) => {
    const cancelled = row.eventType === "session.cancelled";
    return {
      id: `session-lifecycle:${row.eventId}`,
      kind: cancelled ? "session.cancelled" : "session.changed",
      title: row.communityName,
      message: `${row.scenarioCode} — ${row.scenarioTitle} was ${cancelled ? "cancelled" : "changed"}.`,
      href: `/communities/${encodeURIComponent(row.communitySlug)}/sessions/${row.sessionId}`,
      occurredAt: row.occurredAt,
      actionable: false, isRead: false,
    };
  });
  const notifications = [...ownerNotifications, ...applicantNotifications, ...sessionNotifications];
  const readRows = notifications.length === 0 ? [] : await database
    .select({ notificationId: notificationReads.notificationId, clearedAt: notificationReads.clearedAt })
    .from(notificationReads)
    .where(and(eq(notificationReads.personId, personId), inArray(notificationReads.notificationId, notifications.map(({ id }) => id))));
  const visibleReadIds = new Set(readRows.filter(({ clearedAt }) => clearedAt === null).map(({ notificationId }) => notificationId));
  const clearedIds = new Set(readRows.filter(({ clearedAt }) => clearedAt !== null).map(({ notificationId }) => notificationId));
  return notifications
    .filter(({ id }) => !clearedIds.has(id))
    .map((notification) => ({ ...notification, isRead: visibleReadIds.has(notification.id) }))
    .sort((a, b) => Number(b.actionable) - Number(a.actionable) || b.occurredAt.getTime() - a.occurredAt.getTime());
}

export async function clearNotifications(personId: string, notificationIds: string[], database = getDb()) {
  const uniqueIds = [...new Set(notificationIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;
  const clearedAt = new Date();
  await database.insert(notificationReads)
    .values(uniqueIds.map((notificationId) => ({ personId, notificationId, clearedAt })))
    .onConflictDoUpdate({
      target: [notificationReads.personId, notificationReads.notificationId],
      set: { clearedAt },
    });
}

export async function markNotificationsRead(personId: string, notificationIds: string[], database = getDb()) {
  const uniqueIds = [...new Set(notificationIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;
  await database.insert(notificationReads)
    .values(uniqueIds.map((notificationId) => ({ personId, notificationId })))
    .onConflictDoNothing();
}
