import { and, eq, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { accountNotificationPreferences, communities, communityMemberships, communityNotificationPreferences } from "@/db/schema";

export const communityPreferenceKeys = ["newGames", "membershipRequests", "gmSignups", "joinedGameChanges", "joinedGameCancellations"] as const;
export type CommunityPreferenceKey = typeof communityPreferenceKeys[number];
export type NotificationPreferenceUpdate = { communities: Record<CommunityPreferenceKey, string[]>; membershipStatus: boolean };

export async function listNotificationPreferences(actor: AuthenticatedActor, database = getDb()) {
  const rows = await database.select({ communityId: communities.id, communityName: communities.name, newGames: communityNotificationPreferences.newGameNotificationsEnabled, membershipRequests: communityNotificationPreferences.membershipRequestNotificationsEnabled, gmSignups: communityNotificationPreferences.gmSignupNotificationsEnabled, joinedGameChanges: communityNotificationPreferences.joinedGameChangeNotificationsEnabled, joinedGameCancellations: communityNotificationPreferences.joinedGameCancellationNotificationsEnabled })
    .from(communityMemberships).innerJoin(communities, eq(communities.id, communityMemberships.communityId)).leftJoin(communityNotificationPreferences, and(eq(communityNotificationPreferences.personId, communityMemberships.personId), eq(communityNotificationPreferences.communityId, communityMemberships.communityId)))
    .where(and(eq(communityMemberships.personId, actor.personId), eq(communityMemberships.status, "active"))).orderBy(communities.name);
  const [account] = await database.select({ membershipStatus: accountNotificationPreferences.membershipStatusNotificationsEnabled }).from(accountNotificationPreferences).where(eq(accountNotificationPreferences.personId, actor.personId)).limit(1);
  return { communities: rows.map((row) => ({ ...row, newGames: row.newGames ?? true, membershipRequests: row.membershipRequests ?? true, gmSignups: row.gmSignups ?? true, joinedGameChanges: row.joinedGameChanges ?? true, joinedGameCancellations: row.joinedGameCancellations ?? true })), membershipStatus: account?.membershipStatus ?? true };
}

export async function updateNotificationPreferences(actor: AuthenticatedActor, input: NotificationPreferenceUpdate, database = getDb()) {
  return database.transaction(async (transaction) => {
    const memberships = await transaction.select({ communityId: communityMemberships.communityId }).from(communityMemberships).where(and(eq(communityMemberships.personId, actor.personId), eq(communityMemberships.status, "active")));
    const enabled = Object.fromEntries(communityPreferenceKeys.map((key) => [key, new Set(input.communities[key])])) as Record<CommunityPreferenceKey, Set<string>>;
    const now = new Date();
    if (memberships.length) await transaction.insert(communityNotificationPreferences).values(memberships.map(({ communityId }) => ({ personId: actor.personId, communityId, newGameNotificationsEnabled: enabled.newGames.has(communityId), membershipRequestNotificationsEnabled: enabled.membershipRequests.has(communityId), gmSignupNotificationsEnabled: enabled.gmSignups.has(communityId), joinedGameChangeNotificationsEnabled: enabled.joinedGameChanges.has(communityId), joinedGameCancellationNotificationsEnabled: enabled.joinedGameCancellations.has(communityId), updatedAt: now }))).onConflictDoUpdate({ target: [communityNotificationPreferences.personId, communityNotificationPreferences.communityId], set: { newGameNotificationsEnabled: sql`excluded.new_game_notifications_enabled`, membershipRequestNotificationsEnabled: sql`excluded.membership_request_notifications_enabled`, gmSignupNotificationsEnabled: sql`excluded.gm_signup_notifications_enabled`, joinedGameChangeNotificationsEnabled: sql`excluded.joined_game_change_notifications_enabled`, joinedGameCancellationNotificationsEnabled: sql`excluded.joined_game_cancellation_notifications_enabled`, updatedAt: now }});
    await transaction.insert(accountNotificationPreferences).values({ personId: actor.personId, membershipStatusNotificationsEnabled: input.membershipStatus, updatedAt: now }).onConflictDoUpdate({ target: accountNotificationPreferences.personId, set: { membershipStatusNotificationsEnabled: input.membershipStatus, updatedAt: now } });
    return memberships.length;
  });
}

export async function updateCommunityNotificationPreferences(actor: AuthenticatedActor, enabledCommunityIds: string[], database = getDb()) {
  const current = await listNotificationPreferences(actor, database);
  const all = Object.fromEntries(communityPreferenceKeys.map((key) => [key, current.communities.filter((row) => row[key]).map((row) => row.communityId)])) as Record<CommunityPreferenceKey, string[]>;
  all.newGames = enabledCommunityIds;
  return updateNotificationPreferences(actor, { communities: all, membershipStatus: current.membershipStatus }, database);
}
