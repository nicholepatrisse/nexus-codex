"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import { catalogNethysItem, fetchNethysItems, NethysItemError, nethysItemNotes, searchCatalogItems, searchNethysItems, type NethysItem } from "@/nethys/items";
import { catalogSourceMaterial } from "@/materials/materials";

export async function fetchNethysItemAction(url: string) {
  try {
    await requireAuthenticatedActor();
    const items = await fetchNethysItems(url);
    let material = null;
    const sourceUrl = items.find((item) => item.sourceUrl)?.sourceUrl;
    if (sourceUrl) { try { material = await catalogSourceMaterial(sourceUrl); } catch { /* Advisory lookup must not block item import. */ } }
    return { ok: true as const, items: items.map((item) => ({ item: material ? { ...item, source: material.title } : item, notes: nethysItemNotes(item), sourceMaterialId: material?.id ?? null, sourceMaterialIdentity: material ? (material.productCode?.toLowerCase() ?? (material.isbn ? `isbn-${material.isbn}` : null)) : null })) };
  } catch (error) {
    if (error instanceof NethysItemError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t fetch item details. You can still enter the item manually." };
  }
}

function catalogRowItem(row: Awaited<ReturnType<typeof searchCatalogItems>>[number]): NethysItem {
  const metadata = row.metadata;
  const sourceUrl = typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : undefined;
  const canonicalUrl = row.sourceUrl.split("#")[0]!;
  return {
    url: canonicalUrl, name: row.name,
    level: typeof metadata.level === "number" ? metadata.level : undefined,
    price: typeof metadata.price === "string" ? metadata.price : undefined,
    priceCredits: typeof metadata.priceCredits === "number" ? metadata.priceCredits : undefined,
    bulk: typeof metadata.bulk === "string" ? metadata.bulk : undefined,
    hands: typeof metadata.hands === "string" ? metadata.hands : undefined,
    source: row.sourceMaterialTitle ?? (typeof metadata.source === "string" ? metadata.source : undefined), sourceUrl,
    description: typeof metadata.description === "string" ? metadata.description : undefined,
    traits: Array.isArray(metadata.traits) ? metadata.traits.filter((value): value is string => typeof value === "string") : [],
    rarity: typeof metadata.rarity === "string" ? metadata.rarity : undefined,
    societyLegal: typeof metadata.societyLegal === "boolean" ? metadata.societyLegal : undefined,
    societyStatus: metadata.societyStatus === "standard" || metadata.societyStatus === "limited" || metadata.societyStatus === "restricted" ? metadata.societyStatus : undefined,
    usage: typeof metadata.usage === "string" ? metadata.usage : undefined,
    category: typeof metadata.category === "string" ? metadata.category : undefined,
  };
}

export async function searchNethysItemsAction(query: string, requiredLevel?: number) {
  try {
    await requireAuthenticatedActor();
    const catalogRows = await searchCatalogItems(query, requiredLevel);
    const catalog = catalogRows.map((row) => ({ id: row.id, item: catalogRowItem(row), sourceMaterialId: null, sourceMaterialIdentity: row.sourceMaterialIdentity, notes: nethysItemNotes(catalogRowItem(row)) }));
    let remote: Awaited<ReturnType<typeof searchNethysItems>> = []; let remoteError: string | undefined;
    try { remote = await searchNethysItems(query, requiredLevel); }
    catch (error) { remoteError = error instanceof NethysItemError ? error.message : "Archives of Nethys item search is unavailable right now. Exact-link import and manual entry are still available."; }
    const known = new Set(catalog.map(({ item }) => `${item.url}|${item.name}|${item.level ?? ""}`));
    return { ok: true as const, catalog, remote: remote.filter((item) => !known.has(`${item.sourceUrl}|${item.name}|${item.level ?? ""}`)), remoteError };
  } catch {
    return { ok: false as const, error: "We couldn’t search for items. Exact-link import and manual entry are still available." };
  }
}

export async function selectNethysItemAction(url: string, name: string, level?: number) {
  try {
    await requireAuthenticatedActor();
    const candidates = await fetchNethysItems(url);
    const item = candidates.find((candidate) => candidate.name === name && (level == null || candidate.level === level));
    if (!item) return { ok: false as const, error: "That item or variant is no longer available. Search again or use the exact link." };
    await catalogNethysItem(item);
    let material = null;
    if (item.sourceUrl) { try { material = await catalogSourceMaterial(item.sourceUrl); } catch { /* Advisory lookup must not block item import. */ } }
    const importedItem = material ? { ...item, source: material.title } : item;
    return { ok: true as const, choice: { item: importedItem, notes: nethysItemNotes(importedItem), sourceMaterialId: material?.id ?? null, sourceMaterialIdentity: material ? (material.productCode?.toLowerCase() ?? (material.isbn ? `isbn-${material.isbn}` : null)) : null } };
  } catch (error) {
    if (error instanceof NethysItemError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t import that item. Exact-link import and manual entry are still available." };
  }
}
