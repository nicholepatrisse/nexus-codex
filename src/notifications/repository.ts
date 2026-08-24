import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { communities, communityMembershipRequests, communityMemberships, communityRoleGrants } from "@/db/schema";
import { applicantNotificationDestination, type AppNotification } from "@/notifications/model";

const applicantMessages: Record<string, string> = {
  pending: "Your membership request is awaiting review.", approved: "Your membership request was approved.",
  rejected: "Your membership request was not approved.", cancelled: "Your membership request was cancelled.",
};

/** Produces only notifications the person is currently authorized to know about. */
export async function listNotificationsForPerson(personId: string, database = getDb()) {
  const [ownerRows, applicantRows] = await Promise.all([
    database.select({ communityId: communities.id, communityName: communities.name, communitySlug: communities.slug, pendingCount: count(communityMembershipRequests.id) })
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
  ]);

  const ownerNotifications: AppNotification[] = ownerRows.map((row) => ({
    id: `owner-membership:${row.communityId}`, kind: "owner.membership.pending", title: row.communityName,
    message: `${row.pendingCount} membership ${row.pendingCount === 1 ? "request needs" : "requests need"} review.`,
    href: `/communities/${encodeURIComponent(row.communitySlug)}/settings`, occurredAt: new Date(0), actionable: true,
  }));
  const applicantNotifications: AppNotification[] = applicantRows.map((row) => ({
    id: `applicant-membership:${row.requestId}:${row.status}`, kind: "applicant.membership.status", title: row.communityName,
    message: applicantMessages[row.status] ?? "Your membership request changed status.",
    href: applicantNotificationDestination(row.communityVisibility, Boolean(row.activeMembershipId), row.communitySlug),
    occurredAt: row.updatedAt, actionable: row.status === "pending",
  }));
  return [...ownerNotifications, ...applicantNotifications].sort((a, b) => Number(b.actionable) - Number(a.actionable) || b.occurredAt.getTime() - a.occurredAt.getTime());
}
