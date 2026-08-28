import { load } from "cheerio";

const HOST = "2e.aonsrd.com";
const ITEM_PATH = /^\/(?:treasure\/[^/]+|equipment\/(?:armor|shields|weapons)\/[^/]+)\/?$/i;

export type NethysItem = {
  url: string;
  name: string;
  level: number;
  price?: string;
  priceCredits?: number;
  bulk?: string;
  hands?: string;
  source?: string;
  description?: string;
  traits: string[];
  rarity?: string;
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

function parseItemRoot($: ReturnType<typeof load>, root: ReturnType<ReturnType<typeof load>>, sourceUrl: string): NethysItem {
  const rootElement = root.get(0);

  const title = root.children("h1.title, h2.title").first().clone();
  const levelText = clean(title.find(".feature-level").text());
  title.find(".feature-level, .sfs, img").remove();
  const name = clean(title.text());
  const levelMatch = levelText?.match(/Item\s+(\d+)/i);
  if (!name || !levelMatch) throw new NethysItemError("parse_failed", "Nethys returned the page, but its required item details could not be read.");

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
  const pathCategory = new URL(sourceUrl).pathname.split("/")[1];

  return {
    url: sourceUrl,
    name,
    level: Number(levelMatch[1]),
    price,
    priceCredits: creditMatch?.[1] ? Number(creditMatch[1].replaceAll(",", "")) : undefined,
    hands: values.get("hands"),
    bulk: values.get("bulk"),
    source: clean(root.children(".sources").first().text())?.replace(/^Source\s*/i, ""),
    description: clean(root.children(".treasure-description, .description").first().text()),
    traits: [...new Set(traits)],
    rarity,
    usage: values.get("usage"),
    category: pathCategory === "treasure" ? "Treasure" : clean(pathCategory)?.replace(/^./, (letter) => letter.toUpperCase()),
  };
}

export function parseNethysItemsHtml(html: string, sourceUrl: string): NethysItem[] {
  const $ = load(html);
  const root = $(".treasure, .armor, .shield, .weapon").first();
  if (!root.length) throw new NethysItemError("not_item", "The referenced page does not appear to contain a supported item.");
  const variants = root.children(".treasure, .armor, .shield, .weapon");
  return (variants.length ? variants.toArray().map((element) => $(element)) : [root]).map((itemRoot) => parseItemRoot($, itemRoot, sourceUrl));
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
    `Item level: ${item.level}`,
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
