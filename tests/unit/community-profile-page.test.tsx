import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeCommunityBySlug, getAuthenticatedActor, notFound } = vi.hoisted(() => ({
  authorizeCommunityBySlug: vi.fn(),
  getAuthenticatedActor: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/auth/actor", () => ({ getAuthenticatedActor }));
vi.mock("@/authorization/community-guard", () => ({ authorizeCommunityBySlug }));

import CommunityPage from "@/app/communities/[slug]/page";

describe("community profile page access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the shared guard for a signed-out public visitor", async () => {
    getAuthenticatedActor.mockResolvedValue(null);
    authorizeCommunityBySlug.mockResolvedValue({
      status: "authorized",
      access: {
        community: {
          id: "public-id",
          name: "Public Lodge",
          slug: "public-lodge",
          description: "Everyone can see this profile.",
          visibility: "public",
          scheduleVisibility: "members",
        },
        isActiveMember: false,
        roles: [],
      },
    });

    const page = await CommunityPage({ params: Promise.resolve({ slug: "public-lodge" }) });

    expect(authorizeCommunityBySlug).toHaveBeenCalledWith({
      actor: null,
      slug: "public-lodge",
      operation: "community.view",
    });
    expect(renderToStaticMarkup(page)).toContain("Public Lodge");
  });

  it.each(["not-found", "forbidden"])(
    "maps a %s decision to the same not-found boundary",
    async (status) => {
      getAuthenticatedActor.mockResolvedValue({ personId: "inactive-person" });
      authorizeCommunityBySlug.mockResolvedValue({ status });

      await expect(
        CommunityPage({ params: Promise.resolve({ slug: "undisclosed-community" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledOnce();
    },
  );
});
