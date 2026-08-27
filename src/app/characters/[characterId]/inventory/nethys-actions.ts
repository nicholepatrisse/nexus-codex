"use server";
import { requireAuthenticatedActor } from "@/auth/actor";
import { fetchNethysItem, NethysItemError, nethysItemNotes } from "@/nethys/items";

export async function fetchNethysItemAction(url: string) {
  try {
    await requireAuthenticatedActor();
    const item = await fetchNethysItem(url);
    return { ok: true as const, item, notes: nethysItemNotes(item) };
  } catch (error) {
    if (error instanceof NethysItemError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: "We couldn’t fetch item details. You can still enter the item manually." };
  }
}
