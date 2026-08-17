import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityProfile } from "@/app/communities/[slug]/community-profile";

const publicCommunity = {
  name: "Absalom Station Lodge",
  slug: "absalom-station",
  description: "Public games in the Pact Worlds.",
  visibility: "public",
};

describe("community profile", () => {
  it("renders only approved public profile fields for a visitor", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile community={publicCommunity} isOwner={false} />,
    );

    expect(markup).toContain("Public community");
    expect(markup).toContain("Absalom Station Lodge");
    expect(markup).toContain("Public games in the Pact Worlds.");
    expect(markup).not.toContain("Community settings");
    expect(markup).not.toMatch(/member count|invitation|audit|location/i);
  });

  it("labels private profiles and omits an absent description", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile
        community={{ ...publicCommunity, description: null, visibility: "private" }}
        isOwner={false}
      />,
    );

    expect(markup).toContain("Private community");
    expect(markup).toContain("visible only to active members");
    expect(markup).not.toContain("Public games in the Pact Worlds.");
  });

  it("shows the settings link only when access identifies an active owner", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile community={publicCommunity} isOwner />,
    );

    expect(markup).toContain('href="/communities/absalom-station/settings"');
    expect(markup).toContain("Community settings");
  });
});
