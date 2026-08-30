"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { applyManualChronicle, ChronicleEligibilityError, ChronicleOrderError, createManualChronicle, deleteManualChronicle, DuplicateChronicleError, manualChronicleInputSchema, reconcileChronicles, unapplyManualChronicle, updateManualChronicle } from "@/character/chronicles";

export interface ChronicleFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string; values?: Record<string, string> }
function submittedValues(formData: FormData) { return Object.fromEntries(Array.from(formData.entries(), ([name, value]) => [name, typeof value === "string" ? value : value.name])); }
function input(formData: FormData) { const nullableNumber = (name: string) => formData.get(name) === "" || formData.get(name) == null ? null : formData.get(name); return { contentItemId: formData.get("contentItemId"), scenarioNumber: formData.get("scenarioNumber"), scenarioName: formData.get("scenarioName"), datePlayed: formData.get("datePlayed"), timePlayed: formData.get("timePlayed") || null, characterLevel: formData.get("characterLevel"), creditType: formData.get("creditType") || "normal", eligibilityNote: formData.get("eligibilityNote"), advancementSpeed: formData.get("advancementSpeed"), xp: formData.get("xp"), baseCreditsMinor: formData.get("baseCreditsMinor"), downtimeDisposition: formData.get("downtimeDisposition"), downtimeEntryMethod: formData.get("downtimeEntryMethod") || "calculated", downtimeCheckTotal: nullableNumber("downtimeCheckTotal"), downtimeProficiency: formData.get("downtimeProficiency") || null, downtimeSheetCreditsMinor: nullableNumber("downtimeSheetCreditsMinor"), downtimeOverrideCreditsMinor: nullableNumber("downtimeOverrideCreditsMinor"), downtimeCorrectionNote: formData.get("downtimeCorrectionNote"), downtimeActivity: formData.get("downtimeActivity"), partnerCode: formData.get("partnerCode"), eventName: formData.get("eventName"), eventCode: formData.get("eventCode"), gmOrganizedPlayId: formData.get("gmOrganizedPlayId"), playerNotes: formData.get("playerNotes") }; }

export async function createChronicleAction(characterId: string, _state: ChronicleFormState, formData: FormData): Promise<ChronicleFormState> {
  const values = submittedValues(formData);
  const parsed = manualChronicleInputSchema.safeParse(input(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    const created = await createManualChronicle(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!created) return { formError: "You do not have permission to add a Chronicle to this character.", values };
  } catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: z.flattenError(error).fieldErrors, values };
    if (error instanceof DuplicateChronicleError) return { fieldErrors: { scenarioNumber: [error.message] }, values };
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again.", values };
    return { formError: error instanceof Error ? error.message : "We couldn’t add that Chronicle. Please try again.", values };
  }
  redirect(`/characters/${characterId}?tab=chronicles`);
}

export async function updateChronicleAction(characterId: string, chronicleId: string, _state: ChronicleFormState, formData: FormData): Promise<ChronicleFormState> {
  const values = submittedValues(formData);
  const parsed = manualChronicleInputSchema.safeParse(input(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    const updated = await updateManualChronicle(await requireAuthenticatedActor(), characterId, chronicleId, parsed.data);
    if (!updated) return { formError: "This Chronicle is not editable.", values };
  } catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: z.flattenError(error).fieldErrors, values };
    if (error instanceof DuplicateChronicleError) return { fieldErrors: { scenarioNumber: [error.message] }, values };
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again.", values };
    return { formError: error instanceof Error ? error.message : "We couldn’t update that Chronicle. Please try again.", values };
  }
  redirect(`/characters/${characterId}?tab=chronicles`);
}

export async function deleteChronicleAction(characterId: string, chronicleId: string) {
  try { await deleteManualChronicle(await requireAuthenticatedActor(), characterId, chronicleId); } catch { /* Preserve the privacy-safe not-found behavior on failure. */ }
  redirect(`/characters/${characterId}?tab=chronicles`);
}

export interface ChronicleLifecycleState { error?: string }
export async function applyChronicleAction(characterId: string, chronicleId: string, _state: ChronicleLifecycleState): Promise<ChronicleLifecycleState> {
  void _state;
  try {
    const actor = await requireAuthenticatedActor();
    const applied = await applyManualChronicle(actor, characterId, chronicleId);
    if (!applied) return { error: "This Chronicle could not be applied." };
    await reconcileChronicles(actor, characterId);
  } catch (error) {
    if (error instanceof ChronicleEligibilityError || error instanceof ChronicleOrderError) return { error: error.message };
    return { error: "This Chronicle could not be applied." };
  }
  revalidatePath(`/characters/${characterId}`);
  return {};
}
export async function unapplyChronicleAction(characterId: string, chronicleId: string, _state: ChronicleLifecycleState): Promise<ChronicleLifecycleState> {
  void _state;
  try { await unapplyManualChronicle(await requireAuthenticatedActor(), characterId, chronicleId); }
  catch (error) { return { error: error instanceof ChronicleOrderError ? error.message : "This Chronicle could not be unapplied." }; }
  revalidatePath(`/characters/${characterId}`);
  return {};
}
