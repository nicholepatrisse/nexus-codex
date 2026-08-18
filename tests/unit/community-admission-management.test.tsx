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
        invitations={[{ id: "invite-1", status: "pending", maxUses: 5, useCount: 2, expiresAt: new Date("2030-01-01T00:00:00Z") }]}
        requests={[{ id: "request-1", displayName: "Player One", requestedAt: new Date("2030-01-01T00:00:00Z") }]}
      />,
    );
    expect(markup).toContain("2 of 5 uses");
    expect(markup).toContain("Generate sharing link");
    expect(markup).toContain("Revoke");
    expect(markup).toContain("Player One");
    expect(markup).toContain("Approve");
    expect(markup).toContain("Reject");
    expect(markup).not.toMatch(/token hash|person id/i);
  });
});
