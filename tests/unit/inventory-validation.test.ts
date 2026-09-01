import { describe, expect, it } from "vitest";
import { validateInventoryEntry } from "@/character/inventory-validation";
import { withLegacyInventorySource } from "@/character/inventory";

const item = { itemNameSnapshot: "Laser rifle", itemLinkSnapshot: "https://2e.aonsrd.com/equipment/weapons/laser-rifle", sourceMaterialIdentity: "galaxy-guide", sourceMaterialTitle: "Galaxy Guide", societyLegal: null, societyStatus: null, rarity: "Common" };

describe("inventory advisory validation", () => {
  it("validates owned common items and leaves missing ownership unvalidated", () => {
    expect(validateInventoryEntry(item, ["galaxy-guide"]).status).toBe("validated");
    expect(validateInventoryEntry(item, []).status).toBe("unvalidated");
  });

  it("treats possible special access as unvalidated and known restrictions as invalid", () => {
    expect(validateInventoryEntry({ ...item, rarity: "Uncommon" }, ["galaxy-guide"]).status).toBe("unvalidated");
    expect(validateInventoryEntry({ ...item, societyStatus: "limited" }, ["galaxy-guide"])).toMatchObject({ status: "unvalidated", issues: [{ message: expect.stringContaining("SFS Limited") }] });
    expect(validateInventoryEntry({ ...item, societyStatus: "restricted" }, ["galaxy-guide"]).status).toBe("invalid");
    expect(validateInventoryEntry({ ...item, societyLegal: false }, ["galaxy-guide"]).status).toBe("invalid");
  });

  it("keeps missing and incomplete source data unvalidated", () => {
    expect(validateInventoryEntry({ ...item, itemLinkSnapshot: null, sourceMaterialIdentity: null, sourceMaterialTitle: null }, []).status).toBe("unvalidated");
    expect(validateInventoryEntry({ ...item, sourceMaterialIdentity: null, sourceMaterialTitle: null }, []).status).toBe("unvalidated");
  });

  it("asks for Chronicle evidence instead of scenario ownership", () => {
    const result = validateInventoryEntry({ ...item, sourceMaterialTitle: "Starfinder Society Scenario #1-12: Take the Bait pg. 14", sourceMaterialIdentity: "starfinder-society-scenario-1-12-take-the-bait" }, []);
    expect(result).toMatchObject({ status: "unvalidated", issues: [{ message: expect.stringContaining("link that Chronicle") }] });
    expect(result.issues[0]?.message).not.toContain("owned materials");
  });

  it("recovers structured source metadata from legacy imported-item notes", () => {
    const entry = withLegacyInventorySource({ sourceMaterialTitle: null, sourceMaterialIdentity: null, notes: "Item level: 0\nPrice: 10 credits\nSource: Starfinder Absalom Station pg. 140\nCategory: Treasure" } as never);
    expect(entry).toMatchObject({ sourceMaterialTitle: "Starfinder Absalom Station pg. 140", sourceMaterialIdentity: "starfinder-absalom-station" });
    expect(validateInventoryEntry({ ...item, sourceMaterialTitle: entry.sourceMaterialTitle, sourceMaterialIdentity: entry.sourceMaterialIdentity }, []).issues[0]?.type).toBe("missing_material_ownership");
  });
});
