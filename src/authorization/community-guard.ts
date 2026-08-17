import type { AuthenticatedActor } from "@/auth/actor";
import type { CommunityAccessResult } from "@/authorization/community-access";
import { resolveCommunityAccessBySlug } from "@/authorization/community-access";
import {
  canPerformCommunityOperation,
  type CommunityOperation,
  type CommunityRole,
} from "@/authorization/policy";
import {
  logAuthorizationDenial,
  type AuthorizationDenialSink,
} from "@/authorization/denial-audit";

export type AuthorizedCommunityAccess = Extract<
  CommunityAccessResult,
  { status: "available" }
>;

export type CommunityAuthorizationResult =
  | {
      status: "authorized";
      actor: AuthenticatedActor | null;
      access: AuthorizedCommunityAccess;
    }
  | { status: "not-found" }
  | { status: "forbidden" };

type ResolveCommunityAccess = (
  slug: string,
  personId: string | null,
) => Promise<CommunityAccessResult>;

export type AuthorizeCommunityOptions = Readonly<{
  actor: AuthenticatedActor | null;
  slug: string;
  operation: CommunityOperation;
  resolveAccess?: ResolveCommunityAccess;
  denialSink?: AuthorizationDenialSink;
}>;

function effectiveRole(access: AuthorizedCommunityAccess): CommunityRole {
  if (access.roles.includes("owner")) return "owner";
  if (access.roles.includes("gm")) return "gm";
  return access.isActiveMember ? "member" : "visitor";
}

/**
 * Resolves fresh community access and applies the shared policy in one server
 * boundary. The actor object is returned unchanged so writes can attribute the
 * action to the authenticated person independently of their current role.
 */
export async function authorizeCommunityBySlug({
  actor,
  slug,
  operation,
  resolveAccess = resolveCommunityAccessBySlug,
  denialSink = logAuthorizationDenial,
}: AuthorizeCommunityOptions): Promise<CommunityAuthorizationResult> {
  const access = await resolveAccess(slug, actor?.personId ?? null);

  if (access.status === "unavailable") {
    denialSink({ operation, reason: "resource-unavailable" });
    return { status: "not-found" };
  }

  const permitted = canPerformCommunityOperation(effectiveRole(access), operation, {
    visibility: access.community.visibility === "public" ? "public" : "private",
    scheduleVisibility:
      access.community.scheduleVisibility === "public" ? "public" : "members",
  });

  if (!permitted) {
    denialSink({ operation, reason: "insufficient-permission" });
    return { status: "forbidden" };
  }

  return { status: "authorized", actor, access };
}
