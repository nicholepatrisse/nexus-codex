import { load } from "cheerio";
import { normalizeContentCode } from "@/catalog/normalization";

export type PaizoScenarioDetails = {
  code: string;
  title: string;
  contentType: "scenario";
  minimumLevel: number;
  maximumLevel: number;
  productUrl: string;
  source: "paizo";
  sourceUrl: string;
  productCode: string | null;
  publicationDate: string | null;
  description: string | null;
};

const officialProductPath = /^\/starfinder-society-scenario-[a-z0-9-]+\/$/;
const levelPattern = /designed for (\d+)(?:st|nd|rd|th)(?:-\s*through\s*(\d+)(?:st|nd|rd|th))?-level/i;

export function normalizePaizoScenarioUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid Paizo scenario URL."); }
  if (url.protocol !== "https:" || url.hostname !== "store.paizo.com" || !officialProductPath.test(url.pathname)) {
    throw new Error("Use an official store.paizo.com Starfinder Society scenario URL.");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function jsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jsonLdObjects);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [object, ...jsonLdObjects(object["@graph"]), ...jsonLdObjects(object.offers)];
}

/** Parses a single official product page. Optional metadata is deliberately best-effort. */
export function parsePaizoScenarioPage(html: string, productUrl: string): PaizoScenarioDetails {
  const sourceUrl = normalizePaizoScenarioUrl(productUrl);
  const $ = load(html);
  const jsonLd = $('script[type="application/ld+json"]').toArray().flatMap((node) => {
    try { return jsonLdObjects(JSON.parse($(node).text())); } catch { return []; }
  });
  const product = jsonLd.find((item) => String(item["@type"] ?? "").toLowerCase() === "product");
  const rawName = String(product?.name ?? $("h1").first().text() ?? "").replace(/\s+/g, " ").trim();
  const match = rawName.match(/^Starfinder Society Scenario\s*#?(\d+-\d{2}):\s*(.+)$/i);
  if (!match) throw new Error("This Paizo page is not a supported Starfinder Society scenario.");

  const description = String(product?.description ?? $('meta[name="description"]').attr("content") ?? "")
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const pageText = $("body").text().replace(/\s+/g, " ");
  const levels = `${description} ${pageText}`.match(levelPattern)
    ?? `${description} ${pageText}`.match(/(?:levels?|tier)\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!levels) throw new Error("The scenario page does not include a recognizable level range.");
  const minimumLevel = Number(levels[1]);
  const maximumLevel = Number(levels[2] ?? levels[1]);
  const productCode = String(product?.sku ?? $('[itemprop="sku"]').attr("content") ?? $('[data-product-sku]').attr("data-product-sku") ?? "").trim() || null;
  const dateValue = String(product?.releaseDate ?? product?.datePublished ?? $('meta[itemprop="releaseDate"]').attr("content") ?? "").trim();
  const publicationDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue.slice(0, 10)) ? dateValue.slice(0, 10) : null;

  return {
    code: normalizeContentCode(match[1]!), title: match[2]!.trim(), contentType: "scenario",
    minimumLevel, maximumLevel, productUrl: sourceUrl, source: "paizo", sourceUrl,
    productCode, publicationDate, description: description || null,
  };
}

export async function fetchPaizoScenarioPage(value: string, fetchPage: typeof fetch = fetch) {
  const url = normalizePaizoScenarioUrl(value);
  let response: Response;
  try {
    response = await fetchPage(url, { redirect: "manual", headers: { "user-agent": "NexusCodexCatalog/0.1 (+https://github.com/nicholepatrisse/nexus-codex)" } });
  } catch { throw new Error("Paizo is unavailable. Try again in a few minutes."); }
  if (response.status >= 300 && response.status < 400) throw new Error("The Paizo product URL redirected to an unsupported page.");
  if (!response.ok) throw new Error("Paizo is unavailable. Try again in a few minutes.");
  return parsePaizoScenarioPage(await response.text(), url);
}
