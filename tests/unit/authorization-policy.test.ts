import { describe, expect, it } from "vitest";

import {
  canPerformCommunityOperation,
  canPerformSessionOperation,
  type CommunityAccessPolicy,
  type CommunityOperation,
  type CommunityRole,
  type SessionOperation,
} from "@/authorization";

const privateCommunity = {
  visibility: "private",
  scheduleVisibility: "members",
} satisfies CommunityAccessPolicy;

const publicCommunity = {
  visibility: "public",
  scheduleVisibility: "public",
} satisfies CommunityAccessPolicy;

const roles: CommunityRole[] = ["visitor", "member", "gm", "owner"];

const communityOperations: CommunityOperation[] = [
  "community.discover",
  "community.view",
  "schedule.view",
  "membership.request",
  "gm.request",
  "membership.manage",
  "gm.manage",
  "community.policy.manage",
  "community.lifecycle.manage",
  "community.ownership.transfer",
];

const sessionOperations: SessionOperation[] = [
  "session.create",
  "session.manage.assigned",
  "session.manage.any",
  "session.staff.any",
  "session.capacity.override",
];

describe("community authorization policy", () => {
  it("matches the complete role and operation matrix", () => {
    const expected: Record<CommunityRole, CommunityOperation[]> = {
      visitor: [
        "community.discover",
        "community.view",
        "schedule.view",
        "membership.request",
      ],
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
    };

    for (const role of roles) {
      for (const operation of communityOperations) {
        expect(
          canPerformCommunityOperation(role, operation, publicCommunity),
          `${role} -> ${operation}`,
        ).toBe(expected[role].includes(operation));
      }
    }
  });

  it("applies public policy only to visitor reads", () => {
    expect(canPerformCommunityOperation("visitor", "community.discover", privateCommunity)).toBe(
      false,
    );
    expect(canPerformCommunityOperation("visitor", "community.view", privateCommunity)).toBe(false);
    expect(canPerformCommunityOperation("visitor", "schedule.view", privateCommunity)).toBe(false);
    expect(canPerformCommunityOperation("visitor", "membership.request", privateCommunity)).toBe(
      true,
    );
    expect(canPerformCommunityOperation("member", "schedule.view", privateCommunity)).toBe(true);
  });

  it("does not expose a public schedule from a private community", () => {
    expect(
      canPerformCommunityOperation("visitor", "schedule.view", {
        visibility: "private",
        scheduleVisibility: "public",
      }),
    ).toBe(false);
  });

  it("fails closed for unexpected runtime role and operation values", () => {
    expect(
      canPerformCommunityOperation(
        "administrator" as CommunityRole,
        "community.view",
        publicCommunity,
      ),
    ).toBe(false);
    expect(
      canPerformCommunityOperation(
        "owner",
        "community.delete" as CommunityOperation,
        publicCommunity,
      ),
    ).toBe(false);
  });
});

describe("session authorization policy", () => {
  it("matches the complete role and operation matrix", () => {
    const expected: Record<CommunityRole, SessionOperation[]> = {
      visitor: [],
      member: [],
      gm: ["session.create", "session.manage.assigned"],
      owner: sessionOperations,
    };

    for (const role of roles) {
      for (const operation of sessionOperations) {
        expect(canPerformSessionOperation(role, operation), `${role} -> ${operation}`).toBe(
          expected[role].includes(operation),
        );
      }
    }
  });

  it("gives a GM no community-wide, any-game, staffing, or capacity authority", () => {
    for (const operation of [
      "membership.manage",
      "gm.manage",
      "community.policy.manage",
      "community.lifecycle.manage",
      "community.ownership.transfer",
    ] satisfies CommunityOperation[]) {
      expect(canPerformCommunityOperation("gm", operation, publicCommunity)).toBe(false);
    }

    expect(canPerformSessionOperation("gm", "session.manage.any")).toBe(false);
    expect(canPerformSessionOperation("gm", "session.staff.any")).toBe(false);
    expect(canPerformSessionOperation("gm", "session.capacity.override")).toBe(false);
  });

  it("fails closed for unexpected runtime values", () => {
    expect(canPerformSessionOperation("organizer" as CommunityRole, "session.create")).toBe(false);
    expect(
      canPerformSessionOperation("owner", "session.publish" as SessionOperation),
    ).toBe(false);
  });
});
