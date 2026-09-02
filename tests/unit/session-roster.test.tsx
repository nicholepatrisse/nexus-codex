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

  it("describes a fully validated character in the validation tooltip", () => {
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={1} waitlistedCount={0} expandable entries={[{ id: "p1", personName: "Player", characterName: "Vexara", validationSummary: { presentation: "Validated", validatedCount: 4, unvalidatedCount: 0, invalidCount: 0, details: [] }, status: "confirmed" }]} />);
    expect(markup).toContain('aria-label="Character validated"');
    expect(markup).toContain("Nexus confirmed every recorded class, ancestry, background, and inventory selection.");
    expect(markup).not.toContain("✓<span");
  });

  it("shows staff the confirmed players and ordered waitlist", () => {
    const validationSummary = { presentation: "Needs Review" as const, validatedCount: 2, unvalidatedCount: 1, invalidCount: 0, details: [{ key: "identity-background", category: "Background" as const, selection: "Icon", source: "Galaxy Guide", sourceHref: null, playerNote: "Granted by a boon", editHref: "/characters/character-1/edit#background", status: "unvalidated" as const, issues: [{ type: "unsupported_access_rule" as const, severity: "warning" as const, message: "Nexus cannot verify this boon.", resolvable: false }] }] };
    const markup = renderToStaticMarkup(<SessionRoster capacity={6} confirmedCount={1} waitlistedCount={2} expandable entries={[{ id: "w2", personName: "Second Waiting", status: "waitlisted", waitlistPosition: 2 }, { id: "p1", personName: "Confirmed Player", discordHandle: "confirmed.player", characterId: "character-1", characterName: "Navasi", characterSocietyNumber: "12345-2701", characterLevel: 4, characterClassName: "Envoy", characterAncestry: "Human", characterBackground: "Icon", validationSummary, status: "confirmed" }, { id: "w1", personName: "First Waiting", status: "waitlisted", waitlistPosition: 1 }]} />);
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
    expect(markup).not.toContain("Validation summary");
    expect(markup).toContain('aria-label="Validated selections"');
    expect(markup).not.toContain('aria-label="2 validated"');
    expect(markup).toContain('aria-label="1 need review"');
    expect(markup).not.toContain('aria-label="0 rules issues"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain("lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(markup).not.toContain("lg:mt-14");
    expect(markup).toContain("Granted by a boon");
    expect(markup).not.toContain("/characters/character-1/edit#background");
  });
});
