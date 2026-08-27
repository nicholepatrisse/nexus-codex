"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { createInventoryEntry, deleteInventoryEntry, inventoryEntryInputSchema, updateInventoryEntry } from "@/character/inventory";

export interface InventoryFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }
function input(formData: FormData) { return { contentItemId: formData.get("contentItemId"), itemName: formData.get("itemName"), itemLink: formData.get("itemLink"), quantity: formData.get("quantity"), acquisitionType: formData.get("acquisitionType"), acquiredOn: formData.get("acquiredOn"), amountPaidMinor: formData.get("amountPaidMinor"), sourceChronicleId: formData.get("sourceChronicleId"), notes: formData.get("notes") }; }
async function run(operation: () => Promise<unknown>): Promise<InventoryFormState> {
  try { if (!await operation()) return { formError: "This inventory entry is not available." }; }
  catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: z.flattenError(error).fieldErrors };
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: error instanceof Error ? error.message : "We couldn’t save this inventory entry." };
  }
  return {};
}
export async function createInventoryAction(characterId: string, _state: InventoryFormState, formData: FormData) {
  const parsed = inventoryEntryInputSchema.safeParse(input(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const result = await run(async () => createInventoryEntry(await requireAuthenticatedActor(), characterId, parsed.data));
  if (result.formError || result.fieldErrors) return result;
  redirect(`/characters/${characterId}`);
}
export async function updateInventoryAction(characterId: string, entryId: string, _state: InventoryFormState, formData: FormData) {
  const parsed = inventoryEntryInputSchema.safeParse(input(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const result = await run(async () => updateInventoryEntry(await requireAuthenticatedActor(), characterId, entryId, parsed.data));
  if (result.formError || result.fieldErrors) return result;
  redirect(`/characters/${characterId}`);
}
export async function deleteInventoryAction(characterId: string, entryId: string) {
  try { await deleteInventoryEntry(await requireAuthenticatedActor(), characterId, entryId); } catch { /* privacy-safe no-op */ }
  redirect(`/characters/${characterId}`);
}
