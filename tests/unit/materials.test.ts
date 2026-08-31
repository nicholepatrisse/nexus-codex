import { describe, expect, it } from "vitest";
import { normalizeMaterialIdentity, parsePaizoMaterialHtml, PLAYER_CORE } from "@/materials/materials";

describe("materials", () => {
  it("normalizes titles and aliases", () => {
    const result = parsePaizoMaterialHtml(`<html><head><meta property="og:title" content="Starfinder Galaxy Guide | Paizo"></head><body>Product code PZO22003</body></html>`, "https://paizo.com/products/example?Starfinder-Galaxy-Guide#details");
    expect(result).toMatchObject({ identity: "pzo22003", productCode: "PZO22003", title: "Starfinder Galaxy Guide", sourceUrl: "https://paizo.com/products/example?Starfinder-Galaxy-Guide" });
    expect(result.aliases).toContain("Galaxy Guide");
  });
  it("accepts current Paizo Store product URLs", () => {
    const result = parsePaizoMaterialHtml(`<html><head><meta property="og:title" content="Starfinder Galaxy Guide"></head><body><h1>Starfinder Galaxy Guide</h1><dl><dt>SKU:</dt><dd>PZO22004-HC</dd></dl></body></html>`, "https://store.paizo.com/starfinder-2e-galaxy-guide/");
    expect(result).toMatchObject({ identity: "pzo22004", productCode: "PZO22004", title: "Starfinder Galaxy Guide", sourceUrl: "https://store.paizo.com/starfinder-2e-galaxy-guide/" });
  });
  it("uses the current Player Core store page and matching product code", () => {
    expect(PLAYER_CORE).toMatchObject({ productCode: "PZO22001", sourceUrl: "https://store.paizo.com/starfinder-2e-player-core/" });
    expect(parsePaizoMaterialHtml(`<h1>Starfinder Player Core</h1><p>SKU: PZO22001-HC</p>`, PLAYER_CORE.sourceUrl)).toMatchObject({ productCode: PLAYER_CORE.productCode, title: PLAYER_CORE.title });
  });
  it("creates stable fallback identities", () => expect(normalizeMaterialIdentity("Starfinder: Player Core")).toBe("starfinder-player-core"));
  it("rejects non-Paizo URLs", () => expect(() => parsePaizoMaterialHtml("<h1>Book</h1>", "https://example.com/products/book")).toThrow(/Paizo product/));
});
