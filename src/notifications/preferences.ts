import { and, eq, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { communities, communityMemberships, communityNotificationPreferences } from "@/db/schema";

export async function listCommunityNotificationPreferences(actor: AuthenticatedActor, database = getDb()) {
  const rows = await database.select({
    communityId: communities.id,
    communityName: communities.name,
    enabled: communityNotificationPreferences.newGameNotificationsEnabled,
  }).from(communityMemberships)
    .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
    .leftJoin(communityNotificationPreferences, and(
      eq(communityNotificationPreferences.personId, communityMemberships.personId),
      eq(communityNotificationPreferences.communityId, communityMemberships.communityId),
    ))
    .where(and(eq(communityMemberships.personId, actor.personId), eq(communityMemberships.status, "active")))
    .orderBy(communities.name);
  return rows.map((row) => ({ ...row, enabled: row.enabled ?? true }));
}

export async function updateCommunityNotificationPreferences(actor: AuthenticatedActor, enabledCommunityIds: string[], database = getDb()) {
  return database.transaction(async (transaction) => {
    const memberships = await transaction.select({ communityId: communityMemberships.communityId })
      .from(communityMemberships)
      .where(and(eq(communityMemberships.personId, actor.personId), eq(communityMemberships.status, "active")));
    const enabled = new Set(enabledCommunityIds);
    const now = new Date();
    if (memberships.length > 0) await transaction.insert(communityNotificationPreferences).values(
      memberships.map(({ communityId }) => ({
        personId: actor.personId, communityId,
        newGameNotificationsEnabled: enabled.has(communityId), updatedAt: now,
      })),
    ).onConflictDoUpdate({
      target: [communityNotificationPreferences.personId, communityNotificationPreferences.communityId],
      set: { newGameNotificationsEnabled: sql`excluded.new_game_notifications_enabled`, updatedAt: now },
    });
    return memberships.length;
  });
}
