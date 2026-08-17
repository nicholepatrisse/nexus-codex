import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "@/auth/actor";
import { authorizeCommunityBySlug } from "@/authorization/community-guard";

const actor: AuthenticatedActor = {
  personId: "person-sensitive",
  authUserId: "auth-user-sensitive",
  sessionId: "session-sensitive",
};

const community = {
  id: "community-sensitive",
  name: "Secret Society",
  slug: "secret-society",
  visibility: "private",
  scheduleVisibility: "members",
};

describe("community authorization guard", () => {
  it("preserves the authenticated actor for authorized attribution", async () => {
    const result = await authorizeCommunityBySlug({
      actor,
      slug: community.slug,
      operation: "community.view",
      resolveAccess: async () => ({
        status: "available",
        community,
        isActiveMember: true,
        roles: [],
      }),
      denialSink: vi.fn(),
    });

    expect(result).toMatchObject({ status: "authorized", actor });
    if (result.status === "authorized") expect(result.actor).toBe(actor);
  });

  it("returns not-found for every unavailable resource without leaking metadata", async () => {
    const denialSink = vi.fn();
    const result = await authorizeCommunityBySlug({
      actor,
      slug: community.slug,
      operation: "community.view",
      resolveAccess: async () => ({ status: "unavailable" }),
      denialSink,
    });

    expect(result).toEqual({ status: "not-found" });
    expect(denialSink).toHaveBeenCalledWith({
      operation: "community.view",
      reason: "resource-unavailable",
    });
  });

  it("fails closed when an available actor lacks permission", async () => {
    const denialSink = vi.fn();
    const result = await authorizeCommunityBySlug({
      actor,
      slug: "public-community",
      operation: "membership.manage",
      resolveAccess: async () => ({
        status: "available",
        community: { ...community, visibility: "public" },
        isActiveMember: true,
        roles: ["gm"],
      }),
      denialSink,
    });

    expect(result).toEqual({ status: "forbidden" });
    expect(denialSink).toHaveBeenCalledWith({
      operation: "membership.manage",
      reason: "insufficient-permission",
    });
  });

  it("passes only safe operation and reason metadata to denial logging", async () => {
    const denialSink = vi.fn();
    await authorizeCommunityBySlug({
      actor,
      slug: community.slug,
      operation: "community.policy.manage",
      resolveAccess: async () => ({ status: "unavailable" }),
      denialSink,
    });

    const serializedEvent = JSON.stringify(denialSink.mock.calls[0]?.[0]);
    expect(serializedEvent).toBe(
      '{"operation":"community.policy.manage","reason":"resource-unavailable"}',
    );
    expect(serializedEvent).not.toContain(actor.personId);
    expect(serializedEvent).not.toContain(community.id);
    expect(serializedEvent).not.toContain(community.slug);
    expect(serializedEvent).not.toContain(community.name);
  });

  it("allows public visitor reads but denies owner operations", async () => {
    const resolveAccess = async () => ({
      status: "available" as const,
      community: {
        ...community,
        visibility: "public",
        scheduleVisibility: "public",
      },
      isActiveMember: false,
      roles: [],
    });

    await expect(
      authorizeCommunityBySlug({
        actor: null,
        slug: "public-community",
        operation: "community.view",
        resolveAccess,
        denialSink: vi.fn(),
      }),
    ).resolves.toMatchObject({ status: "authorized", actor: null });

    await expect(
      authorizeCommunityBySlug({
        actor: null,
        slug: "public-community",
        operation: "community.lifecycle.manage",
        resolveAccess,
        denialSink: vi.fn(),
      }),
    ).resolves.toEqual({ status: "forbidden" });
  });
});
