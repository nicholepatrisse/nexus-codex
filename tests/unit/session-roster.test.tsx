import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { canViewPrivateRosterDetails, SessionRoster } from "@/app/communities/[slug]/sessions/[sessionId]/session-roster";

describe("session roster", () => {
  it("reserves private roster details for the GM and owner", () => {
    expect(canViewPrivateRosterDetails(false)).toBe(false);
    expect(canViewPrivateRosterDetails(true)).toBe(true);
  });

  it("can render aggregate counts independently", () => {
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={4} waitlistedCount={2} />);
    expect(markup).toContain("4 of 6 seats confirmed");
    expect(markup).toContain("2 waitlisted");
  });

  it("renders static roster cards for non-managers", () => {
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={1} waitlistedCount={0} entries={[{ id: "p1", personName: "Player", characterName: "Vexara", characterLevel: 1, characterAncestry: "Human", characterBackground: "Outlaw", characterClassName: "Mystic", status: "confirmed" }]} />);
    expect(markup).toContain("Vexara");
    expect(markup).toContain("Level 1 · Human · Outlaw · Mystic");
    expect(markup).toContain("break-words");
    expect(markup).not.toContain("truncate");
    expect(markup).not.toContain("<details");
    expect(markup).not.toContain("<summary");
  });

  it("shows staff the confirmed players and ordered waitlist", () => {
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={1} waitlistedCount={2} expandable entries={[{ id: "w2", personName: "Second Waiting", status: "waitlisted", waitlistPosition: 2 }, { id: "p1", personName: "Confirmed Player", discordHandle: "confirmed.player", characterId: "character-1", characterName: "Navasi", characterSocietyNumber: "12345-2701", characterLevel: 4, characterClassName: "Envoy", characterAncestry: "Human", characterBackground: "Icon", status: "confirmed" }, { id: "w1", personName: "First Waiting", status: "waitlisted", waitlistPosition: 1 }]} />);
    expect(markup).toContain("Confirmed Player");
    expect(markup).toContain("card-standard");
    expect(markup).toContain("group-open:hidden");
    expect(markup).toContain("Confirmed");
    expect(markup).toContain("Waitlist #1");
    expect(markup.indexOf("First Waiting")).toBeLessThan(markup.indexOf("Second Waiting"));
    expect(markup).toContain("#1");
    expect(markup).toContain("Discord");
    expect(markup).toContain("confirmed.player");
    expect(markup).toContain("Society #");
    expect(markup).toContain("Character");
    expect(markup).toContain("Navasi");
    expect(markup).toContain("12345-2701");
    expect(markup).toContain("Level 4");
    expect(markup).toContain("Envoy");
    expect(markup).toContain("Human");
    expect(markup).toContain("Icon");
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain('href="/characters/character-1"');
  });
});
