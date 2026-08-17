import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityList } from "@/app/my-communities";

describe("community list", () => {
  it("renders an empty state with a creation action", () => {
    const markup = renderToStaticMarkup(<CommunityList communities={[]} />);

    expect(markup).toContain("No communities yet");
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
});
