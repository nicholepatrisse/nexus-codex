import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike } from "drizzle-orm";
import { load } from "cheerio";
import { getDb } from "@/db/client";
import { characterOptions } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

const HOST = "2e.aonsrd.com";
const ITEM_PATH = /^\/(?:treasure\/[^/]+|equipment\/(?:ammunition|armor|shields|weapons)\/[^/]+)\/?$/i;
const ITEM_ROOT_SELECTOR = ".ammunition-type, .treasure, .armor, .shield, .weapon";

export type NethysItem = {
  url: string;
  name: string;
  level?: number;
  price?: string;
  priceCredits?: number;
  bulk?: string;
  hands?: string;
  source?: string;
  sourceUrl?: string;
  description?: string;
  traits: string[];
  rarity?: string;
  societyLegal?: boolean;
  societyStatus?: "standard" | "limited" | "restricted";
  usage?: string;
  category?: string;
};

export type NethysItemSearchResult = Pick<NethysItem, "name" | "level" | "category"> & {
  sourceUrl: string;
  sourceMaterialTitle?: string;
  summary?: string;
};

export class NethysItemError extends Error {
  constructor(public readonly code: "invalid_url" | "unsupported_url" | "not_item" | "unavailable" | "parse_failed", message: string) {
    super(message);
    this.name = "NethysItemError";
  }
}

export function validateNethysItemUrl(value: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new NethysItemError("invalid_url", "Enter a complete, valid URL."); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== HOST) {
    throw new NethysItemError("unsupported_url", "Use a Starfinder 2e Archives of Nethys URL from 2e.aonsrd.com.");
  }
  if (!ITEM_PATH.test(url.pathname)) {
    throw new NethysItemError("not_item", "That Archives of Nethys page is not a supported item page.");
  }
  url.hash = "";
  url.search = "";
  return url;
}

const clean = (value?: string | null) => value?.replace(/\s+/g, " ").trim() || undefined;

type InheritedItemMetadata = Pick<NethysItem, "societyStatus" | "source" | "sourceUrl">;

function parseItemRoot($: ReturnType<typeof load>, root: ReturnType<ReturnType<typeof load>>, sourceUrl: string, inherited: InheritedItemMetadata = {}): NethysItem {
  const rootElement = root.get(0);

  const title = root.children("h1.title, h2.title").first().clone();
  const levelText = clean(title.find(".feature-level").text());
  title.find(".feature-level, .sfs, img").remove();
  const name = clean(title.text());
  const levelMatch = levelText?.match(/Item\s+(\d+)/i);
  if (!name) throw new NethysItemError("parse_failed", "Nethys returned the page, but its required item details could not be read.");

  const values = new Map<string, string>();
  root.find("b, strong").filter((_index, element) => $(element).closest(ITEM_ROOT_SELECTOR).get(0) === rootElement).each((_index, element) => {
    const label = clean($(element).text())?.replace(/:$/, "").toLowerCase();
    const parent = $(element).parent().clone();
    parent.find("b, strong").first().remove();
    const value = clean(parent.text());
    if (label && value && !values.has(label)) values.set(label, value);
  });
  const price = values.get("price");
  const creditMatch = price?.match(/^([\d,]+(?:\.\d+)?)\s+credits?$/i);
  const traits = root.find(".trait, .traits a, a.link-trait").filter((_index, element) => $(element).closest(ITEM_ROOT_SELECTOR).get(0) === rootElement).map((_index, element) => clean($(element).text())).get().filter((value): value is string => Boolean(value));
  const rarity = traits.find((trait) => /^(common|uncommon|rare|unique)$/i.test(trait));
  const societyMarker = root.find(".sfs img").first();
  const societyMarkerText = [societyMarker.attr("alt"), societyMarker.attr("title"), societyMarker.attr("src")].filter(Boolean).join(" ");
  const societyStatus = /\brestricted\b/i.test(societyMarkerText) ? "restricted" : /\blimited\b/i.test(societyMarkerText) ? "limited" : /\bstandard\b/i.test(societyMarkerText) ? "standard" : inherited.societyStatus;
  const societyLegal = societyStatus === "restricted" ? false : undefined;
  const pathCategory = new URL(sourceUrl).pathname.split("/")[1];
  const sourceElement = root.children(".sources").first();
  const source = clean(sourceElement.text())?.replace(/^Source\s*/i, "") ?? inherited.source;
  const canonicalSourceUrl = (() => { const href = sourceElement.find("a[href]").first().attr("href"); if (!href) return inherited.sourceUrl; try { const resolved = new URL(href, sourceUrl); return resolved.hostname === HOST && /^\/sources\//i.test(resolved.pathname) ? resolved.href : inherited.sourceUrl; } catch { return inherited.sourceUrl; } })();

  return {
    url: sourceUrl,
    name,
    level: levelMatch ? Number(levelMatch[1]) : undefined,
    price,
    priceCredits: creditMatch?.[1] ? Number(creditMatch[1].replaceAll(",", "")) : undefined,
    hands: values.get("hands"),
    bulk: values.get("bulk"),
    source,
    sourceUrl: canonicalSourceUrl,
    description: clean(root.children(".treasure-description, .description").first().text()),
    traits: [...new Set(traits)],
    rarity,
    societyLegal,
    societyStatus,
    usage: values.get("usage"),
    category: pathCategory === "treasure" ? "Treasure" : root.hasClass("ammunition-type") ? "Ammunition" : clean(pathCategory)?.replace(/^./, (letter) => letter.toUpperCase()),
  };
}

export function parseNethysItemsHtml(html: string, sourceUrl: string): NethysItem[] {
  const $ = load(html);
  const root = $(ITEM_ROOT_SELECTOR).first();
  if (!root.length) throw new NethysItemError("not_item", "The referenced page does not appear to contain a supported item.");
  const variants = root.children(ITEM_ROOT_SELECTOR);
  const parentMarker = root.children("h1.title, h2.title").first().find(".sfs img").first();
  const parentMarkerText = [parentMarker.attr("alt"), parentMarker.attr("title"), parentMarker.attr("src")].filter(Boolean).join(" ");
  const parentSocietyStatus: NethysItem["societyStatus"] = /\brestricted\b/i.test(parentMarkerText) ? "restricted" : /\blimited\b/i.test(parentMarkerText) ? "limited" : /\bstandard\b/i.test(parentMarkerText) ? "standard" : undefined;
  const parentSourceElement = root.children(".sources").first();
  const parentSource = clean(parentSourceElement.text())?.replace(/^Source\s*/i, "");
  const parentSourceUrl = (() => { const href = parentSourceElement.find("a[href]").first().attr("href"); if (!href) return undefined; try { const resolved = new URL(href, sourceUrl); return resolved.hostname === HOST && /^\/sources\//i.test(resolved.pathname) ? resolved.href : undefined; } catch { return undefined; } })();
  const inherited = { societyStatus: parentSocietyStatus, source: parentSource, sourceUrl: parentSourceUrl };
  if (root.hasClass("ammunition-type")) {
    const ammunitionTable = root.find("table.table-ammunition-grades").first();
    const headings = ammunitionTable.find("thead th").map((_index, heading) => clean($(heading).text())?.toLowerCase()).get();
    const nameIndex = headings.indexOf("ammunition");
    const levelIndex = headings.indexOf("level");
    const priceIndex = headings.indexOf("price");
    const bulkIndex = headings.indexOf("bulk");
    const ammunition = ammunitionTable.find("tbody tr").toArray().flatMap((row) => {
      const cells = $(row).children("td").toArray().map((cell) => clean($(cell).text()));
      const name = cells[nameIndex];
      const level = Number(cells[levelIndex]);
      const price = cells[priceIndex];
      if (!name || !Number.isInteger(level) || level < 0) return [];
      const parsed = parseItemRoot($, root, sourceUrl, inherited);
      const creditMatch = price?.match(/^([\d,]+(?:\.\d+)?)\s+credits?$/i);
      return [{ ...parsed, name, level, price, priceCredits: creditMatch?.[1] ? Number(creditMatch[1].replaceAll(",", "")) : undefined, bulk: cells[bulkIndex] }];
    });
    if (ammunition.length) return ammunition;
  }
  if (root.hasClass("weapon")) {
    const gradeTable = root.find("table").filter((_index, table) => {
      const headings = $(table).find("thead th").map((_headingIndex, heading) => clean($(heading).text())?.toLowerCase()).get();
      return headings.includes("grade") && headings.includes("level") && headings.includes("total price");
    }).first();
    if (gradeTable.length) {
      const headings = gradeTable.find("thead th").map((_index, heading) => clean($(heading).text())?.toLowerCase()).get();
      const gradeIndex = headings.indexOf("grade");
      const levelIndex = headings.indexOf("level");
      const priceIndex = headings.indexOf("total price");
      const weaponVariants = gradeTable.find("tbody tr").toArray().flatMap((row) => {
        const cells = $(row).children("td").toArray().map((cell) => clean($(cell).text()));
        const name = cells[gradeIndex];
        const level = Number(cells[levelIndex]);
        const price = cells[priceIndex];
        if (!name || !Number.isInteger(level) || level < 0) return [];
        const variant = root.clone();
        variant.children("h1.title, h2.title").first().html(`${name}<span class="feature-level">Item ${level}</span>`);
        const parsed = parseItemRoot($, variant, sourceUrl, inherited);
        const creditMatch = price?.match(/^([\d,]+(?:\.\d+)?)\s+credits?$/i);
        return [{ ...parsed, name, level, price, priceCredits: creditMatch?.[1] ? Number(creditMatch[1].replaceAll(",", "")) : undefined }];
      });
      if (weaponVariants.length) return weaponVariants;
    }
  }
  return (variants.length ? variants.toArray().map((element) => $(element)) : [root]).map((itemRoot) => parseItemRoot($, itemRoot, sourceUrl, inherited));
}

export function parseNethysItemHtml(html: string, sourceUrl: string): NethysItem {
  return parseNethysItemsHtml(html, sourceUrl)[0]!;
}

export async function fetchNethysItem(value: string, fetcher: typeof fetch = fetch) {
  return (await fetchNethysItems(value, fetcher))[0]!;
}

export async function fetchNethysItems(value: string, fetcher: typeof fetch = fetch) {
  const url = validateNethysItemUrl(value);
  let response: Response;
  try {
    response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "NexusCodex/1.0 item importer" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new NethysItemError("unavailable", "Archives of Nethys is unavailable right now. You can still enter the item manually.");
  }
  if (!response.ok) throw new NethysItemError("unavailable", "Archives of Nethys is unavailable right now. You can still enter the item manually.");
  return parseNethysItemsHtml(await response.text(), url.href);
}

export function nethysItemNotes(item: NethysItem) {
  const metadata = [
    item.level != null && `Item level: ${item.level}`,
    item.price && `Price: ${item.price}`,
    item.hands && `Hands: ${item.hands}`,
    item.source && `Source: ${item.source}`,
    item.usage && `Usage: ${item.usage}`,
    item.category && `Category: ${item.category}`,
    item.rarity && `Rarity: ${item.rarity}`,
    item.traits.length && `Traits: ${item.traits.join(", ")}`,
  ].filter(Boolean).join("\n");
  return [metadata, item.description].filter(Boolean).join("\n\n");
}

function itemSearchType(row: Record<string, unknown>) {
  const url = typeof row.url === "string" ? row.url : "";
  return /^\/(?:treasure|equipment\/(?:ammunition|armor|shields|weapons))\//i.test(url);
}

/** Normalize AoN's public Elasticsearch response without trusting remote URLs or metadata. */
export function normalizeNethysItemSearchResponse(value: unknown, requiredLevel?: number): NethysItemSearchResult[] {
  if (!value || typeof value !== "object") throw new NethysItemError("parse_failed", "Archives of Nethys returned an unreadable search response.");
  const hits = (value as { hits?: { hits?: unknown } }).hits?.hits;
  if (!Array.isArray(hits)) throw new NethysItemError("parse_failed", "Archives of Nethys returned an unreadable search response.");
  return hits.flatMap((hit): NethysItemSearchResult[] => {
    const source = hit && typeof hit === "object" && "_source" in hit ? (hit as { _source?: unknown })._source : null;
    if (!source || typeof source !== "object") return [];
    const row = source as Record<string, unknown>;
    if (!itemSearchType(row) || typeof row.name !== "string" || typeof row.url !== "string") return [];
    let sourceUrl: URL;
    try { sourceUrl = new URL(row.url, `https://${HOST}`); } catch { return []; }
    try { validateNethysItemUrl(sourceUrl.href); } catch { return []; }
    const level = typeof row.level === "number" && Number.isInteger(row.level) ? row.level : undefined;
    if (requiredLevel != null && level != null && level !== requiredLevel) return [];
    const category = typeof row.type === "string" ? row.type : typeof row.category === "string" ? row.category : undefined;
    return [{ name: row.name.trim(), level, category, sourceUrl: sourceUrl.href, sourceMaterialTitle: typeof row.primary_source === "string" ? row.primary_source : undefined, summary: typeof row.summary === "string" ? row.summary : undefined }];
  });
}

export async function searchNethysItems(query: string, requiredLevel?: number, fetcher: typeof fetch = fetch) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const escaped = trimmed.replace(/[+\-=!(){}\[\]^"~*?:\\/]|&&|\|\|/g, "\\$&");
  const url = new URL("https://elasticsearch.aonprd.com/aonsf/_search");
  url.searchParams.set("q", `name:(${escaped})`);
  url.searchParams.set("size", "25");
  let response: Response;
  try { response = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": "NexusCodex/1.0 item search" }, signal: AbortSignal.timeout(10_000) }); }
  catch { throw new NethysItemError("unavailable", "Archives of Nethys item search is unavailable right now. Exact-link import and manual entry are still available."); }
  if (!response.ok) throw new NethysItemError("unavailable", "Archives of Nethys item search is unavailable right now. Exact-link import and manual entry are still available.");
  try {
    const normalized = normalizeNethysItemSearchResponse(await response.json(), requiredLevel);
    return normalized.filter((item, index, all) => all.findIndex((candidate) => candidate.sourceUrl === item.sourceUrl) === index);
  }
  catch (error) { if (error instanceof NethysItemError) throw error; throw new NethysItemError("parse_failed", "Archives of Nethys returned unreadable item results. Exact-link import and manual entry are still available."); }
}

const itemCatalogUrl = (item: NethysItem) => `${item.url}#item=${encodeURIComponent(item.name)}${item.level == null ? "" : `&level=${item.level}`}`;
const itemMetadata = (item: NethysItem) => ({ level: item.level, price: item.price, priceCredits: item.priceCredits, bulk: item.bulk, hands: item.hands, source: item.source, sourceUrl: item.sourceUrl, description: item.description, traits: item.traits, rarity: item.rarity, societyLegal: item.societyLegal, societyStatus: item.societyStatus, usage: item.usage, category: item.category });

export async function catalogNethysItem(item: NethysItem, database = getDb()) {
  const normalizedName = item.name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
  const sourceMaterialTitle = item.source ? materialTitleWithoutCitation(item.source) : undefined;
  const sourceMaterialIdentity = sourceMaterialTitle ? normalizeMaterialIdentity(sourceMaterialTitle) : undefined;
  const sourceUrl = itemCatalogUrl(item);
  const [saved] = await database.insert(characterOptions).values({ id: randomUUID(), gameSystemId: SUPPORTED_GAME_SYSTEM.id, optionType: "item", name: item.name, normalizedName, sourceMaterialIdentity, sourceMaterialTitle, sourceUrl, metadata: itemMetadata(item) }).onConflictDoUpdate({ target: characterOptions.sourceUrl, set: { name: item.name, normalizedName, sourceMaterialIdentity, sourceMaterialTitle, metadata: itemMetadata(item), updatedAt: new Date() } }).returning();
  return saved!;
}

export async function searchCatalogItems(query: string, requiredLevel?: number, database = getDb()) {
  const normalized = query.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
  if (!normalized) return [];
  const rows = await database.select().from(characterOptions).where(and(eq(characterOptions.optionType, "item"), ilike(characterOptions.normalizedName, `%${normalized}%`))).orderBy(asc(characterOptions.name)).limit(50);
  return rows.filter((row) => requiredLevel == null || row.metadata.level === requiredLevel);
}
