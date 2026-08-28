import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChronicleSummaryCard, formatChronicleDate } from "@/app/chronicle-summary-card";

const base = {
  href: "/characters/character-1/chronicles/chronicle-1",
  scenarioNumber: "1-04",
  scenarioName: "The Great Absalom Relay",
  playedOn: "2030-09-02",
  characterLevel: 3,
  xp: 4,
} as const;

describe("ChronicleSummaryCard", () => {
  it("presents pending review with character and GM-credit context", () => {
    const markup = renderToStaticMarkup(<ChronicleSummaryCard {...base} status="pending" characterName="Veyra Sable" isGmCredit />);

    expect(markup).toContain("1-04 — The Great Absalom Relay");
    expect(markup).toContain("Needs review");
    expect(markup).toContain("Veyra Sable");
    expect(markup).toContain("GM Credit");
    expect(markup).toContain("Sep 2, 2030 · Level 3 · 4 XP");
  });

  it("presents applied history and composes owner actions outside the detail link", () => {
    const markup = renderToStaticMarkup(<ChronicleSummaryCard {...base} status="applied" chronicleNumber="7" actions={<button>Apply</button>} secondaryActions={<a href="/edit">Edit</a>} />);

    expect(markup).toContain("Chronicle 7");
    expect(markup).toContain("Applied");
    expect(markup).toContain("</a></h3>");
    expect(markup).toContain("<button>Apply</button>");
    expect(markup).not.toContain("<a href=\"/characters/character-1/chronicles/chronicle-1\"><button>");
    expect(markup).toContain("href=\"/edit\"");
  });

  it("formats calendar dates in UTC", () => {
    expect(formatChronicleDate("2030-09-02")).toBe("Sep 2, 2030");
  });
});
