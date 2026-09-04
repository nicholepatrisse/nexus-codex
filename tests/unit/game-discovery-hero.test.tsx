import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { filterEligibleCommunities, GameDiscoveryHero } from "@/app/game-discovery-hero";

describe("game discovery hero", () => {
  it("focuses the homepage on finding games", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero />);
    expect(markup).toContain("Find your next table");
    expect(markup).toContain('href="/games/browse"');
    expect(markup).toContain("Schedule a game");
    expect(markup).not.toContain("Request GM permissions");
    expect(markup).not.toContain('id="game-discovery-panel"');
    expect(markup).toContain('aria-expanded="false"');
  });

  it("shows a direct secondary schedule action for one eligible community", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero initialMode="schedule" eligibleCommunities={[{ id: "one", name: "Nexus", slug: "nexus" }]} />);
    expect(markup).toContain("Schedule a game");
    expect(markup).toContain('href="/communities/nexus/sessions/new"');
  });

  it("uses community selection when multiple communities are eligible", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero initialMode="schedule" eligibleCommunities={[{ id: "one", name: "Nexus", slug: "nexus" }, { id: "two", name: "Drift", slug: "drift" }]} />);
    expect(markup).toContain("Filter communities");
    expect(markup).toContain('href="/communities/nexus/sessions/new"');
    expect(markup).toContain('href="/communities/drift/sessions/new"');
  });

  it("offers a GM-permission path to members without scheduling access", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero initialMode="schedule" communityCount={2} />);
    expect(markup).toContain("Request GM permissions");
    expect(markup).toContain('href="/communities"');
    expect(markup).toContain("Create a community");
    expect(markup).toContain('href="/communities/new"');
  });

  it("offers discovery and creation actions when the player has no communities", () => {
    const markup = renderToStaticMarkup(<GameDiscoveryHero initialMode="schedule" communityCount={0} />);
    expect(markup).toContain("Find communities");
    expect(markup).toContain('href="/communities/new"');
  });

  it("filters eligible communities case-insensitively", () => {
    const communities = [{ id: "one", name: "Starfinder Nexus", slug: "nexus" }, { id: "two", name: "Drift Lodge", slug: "drift" }];
    expect(filterEligibleCommunities(communities, " NEX ")).toEqual([communities[0]]);
    expect(filterEligibleCommunities(communities, "none")).toEqual([]);
  });

});
