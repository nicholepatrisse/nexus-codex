"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { returnPurchase, returnPurchaseInputSchema, saleInputSchema, sellInventory } from "@/character/sales";

export interface SaleState { fieldErrors?: Record<string, string[] | undefined>; formError?: string; success?: boolean }
export async function sellInventoryAction(characterId: string, inventoryEntryId: string, _state: SaleState, formData: FormData): Promise<SaleState> {
  const parsed = saleInputSchema.safeParse({ inventoryEntryId, quantity: formData.get("quantity"), soldOn: formData.get("soldOn"), idempotencyKey: formData.get("idempotencyKey") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const result = await sellInventory(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!result) return { formError: "This inventory lot is not available." };
    revalidatePath(`/characters/${characterId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: error instanceof Error ? error.message : "We couldn’t record this sale." };
  }
}

export async function returnPurchaseAction(characterId: string, inventoryEntryId: string, _state: SaleState, formData: FormData): Promise<SaleState> {
  const parsed = returnPurchaseInputSchema.safeParse({ inventoryEntryId, returnedOn: formData.get("returnedOn"), idempotencyKey: formData.get("idempotencyKey") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const result = await returnPurchase(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!result) return { formError: "This inventory lot is not available." };
    revalidatePath(`/characters/${characterId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: error instanceof Error ? error.message : "We couldn’t return this item." };
  }
}
