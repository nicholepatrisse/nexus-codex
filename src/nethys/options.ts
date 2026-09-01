import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike } from "drizzle-orm";
import { load } from "cheerio";
import { getDb } from "@/db/client";
import { characterOptions } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

export const OPTION_TYPES = ["class", "ancestry", "background", "item"] as const;
export type OptionType = typeof OPTION_TYPES[number];
export type NethysOption = { name: string; optionType: OptionType; sourceMaterialTitle?: string; sourceMaterialIdentity?: string; sourceUrl: string; metadata: Record<string, unknown> };
export class NethysOptionError extends Error { constructor(public code: "invalid_url" | "unsupported" | "unavailable" | "parse_failed", message: string) { super(message); } }
const paths: Record<OptionType, RegExp> = { class: /^\/classes\//i, ancestry: /^\/ancestries\//i, background: /^\/backgrounds\//i, item: /^\/(?:treasure|equipment)\//i };

export function optionTypeFromUrl(url: URL): OptionType | null { return OPTION_TYPES.find((type) => paths[type].test(url.pathname)) ?? null; }
export function parseNethysOptionHtml(html: string, sourceUrl: string): NethysOption {
  let url: URL; try { url = new URL(sourceUrl); } catch { throw new NethysOptionError("invalid_url", "Enter a complete URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "2e.aonsrd.com") throw new NethysOptionError("unsupported", "Use a Starfinder 2e Archives of Nethys URL.");
  const optionType = optionTypeFromUrl(url); if (!optionType) throw new NethysOptionError("unsupported", "That Archives of Nethys option type is not supported.");
  url.hash = ""; url.search = "";
  const $ = load(html); const heading = $("main h1, article h1, h1.title, h1").first().clone(); heading.find(".feature-level, .sfs, img").remove();
  const name = heading.text().replace(/\s+/g, " ").trim();
  if (!name) throw new NethysOptionError("parse_failed", "Nethys returned the page, but its option name could not be read.");
  const rawSourceMaterialTitle = $(".sources").first().text().replace(/^\s*Source\s*/i, "").replace(/\s+/g, " ").trim();
  const sourceMaterialTitle = rawSourceMaterialTitle ? materialTitleWithoutCitation(rawSourceMaterialTitle) : undefined;
  const traits = $(".trait, .traits a, a.link-trait").map((_i, element) => $(element).text().trim()).get().filter(Boolean);
  const societyMarker = $(".sfs img").first();
  const societyMarkerText = [societyMarker.attr("alt"), societyMarker.attr("title"), societyMarker.attr("src")].filter(Boolean).join(" ");
  const societyRestricted = /\brestricted\b/i.test(societyMarkerText);
  return { name, optionType, sourceMaterialTitle, sourceMaterialIdentity: sourceMaterialTitle ? normalizeMaterialIdentity(sourceMaterialTitle) : undefined, sourceUrl: url.href, metadata: { traits: [...new Set(traits)], ...(societyRestricted ? { societyStatus: "restricted", societyLegal: false } : {}) } };
}
export async function fetchNethysOption(value: string, fetcher: typeof fetch = fetch) {
  let url: URL; try { url = new URL(value); } catch { throw new NethysOptionError("invalid_url", "Enter a complete URL."); }
  let response: Response; try { response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "NexusCodex/1.0 option importer" }, signal: AbortSignal.timeout(10_000) }); } catch { throw new NethysOptionError("unavailable", "Archives of Nethys is unavailable right now. Manual entry is still available."); }
  if (!response.ok) throw new NethysOptionError("unavailable", "Archives of Nethys is unavailable right now. Manual entry is still available.");
  return parseNethysOptionHtml(await response.text(), response.url || url.href);
}
export async function importNethysOption(value: string, database = getDb(), fetcher: typeof fetch = fetch, expectedType?: OptionType) {
  const option = await fetchNethysOption(value, fetcher);
  if (expectedType && option.optionType !== expectedType) throw new NethysOptionError("unsupported", `That link is for a ${option.optionType}, not a ${expectedType}.`);
  const [saved] = await database.insert(characterOptions).values({ id: randomUUID(), gameSystemId: SUPPORTED_GAME_SYSTEM.id, normalizedName: option.name.toLowerCase(), ...option }).onConflictDoUpdate({ target: characterOptions.sourceUrl, set: { name: option.name, normalizedName: option.name.toLowerCase(), optionType: option.optionType, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, metadata: option.metadata, updatedAt: new Date() } }).returning();
  return saved!;
}
export async function searchCharacterOptions(type: OptionType, query = "", database = getDb()) { return database.select().from(characterOptions).where(and(eq(characterOptions.optionType, type), ilike(characterOptions.normalizedName, `%${query.trim().toLowerCase()}%`))).orderBy(asc(characterOptions.name)).limit(50); }
