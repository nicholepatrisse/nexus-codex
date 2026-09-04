import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityList } from "@/app/my-communities";

describe("community list", () => {
  it("renders discovery and creation actions", () => {
    const markup = renderToStaticMarkup(<CommunityList communities={[]} />);

    expect(markup).toContain("No communities yet");
    expect(markup).toContain('href="/communities/directory"');
    expect(markup).toContain("Find communities");
    expect(markup).toContain('href="/communities/new"');
  });

  it("renders each active community as a link", () => {
    const markup = renderToStaticMarkup(
      <CommunityList
        communities={[
          { id: "one", name: "Absalom Lodge", slug: "absalom", visibility: "private", lifecycleStatus: "active" },
          { id: "two", name: "Drift Lodge", slug: "drift", visibility: "public", lifecycleStatus: "active" },
        ]}
      />,
    );

    expect(markup).toContain('href="/communities/absalom"');
    expect(markup).toContain("Absalom Lodge");
    expect(markup).toContain('href="/communities/drift"');
    expect(markup).toContain("Drift Lodge");
  });

  it("links archived communities to their restore settings", () => {
    const markup = renderToStaticMarkup(
      <CommunityList
        communities={[
          {
            id: "archived",
            name: "Archived Lodge",
            slug: "archived-lodge",
            visibility: "private",
            lifecycleStatus: "archived",
          },
        ]}
      />,
    );

    expect(markup).toContain("Archived communities");
    expect(markup).toContain('href="/communities/archived-lodge/settings"');
    expect(markup).toContain("Open settings to restore");
  });

  it("shows admission status badges without exposing private-community links", () => {
    const markup = renderToStaticMarkup(
      <CommunityList
        communities={[]}
        admissions={[
          {
            id: "pending-request",
            communityName: "Public Lodge",
            communitySlug: "public-lodge",
            communityVisibility: "public",
            status: "pending",
            updatedAt: new Date("2026-08-17T12:00:00Z"),
          },
          {
            id: "rejected-request",
            communityName: "Private Lodge",
            communitySlug: "private-lodge",
            communityVisibility: "private",
            status: "rejected",
            updatedAt: new Date("2026-08-17T13:00:00Z"),
          },
        ]}
      />,
    );

    expect(markup).toContain("Membership requests");
    expect(markup).toContain("Pending");
    expect(markup).toContain("Not approved");
    expect(markup).toContain('href="/communities/public-lodge"');
    expect(markup).not.toContain('href="/communities/private-lodge"');
    expect(markup).not.toContain("decisionReason");
  });
});
