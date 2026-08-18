import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdmissionManagement } from "@/app/communities/[slug]/settings/admission-management";

describe("owner admission management", () => {
  it("renders useful empty states without internal decision data", () => {
    const markup = renderToStaticMarkup(
      <AdmissionManagement slug="test-lodge" invitations={[]} requests={[]} />,
    );
    expect(markup).toContain("No active sharing links");
    expect(markup).toContain("No pending membership requests");
    expect(markup).not.toMatch(/token hash|decision reason|person id/i);
  });

  it("shows only owner-safe pending summaries and confirmation controls", () => {
    const markup = renderToStaticMarkup(
      <AdmissionManagement
        slug="test-lodge"
        invitations={[
          { id: "invite-1", status: "pending", maxUses: 5, useCount: 2, expiresAt: new Date("2030-01-01T00:00:00Z"), token: "limited-token" },
          { id: "invite-2", status: "pending", maxUses: null, useCount: 4, expiresAt: new Date("2030-01-01T00:00:00Z"), token: "unlimited-token" },
          { id: "invite-3", status: "exhausted", maxUses: 1, useCount: 1, expiresAt: new Date("2030-01-01T00:00:00Z"), token: "exhausted-token" },
        ]}
        requests={[{ id: "request-1", displayName: "Player One", requestedAt: new Date("2030-01-01T00:00:00Z") }]}
      />,
    );
    expect(markup).toContain("3 invitations remaining · 2 used");
    expect(markup).toContain("/invitations/limited-token");
    expect(markup).toContain("Unlimited invitations remaining · 4 used");
    expect(markup).toContain("/invitations/unlimited-token");
    expect(markup).not.toContain("exhausted-token");
    expect(markup.match(/Revoke/g)).toHaveLength(2);
    expect(markup).toContain("Generate sharing link");
    expect(markup).toContain("Revoke");
    expect(markup).toContain("Player One");
    expect(markup).toContain("Approve");
    expect(markup).toContain("Reject");
    expect(markup).not.toMatch(/token hash|person id/i);
  });
});
