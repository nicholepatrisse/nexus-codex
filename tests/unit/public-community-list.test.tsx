import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicCommunityList } from "@/app/communities/public-community-list";

describe("public community discovery list", () => {
  it("renders only the public-safe fields supplied by the repository", () => {
    const markup = renderToStaticMarkup(
      <PublicCommunityList
        communities={[
          {
            id: "community-public",
            name: "Absalom Lodge",
            slug: "absalom-lodge",
            description: "Weekly games in the Grand Lodge.",
          },
        ]}
        hasQuery
      />,
    );

    expect(markup).toContain("Absalom Lodge");
    expect(markup).toContain("Weekly games in the Grand Lodge.");
    expect(markup).toContain('href="/communities/absalom-lodge"');
    expect(markup).not.toContain("community-public");
    expect(markup).not.toContain("member");
  });

  it("renders a nonrevealing search empty state", () => {
    const markup = renderToStaticMarkup(<PublicCommunityList communities={[]} hasQuery />);

    expect(markup).toContain("No public communities found");
    expect(markup).not.toContain("private");
    expect(markup).not.toContain("archived");
  });

  it("distinguishes an empty public directory from an unmatched search", () => {
    const markup = renderToStaticMarkup(<PublicCommunityList communities={[]} hasQuery={false} />);

    expect(markup).toContain("No public communities yet");
  });
});
