import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  accountNotificationPreferences,
  communityNotificationPreferences,
  communityRoleGrants,
  notificationDeliveries,
  sessionSignups,
} from "@/db/schema";

type Database = ReturnType<typeof getDb>;
export type DeliveryKind = "owner.membership.pending" | "applicant.membership.status" | "gm.session.signup" | "session.changed" | "session.cancelled";

async function insert(database: Database, auditEventId: string, kind: DeliveryKind, personIds: string[], now: Date) {
  if (!personIds.length) return;
  await database.insert(notificationDeliveries).values(
    [...new Set(personIds)].map((personId) => ({ personId, auditEventId, kind, createdAt: now })),
  ).onConflictDoNothing();
}

export async function deliverMembershipRequestToOwners(database: Database, communityId: string, auditEventId: string, now: Date) {
  const rows = await database.select({ personId: communityRoleGrants.personId }).from(communityRoleGrants)
    .leftJoin(communityNotificationPreferences, and(eq(communityNotificationPreferences.personId, communityRoleGrants.personId), eq(communityNotificationPreferences.communityId, communityRoleGrants.communityId)))
    .where(and(eq(communityRoleGrants.communityId, communityId), eq(communityRoleGrants.role, "owner"), eq(communityRoleGrants.status, "active"), isNull(communityRoleGrants.revokedAt), or(isNull(communityNotificationPreferences.personId), eq(communityNotificationPreferences.membershipRequestNotificationsEnabled, true))));
  await insert(database, auditEventId, "owner.membership.pending", rows.map((row) => row.personId), now);
}

export async function deliverMembershipStatus(database: Database, personId: string, auditEventId: string, now: Date) {
  const [preference] = await database.select({ enabled: accountNotificationPreferences.membershipStatusNotificationsEnabled }).from(accountNotificationPreferences).where(eq(accountNotificationPreferences.personId, personId)).limit(1);
  if (preference?.enabled !== false) await insert(database, auditEventId, "applicant.membership.status", [personId], now);
}

export async function deliverSignupToGm(database: Database, communityId: string, gmPersonId: string, auditEventId: string, now: Date) {
  const [preference] = await database.select({ enabled: communityNotificationPreferences.gmSignupNotificationsEnabled }).from(communityNotificationPreferences).where(and(eq(communityNotificationPreferences.personId, gmPersonId), eq(communityNotificationPreferences.communityId, communityId))).limit(1);
  if (preference?.enabled !== false) await insert(database, auditEventId, "gm.session.signup", [gmPersonId], now);
}

export async function deliverSessionChange(database: Database, communityId: string, sessionId: string, actorPersonId: string, auditEventId: string, kind: "session.changed" | "session.cancelled", now: Date) {
  const column = kind === "session.cancelled" ? communityNotificationPreferences.joinedGameCancellationNotificationsEnabled : communityNotificationPreferences.joinedGameChangeNotificationsEnabled;
  const rows = await database.select({ personId: sessionSignups.personId }).from(sessionSignups)
    .leftJoin(communityNotificationPreferences, and(eq(communityNotificationPreferences.personId, sessionSignups.personId), eq(communityNotificationPreferences.communityId, communityId)))
    .where(and(eq(sessionSignups.sessionId, sessionId), inArray(sessionSignups.status, ["confirmed", "waitlisted"]), or(isNull(communityNotificationPreferences.personId), eq(column, true))));
  await insert(database, auditEventId, kind, rows.map((row) => row.personId).filter((id) => id !== actorPersonId), now);
}
