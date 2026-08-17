import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { canPerformCommunityOperation } from "@/authorization/policy";
import { getDb } from "@/db/client";
import {
  communities,
  communityAuditEvents,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

export type CommunityLifecycleAction = "archive" | "restore";

export class CommunityLifecycleError extends Error {
  constructor(
    readonly code: "confirmation-required" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(
      code === "confirmation-required"
        ? "Explicit confirmation is required."
        : "The community is unavailable.",
      options,
    );
    this.name = "CommunityLifecycleError";
  }
}

export type ChangeCommunityLifecycleInput = Readonly<{
  slug: string;
  action: CommunityLifecycleAction;
  confirmed: boolean;
}>;

/**
 * Archives or restores a community without deleting it or its relationships.
 * Authorization and the update happen in one transaction and are resolved from
 * current membership/grant state, so revocation is effective immediately.
 */
export async function changeCommunityLifecycle(
  actor: Pick<AuthenticatedActor, "personId">,
  input: ChangeCommunityLifecycleInput,
  database = getDb(),
) {
  if (input.confirmed !== true) {
    throw new CommunityLifecycleError("confirmation-required");
  }

  const desiredStatus = input.action === "archive" ? "archived" : "active";
  const requiredStatus = input.action === "archive" ? "active" : "archived";

  try {
    return await database.transaction(async (transaction) => {
      const [community] = await transaction
        .select({
          id: communities.id,
          slug: communities.slug,
          lifecycleStatus: communities.lifecycleStatus,
          visibility: communities.visibility,
          scheduleVisibility: communities.scheduleVisibility,
        })
        .from(communities)
        .where(and(eq(communities.slug, input.slug), eq(communities.lifecycleStatus, requiredStatus)))
        .limit(1);

      if (!community) throw new CommunityLifecycleError("unavailable");

      const [membership] = await transaction
        .select({ id: communityMemberships.id })
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.communityId, community.id),
            eq(communityMemberships.personId, actor.personId),
            eq(communityMemberships.status, "active"),
          ),
        )
        .limit(1);

      const [ownerGrant] = membership
        ? await transaction
            .select({ id: communityRoleGrants.id })
            .from(communityRoleGrants)
            .where(
              and(
                eq(communityRoleGrants.communityId, community.id),
                eq(communityRoleGrants.personId, actor.personId),
                eq(communityRoleGrants.role, "owner"),
                isNull(communityRoleGrants.revokedAt),
              ),
            )
            .limit(1)
        : [];

      const permitted = Boolean(ownerGrant) && canPerformCommunityOperation(
        "owner",
        "community.lifecycle.manage",
        {
          visibility: community.visibility === "public" ? "public" : "private",
          scheduleVisibility:
            community.scheduleVisibility === "public" ? "public" : "members",
        },
      );

      if (!permitted) throw new CommunityLifecycleError("unavailable");

      const [updated] = await transaction
        .update(communities)
        .set({ lifecycleStatus: desiredStatus, updatedAt: new Date() })
        .where(and(eq(communities.id, community.id), eq(communities.lifecycleStatus, requiredStatus)))
        .returning({ id: communities.id, slug: communities.slug, lifecycleStatus: communities.lifecycleStatus });

      if (!updated) throw new CommunityLifecycleError("unavailable");

      await transaction.insert(communityAuditEvents).values({
        id: randomUUID(),
        communityId: community.id,
        actorPersonId: actor.personId,
        eventType: input.action === "archive" ? "community.archived" : "community.restored",
        details: { from: requiredStatus, to: desiredStatus },
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof CommunityLifecycleError) throw error;
    throw new CommunityLifecycleError("unavailable", { cause: error });
  }
}
