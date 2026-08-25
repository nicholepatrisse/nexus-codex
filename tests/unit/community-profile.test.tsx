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

  it("separates and orders upcoming and past sessions", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile
        community={publicCommunity}
        isOwner={false}
        now="2030-09-02T00:00:00.000Z"
        sessions={[{
          id: "future-later",
          code: "1-01",
          title: "The Commencement",
          startsAt: "2030-09-02T01:00:00.000Z",
          gmName: "Radaszam",
        }, {
          id: "past-older", code: "1-02", title: "Older", startsAt: "2029-01-01T00:00:00.000Z", gmName: "Zigvigix",
        }, {
          id: "future-next", code: "1-03", title: "Next", startsAt: "2030-09-02T00:30:00.000Z", gmName: "Tara Nova",
        }, {
          id: "past-recent", code: "1-04", title: "Recent", startsAt: "2030-09-01T23:00:00.000Z", gmName: "Chiskisk",
        }]}
      />,
    );

    expect(markup).toContain("Upcoming Sessions");
    expect(markup).toContain("Past Sessions");
    expect(markup).toContain("1-01 — The Commencement");
    expect(markup).toContain("GM: Radaszam");
    expect(markup.indexOf("1-03 — Next")).toBeLessThan(markup.indexOf("1-01 — The Commencement"));
    expect(markup.indexOf("1-04 — Recent")).toBeLessThan(markup.indexOf("1-02 — Older"));
  });

  it("renders an empty state for each visible schedule section", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile community={publicCommunity} isOwner={false} canViewSchedule sessions={[]} />,
    );

    expect(markup).toContain("No upcoming sessions are scheduled.");
    expect(markup).toContain("No past sessions yet.");
  });
});
