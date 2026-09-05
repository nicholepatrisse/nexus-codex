import { describe, expect, it } from "vitest";
import { fetchNethysOption, NethysOptionError, normalizeOptionName, parseNethysOptionHtml } from "@/nethys/options";

describe("Archives of Nethys character options", () => {
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
});
