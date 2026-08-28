"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import { fetchNethysItems, NethysItemError, nethysItemNotes } from "@/nethys/items";

export async function fetchNethysItemAction(url: string) {
  try {
    await requireAuthenticatedActor();
    const items = await fetchNethysItems(url);
    return { ok: true as const, items: items.map((item) => ({ item, notes: nethysItemNotes(item) })) };
  } catch (error) {
    if (error instanceof NethysItemError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t fetch item details. You can still enter the item manually." };
  }
}
