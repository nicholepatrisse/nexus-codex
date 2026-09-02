import { load } from "cheerio";

const HOST = "2e.aonsrd.com";
const ITEM_PATH = /^\/(?:treasure\/[^/]+|equipment\/(?:armor|shields|weapons)\/[^/]+)\/?$/i;

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

function parseItemRoot($: ReturnType<typeof load>, root: ReturnType<ReturnType<typeof load>>, sourceUrl: string, inheritedSocietyStatus?: NethysItem["societyStatus"]): NethysItem {
  const rootElement = root.get(0);

  const title = root.children("h1.title, h2.title").first().clone();
  const levelText = clean(title.find(".feature-level").text());
  title.find(".feature-level, .sfs, img").remove();
  const name = clean(title.text());
  const levelMatch = levelText?.match(/Item\s+(\d+)/i);
  if (!name) throw new NethysItemError("parse_failed", "Nethys returned the page, but its required item details could not be read.");

  const values = new Map<string, string>();
  root.find("b, strong").filter((_index, element) => $(element).closest(".treasure, .armor, .shield, .weapon").get(0) === rootElement).each((_index, element) => {
    const label = clean($(element).text())?.replace(/:$/, "").toLowerCase();
    const parent = $(element).parent().clone();
    parent.find("b, strong").first().remove();
    const value = clean(parent.text());
    if (label && value && !values.has(label)) values.set(label, value);
  });
  const price = values.get("price");
  const creditMatch = price?.match(/^([\d,]+(?:\.\d+)?)\s+credits?$/i);
  const traits = root.find(".trait, .traits a, a.link-trait").filter((_index, element) => $(element).closest(".treasure, .armor, .shield, .weapon").get(0) === rootElement).map((_index, element) => clean($(element).text())).get().filter((value): value is string => Boolean(value));
  const rarity = traits.find((trait) => /^(common|uncommon|rare|unique)$/i.test(trait));
  const societyMarker = root.find(".sfs img").first();
  const societyMarkerText = [societyMarker.attr("alt"), societyMarker.attr("title"), societyMarker.attr("src")].filter(Boolean).join(" ");
  const societyStatus = /\brestricted\b/i.test(societyMarkerText) ? "restricted" : /\blimited\b/i.test(societyMarkerText) ? "limited" : /\bstandard\b/i.test(societyMarkerText) ? "standard" : inheritedSocietyStatus;
  const societyLegal = societyStatus === "restricted" ? false : undefined;
  const pathCategory = new URL(sourceUrl).pathname.split("/")[1];

  return {
    url: sourceUrl,
    name,
    level: levelMatch ? Number(levelMatch[1]) : undefined,
    price,
    priceCredits: creditMatch?.[1] ? Number(creditMatch[1].replaceAll(",", "")) : undefined,
    hands: values.get("hands"),
    bulk: values.get("bulk"),
    source: clean(root.children(".sources").first().text())?.replace(/^Source\s*/i, ""),
    sourceUrl: (() => { const href = root.children(".sources").first().find("a[href]").first().attr("href"); if (!href) return undefined; try { const resolved = new URL(href, sourceUrl); return resolved.hostname === HOST && /^\/sources\//i.test(resolved.pathname) ? resolved.href : undefined; } catch { return undefined; } })(),
    description: clean(root.children(".treasure-description, .description").first().text()),
    traits: [...new Set(traits)],
    rarity,
    societyLegal,
    societyStatus,
    usage: values.get("usage"),
    category: pathCategory === "treasure" ? "Treasure" : clean(pathCategory)?.replace(/^./, (letter) => letter.toUpperCase()),
  };
}

export function parseNethysItemsHtml(html: string, sourceUrl: string): NethysItem[] {
  const $ = load(html);
  const root = $(".treasure, .armor, .shield, .weapon").first();
  if (!root.length) throw new NethysItemError("not_item", "The referenced page does not appear to contain a supported item.");
  const variants = root.children(".treasure, .armor, .shield, .weapon");
  const parentMarker = root.children("h1.title, h2.title").first().find(".sfs img").first();
  const parentMarkerText = [parentMarker.attr("alt"), parentMarker.attr("title"), parentMarker.attr("src")].filter(Boolean).join(" ");
  const parentSocietyStatus: NethysItem["societyStatus"] = /\brestricted\b/i.test(parentMarkerText) ? "restricted" : /\blimited\b/i.test(parentMarkerText) ? "limited" : /\bstandard\b/i.test(parentMarkerText) ? "standard" : undefined;
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
        const parsed = parseItemRoot($, variant, sourceUrl, parentSocietyStatus);
        const creditMatch = price?.match(/^([\d,]+(?:\.\d+)?)\s+credits?$/i);
        return [{ ...parsed, name, level, price, priceCredits: creditMatch?.[1] ? Number(creditMatch[1].replaceAll(",", "")) : undefined }];
      });
      if (weaponVariants.length) return weaponVariants;
    }
  }
  return (variants.length ? variants.toArray().map((element) => $(element)) : [root]).map((itemRoot) => parseItemRoot($, itemRoot, sourceUrl, parentSocietyStatus));
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
