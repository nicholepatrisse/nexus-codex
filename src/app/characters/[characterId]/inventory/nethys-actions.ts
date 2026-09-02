"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import { fetchNethysItems, NethysItemError, nethysItemNotes } from "@/nethys/items";
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
