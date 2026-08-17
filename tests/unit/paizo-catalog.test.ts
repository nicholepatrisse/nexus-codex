import { describe, expect, it } from "vitest";
import { buildSfs2CatalogSnapshot, parsePaizoCatalogPage } from "@/catalog/paizo";

const product = (brand: string, title: string, description: string, href: string) => `
  <li class="product">
    <div class="card-body">
      <p data-test-info-type="brandName">${brand}</p>
      <h3 class="card-title"><a href="${href}">${title}</a></h3>
      <div class="listdes">${description}</div>
    </div>
  </li>`;

describe("Paizo SFS2 catalog importer", () => {
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
