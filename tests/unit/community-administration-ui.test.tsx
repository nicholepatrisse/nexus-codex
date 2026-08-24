import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdministrationOverview } from "@/app/communities/[slug]/settings/administration-overview";

describe("community administration overview", () => {
  it("distinguishes upcoming and cancelled sessions and shows owner grants", () => {
    const markup = renderToStaticMarkup(<AdministrationOverview slug="absalom" members={[{ id: "member", displayName: "Val", status: "active", roles: ["owner"] }]} sessions={[
      { id: "upcoming", code: "SFS 1-01", title: "Upcoming", gmName: "Val", gmPersonId: "person", status: "published", startsAt: new Date("2030-01-01T18:00:00Z"), displayTimeZone: "UTC" },
      { id: "cancelled", code: "SFS 1-02", title: "Cancelled", gmName: "Val", gmPersonId: "person", status: "cancelled", startsAt: new Date("2030-01-02T18:00:00Z"), displayTimeZone: "UTC" },
    ]} />);
    expect(markup).toContain("Members and owner grants");
    expect(markup).toContain("owner");
    expect(markup).toContain("Upcoming sessions");
    expect(markup).toContain("Cancelled sessions");
    expect(markup).toContain("SFS 1-01");
    expect(markup).toContain("SFS 1-02");
  });

  it("removes mutation links in archived read-only mode", () => {
    const markup = renderToStaticMarkup(<AdministrationOverview slug="archived" members={[]} sessions={[]} readOnly />);
    expect(markup).not.toContain("Create session");
  });
});
