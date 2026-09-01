import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { load } from "cheerio";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { playerMaterials } from "@/db/schema";
import { normalizeMaterialIdentity } from "@/materials/material-identity";
export { isFreeAccessMaterial, materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

type Database = ReturnType<typeof getDb>;
export const PLAYER_CORE = { id: "default-player-core", identity: "starfinder-player-core", productCode: "PZO22001", title: "Starfinder Player Core", sourceUrl: "https://store.paizo.com/starfinder-2e-player-core/", aliases: ["Player Core", "SF2 Player Core", "PZO22001"], isDefault: true } as const;
export class MaterialLookupError extends Error {}

function isPaizoProductUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") return false;
  if (hostname === "store.paizo.com") return /^\/[a-z0-9][a-z0-9-]*\/?$/i.test(url.pathname);
  return (hostname === "paizo.com" || hostname.endsWith(".paizo.com")) && url.pathname.startsWith("/products/");
}

export function parsePaizoMaterialHtml(html: string, sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (!isPaizoProductUrl(url)) throw new MaterialLookupError("Use a Paizo product link from paizo.com or store.paizo.com.");
  url.hash = "";
  const $ = load(html);
  const rawTitle = $("meta[property='og:title']").attr("content") || $("h1").first().text() || $("title").text();
  const title = rawTitle.replace(/\s*[|–-]\s*Paizo.*$/i, "").replace(/\s+/g, " ").trim();
  if (!title) throw new MaterialLookupError("Paizo returned the page, but its product title could not be read.");
  const text = $("body").text();
  const productCode = text.match(/\bPZO\d{5,}\b/i)?.[0]?.toUpperCase() ?? null;
  const identity = productCode?.toLowerCase() ?? normalizeMaterialIdentity(title);
  return { identity, productCode, title, sourceUrl: url.href, aliases: [...new Set([title.replace(/^Starfinder\s+/i, ""), productCode].filter((value): value is string => Boolean(value)))] };
}

export async function fetchPaizoMaterial(value: string, fetcher: typeof fetch = fetch) {
  let url: URL;
  try { url = new URL(value); } catch { throw new MaterialLookupError("Enter a complete Paizo product link."); }
  if (!isPaizoProductUrl(url)) throw new MaterialLookupError("Use a Paizo product link from paizo.com or store.paizo.com.");
  let response: Response;
  try { response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "NexusCodex/1.0 material importer" }, signal: AbortSignal.timeout(10_000) }); }
  catch { throw new MaterialLookupError("Paizo is unavailable right now. Try again later."); }
  if (!response.ok) throw new MaterialLookupError("Paizo is unavailable right now. Try again later.");
  return parsePaizoMaterialHtml(await response.text(), response.url || url.href);
}

export async function listOwnedMaterials(actor: AuthenticatedActor, database: Database = getDb()) {
  const rows = await database.select().from(playerMaterials).where(eq(playerMaterials.personId, actor.personId)).orderBy(asc(playerMaterials.title));
  return [PLAYER_CORE, ...rows.map((row) => ({ ...row, isDefault: false as const }))];
}

export async function addOwnedMaterial(actor: AuthenticatedActor, url: string, database: Database = getDb(), fetcher: typeof fetch = fetch) {
  const material = await fetchPaizoMaterial(url, fetcher);
  if (material.identity === PLAYER_CORE.identity || material.productCode === PLAYER_CORE.productCode) return PLAYER_CORE;
  const [row] = await database.insert(playerMaterials).values({ id: randomUUID(), personId: actor.personId, ...material }).onConflictDoUpdate({ target: [playerMaterials.personId, playerMaterials.identity], set: { productCode: material.productCode, title: material.title, sourceUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } }).returning();
  return row;
}

export async function removeOwnedMaterial(actor: AuthenticatedActor, id: string, database: Database = getDb()) {
  if (id === PLAYER_CORE.id) return false;
  return (await database.delete(playerMaterials).where(and(eq(playerMaterials.id, id), eq(playerMaterials.personId, actor.personId))).returning({ id: playerMaterials.id })).length === 1;
}
