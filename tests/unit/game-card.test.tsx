import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCard, formatGameDateTime } from "@/app/game-card";

describe("GameCard", () => {
  it("gives the title a full row before wrapping status pills", () => {
    const markup = renderToStaticMarkup(<GameCard
      href="/games/one"
      scenarioCode="1-04"
      scenarioTitle="The Great Absalom Relay"
      startsAt={new Date("2030-09-02T01:00:00Z")}
      displayTimeZone="America/Phoenix"
      status="published"
      relationship="registered"
      characterName={'Veyra “Vey” Sable'}
    />);

    expect(markup).toContain("1-04 — The Great Absalom Relay</a></h3><div class=\"mt-3 flex flex-wrap gap-2\"");
    expect(markup).not.toContain("sm:flex-row");
    expect(markup).toContain("Registered");
    expect(markup).toContain("Upcoming");
  });

  it("centralizes time-zone-aware date formatting", () => {
    expect(formatGameDateTime(new Date("2030-09-02T01:00:00Z"), "America/Phoenix"))
      .toContain("Sep 1");
  });

  it("keeps contextual actions outside the detail link", () => {
    const markup = renderToStaticMarkup(<GameCard href="/games/one" scenarioTitle="Scenario" startsAt={new Date("2030-09-02T01:00:00Z")} status="draft" actions={<button>Edit</button>} />);
    expect(markup).toContain("</a></h3>");
    expect(markup).toContain("<button>Edit</button>");
    expect(markup).not.toContain("<a href=\"/games/one\"><button>");
  });
});
