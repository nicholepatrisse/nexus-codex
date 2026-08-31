import { describe, expect, it } from "vitest";
import { fetchNethysOption, NethysOptionError, parseNethysOptionHtml } from "@/nethys/options";

describe("Archives of Nethys character options", () => {
  it.each([
    ["class", "https://2e.aonsrd.com/classes/envoy", "Envoy"],
    ["ancestry", "https://2e.aonsrd.com/ancestries/android", "Android"],
    ["background", "https://2e.aonsrd.com/backgrounds/ace-pilot", "Ace Pilot"],
    ["item", "https://2e.aonsrd.com/treasure/medkit", "Medkit"],
  ] as const)("parses a %s page", (optionType, url, name) => {
    expect(parseNethysOptionHtml(`<main><h1>${name}</h1><div class="sources">Source Starfinder Player Core</div><a class="trait">Common</a></main>`, url)).toEqual({ name, optionType, sourceMaterialTitle: "Starfinder Player Core", sourceMaterialIdentity: "starfinder-player-core", sourceUrl: url, metadata: { traits: ["Common"] } });
  });
  it("allows missing optional fields", () => expect(parseNethysOptionHtml("<h1>Witchwarper</h1>", "https://2e.aonsrd.com/classes/witchwarper").sourceMaterialTitle).toBeUndefined());
  it("rejects malformed and unsupported pages", () => {
    expect(() => parseNethysOptionHtml("<p>missing</p>", "https://2e.aonsrd.com/classes/envoy")).toThrow(NethysOptionError);
    expect(() => parseNethysOptionHtml("<h1>Feat</h1>", "https://2e.aonsrd.com/feats/example")).toThrow(/not supported/);
  });
  it("turns timeouts into recoverable errors", async () => {
    const fetcher = async () => { throw new Error("timeout"); };
    await expect(fetchNethysOption("https://2e.aonsrd.com/classes/envoy", fetcher as typeof fetch)).rejects.toMatchObject({ code: "unavailable" });
  });
});
