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
export class NethysOptionError extends Error { constructor(public code: "invalid_url" | "unsupported" | "unavailable" | "parse_failed", message: string) { super(message); } }
const paths: Record<OptionType, RegExp> = {
  class: /^\/classes\/[^/]+\/?$/i,
  ancestry: /^\/ancestries\/[^/]+\/?$/i,
  background: /^\/backgrounds\/[^/]+\/?$/i,
  heritage: /^\/(?:heritages\/[^/]+|ancestries\/[^/]+\/heritages\/[^/]+)\/?$/i,
  feat: /^\/feats\/[^/]+\/?$/i,
  item: /^\/(?:treasure|equipment)\//i,
};

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

export function optionTypeFromUrl(url: URL): OptionType | null { return OPTION_TYPES.find((type) => paths[type].test(url.pathname)) ?? null; }
export function parseNethysOptionHtml(html: string, sourceUrl: string): NethysOption {
  let url: URL; try { url = new URL(sourceUrl); } catch { throw new NethysOptionError("invalid_url", "Enter a complete URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "2e.aonsrd.com") throw new NethysOptionError("unsupported", "Use a Starfinder 2e Archives of Nethys URL.");
  const optionType = optionTypeFromUrl(url); if (!optionType) throw new NethysOptionError("unsupported", "That Archives of Nethys option type is not supported.");
  url.hash = ""; url.search = ""; url.pathname = url.pathname.replace(/\/$/, "");
  const $ = load(html); const heading = $("main h1, article h1, h1.title, h1").first().clone(); heading.find(".feature-level, .sfs, img").remove();
  const name = heading.text().replace(/\s+/g, " ").trim();
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
