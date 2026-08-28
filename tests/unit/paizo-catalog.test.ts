import { describe, expect, it } from "vitest";
import { buildSfs2CatalogSnapshot, normalizePaizoScenarioUrl, parsePaizoCatalogPage, parsePaizoScenarioPage } from "@/catalog/paizo";

const product = (brand: string, title: string, description: string, href: string) => `
  <li class="product">
    <div class="card-body">
      <p data-test-info-type="brandName">${brand}</p>
      <h3 class="card-title"><a href="${href}">${title}</a></h3>
      <div class="listdes">${description}</div>
    </div>
  </li>`;

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

  it("extracts scheduling metadata and ignores unrelated products", () => {
    const html = `<ul class="productGrid">
      ${product(
        "Starfinder Society 2E",
        "Starfinder Society Scenario #1-00: Collision's Wake",
        "A Starfinder Society Special designed for 3rd-level pregenerated characters.",
        "/starfinder-society-scenario-1-00-collisions-wake/",
      )}
      ${product("Starfinder 2E", "Starfinder Player Core", "A rulebook.", "/player-core/")}
    </ul><ul class="pagination-list"><li><a>1</a></li><li><a>4</a></li></ul>`;

    expect(parsePaizoCatalogPage(html)).toEqual({
      totalPages: 4,
      items: [
        {
          code: "1-00",
          title: "Collision's Wake",
          contentType: "special",
          minimumLevel: 3,
          maximumLevel: 3,
          productUrl: "https://store.paizo.com/starfinder-society-scenario-1-00-collisions-wake/",
        },
      ],
    });
  });

  it("rejects duplicate normalized codes", () => {
    const item = {
      code: "1-01",
      title: "Invasion's Edge",
      contentType: "scenario" as const,
      minimumLevel: 1,
      maximumLevel: 2,
      productUrl: "https://store.paizo.com/example/",
    };
    expect(() => buildSfs2CatalogSnapshot([item, item])).toThrow("Duplicate Paizo catalog code");
  });

  it("fails closed when a scenario has no parseable level range", () => {
    const html = `<ul class="productGrid">${product(
      "Starfinder Society 2E",
      "Starfinder Society Scenario #1-01: Invasion's Edge",
      "A Starfinder Society Scenario for new characters.",
      "/starfinder-society-scenario-1-01-invasions-edge/",
    )}</ul>`;
    expect(() => parsePaizoCatalogPage(html)).toThrow("Could not determine level range");
  });
});
