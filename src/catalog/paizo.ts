import { load } from "cheerio";
import { z } from "zod";
import { normalizeContentCode } from "@/catalog/normalization";

export const PAIZO_SFS_CATALOG_URL = "https://store.paizo.com/starfinder/starfinder-society/";

const catalogItemSchema = z
  .object({
    code: z.string().regex(/^\d+-\d{2}$/),
    title: z.string().min(1),
    contentType: z.enum(["scenario", "special"]),
    minimumLevel: z.int().min(1),
    maximumLevel: z.int().min(1),
    productUrl: z.url().refine((url) => {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname === "store.paizo.com";
    }),
  })
  .refine((item) => item.maximumLevel >= item.minimumLevel, {
    message: "maximumLevel must be greater than or equal to minimumLevel",
    path: ["maximumLevel"],
  });

export const sfs2CatalogSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal(PAIZO_SFS_CATALOG_URL),
  items: z.array(catalogItemSchema).min(10),
});

export type PaizoCatalogItem = z.infer<typeof catalogItemSchema>;
export type Sfs2CatalogSnapshot = z.infer<typeof sfs2CatalogSnapshotSchema>;

const titlePattern = /^Starfinder Society Scenario #(\d+-\d{2}):\s*(.+)$/;
const levelPattern = /designed for (\d+)(?:st|nd|rd|th)(?:-\s*through\s*(\d+)(?:st|nd|rd|th))?-level/i;

export function parsePaizoCatalogPage(html: string) {
  const $ = load(html);
  const items: PaizoCatalogItem[] = [];

  $(".productGrid .product").each((_, product) => {
    const card = $(product);
    if (card.find('[data-test-info-type="brandName"]').text().trim() !== "Starfinder Society 2E") {
      return;
    }

    const titleLink = card.find(".card-title a").first();
    const match = titleLink.text().trim().match(titlePattern);
    if (!match) return;
    const href = titleLink.attr("href");
    if (!href) throw new Error(`Paizo catalog item ${match[1]} has no product URL.`);

    const description = card.find(".listdes").text().replace(/\s+/g, " ").trim();
    const levels = description.match(levelPattern);
    if (!levels) {
      throw new Error(`Could not determine level range for ${titleLink.text().trim()}.`);
    }

    const minimumLevel = Number(levels[1]);
    const maximumLevel = Number(levels[2] ?? levels[1]);
    items.push(
      catalogItemSchema.parse({
        code: normalizeContentCode(match[1]!),
        title: match[2]!.trim(),
        contentType: /Starfinder Society Special/i.test(description) ? "special" : "scenario",
        minimumLevel,
        maximumLevel,
        productUrl: new URL(href, PAIZO_SFS_CATALOG_URL).toString(),
      }),
    );
  });

  const totalPages = Math.max(
    1,
    ...$(".pagination-list a")
      .map((_, link) => Number($(link).text().trim()))
      .get()
      .filter(Number.isInteger),
  );

  return { items, totalPages };
}

function compareCodes(left: string, right: string): number {
  const [leftSeason, leftNumber] = left.split("-").map(Number);
  const [rightSeason, rightNumber] = right.split("-").map(Number);
  return leftSeason! - rightSeason! || leftNumber! - rightNumber!;
}

export function buildSfs2CatalogSnapshot(items: PaizoCatalogItem[]): Sfs2CatalogSnapshot {
  const byCode = new Map<string, PaizoCatalogItem>();
  for (const item of items.map((value) => catalogItemSchema.parse(value))) {
    const normalizedCode = normalizeContentCode(item.code);
    if (byCode.has(normalizedCode)) {
      throw new Error(`Duplicate Paizo catalog code: ${normalizedCode}.`);
    }
    byCode.set(normalizedCode, { ...item, code: normalizedCode });
  }

  return sfs2CatalogSnapshotSchema.parse({
    schemaVersion: 1,
    source: PAIZO_SFS_CATALOG_URL,
    items: [...byCode.values()].sort((left, right) => compareCodes(left.code, right.code)),
  });
}

export async function fetchSfs2Catalog(
  fetchPage: typeof fetch = fetch,
  delayMilliseconds = 750,
): Promise<Sfs2CatalogSnapshot> {
  const fetchHtml = async (page: number) => {
    const url = new URL(PAIZO_SFS_CATALOG_URL);
    url.searchParams.set("page", String(page));
    const response = await fetchPage(url, {
      headers: { "user-agent": "NexusCodexCatalog/0.1 (+https://github.com/nicholepatrisse/nexus-codex)" },
    });
    if (!response.ok) throw new Error(`Paizo catalog page ${page} returned ${response.status}.`);
    return response.text();
  };

  const first = parsePaizoCatalogPage(await fetchHtml(1));
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
    items.push(...parsePaizoCatalogPage(await fetchHtml(page)).items);
  }
  return buildSfs2CatalogSnapshot(items);
}
