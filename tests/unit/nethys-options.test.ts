import { describe, expect, it } from "vitest";
import { fetchNethysOption, NethysOptionError, normalizeNethysSearchResponse, normalizeOptionName, parseNethysOptionHtml, searchNethysOptions, stripOptionActionMarkers } from "@/nethys/options";

describe("Archives of Nethys character options", () => {
  it("removes action markers from feat names", () => {
    expect(stripOptionActionMarkers("Debris Zone [one-action]")).toBe("Debris Zone");
    expect(parseNethysOptionHtml('<main><h1>Debris Zone [one-action]<span class="feature-level">Feat 1</span></h1><div class="sources">Source Player Core pg. 120</div><a class="trait">Class</a></main>', "https://2e.aonsrd.com/feats/669-debris-zone")).toMatchObject({ name: "Debris Zone", metadata: { level: 1, featCategory: "class" } });
  });
  it("extracts linked feats granted by backgrounds", () => {
    const html = '<main><h1>Acolyte</h1><div class="sources">Source Guilt of the Grave World Player Guide pg. 5</div><p>You gain the <a href="/feats/123-urban-survivalist">Urban Survivalist</a> skill feat.</p></main>';
    expect(parseNethysOptionHtml(html, "https://2e.aonsrd.com/backgrounds/134-acolyte").metadata).toMatchObject({ grantedFeats: ["Urban Survivalist"] });
  });
  it.each([
    ["class", "https://2e.aonsrd.com/classes/envoy", "Envoy"],
    ["ancestry", "https://2e.aonsrd.com/ancestries/android", "Android"],
    ["background", "https://2e.aonsrd.com/backgrounds/ace-pilot", "Ace Pilot"],
    ["item", "https://2e.aonsrd.com/treasure/medkit", "Medkit"],
  ] as const)("parses a %s page", (optionType, url, name) => {
    expect(parseNethysOptionHtml(`<main><h1>${name}</h1><div class="sources">Source Starfinder Player Core</div><a class="trait">Common</a></main>`, url)).toEqual({ name, optionType, sourceMaterialTitle: "Starfinder Player Core", sourceMaterialIdentity: "starfinder-player-core", sourceUrl: url, metadata: { traits: ["Common"] } });
  });
  it("allows missing optional fields and records what can be recovered manually", () => expect(parseNethysOptionHtml("<h1>Witchwarper</h1>", "https://2e.aonsrd.com/classes/witchwarper")).toMatchObject({ sourceMaterialTitle: undefined, metadata: { missingFields: ["sourceMaterial"] } }));

  it("removes page citations from material identity", () => expect(parseNethysOptionHtml('<h1>Astrozoan</h1><div class="sources">Source Galaxy Guide pg. 128</div>', "https://2e.aonsrd.com/ancestries/astrozoan")).toMatchObject({ sourceMaterialTitle: "Galaxy Guide", sourceMaterialIdentity: "galaxy-guide" }));

  it("preserves the Society restricted marker", () => expect(parseNethysOptionHtml('<h1 class="title"><span class="sfs"><img src="/images/icons/sfs-restricted.png" alt="SFS Restricted" title="SFS Restricted"></span> Escaped Experiment</h1><div class="sources">Source Galaxy Guide pg. 99</div>', "https://2e.aonsrd.com/backgrounds/73-escaped-experiment")).toMatchObject({ name: "Escaped Experiment", metadata: { traits: [], societyStatus: "restricted", societyLegal: false } }));
  it("preserves the Society standard marker", () => expect(parseNethysOptionHtml('<h1 class="title"><span class="sfs"><img alt="SFS Standard"></span> Adaptable <span class="feature-level">Feat 1</span></h1><div data-feat-category="ancestry"></div>', "https://2e.aonsrd.com/feats/20-adaptable")).toMatchObject({ metadata: { featCategory: "ancestry", societyStatus: "standard", societyLegal: true } }));
  it("parses a heritage with ancestry restrictions", () => expect(parseNethysOptionHtml('<main><h1>Moonborn</h1><div class="sources">Source Galaxy Guide pg. 42</div><p><b>Ancestry:</b> Astrazoan, Human</p><a class="trait">Rare</a></main>', "https://2e.aonsrd.com/heritages/7-moonborn?ref=list#rules")).toMatchObject({ optionType: "heritage", sourceUrl: "https://2e.aonsrd.com/heritages/7-moonborn", metadata: { traits: ["Rare"], ancestryRestrictions: ["Astrazoan", "Human"] } }));
  it.each([
    ["https://2e.aonsrd.com/ancestries/17-borai", "Borai"],
    ["https://2e.aonsrd.com/ancestries/18-prismeni", "Prismeni"],
    ["https://2e.aonsrd.com/rules/129-borai", "Borai"],
    ["https://2e.aonsrd.com/rules/130-prismeni", "Prismeni"],
  ])("parses the versatile heritage page %s", (url, name) => {
    expect(parseNethysOptionHtml(`<main><h1>${name}</h1><div class="sources">Source Player Core pg. 83</div></main>`, url)).toMatchObject({ name, optionType: "heritage", sourceMaterialTitle: "Player Core", metadata: { versatileHeritage: true } });
  });
  it.each([
    ["class", "Class", "Envoy"],
    ["ancestry", "Ancestry", "Android"],
    ["skill", "Skill", undefined],
    ["general", "General", undefined],
  ] as const)("parses a %s feat", (category, trait, classOrAncestry) => {
    const restriction = category === "class" ? `<p><strong>Class:</strong> ${classOrAncestry}</p>` : category === "ancestry" ? `<p><strong>Ancestry:</strong> ${classOrAncestry}</p>` : "";
    expect(parseNethysOptionHtml(`<main><h1 class="title"><span class="sfs"><img alt="SFS Limited"></span>Quick Study <span class="feature-level">Feat 2</span></h1><div class="sources">Source Player Core pg. 100</div><div class="traits"><a class="trait">${trait}</a></div><p><b>Prerequisites</b> trained in Society</p>${restriction}</main>`, `https://2e.aonsrd.com/feats/${category}-quick-study`)).toMatchObject({ optionType: "feat", metadata: { level: 2, featCategory: category, prerequisites: "trained in Society", societyStatus: "limited", ...(category === "class" ? { classRestrictions: ["Envoy"] } : category === "ancestry" ? { ancestryRestrictions: ["Android"] } : {}) } });
  });
  it("uses only explicit unambiguous aliases", () => {
    expect(normalizeOptionName("  Ysoki (Ratfolk) ")).toBe("ysoki");
    expect(() => normalizeOptionName("Legacy Name", { "legacy name": ["First", "Second"] })).toThrow(/more than one/);
  });
  it("rejects malformed and unsupported pages", () => {
    expect(() => parseNethysOptionHtml("<p>missing</p>", "https://2e.aonsrd.com/classes/envoy")).toThrow(NethysOptionError);
    expect(() => parseNethysOptionHtml("<h1>Feat</h1>", "https://2e.aonsrd.com/feats")).toThrow(/not supported/);
    expect(() => parseNethysOptionHtml("<h1>Versatile Heritages</h1>", "https://2e.aonsrd.com/rules/124-versatile-heritages")).toThrow(/not supported/);
  });
  it("turns timeouts into recoverable errors", async () => {
    const fetcher = async () => { throw new Error("timeout"); };
    await expect(fetchNethysOption("https://2e.aonsrd.com/classes/envoy", fetcher as typeof fetch)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("rejects unsupported URLs before making a request", async () => {
    const fetcher = async () => new Response("<h1>Not AoN</h1>");
    await expect(fetchNethysOption("https://example.com/feats/1", fetcher as typeof fetch)).rejects.toMatchObject({ code: "unsupported" });
  });
  it("normalizes search results and filters incompatible option types and feat categories", () => {
    const response = { hits: { hits: [
      { _source: { name: "Intimidating Shot", type: "Feat", url: "/feats/821-intimidating-shot", level: 1, primary_source: "Player Core", trait: ["General", "Skill"], summary: "Demoralize with a ranged weapon." } },
      { _source: { name: "Moonborn", type: "Heritage", url: "/heritages/7-moonborn", primary_source: "Galaxy Guide" } },
      { _source: { name: "Wrong URL", type: "Feat", url: "https://example.com/feats/1" } },
    ] } };
    expect(normalizeNethysSearchResponse(response, "feat", "skill")).toEqual([{ name: "Intimidating Shot", optionType: "feat", sourceUrl: "https://2e.aonsrd.com/feats/821-intimidating-shot", sourceMaterialTitle: "Player Core", level: 1, featCategory: "skill", summary: "Demoralize with a ranged weapon." }]);
    expect(normalizeNethysSearchResponse(response, "heritage")).toEqual([{ name: "Moonborn", optionType: "heritage", sourceUrl: "https://2e.aonsrd.com/heritages/7-moonborn", sourceMaterialTitle: "Galaxy Guide", level: undefined, featCategory: undefined, summary: undefined }]);
  });
  it("surfaces malformed and unavailable search responses as recoverable errors", async () => {
    expect(() => normalizeNethysSearchResponse({}, "feat")).toThrow(/unreadable/);
    const unavailable = async () => { throw new Error("timeout"); };
    await expect(searchNethysOptions("Intimidating Shot", "feat", undefined, unavailable as typeof fetch)).rejects.toMatchObject({ code: "unavailable" });
  });
});
