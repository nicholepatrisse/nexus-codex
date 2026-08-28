import { describe, expect, it } from "vitest";
import { normalizePaizoScenarioUrl, parsePaizoScenarioPage } from "@/catalog/paizo";

describe("Paizo SFS2 catalog importer", () => {
  it("parses a reviewed scenario product and keeps its provenance", () => {
    const url = "https://store.paizo.com/starfinder-society-scenario-2-10-wrecked-inheritance/";
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Starfinder Society Scenario #2-10: Wrecked Inheritance",
      sku: "PZO260210",
      datePublished: "2026-08-19",
      description: "A Starfinder Society Scenario designed for 3rd- through 4th-level characters.",
    })}</script></head><body><h1>Scenario</h1></body></html>`;

    expect(parsePaizoScenarioPage(html, url)).toMatchObject({
      code: "2-10", title: "Wrecked Inheritance", minimumLevel: 3, maximumLevel: 4,
      source: "paizo", sourceUrl: url, productCode: "PZO260210", publicationDate: "2026-08-19",
    });
  });

  it("rejects non-official and unrelated Paizo URLs", () => {
    expect(() => normalizePaizoScenarioUrl("https://example.com/starfinder-society-scenario-2-10/"))
      .toThrow("official store.paizo.com");
    expect(() => normalizePaizoScenarioUrl("https://store.paizo.com/starfinder-player-core/"))
      .toThrow("official store.paizo.com");
  });

  it("fails closed when a scenario has no parseable level range", () => {
    const html = `<h1>Starfinder Society Scenario #1-01: Invasion's Edge</h1><p>A scenario for new characters.</p>`;
    expect(() => parsePaizoScenarioPage(html, "https://store.paizo.com/starfinder-society-scenario-1-01-invasions-edge/"))
      .toThrow("recognizable level range");
  });
});
