import { describe, expect, it, vi } from "vitest";
import { fetchNethysItem, NethysItemError, nethysItemNotes, parseNethysItemHtml, parseNethysItemsHtml, validateNethysItemUrl } from "@/nethys/items";

const hygieneKit = `<div class="treasure"><h1 class="title"><span class="sfs">icon</span> Hygiene Kit <span class="feature-level">Item 0</span></h1><div class="sources"><strong>Source</strong> <a>Player Core pg. 241</a></div><div><b>Price</b> 2 credits</div><div><div><b>Hands</b> 2</div><div><b>Bulk</b> L</div></div><hr><div class="treasure-description">Everything needed for good grooming.</div></div>`;
const sunshades = `<div class="treasure"><h1 class="title">Sunshades <span class="feature-level">Item 0+</span></h1><div class="treasure-description">Sunshades make everyone look cooler.</div><div class="treasure"><h2 class="title">Sunshades (Commercial) <span class="feature-level">Item 0</span></h2><div class="sources"><strong>Source</strong> Player Core pg. 241</div><div><b>Price</b> 2 credits</div><div><b>Bulk</b> —</div></div><div class="treasure"><h2 class="title">Sunshades (Tactical) <span class="feature-level">Item 3</span></h2><div class="sources"><strong>Source</strong> Player Core pg. 241</div><div><b>Price</b> 450 credits</div><div><b>Bulk</b> —</div><div class="treasure-description">Protects against blinded and dazzled.</div></div></div>`;

describe("Archives of Nethys item import", () => {
  it("parses the Hygiene Kit fields", () => {
    const item = parseNethysItemHtml(hygieneKit, "https://2e.aonsrd.com/treasure/19-hygiene-kit");
    expect(item).toMatchObject({ name: "Hygiene Kit", level: 0, price: "2 credits", priceCredits: 2, hands: "2", bulk: "L", source: "Player Core pg. 241", description: "Everything needed for good grooming.", category: "Treasure" });
    expect(nethysItemNotes(item)).toContain("Item level: 0\nPrice: 2 credits\nHands: 2\nSource: Player Core pg. 241");
    expect(nethysItemNotes(item)).not.toContain("Bulk:");
  });

  it("returns nested item variants as separate import choices", () => {
    expect(parseNethysItemsHtml(sunshades, "https://2e.aonsrd.com/treasure/33-sunshades")).toEqual([
      expect.objectContaining({ name: "Sunshades (Commercial)", level: 0, priceCredits: 2, bulk: "—" }),
      expect.objectContaining({ name: "Sunshades (Tactical)", level: 3, priceCredits: 450, description: "Protects against blinded and dazzled." }),
    ]);
  });

  it("returns weapon grade-table rows as separate import choices", () => {
    const weapon = `<div class="weapon"><h1 class="title"><span class="sfs">SFS Standard</span> Arc Pistol</h1><div><b>Price</b> 25 credits</div><div><b>Bulk</b> 1</div><div><b>Hands</b> 1</div><table><thead><tr><th>Grade</th><th>Level</th><th>Upgrade Price</th><th>Total Price</th></tr></thead><tbody><tr><td>Commercial Arc Pistol</td><td>0</td><td>—</td><td>25 credits</td></tr><tr><td>Tactical Arc Pistol</td><td>2</td><td>+350 credits</td><td>375 credits</td></tr></tbody></table></div>`;
    expect(parseNethysItemsHtml(weapon, "https://2e.aonsrd.com/equipment/weapons/36-arc-pistol")).toEqual([
      expect.objectContaining({ name: "Commercial Arc Pistol", level: 0, price: "25 credits", priceCredits: 25, bulk: "1", hands: "1" }),
      expect.objectContaining({ name: "Tactical Arc Pistol", level: 2, price: "375 credits", priceCredits: 375, bulk: "1", hands: "1" }),
    ]);
  });

  it("only accepts recognized HTTPS item URLs", () => {
    expect(validateNethysItemUrl("https://2e.aonsrd.com/treasure/19-hygiene-kit").href).toBe("https://2e.aonsrd.com/treasure/19-hygiene-kit");
    expect(() => validateNethysItemUrl("not a url")).toThrowError(NethysItemError);
    expect(() => validateNethysItemUrl("https://example.com/treasure/19-hygiene-kit")).toThrow("Use a Starfinder 2e");
    expect(() => validateNethysItemUrl("https://2e.aonsrd.com/feats/1-example")).toThrow("not a supported item page");
  });

  it("allows missing optional metadata and reports upstream failures", async () => {
    const sparse = parseNethysItemHtml(`<div class="treasure"><h1 class="title">Tool <span class="feature-level">Item 1</span></h1></div>`, "https://2e.aonsrd.com/treasure/1-tool");
    expect(sparse).toMatchObject({ name: "Tool", level: 1, traits: [] });
    await expect(fetchNethysItem("https://2e.aonsrd.com/treasure/1-tool", vi.fn().mockRejectedValue(new Error("offline")))).rejects.toThrow("unavailable");
  });
});
