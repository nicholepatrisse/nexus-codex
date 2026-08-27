import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GmReportingQueueList } from "@/app/gm-reporting-queue";
import type { UnreportedGmGame } from "@/session/session-signups";

const game: UnreportedGmGame = { sessionId: "session/one", communityName: "Absalom Lodge", communitySlug: "absalom lodge", scenarioCode: "1-01", scenarioTitle: "Invasion's Edge", startsAt: new Date("2026-08-20T18:00:00-07:00"), endsAt: new Date("2026-08-20T22:00:00-07:00"), displayTimeZone: "America/Phoenix" };

describe("GM reporting queue", () => {
  it("stays out of the homepage when no games need reporting", () => {
    expect(renderToStaticMarkup(<GmReportingQueueList games={[]} />)).toBe("");
  });

  it("links overdue published games to their completion workflow", () => {
    const markup = renderToStaticMarkup(<GmReportingQueueList games={[game]} />);
    expect(markup).toContain("Games awaiting completion");
    expect(markup).toContain("Awaiting reporting");
    expect(markup).toContain("Chronicle reporting and completion");
    expect(markup).toContain('href="/communities/absalom%20lodge/sessions/session%2Fone"');
  });
});
