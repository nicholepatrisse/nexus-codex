import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignedUpGamesList, SignedUpGamesLoading } from "@/app/signed-up-games";
import type { SignedUpGame } from "@/session/session-signups";

const game: SignedUpGame = {
  sessionId: "session/one",
  communityName: "Absalom Lodge",
  communitySlug: "absalom lodge",
  scenarioCode: "1-01",
  scenarioTitle: "Invasion's Edge",
  startsAt: new Date("2030-09-01T18:00:00-07:00"),
  displayTimeZone: "America/Phoenix",
  sessionStatus: "published",
  participationRole: "player",
  signupStatus: "waitlisted",
  waitlistPosition: 2,
  characterName: "Navasi",
};

describe("signed-up games", () => {
  it("renders an accessible empty state", () => {
    const markup = renderToStaticMarkup(<SignedUpGamesList games={[]} />);
    expect(markup).toContain("No upcoming games");
    expect(markup).toContain("Upcoming games");
    expect(markup).toContain('href="/games"');
    expect(markup).toContain("View all games");
    expect(markup).toContain('id="signed-up-games-heading"');
  });

  it("renders context, status, time, and an encoded authorized detail link", () => {
    const markup = renderToStaticMarkup(<SignedUpGamesList games={[game]} />);
    expect(markup).toContain("Absalom Lodge");
    expect(markup).toContain("1-01 — Invasion&#x27;s Edge");
    expect(markup).toContain("Waitlisted · #2");
    expect(markup).not.toContain(">Player<");
    expect(markup).toContain(">Navasi<");
    expect(markup).toContain("border-sky-200/30");
    expect(markup).toContain('dateTime="2030-09-02T01:00:00.000Z"');
    expect(markup).toContain('href="/communities/absalom%20lodge/sessions/session%2Fone"');
  });

  it("labels GM games without showing a player signup status", () => {
    const markup = renderToStaticMarkup(<SignedUpGamesList games={[{
      ...game,
      participationRole: "gm",
      signupStatus: null,
      waitlistPosition: null,
    }]} />);
    expect(markup).toContain(">GM<");
    expect(markup).not.toContain("Waitlisted");
    expect(markup).not.toContain("Confirmed");
    expect(markup).not.toContain(">Navasi<");
  });

  it("visibly and audibly distinguishes cancelled games", () => {
    const markup = renderToStaticMarkup(<SignedUpGamesList games={[{ ...game, sessionStatus: "cancelled" }]} />);
    expect(markup).toContain("Cancelled");
    expect(markup).toContain("This game was cancelled");
    expect(markup).toContain("line-through");
  });

  it("announces loading and marks the section busy", () => {
    const markup = renderToStaticMarkup(<SignedUpGamesLoading />);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
  });
});
