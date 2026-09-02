import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { load } from "cheerio";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { playerMaterials, sourceMaterials } from "@/db/schema";
import { materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";
export { isFreeAccessMaterial, materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";

type Database = ReturnType<typeof getDb>;
export const PLAYER_CORE = { id: "default-player-core", identity: "pzo22001", isbn: null, productCode: "PZO22001", title: "Starfinder Player Core", sourceUrl: "https://store.paizo.com/starfinder-2e-player-core/", aliases: ["Player Core", "SF2 Player Core", "Starfinder Player Core", "PZO22001"], isDefault: true } as const;
export class MaterialLookupError extends Error {}

function catalogMaterialIdentity(material: { isbn: string | null; productCode: string | null; title: string }) {
  return material.productCode?.toLowerCase() ?? (material.isbn ? `isbn-${material.isbn}` : normalizeMaterialIdentity(material.title));
}

function isPaizoProductUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") return false;
  if (hostname === "store.paizo.com") return /^\/[a-z0-9][a-z0-9-]*\/?$/i.test(url.pathname);
  return (hostname === "paizo.com" || hostname.endsWith(".paizo.com")) && url.pathname.startsWith("/products/");
}

function isNethysSourceUrl(url: URL) {
  return url.protocol === "https:" && url.hostname.toLowerCase() === "2e.aonsrd.com" && /^\/sources\/[^/]+\/?$/i.test(url.pathname);
}

export function parseNethysProductUrl(html: string, sourceUrl: string) {
  const source = new URL(sourceUrl);
  if (!isNethysSourceUrl(source)) throw new MaterialLookupError("Use an Archives of Nethys source link or a Paizo product link.");
  const $ = load(html);
  const href = $("a").filter((_index, element) => /product\s*page|paizo\s*store/i.test($(element).parent().text())).first().attr("href")
    ?? $("a[href*='store.paizo.com'], a[href*='paizo.com/products/']").first().attr("href");
  if (!href) throw new MaterialLookupError("Archives of Nethys does not list a Paizo product link for this source.");
  const productUrl = new URL(href, source);
  if (!isPaizoProductUrl(productUrl)) throw new MaterialLookupError("Archives of Nethys returned an unsupported product link.");
  return productUrl;
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
  const isbn = text.match(/\bISBN(?:-13)?\s*:\s*((?:97[89][\s-]*)?\d(?:[\s-]*\d){9,12})\b/i)?.[1]?.replace(/[^0-9]/g, "") ?? null;
  const validIsbn = isbn?.length === 13 ? isbn : null;
  const identity = productCode?.toLowerCase() ?? (validIsbn ? `isbn-${validIsbn}` : normalizeMaterialIdentity(title));
  const shortTitle = title.replace(/^Starfinder(?:\s+2e)?\s+(?:Adventure(?:\s+Path)?\s*:\s*)?/i, "");
  return { identity, isbn: validIsbn, productCode, title, sourceUrl: url.href, aliases: [...new Set([title.replace(/^Starfinder\s+/i, ""), shortTitle, productCode, validIsbn].filter((value): value is string => Boolean(value)))] };
}

export async function fetchPaizoMaterial(value: string, fetcher: typeof fetch = fetch) {
  let url: URL;
  try { url = new URL(value); } catch { throw new MaterialLookupError("Enter a complete Paizo product link."); }
  if (!isPaizoProductUrl(url) && !isNethysSourceUrl(url)) throw new MaterialLookupError("Use an Archives of Nethys source link or a Paizo product link.");
  let response: Response;
  try { response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "NexusCodex/1.0 material importer" }, signal: AbortSignal.timeout(10_000) }); }
  catch { throw new MaterialLookupError(`${isNethysSourceUrl(url) ? "Archives of Nethys" : "Paizo"} is unavailable right now. Try again later.`); }
  if (!response.ok) throw new MaterialLookupError(`${isNethysSourceUrl(url) ? "Archives of Nethys" : "Paizo"} is unavailable right now. Try again later.`);
  if (isNethysSourceUrl(url)) {
    url = parseNethysProductUrl(await response.text(), response.url || url.href);
    try { response = await fetcher(url, { headers: { Accept: "text/html", "User-Agent": "NexusCodex/1.0 material importer" }, signal: AbortSignal.timeout(10_000) }); }
    catch { throw new MaterialLookupError("Paizo is unavailable right now. Try again later."); }
    if (!response.ok) throw new MaterialLookupError("Paizo is unavailable right now. Try again later.");
  }
  return parsePaizoMaterialHtml(await response.text(), response.url || url.href);
}

export async function catalogSourceMaterial(nethysSourceUrl: string, database: Database = getDb(), fetcher: typeof fetch = fetch) {
  const [known] = await database.select().from(sourceMaterials).where(eq(sourceMaterials.nethysSourceUrl, nethysSourceUrl)).limit(1);
  if (known) return known;
  const material = await fetchPaizoMaterial(nethysSourceUrl, fetcher);
  if (!material.isbn && !material.productCode) return null;
  const conflict = material.isbn
    ? { target: sourceMaterials.isbn, targetWhere: sql`${sourceMaterials.isbn} is not null` }
    : { target: sourceMaterials.productCode, targetWhere: sql`${sourceMaterials.productCode} is not null` };
  const [row] = await database.insert(sourceMaterials).values({ id: randomUUID(), isbn: material.isbn, title: material.title, productCode: material.productCode, nethysSourceUrl, paizoProductUrl: material.sourceUrl, aliases: material.aliases }).onConflictDoUpdate({ ...conflict, set: { title: material.title, productCode: material.productCode, nethysSourceUrl, paizoProductUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } }).returning();
  return row ?? null;
}

export async function listOwnedMaterials(actor: AuthenticatedActor, database: Database = getDb()) {
  const rows = await database.select().from(playerMaterials).where(eq(playerMaterials.personId, actor.personId)).orderBy(asc(playerMaterials.title));
  return [PLAYER_CORE, ...rows.map((row) => ({ ...row, isDefault: false as const }))];
}

export async function listCatalogMaterials(database: Database = getDb()) {
  return database.select().from(sourceMaterials).orderBy(asc(sourceMaterials.title));
}

export async function addCatalogOwnedMaterial(actor: AuthenticatedActor, sourceMaterialId: string, database: Database = getDb()) {
  const [source] = await database.select().from(sourceMaterials).where(eq(sourceMaterials.id, sourceMaterialId)).limit(1);
  if (!source) return null;
  const material = { identity: catalogMaterialIdentity(source), isbn: source.isbn, productCode: source.productCode, title: source.title, sourceUrl: source.paizoProductUrl, aliases: source.aliases };
  const [row] = await database.insert(playerMaterials).values({ id: randomUUID(), personId: actor.personId, ...material }).onConflictDoUpdate({ target: [playerMaterials.personId, playerMaterials.identity], set: { isbn: material.isbn, productCode: material.productCode, title: material.title, sourceUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } }).returning();
  return row ?? null;
}

export function materialValidationIdentities(material: { identity: string; title: string; aliases: readonly string[]; isbn?: string | null }) {
  return [...new Set([material.identity, material.isbn ? `isbn-${material.isbn}` : null, material.title, ...material.aliases].filter((value): value is string => Boolean(value)).map(normalizeMaterialIdentity).filter(Boolean))];
}

export function materialMatchesReference(material: { identity: string; title: string; aliases: readonly string[]; isbn?: string | null }, expectedIdentity: string, expectedTitle: string) {
  const expected = [expectedIdentity, materialTitleWithoutCitation(expectedTitle)].map(normalizeMaterialIdentity);
  const known = materialValidationIdentities(material);
  return expected.some((identity) => known.includes(identity));
}

export async function listOwnedMaterialIdentities(actor: AuthenticatedActor, database: Database = getDb()) {
  return (await listOwnedMaterials(actor, database)).flatMap(materialValidationIdentities);
}

export async function addOwnedMaterial(actor: AuthenticatedActor, url: string, database: Database = getDb(), fetcher: typeof fetch = fetch) {
  const material = await fetchPaizoMaterial(url, fetcher);
  if (material.identity === PLAYER_CORE.identity || material.productCode === PLAYER_CORE.productCode) return PLAYER_CORE;
  if (material.isbn || material.productCode) {
    const conflict = material.isbn ? { target: sourceMaterials.isbn, targetWhere: sql`${sourceMaterials.isbn} is not null` } : { target: sourceMaterials.productCode, targetWhere: sql`${sourceMaterials.productCode} is not null` };
    await database.insert(sourceMaterials).values({ id: randomUUID(), isbn: material.isbn, title: material.title, productCode: material.productCode, paizoProductUrl: material.sourceUrl, aliases: material.aliases }).onConflictDoUpdate({ ...conflict, set: { title: material.title, productCode: material.productCode, paizoProductUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } });
  }
  const [row] = await database.insert(playerMaterials).values({ id: randomUUID(), personId: actor.personId, ...material }).onConflictDoUpdate({ target: [playerMaterials.personId, playerMaterials.identity], set: { isbn: material.isbn, productCode: material.productCode, title: material.title, sourceUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } }).returning();
  return row;
}

export async function addReferencedOwnedMaterial(actor: AuthenticatedActor, url: string, expectedIdentity: string, expectedTitle = expectedIdentity, database: Database = getDb(), fetcher: typeof fetch = fetch) {
  const material = await fetchPaizoMaterial(url, fetcher);
  const identities = materialValidationIdentities(material);
  if (!materialMatchesReference(material, expectedIdentity, expectedTitle)) throw new MaterialLookupError("That Paizo product does not match the material for this option.");
  if (material.identity === PLAYER_CORE.identity || material.productCode === PLAYER_CORE.productCode) return { material: PLAYER_CORE, identities: materialValidationIdentities(PLAYER_CORE), duplicate: true };
  const existing = await database.select({ id: playerMaterials.id }).from(playerMaterials).where(and(eq(playerMaterials.personId, actor.personId), eq(playerMaterials.identity, material.identity))).limit(1);
  const [row] = await database.insert(playerMaterials).values({ id: randomUUID(), personId: actor.personId, ...material }).onConflictDoUpdate({ target: [playerMaterials.personId, playerMaterials.identity], set: { isbn: material.isbn, productCode: material.productCode, title: material.title, sourceUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } }).returning();
  return { material: row!, identities, duplicate: existing.length > 0 };
}

export async function addKnownOwnedMaterial(actor: AuthenticatedActor, expectedIdentity: string, expectedTitle: string, database: Database = getDb()) {
  const catalog = await database.select().from(sourceMaterials);
  const source = catalog.find((candidate) => materialMatchesReference({ identity: catalogMaterialIdentity(candidate), isbn: candidate.isbn, title: candidate.title, aliases: candidate.aliases }, expectedIdentity, expectedTitle));
  const legacy = source ? null : (await database.select().from(playerMaterials).then((materials) => materials.find((candidate) => materialMatchesReference(candidate, expectedIdentity, expectedTitle))));
  const material = source ? { identity: catalogMaterialIdentity(source), isbn: source.isbn, productCode: source.productCode, title: source.title, sourceUrl: source.paizoProductUrl, aliases: source.aliases } : legacy;
  if (!material) return null;
  const duplicate = (await database.select({ id: playerMaterials.id }).from(playerMaterials).where(and(eq(playerMaterials.personId, actor.personId), eq(playerMaterials.identity, material.identity))).limit(1)).length > 0;
  if (!duplicate) await database.insert(playerMaterials).values({ id: randomUUID(), personId: actor.personId, identity: material.identity, isbn: material.isbn, productCode: material.productCode, title: material.title, sourceUrl: material.sourceUrl, aliases: material.aliases }).onConflictDoUpdate({ target: [playerMaterials.personId, playerMaterials.identity], set: { isbn: material.isbn, productCode: material.productCode, title: material.title, sourceUrl: material.sourceUrl, aliases: material.aliases, updatedAt: new Date() } });
  return { identities: materialValidationIdentities(material), duplicate };
}

export async function removeOwnedMaterial(actor: AuthenticatedActor, id: string, database: Database = getDb()) {
  if (id === PLAYER_CORE.id) return false;
  return (await database.delete(playerMaterials).where(and(eq(playerMaterials.id, id), eq(playerMaterials.personId, actor.personId))).returning({ id: playerMaterials.id })).length === 1;
}
