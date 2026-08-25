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
    expect(markup).not.toContain('href="/"');
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

  it("offers signed-out visitors a sign-in return path", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile community={publicCommunity} isOwner={false} />,
    );
    expect(markup).toContain("Sign in to request membership");
    expect(markup).toContain("callbackURL=%2Fcommunities%2Fabsalom-station");
  });

  it("shows pending cancellation without exposing decision details", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile community={publicCommunity} isOwner={false} isSignedIn pendingRequestId="request-secret" />,
    );
    expect(markup).toContain("Cancel membership request");
    expect(markup).toContain("awaiting review");
    expect(markup).not.toMatch(/reason|decision note/i);
  });

  it("does not offer admission to active members", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile community={publicCommunity} isOwner={false} isSignedIn isMember />,
    );
    expect(markup).not.toMatch(/request membership|cancel membership request/i);
  });

  it("renders published sessions supplied by the visibility-aware page query", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile
        community={publicCommunity}
        isOwner={false}
        sessions={[{
          id: "session-1",
          code: "1-01",
          title: "The Commencement",
          startsAt: "2030-09-02T01:00:00.000Z",
          gmName: "Radaszam",
        }]}
      />,
    );

    expect(markup).toContain("Published sessions");
    expect(markup).toContain("1-01 — The Commencement");
    expect(markup).toContain("GM: Radaszam");
  });
});
