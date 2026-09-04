import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameDiscoveryHero } from "@/app/game-discovery-hero";

describe("game discovery hero", () => {
  it("focuses the homepage on finding games", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero />);
    expect(markup).toContain("Find a game to join");
    expect(markup).toContain('href="/games/browse"');
    expect(markup).not.toContain("Schedule a game");
    expect(markup).not.toContain("Request GM permissions");
  });

  it("shows a direct secondary schedule action for one eligible community", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero eligibleCommunities={[{ id: "one", name: "Nexus", slug: "nexus" }]} />);
    expect(markup).toContain("Schedule a game");
    expect(markup).toContain('href="/communities/nexus/sessions/new"');
  });

  it("uses community selection when multiple communities are eligible", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero eligibleCommunities={[{ id: "one", name: "Nexus", slug: "nexus" }, { id: "two", name: "Drift", slug: "drift" }]} />);
    expect(markup).toContain('href="/games/new"');
  });
});
