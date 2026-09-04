import { describe, expect, it, vi } from "vitest";
import { fetchNethysItem, NethysItemError, nethysItemNotes, parseNethysItemHtml, parseNethysItemsHtml, validateNethysItemUrl } from "@/nethys/items";

const hygieneKit = `<div class="treasure"><h1 class="title"><span class="sfs">icon</span> Hygiene Kit <span class="feature-level">Item 0</span></h1><div class="sources"><strong>Source</strong> <a>Player Core pg. 241</a></div><div><b>Price</b> 2 credits</div><div><div><b>Hands</b> 2</div><div><b>Bulk</b> L</div></div><hr><div class="treasure-description">Everything needed for good grooming.</div></div>`;
const sunshades = `<div class="treasure"><h1 class="title">Sunshades <span class="feature-level">Item 0+</span></h1><div class="treasure-description">Sunshades make everyone look cooler.</div><div class="treasure"><h2 class="title">Sunshades (Commercial) <span class="feature-level">Item 0</span></h2><div class="sources"><strong>Source</strong> Player Core pg. 241</div><div><b>Price</b> 2 credits</div><div><b>Bulk</b> —</div></div><div class="treasure"><h2 class="title">Sunshades (Tactical) <span class="feature-level">Item 3</span></h2><div class="sources"><strong>Source</strong> Player Core pg. 241</div><div><b>Price</b> 450 credits</div><div><b>Bulk</b> —</div><div class="treasure-description">Protects against blinded and dazzled.</div></div></div>`;
const shieldBash = `<div class="weapon"><h1 class="title">Shield Bash</h1><div class="sources"><strong>Source</strong> Player Core pg. 264</div><div><b>Price</b> —</div><div><b>Damage</b> 1d4 B</div><div><b>Bulk</b> —</div><div><b>Hands</b> 1</div><div><b>Type</b> Melee</div><div><b>Category</b> Martial</div><div><b>Group</b> Shield</div><div><b>Upgrades</b> —</div><div class="description">Nethys Note: No description was provided for this weapon</div></div>`;

describe("Archives of Nethys item import", () => {
  it("parses the Hygiene Kit fields", () => {
    const item = parseNethysItemHtml(hygieneKit, "https://2e.aonsrd.com/treasure/19-hygiene-kit");
    expect(item).toMatchObject({ name: "Hygiene Kit", level: 0, price: "2 credits", priceCredits: 2, hands: "2", bulk: "L", source: "Player Core pg. 241", description: "Everything needed for good grooming.", category: "Treasure" });
    expect(nethysItemNotes(item)).toContain("Item level: 0\nPrice: 2 credits\nHands: 2\nSource: Player Core pg. 241");
    expect(nethysItemNotes(item)).not.toContain("Bulk:");
  });

  it("extracts the canonical AoN source link when present", () => {
    const html = `<div class="treasure"><h1 class="title">Tool <span class="feature-level">Item 1</span></h1><div class="sources"><strong>Source</strong> <a href="/sources/2-player-core">Player Core pg. 10</a></div></div>`;
    expect(parseNethysItemHtml(html, "https://2e.aonsrd.com/treasure/1-tool")).toMatchObject({ source: "Player Core pg. 10", sourceUrl: "https://2e.aonsrd.com/sources/2-player-core" });
  });

  it("returns nested item variants as separate import choices", () => {
    expect(parseNethysItemsHtml(sunshades, "https://2e.aonsrd.com/treasure/33-sunshades")).toEqual([
      expect.objectContaining({ name: "Sunshades (Commercial)", level: 0, priceCredits: 2, bulk: "—" }),
      expect.objectContaining({ name: "Sunshades (Tactical)", level: 3, priceCredits: 450, description: "Protects against blinded and dazzled." }),
    ]);
  });

  it("inherits Player Core source metadata for variants whose source is recorded on the parent", () => {
    const playerCoreTools = `<div class="treasure"><h1 class="title">Medkit <span class="feature-level">Item 0+</span></h1><div class="sources"><strong>Source</strong> <a href="/sources/2-player-core">Player Core pg. 269</a></div><div class="treasure"><h2 class="title">Medkit (Commercial) <span class="feature-level">Item 0</span></h2><div><b>Price</b> 5 credits</div></div><div class="treasure"><h2 class="title">Medkit (Tactical) <span class="feature-level">Item 3</span></h2><div><b>Price</b> 600 credits</div></div></div>`;

    expect(parseNethysItemsHtml(playerCoreTools, "https://2e.aonsrd.com/treasure/medkit")).toEqual([
      expect.objectContaining({ name: "Medkit (Commercial)", source: "Player Core pg. 269", sourceUrl: "https://2e.aonsrd.com/sources/2-player-core" }),
      expect.objectContaining({ name: "Medkit (Tactical)", source: "Player Core pg. 269", sourceUrl: "https://2e.aonsrd.com/sources/2-player-core" }),
    ]);
  });

  it("returns weapon grade-table rows as separate import choices", () => {
    const weapon = `<div class="weapon"><h1 class="title"><span class="sfs">SFS Standard</span> Arc Pistol</h1><div><b>Price</b> 25 credits</div><div><b>Bulk</b> 1</div><div><b>Hands</b> 1</div><table><thead><tr><th>Grade</th><th>Level</th><th>Upgrade Price</th><th>Total Price</th></tr></thead><tbody><tr><td>Commercial Arc Pistol</td><td>0</td><td>—</td><td>25 credits</td></tr><tr><td>Tactical Arc Pistol</td><td>2</td><td>+350 credits</td><td>375 credits</td></tr></tbody></table></div>`;
    expect(parseNethysItemsHtml(weapon, "https://2e.aonsrd.com/equipment/weapons/36-arc-pistol")).toEqual([
      expect.objectContaining({ name: "Commercial Arc Pistol", level: 0, price: "25 credits", priceCredits: 25, bulk: "1", hands: "1" }),
      expect.objectContaining({ name: "Tactical Arc Pistol", level: 2, price: "375 credits", priceCredits: 375, bulk: "1", hands: "1" }),
    ]);
  });

  it("parses an unlevelled weapon such as Shield Bash", () => {
    const item = parseNethysItemHtml(shieldBash, "https://2e.aonsrd.com/equipment/weapons/26-shield-bash");
    expect(item).toMatchObject({ name: "Shield Bash", price: "—", bulk: "—", hands: "1", source: "Player Core pg. 264", category: "Equipment" });
    expect(item.level).toBeUndefined();
    expect(nethysItemNotes(item)).not.toContain("Item level:");
  });

  it("only accepts recognized HTTPS item URLs", () => {
    expect(validateNethysItemUrl("https://2e.aonsrd.com/treasure/19-hygiene-kit").href).toBe("https://2e.aonsrd.com/treasure/19-hygiene-kit");
    expect(validateNethysItemUrl("https://2e.aonsrd.com/equipment/ammunition/1-projectile-ammo").href).toBe("https://2e.aonsrd.com/equipment/ammunition/1-projectile-ammo");
    expect(() => validateNethysItemUrl("not a url")).toThrowError(NethysItemError);
    expect(() => validateNethysItemUrl("https://example.com/treasure/19-hygiene-kit")).toThrow("Use a Starfinder 2e");
    expect(() => validateNethysItemUrl("https://2e.aonsrd.com/feats/1-example")).toThrow("not a supported item page");
  });

  it("imports ammunition rows with their inherited source metadata", () => {
    const projectileAmmo = `<div class="ammunition-type"><h1 class="title">Projectile Ammo</h1><div class="sources"><strong>Source</strong> <a href="/sources/2-player-core">Player Core pg. 267</a></div><table class="table-ammunition-grades"><thead><tr><th>Ammunition</th><th>Level</th><th>Price</th><th>Magazine</th><th>Bulk</th></tr></thead><tbody><tr><td>Projectile Ammo (10)</td><td>0</td><td>1 credits</td><td>—</td><td>—</td></tr></tbody></table></div>`;

    expect(parseNethysItemsHtml(projectileAmmo, "https://2e.aonsrd.com/equipment/ammunition/1-projectile-ammo")).toEqual([
      expect.objectContaining({ name: "Projectile Ammo (10)", level: 0, price: "1 credits", priceCredits: 1, bulk: "—", source: "Player Core pg. 267", sourceUrl: "https://2e.aonsrd.com/sources/2-player-core", category: "Ammunition" }),
    ]);
  });

  it("allows missing optional metadata and reports upstream failures", async () => {
    const sparse = parseNethysItemHtml(`<div class="treasure"><h1 class="title">Tool <span class="feature-level">Item 1</span></h1></div>`, "https://2e.aonsrd.com/treasure/1-tool");
    expect(sparse).toMatchObject({ name: "Tool", level: 1, traits: [] });
    await expect(fetchNethysItem("https://2e.aonsrd.com/treasure/1-tool", vi.fn().mockRejectedValue(new Error("offline")))).rejects.toThrow("unavailable");
  });

  it("preserves a positive Society restriction for advisory validation", () => {
    const restricted = parseNethysItemHtml(`<div class="treasure"><h1 class="title"><span class="sfs"><img alt="SFS Restricted"></span> Contraband <span class="feature-level">Item 2</span></h1></div>`, "https://2e.aonsrd.com/treasure/2-contraband");
    expect(restricted.societyLegal).toBe(false);
  });

  it("inherits an SFS Limited marker from a multi-item parent", () => {
    const limited = `<div class="treasure"><h1 class="title"><span class="sfs"><img alt="SFS Limited"></span> Degradation Grenade <span class="feature-level">Item 0+</span></h1><div class="treasure"><h2 class="title">Degradation Grenade (Commercial) <span class="feature-level">Item 0</span></h2><div class="sources">Source Starfinder Society Scenario #1-12: Take the Bait pg. 14</div></div></div>`;
    expect(parseNethysItemsHtml(limited, "https://2e.aonsrd.com/treasure/178-degradation-grenade")[0]).toMatchObject({ name: "Degradation Grenade (Commercial)", societyStatus: "limited", societyLegal: undefined });
  });
});
