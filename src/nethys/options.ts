import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike } from "drizzle-orm";
import { load } from "cheerio";
import { getDb } from "@/db/client";
import { characterOptions } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

export const OPTION_TYPES = ["class", "ancestry", "background", "heritage", "feat", "item"] as const;
export type OptionType = typeof OPTION_TYPES[number];
export const FEAT_CATEGORIES = ["class", "ancestry", "skill", "general"] as const;
export type FeatCategory = typeof FEAT_CATEGORIES[number];
export type NethysOption = { name: string; optionType: OptionType; sourceMaterialTitle?: string; sourceMaterialIdentity?: string; sourceUrl: string; metadata: Record<string, unknown> };
export type NethysSearchResult = { name: string; optionType: "heritage" | "feat"; sourceUrl: string; sourceMaterialTitle?: string; level?: number; featCategory?: FeatCategory; summary?: string };
export class NethysOptionError extends Error { constructor(public code: "invalid_url" | "unsupported" | "unavailable" | "parse_failed", message: string) { super(message); } }
const paths: Record<OptionType, RegExp> = {
  class: /^\/classes\/[^/]+\/?$/i,
  ancestry: /^\/ancestries\/[^/]+\/?$/i,
  background: /^\/backgrounds\/[^/]+\/?$/i,
  // Borai and Prismeni are selectable versatile heritages, but AoN publishes
  // their entries under Rules rather than under the ordinary heritage routes.
  heritage: /^\/(?:heritages\/[^/]+|ancestries\/[^/]+\/heritages\/[^/]+|rules\/\d+-(?:borai|prismeni))\/?$/i,
  feat: /^\/feats\/[^/]+\/?$/i,
  item: /^\/(?:treasure|equipment)\//i,
};
const versatileHeritagePath = /^\/(?:ancestries\/(?:17-borai|18-prismeni)|rules\/\d+-(?:borai|prismeni))\/?$/i;

/** Explicit aliases are deliberately small: ambiguous spellings must be resolved by a person. */
export const OPTION_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "ysoki (ratfolk)": ["Ysoki"],
};

export function normalizeOptionName(name: string, aliases: Readonly<Record<string, readonly string[]>> = OPTION_NAME_ALIASES) {
  const normalized = name.normalize("NFKC").replace(/[’]/g, "'").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
  const candidates = aliases[normalized];
  if (!candidates?.length) return normalized;
  if (candidates.length > 1) throw new NethysOptionError("parse_failed", `“${name}” matches more than one known catalog name. Choose the intended option manually.`);
  return candidates[0]!.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function stripOptionActionMarkers(name: string) {
  return name.replace(/\s*\[(?:(?:one|two|three)[- ]actions?|free[- ]action|reaction)\]\s*$/i, "").trim();
}

function textAfterLabel($: ReturnType<typeof load>, labels: readonly string[]) {
  const labelPattern = new RegExp(`^(?:${labels.join("|")})\\s*:?\\s*`, "i");
  for (const element of $("b, strong, dt").toArray()) {
    const label = $(element).text().replace(/\s+/g, " ").trim();
    if (!labelPattern.test(label)) continue;
    const container = element.tagName === "dt" ? $(element).next("dd") : $(element).parent();
    const text = container.clone().find("b, strong, dt").first().remove().end().text().replace(/\s+/g, " ").trim();
    if (text) return text.replace(labelPattern, "").trim();
  }
  return undefined;
}

function restrictionValues(value: string | undefined) {
  if (!value) return undefined;
  return value.split(/[,;]|\bor\b/i).map((part) => part.trim()).filter(Boolean);
}

export function optionTypeFromUrl(url: URL): OptionType | null {
  // AoN files versatile heritages in the ancestry section even though they
  // replace a heritage during character creation.
  if (versatileHeritagePath.test(url.pathname)) return "heritage";
  return OPTION_TYPES.find((type) => paths[type].test(url.pathname)) ?? null;
}
export function parseNethysOptionHtml(html: string, sourceUrl: string): NethysOption {
  let url: URL; try { url = new URL(sourceUrl); } catch { throw new NethysOptionError("invalid_url", "Enter a complete URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "2e.aonsrd.com") throw new NethysOptionError("unsupported", "Use a Starfinder 2e Archives of Nethys URL.");
  const optionType = optionTypeFromUrl(url); if (!optionType) throw new NethysOptionError("unsupported", "That Archives of Nethys option type is not supported.");
  url.hash = ""; url.search = ""; url.pathname = url.pathname.replace(/\/$/, "");
  const $ = load(html); const heading = $("main h1, article h1, h1.title, h1").first().clone(); heading.find(".feature-level, .sfs, img").remove();
  const name = stripOptionActionMarkers(heading.text().replace(/\s+/g, " ").trim());
  if (!name) throw new NethysOptionError("parse_failed", "Nethys returned the page, but its option name could not be read.");
  const rawSourceMaterialTitle = $(".sources").first().text().replace(/^\s*Source\s*/i, "").replace(/\s+/g, " ").trim();
  const sourceMaterialTitle = rawSourceMaterialTitle ? materialTitleWithoutCitation(rawSourceMaterialTitle) : undefined;
  const traits = $(".trait, .traits a, a.link-trait").map((_i, element) => $(element).text().trim()).get().filter(Boolean);
  const societyMarker = $(".sfs img").first();
  const societyMarkerText = [societyMarker.attr("alt"), societyMarker.attr("title"), societyMarker.attr("src")].filter(Boolean).join(" ");
  const societyRestricted = /\brestricted\b/i.test(societyMarkerText);
  const societyLimited = /\blimited\b/i.test(societyMarkerText);
  const societyStandard = /\bstandard\b/i.test(societyMarkerText);
  const levelText = $(".feature-level").first().text();
  const levelMatch = levelText.match(/\b(?:feat|level)\s*(\d+)\b/i) ?? heading.text().match(/\bfeat\s*(\d+)\b/i);
  const traitNames = [...new Set(traits.map((trait) => trait.replace(/\s+/g, " ").trim()))];
  const explicitCategory = $("[data-feat-category]").first().attr("data-feat-category")
    ?? $(".feat-category").first().text().trim()
    ?? textAfterLabel($, ["Category"]);
  const featCategory = optionType === "feat"
    ? (FEAT_CATEGORIES.find((category) => new RegExp(`\\b${category}\\b`, "i").test(explicitCategory ?? ""))
      ?? (traitNames.some((trait) => /^skill$/i.test(trait)) ? "skill"
      : traitNames.some((trait) => /^ancestry$/i.test(trait)) ? "ancestry"
        : traitNames.some((trait) => /^class$/i.test(trait)) ? "class"
          : traitNames.some((trait) => /^general$/i.test(trait)) ? "general" : undefined))
    : undefined;
  const prerequisites = textAfterLabel($, ["Prerequisites?"]);
  const ancestryRestrictions = restrictionValues(textAfterLabel($, ["Ancestr(?:y|ies)"]));
  const classRestrictions = restrictionValues(textAfterLabel($, ["Class(?:es)?"]));
  const grantedFeats = optionType === "background" ? $("main a[href], article a[href]").toArray().filter((element) => {
    const href = $(element).attr("href") ?? "";
    const context = $(element).parent().text().replace(/\s+/g, " ");
    return /^\/?feats\//i.test(href) && /\bgain\b/i.test(context) && /\bfeat\b/i.test(context);
  }).map((element) => stripOptionActionMarkers($(element).text().replace(/\s+/g, " ").trim())).filter(Boolean) : [];
  const versatileHeritage = optionType === "heritage" && versatileHeritagePath.test(url.pathname);
  const missingFields = [
    !sourceMaterialTitle && "sourceMaterial",
    optionType === "feat" && !levelMatch && "level",
    optionType === "feat" && !featCategory && "featCategory",
  ].filter(Boolean);
  return {
    name,
    optionType,
    sourceMaterialTitle,
    sourceMaterialIdentity: sourceMaterialTitle ? normalizeMaterialIdentity(sourceMaterialTitle) : undefined,
    sourceUrl: url.href,
    metadata: {
      traits: traitNames,
      ...(levelMatch ? { level: Number(levelMatch[1]) } : {}),
      ...(featCategory ? { featCategory } : {}),
      ...(prerequisites ? { prerequisites } : {}),
      ...(ancestryRestrictions ? { ancestryRestrictions } : {}),
      ...(classRestrictions ? { classRestrictions } : {}),
      ...(grantedFeats.length ? { grantedFeats: [...new Set(grantedFeats)] } : {}),
      ...(versatileHeritage ? { versatileHeritage: true } : {}),
      ...(societyRestricted ? { societyStatus: "restricted", societyLegal: false } : societyLimited ? { societyStatus: "limited" } : societyStandard ? { societyStatus: "standard", societyLegal: true } : {}),
      ...(missingFields.length ? { missingFields } : {}),
    },
  };
}
export async function fetchNethysOption(value: string, fetcher: typeof fetch = fetch) {
  let url: URL; try { url = new URL(value); } catch { throw new NethysOptionError("invalid_url", "Enter a complete URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "2e.aonsrd.com") throw new NethysOptionError("unsupported", "Use a Starfinder 2e Archives of Nethys URL.");
  if (!optionTypeFromUrl(url)) throw new NethysOptionError("unsupported", "That Archives of Nethys option type is not supported.");
  let response: Response; try { response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "NexusCodex/1.0 option importer" }, signal: AbortSignal.timeout(10_000) }); } catch { throw new NethysOptionError("unavailable", "Archives of Nethys is unavailable right now. Manual entry is still available."); }
  if (!response.ok) throw new NethysOptionError("unavailable", "Archives of Nethys is unavailable right now. Manual entry is still available.");
  return parseNethysOptionHtml(await response.text(), response.url || url.href);
}
export async function importNethysOption(value: string, database = getDb(), fetcher: typeof fetch = fetch, expectedType?: OptionType) {
  const option = await fetchNethysOption(value, fetcher);
  if (expectedType && option.optionType !== expectedType) throw new NethysOptionError("unsupported", `That link is for a ${option.optionType}, not a ${expectedType}.`);
  const normalizedName = normalizeOptionName(option.name);
  const [saved] = await database.insert(characterOptions).values({ id: randomUUID(), gameSystemId: SUPPORTED_GAME_SYSTEM.id, normalizedName, ...option }).onConflictDoUpdate({ target: characterOptions.sourceUrl, set: { name: option.name, normalizedName, optionType: option.optionType, sourceMaterialIdentity: option.sourceMaterialIdentity, sourceMaterialTitle: option.sourceMaterialTitle, metadata: option.metadata, updatedAt: new Date() } }).returning();
  return saved!;
}
export async function searchCharacterOptions(type: OptionType, query = "", database = getDb()) { return database.select().from(characterOptions).where(and(eq(characterOptions.optionType, type), ilike(characterOptions.normalizedName, `%${normalizeOptionName(query)}%`))).orderBy(asc(characterOptions.name)).limit(50); }

const searchType = (source: Record<string, unknown>): "heritage" | "feat" | null => {
  const url = typeof source.url === "string" ? source.url : "";
  if (/^\/feats\//i.test(url) || /^feat$/i.test(String(source.type ?? ""))) return "feat";
  if (/^\/heritages\//i.test(url) || /\/heritages\//i.test(url) || /^heritage$/i.test(String(source.type ?? ""))) return "heritage";
  if (versatileHeritagePath.test(url)) return "heritage";
  return null;
};

/** Normalize the public AoN Elasticsearch response into safe, review-only results. */
export function normalizeNethysSearchResponse(value: unknown, expectedType: "heritage" | "feat", category?: FeatCategory): NethysSearchResult[] {
  if (!value || typeof value !== "object") throw new NethysOptionError("parse_failed", "Archives of Nethys returned an unreadable search response.");
  const hits = (value as { hits?: { hits?: unknown } }).hits?.hits;
  if (!Array.isArray(hits)) throw new NethysOptionError("parse_failed", "Archives of Nethys returned an unreadable search response.");
  return hits.flatMap((hit): NethysSearchResult[] => {
    const source = hit && typeof hit === "object" && "_source" in hit ? (hit as { _source?: unknown })._source : null;
    if (!source || typeof source !== "object") return [];
    const row = source as Record<string, unknown>; const optionType = searchType(row);
    if (optionType !== expectedType || typeof row.name !== "string" || typeof row.url !== "string") return [];
    const traits = Array.isArray(row.trait) ? row.trait.filter((item): item is string => typeof item === "string") : [];
    const traitGroups = Array.isArray(row.trait_group) ? row.trait_group.filter((item): item is string => typeof item === "string") : [];
    const featTaxonomy = [...traitGroups, ...traits].map((item) => item.toLocaleLowerCase("en-US"));
    const featCategory = optionType === "feat" ? FEAT_CATEGORIES.find((item) => featTaxonomy.includes(item)) : undefined;
    if (category && featCategory !== category) return [];
    let sourceUrl: URL; try { sourceUrl = new URL(row.url, "https://2e.aonsrd.com"); } catch { return []; }
    if (sourceUrl.hostname !== "2e.aonsrd.com" || optionTypeFromUrl(sourceUrl) !== optionType) return [];
    return [{ name: stripOptionActionMarkers(row.name), optionType, sourceUrl: sourceUrl.href, sourceMaterialTitle: typeof row.primary_source === "string" ? row.primary_source : undefined, level: typeof row.level === "number" ? row.level : undefined, featCategory, summary: typeof row.summary === "string" ? row.summary : undefined }];
  });
}

export async function searchNethysOptions(query: string, expectedType: "heritage" | "feat", category?: FeatCategory, fetcher: typeof fetch = fetch) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const escaped = trimmed.replace(/[+\-=!(){}\[\]^"~*?:\\/]|&&|\|\|/g, "\\$&");
  const url = new URL("https://elasticsearch.aonprd.com/aonsf/_search");
  url.searchParams.set("q", `name:(${escaped})`); url.searchParams.set("size", "25");
  let response: Response;
  try { response = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": "NexusCodex/1.0 option search" }, signal: AbortSignal.timeout(10_000) }); }
  catch { throw new NethysOptionError("unavailable", "Archives of Nethys search is unavailable right now. Manual entry and link import are still available."); }
  if (!response.ok) throw new NethysOptionError("unavailable", "Archives of Nethys search is unavailable right now. Manual entry and link import are still available.");
  try { return normalizeNethysSearchResponse(await response.json(), expectedType, category); }
  catch (error) { if (error instanceof NethysOptionError) throw error; throw new NethysOptionError("parse_failed", "Archives of Nethys returned unreadable search results. Manual entry and link import are still available."); }
}
