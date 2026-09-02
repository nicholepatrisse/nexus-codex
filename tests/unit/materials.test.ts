import { describe, expect, it, vi } from "vitest";
import { addKnownOwnedMaterial, addReferencedOwnedMaterial, catalogSourceMaterial, materialMatchesReference, materialValidationIdentities, normalizeMaterialIdentity, parseNethysProductUrl, parsePaizoMaterialHtml, PLAYER_CORE } from "@/materials/materials";

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
  it("uses Paizo SKU as identity while retaining normalized ISBN-13 for deduplication", () => {
    const result = parsePaizoMaterialHtml('<meta property="og:title" content="Starfinder Adventure: Guilt of the Grave World"><body>ISBN-13: 978-1-64078-712-4 SKU: PZO24006-HC</body>', "https://store.paizo.com/starfinder-adventure-guilt-of-the-grave-world/");
    expect(result).toMatchObject({ isbn: "9781640787124", identity: "pzo24006", productCode: "PZO24006" });
  });
  it("matches adventure product branding to the cited AoN source title", async () => {
    const row = { id: "material-2", personId: "person-1", identity: "pzo22020", productCode: "PZO22020", title: "Starfinder Adventure: Guilt of the Grave World", sourceUrl: "https://store.paizo.com/starfinder-adventure-guilt-of-the-grave-world/", aliases: ["Adventure: Guilt of the Grave World", "Guilt of the Grave World"] };
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }), insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [row] }) }) }) };
    const fetcher = async () => new Response('<meta property="og:title" content="Starfinder Adventure: Guilt of the Grave World"><body>PZO22020</body>', { status: 200 });
    await expect(addReferencedOwnedMaterial({ personId: "person-1" } as never, row.sourceUrl, "guilt-of-the-grave-world-pg-104", "Guilt of the Grave World pg. 104", database as never, fetcher as never)).resolves.toMatchObject({ duplicate: false });
  });
  it("uses the current Player Core store page and matching product code", () => {
    expect(PLAYER_CORE).toMatchObject({ productCode: "PZO22001", sourceUrl: "https://store.paizo.com/starfinder-2e-player-core/" });
    expect(parsePaizoMaterialHtml(`<h1>Starfinder Player Core</h1><p>SKU: PZO22001-HC</p>`, PLAYER_CORE.sourceUrl)).toMatchObject({ productCode: PLAYER_CORE.productCode, title: PLAYER_CORE.title });
  });
  it("creates stable fallback identities", () => expect(normalizeMaterialIdentity("Starfinder: Player Core")).toBe("starfinder-player-core"));
  it("rejects non-Paizo URLs", () => expect(() => parsePaizoMaterialHtml("<h1>Book</h1>", "https://example.com/products/book")).toThrow(/Paizo product/));
  it("resolves the Paizo store link published on an AoN source page", () => {
    expect(parseNethysProductUrl('<p>Product Page <a href="https://store.paizo.com/starfinder-2e-player-core/">Paizo Store</a></p>', "https://2e.aonsrd.com/sources/2-player-core").href).toBe("https://store.paizo.com/starfinder-2e-player-core/");
  });

  it("creates a canonical source record by ISBN without granting ownership", async () => {
    let inserted: Record<string, unknown> | undefined;
    const row = { id: "source-1", isbn: "9781640787124", title: "Starfinder Adventure: Guilt of the Grave World", productCode: "PZO24006", nethysSourceUrl: "https://2e.aonsrd.com/sources/9-guilt", paizoProductUrl: "https://store.paizo.com/guilt/", aliases: [] };
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }), insert: () => ({ values: (value: Record<string, unknown>) => { inserted = value; return { onConflictDoUpdate: () => ({ returning: async () => [row] }) }; } }) };
    const fetcher = vi.fn(async (url: URL) => url.hostname === "2e.aonsrd.com"
      ? new Response('<p>Product Page <a href="https://store.paizo.com/guilt/">Paizo Store</a></p>', { status: 200 })
      : new Response('<meta property="og:title" content="Starfinder Adventure: Guilt of the Grave World"><body>ISBN-13: 978-1-64078-712-4 SKU: PZO24006</body>', { status: 200 }));
    await expect(catalogSourceMaterial(row.nethysSourceUrl, database as never, fetcher as never)).resolves.toEqual(row);
    expect(inserted).toMatchObject({ isbn: row.isbn, nethysSourceUrl: row.nethysSourceUrl, paizoProductUrl: row.paizoProductUrl });
    expect(inserted).not.toHaveProperty("personId");
  });

  it("reuses a cataloged AoN source without external lookup", async () => {
    const known = { id: "source-1", isbn: "9781640787124" };
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [known] }) }) }) };
    const fetcher = vi.fn();
    await expect(catalogSourceMaterial("https://2e.aonsrd.com/sources/9-guilt", database as never, fetcher as never)).resolves.toBe(known);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("catalogs by Paizo SKU when the product page omits ISBN-13", async () => {
    const row = { id: "source-2", isbn: null, title: "Starfinder Absalom Station", productCode: "PZO22007", nethysSourceUrl: "https://2e.aonsrd.com/sources/43-starfinder-absalom-station", paizoProductUrl: "https://store.paizo.com/starfinder-absalom-station/", aliases: [] };
    let inserted: Record<string, unknown> | undefined;
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }), insert: () => ({ values: (value: Record<string, unknown>) => { inserted = value; return { onConflictDoUpdate: () => ({ returning: async () => [row] }) }; } }) };
    const fetcher = vi.fn(async (url: URL) => url.hostname === "2e.aonsrd.com" ? new Response('<a href="https://store.paizo.com/book/">Paizo Store</a>') : new Response('<h1>Book</h1><p>SKU: PZO22099</p>'));
    await expect(catalogSourceMaterial("https://2e.aonsrd.com/sources/10-book", database as never, fetcher as never)).resolves.toBe(row);
    expect(inserted).toMatchObject({ isbn: null, productCode: "PZO22099", nethysSourceUrl: "https://2e.aonsrd.com/sources/10-book" });
  });

  it("adds a confidently matched material and returns every validation identity", async () => {
    const row = { id: "material-1", personId: "person-1", identity: "pzo22003", productCode: "PZO22003", title: "Starfinder Galaxy Guide", sourceUrl: "https://store.paizo.com/starfinder-2e-galaxy-guide/", aliases: ["Galaxy Guide"] };
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }), insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [row] }) }) }) };
    const fetcher = async () => new Response('<meta property="og:title" content="Starfinder Galaxy Guide"><body>PZO22003</body>', { status: 200 });
    const result = await addReferencedOwnedMaterial({ personId: "person-1" } as never, row.sourceUrl, "galaxy-guide", "Galaxy Guide", database as never, fetcher as never);
    expect(result).toMatchObject({ duplicate: false, material: row });
    expect(result.identities).toEqual(expect.arrayContaining(["pzo22003", "starfinder-galaxy-guide", "galaxy-guide"]));
  });

  it("treats an existing matching material as a successful duplicate", async () => {
    const row = { id: "material-1", personId: "person-1", identity: "pzo22003", productCode: "PZO22003", title: "Starfinder Galaxy Guide", sourceUrl: "https://store.paizo.com/starfinder-2e-galaxy-guide/", aliases: ["Galaxy Guide"] };
    const database = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: row.id }] }) }) }), insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [row] }) }) }) };
    const fetcher = async () => new Response('<meta property="og:title" content="Starfinder Galaxy Guide"><body>PZO22003</body>', { status: 200 });
    await expect(addReferencedOwnedMaterial({ personId: "person-1" } as never, row.sourceUrl, "galaxy-guide-pg-104", "Galaxy Guide pg. 104", database as never, fetcher as never)).resolves.toMatchObject({ duplicate: true });
  });

  it("fails without writing when the chosen product does not match", async () => {
    let wrote = false;
    const database = { insert: () => { wrote = true; return {}; } };
    const fetcher = async () => new Response('<meta property="og:title" content="Starfinder Tech Core"><body>PZO22009</body>', { status: 200 });
    await expect(addReferencedOwnedMaterial({ personId: "person-1" } as never, "https://store.paizo.com/starfinder-tech-core/", "galaxy-guide", "Galaxy Guide pg. 104", database as never, fetcher as never)).rejects.toThrow(/does not match/);
    expect(wrote).toBe(false);
  });

  it("keeps cancellation client-only by exposing no eager material mutation", () => {
    expect(materialValidationIdentities({ identity: "galaxy-guide", title: "Galaxy Guide", aliases: [] })).toEqual(["galaxy-guide"]);
  });

  it("recognizes a cataloged ISBN material from an AoN title with a page citation", () => {
    expect(materialMatchesReference({ identity: "isbn-9781640787124", isbn: "9781640787124", title: "Starfinder Adventure: Guilt of the Grave World", aliases: ["Guilt of the Grave World"] }, "guilt-of-the-grave-world-pg-104", "Guilt of the Grave World pg. 104")).toBe(true);
  });

  it("adds a known database material without another external lookup", async () => {
    let inserted = false;
    const known = { id: "existing", isbn: "9781640787124", productCode: "PZO24006", title: "Starfinder Adventure: Guilt of the Grave World", paizoProductUrl: "https://store.paizo.com/starfinder-adventure-guilt-of-the-grave-world/", nethysSourceUrl: "https://2e.aonsrd.com/sources/9-guilt", aliases: ["Guilt of the Grave World"], createdAt: new Date(), updatedAt: new Date() };
    let selection = 0;
    const database = { select: () => ({ from: () => ++selection === 1 ? Promise.resolve([known]) : ({ where: () => ({ limit: async () => [] }) }) }), insert: () => ({ values: () => { inserted = true; return { onConflictDoUpdate: async () => undefined }; } }) };
    const result = await addKnownOwnedMaterial({ personId: "person-1" } as never, "guilt-of-the-grave-world-pg-104", "Guilt of the Grave World pg. 104", database as never);
    expect(result).toMatchObject({ duplicate: false });
    expect(inserted).toBe(true);
  });

  it("returns no match without writing when the source is not cataloged", async () => {
    let inserted = false;
    const database = { select: () => ({ from: async () => [] }), insert: () => { inserted = true; return {}; } };
    await expect(addKnownOwnedMaterial({ personId: "person-1" } as never, "unknown-book", "Unknown Book", database as never)).resolves.toBeNull();
    expect(inserted).toBe(false);
  });
});
