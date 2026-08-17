/** The effective community role used for a single authorization decision. */
export type CommunityRole = "visitor" | "member" | "gm" | "owner";

/** Community-wide operations available in M0. */
export type CommunityOperation =
  | "community.discover"
  | "community.view"
  | "schedule.view"
  | "membership.request"
  | "gm.request"
  | "membership.manage"
  | "gm.manage"
  | "community.policy.manage"
  | "community.lifecycle.manage"
  | "community.ownership.transfer";

/**
 * Session operations are defined here so later session services share this
 * vocabulary. Resource ownership checks are intentionally left to those
 * services: `session.manage.assigned` means the actor is assigned to that game.
 */
export type SessionOperation =
  | "session.create"
  | "session.manage.assigned"
  | "session.manage.any"
  | "session.staff.any"
  | "session.capacity.override";

export type AuthorizationOperation = CommunityOperation | SessionOperation;

export type CommunityAccessPolicy = Readonly<{
  visibility: "private" | "public";
  scheduleVisibility: "members" | "public";
}>;

const communityPermissions = {
  visitor: ["community.discover", "community.view", "schedule.view", "membership.request"],
  member: ["community.discover", "community.view", "schedule.view", "gm.request"],
  gm: ["community.discover", "community.view", "schedule.view"],
  owner: [
    "community.discover",
    "community.view",
    "schedule.view",
    "membership.manage",
    "gm.manage",
    "community.policy.manage",
    "community.lifecycle.manage",
    "community.ownership.transfer",
  ],
} as const satisfies Record<CommunityRole, readonly CommunityOperation[]>;

const sessionPermissions = {
  visitor: [],
  member: [],
  gm: ["session.create", "session.manage.assigned"],
  owner: [
    "session.create",
    "session.manage.assigned",
    "session.manage.any",
    "session.staff.any",
    "session.capacity.override",
  ],
} as const satisfies Record<CommunityRole, readonly SessionOperation[]>;

function isRole(value: unknown): value is CommunityRole {
  return value === "visitor" || value === "member" || value === "gm" || value === "owner";
}

function permitsPublicRead(
  role: CommunityRole,
  operation: CommunityOperation,
  policy: CommunityAccessPolicy,
): boolean {
  if (role !== "visitor") return true;

  if (operation === "community.discover" || operation === "community.view") {
    return policy.visibility === "public";
  }

  if (operation === "schedule.view") {
    return policy.visibility === "public" && policy.scheduleVisibility === "public";
  }

  return true;
}

/** Pure, fail-closed decision for community-wide operations. */
export function canPerformCommunityOperation(
  role: CommunityRole,
  operation: CommunityOperation,
  policy: CommunityAccessPolicy,
): boolean {
  if (!isRole(role)) return false;

  const allowed = (communityPermissions[role] as readonly string[]).includes(operation);
  return allowed && permitsPublicRead(role, operation, policy);
}

/** Pure, fail-closed role decision for future session services. */
export function canPerformSessionOperation(
  role: CommunityRole,
  operation: SessionOperation,
): boolean {
  if (!isRole(role)) return false;
  return (sessionPermissions[role] as readonly string[]).includes(operation);
}
