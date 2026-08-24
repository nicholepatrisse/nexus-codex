import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionRoster } from "@/app/communities/[slug]/sessions/[sessionId]/session-roster";

describe("session roster", () => {
  it("can render aggregate counts independently", () => {
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={4} waitlistedCount={2} />);
    expect(markup).toContain("4 of 6 seats confirmed");
    expect(markup).toContain("2 waitlisted");
  });

  it("shows staff the confirmed players and ordered waitlist", () => {
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={1} waitlistedCount={2} entries={[{ id: "w2", personName: "Second Waiting", status: "waitlisted", waitlistPosition: 2 }, { id: "p1", personName: "Confirmed Player", status: "confirmed" }, { id: "w1", personName: "First Waiting", status: "waitlisted", waitlistPosition: 1 }]} />);
    expect(markup).toContain("Confirmed Player");
    expect(markup.indexOf("First Waiting")).toBeLessThan(markup.indexOf("Second Waiting"));
    expect(markup).toContain("#1");
  });
});
