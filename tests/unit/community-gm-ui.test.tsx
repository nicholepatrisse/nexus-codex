import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityProfile } from "@/app/communities/[slug]/community-profile";
import { GmManagement } from "@/app/communities/[slug]/settings/gm-management";

const community = {
  name: "Absalom Lodge",
  slug: "absalom-lodge",
  description: null,
  visibility: "private",
};

describe("community GM UI", () => {
  it.each([
    ["eligible", "Request GM access"],
    ["pending", "Cancel GM request"],
    ["active", "You’re an approved GM."],
    ["rejected", "previous GM request was not approved"],
    ["revoked", "previous GM access was revoked"],
  ] as const)("renders the member %s state", (gmState, expected) => {
    const markup = renderToStaticMarkup(
      <CommunityProfile
        community={community}
        isOwner={false}
        isSignedIn
        isMember
        gmState={gmState}
        pendingGmRequestId={gmState === "pending" ? "pending-request" : undefined}
      />,
    );
    expect(markup).toContain(expected);
    expect(markup).not.toContain("Private decision note");
  });

  it("does not show GM request controls to visitors or owners", () => {
    const visitor = renderToStaticMarkup(
      <CommunityProfile community={community} isOwner={false} isSignedIn isMember={false} />,
    );
    const owner = renderToStaticMarkup(
      <CommunityProfile community={community} isOwner isSignedIn isMember gmState="eligible" />,
    );
    expect(visitor).not.toMatch(/Request GM access|Cancel GM request/);
    expect(owner).not.toMatch(/Request GM access|Cancel GM request/);
  });

  it("explains self-service promotion without showing a standalone request", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile
        community={community}
        isOwner={false}
        isSignedIn
        isMember
        gmAdmission="self_service"
        gmState="eligible"
      />,
    );
    expect(markup).toContain("GM access is granted when you create a game");
    expect(markup).not.toContain("Request GM access");
  });

  it("does not let a revoked member regain GM access through self-service", () => {
    const markup = renderToStaticMarkup(
      <CommunityProfile
        community={community}
        isOwner={false}
        isSignedIn
        isMember
        gmAdmission="self_service"
        gmState="revoked"
      />,
    );
    expect(markup).toContain("cannot be restored through self-service");
    expect(markup).not.toContain("Request GM access");
    expect(markup).not.toContain("GM access is granted when you create a game");
  });

  it("shows owner request decisions and confirmation-based active grant revocation", () => {
    const markup = renderToStaticMarkup(
      <GmManagement
        slug="absalom-lodge"
        requests={[{ id: "request-one", displayName: "Mara", requestedAt: new Date("2026-08-17") }]}
        grants={[
          { id: "grant-active", displayName: "Jin", status: "active" },
          { id: "grant-revoked", displayName: "Sol", status: "revoked" },
        ]}
      />,
    );
    expect(markup).toContain("Pending GM requests");
    expect(markup).toContain("Approve");
    expect(markup).toContain("Reject");
    expect(markup).toContain("GM grant history");
    expect(markup.match(/>Revoke</g)).toHaveLength(1);
    expect(markup).not.toMatch(/reason|decision note|suspend|restore/i);
  });
});
