import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrowseGamesList, FindMoreCommunitiesLink } from "@/app/games/browse/browse-games-list";

describe("browse games list", () => {
  it("renders games with their community and GM", () => {
    const markup = renderToStaticMarkup(<BrowseGamesList games={[{ sessionId: "game-1", communityName: "Starfinder Nexus", communitySlug: "starfinder-nexus", scenarioCode: "1-01", scenarioTitle: "Shards of the Glass Planet", startsAt: new Date("2030-09-05T19:00:00Z"), displayTimeZone: "America/Phoenix", gmName: "Val", playerCapacity: 6 }]} />);
    expect(markup).toContain("Starfinder Nexus");
    expect(markup).toContain("GM: Val");
    expect(markup).toContain('href="/communities/starfinder-nexus/sessions/game-1"');
  });

  it("renders a useful empty state and community discovery link", () => {
    expect(renderToStaticMarkup(<BrowseGamesList games={[]} />)).toContain("No upcoming games");
    const link = renderToStaticMarkup(<FindMoreCommunitiesLink />);
    expect(link).toContain("Find new communities");
    expect(link).toContain('href="/communities"');
  });
});
