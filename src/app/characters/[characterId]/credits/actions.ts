"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedActor } from "@/auth/actor";
import { createCreditAdjustment, creditAdjustmentInputSchema } from "@/character/credit-ledger";

export interface AdjustmentState { fieldErrors?: Record<string, string[] | undefined>; formError?: string; success?: boolean }
export async function createCreditAdjustmentAction(characterId: string, _state: AdjustmentState, formData: FormData): Promise<AdjustmentState> {
  const parsed = creditAdjustmentInputSchema.safeParse({ amountMinor: formData.get("amountMinor"), effectiveOn: formData.get("effectiveOn"), notes: formData.get("notes") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const created = await createCreditAdjustment(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!created) return { formError: "Character not found." };
    revalidatePath(`/characters/${characterId}`);
    return { success: true };
  } catch { return { formError: "We couldn’t save that adjustment. Please try again." }; }
}
