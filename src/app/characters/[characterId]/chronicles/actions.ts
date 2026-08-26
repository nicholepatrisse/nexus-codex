"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { createManualChronicle, deleteManualChronicle, manualChronicleInputSchema, updateManualChronicle } from "@/character/chronicles";

export interface ChronicleFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }
function input(formData: FormData) { return { contentItemId: formData.get("contentItemId"), scenarioNumber: formData.get("scenarioNumber"), scenarioName: formData.get("scenarioName"), datePlayed: formData.get("datePlayed"), characterLevel: formData.get("characterLevel"), advancementSpeed: formData.get("advancementSpeed"), xp: formData.get("xp"), creditsMinor: formData.get("creditsMinor"), reputation: formData.get("reputation"), downtime: formData.get("downtime"), playerNotes: formData.get("playerNotes") }; }

export async function createChronicleAction(characterId: string, _state: ChronicleFormState, formData: FormData): Promise<ChronicleFormState> {
  const parsed = manualChronicleInputSchema.safeParse(input(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const created = await createManualChronicle(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!created) return { formError: "You do not have permission to add a Chronicle to this character." };
  } catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: z.flattenError(error).fieldErrors };
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: error instanceof Error ? error.message : "We couldn’t add that Chronicle. Please try again." };
  }
  redirect(`/characters/${characterId}`);
}

export async function updateChronicleAction(characterId: string, chronicleId: string, _state: ChronicleFormState, formData: FormData): Promise<ChronicleFormState> {
  const parsed = manualChronicleInputSchema.safeParse(input(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const updated = await updateManualChronicle(await requireAuthenticatedActor(), characterId, chronicleId, parsed.data);
    if (!updated) return { formError: "This Chronicle is not editable." };
  } catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: z.flattenError(error).fieldErrors };
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: error instanceof Error ? error.message : "We couldn’t update that Chronicle. Please try again." };
  }
  redirect(`/characters/${characterId}`);
}

export async function deleteChronicleAction(characterId: string, chronicleId: string) {
  try { await deleteManualChronicle(await requireAuthenticatedActor(), characterId, chronicleId); } catch { /* Preserve the privacy-safe not-found behavior on failure. */ }
  redirect(`/characters/${characterId}`);
}
