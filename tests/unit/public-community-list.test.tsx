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
      />,
    );

    expect(markup).toContain("Absalom Lodge");
    expect(markup).toContain("Weekly games in the Grand Lodge.");
    expect(markup).toContain('href="/communities/absalom-lodge"');
    expect(markup).not.toContain("community-public");
    expect(markup).not.toContain("member");
  });

  it("renders a nonrevealing empty directory state", () => {
    const markup = renderToStaticMarkup(<PublicCommunityList communities={[]} />);

    expect(markup).toContain("No public communities yet");
    expect(markup).not.toContain("private");
    expect(markup).not.toContain("archived");
  });

  it("gives joined communities a distinct treatment", () => {
    const markup = renderToStaticMarkup(<PublicCommunityList communities={[
      { id: "joined", name: "Joined Lodge", slug: "joined-lodge", description: null },
      { id: "available", name: "Available Lodge", slug: "available-lodge", description: null },
    ]} joinedCommunityIds={["joined"]} />);

    expect(markup).toContain("Joined");
    expect(markup).toContain("border-l-success");
    expect(markup.match(/>Joined</g)).toHaveLength(1);
  });
});
