import { describe, expect, it, vi } from "vitest";
import { fetchNethysItem, NethysItemError, nethysItemNotes, parseNethysItemHtml, validateNethysItemUrl } from "@/nethys/items";

const hygieneKit = `<div class="treasure"><h1 class="title"><span class="sfs">icon</span> Hygiene Kit <span class="feature-level">Item 0</span></h1><div class="sources"><strong>Source</strong> <a>Player Core pg. 241</a></div><div><b>Price</b> 2 credits</div><div><div><b>Hands</b> 2</div><div><b>Bulk</b> L</div></div><hr><div class="treasure-description">Everything needed for good grooming.</div></div>`;

describe("Archives of Nethys item import", () => {
  it("parses the Hygiene Kit fields", () => {
    const item = parseNethysItemHtml(hygieneKit, "https://2e.aonsrd.com/treasure/19-hygiene-kit");
    expect(item).toMatchObject({ name: "Hygiene Kit", level: 0, price: "2 credits", priceCredits: 2, hands: "2", bulk: "L", source: "Player Core pg. 241", description: "Everything needed for good grooming.", category: "Treasure" });
    expect(nethysItemNotes(item)).toContain("Item level: 0\nPrice: 2 credits\nHands: 2\nSource: Player Core pg. 241");
    expect(nethysItemNotes(item)).not.toContain("Bulk:");
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
