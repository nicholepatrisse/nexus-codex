"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { CharacterCreationError, createCharacter, createCharacterInputSchema } from "@/character/characters";
import { resolveCharacterCreationReturnTo } from "@/character/character-creation-return";
import { societyPlayNumberSchema, updateSocietyPlayNumber } from "@/profile/profile";
import { characterOptionSelectionInputSchema } from "@/character/option-selections";
import { previewPathmuncherImportAction } from "@/app/characters/pathmuncher-import-actions";
import { getDb } from "@/db/client";
export interface CreateCharacterFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }
export async function createCharacterAction(_state: CreateCharacterFormState, formData: FormData): Promise<CreateCharacterFormState> {
  let startingItems: unknown = [];
  let characterOptions: unknown = [];
  let importApproval: { sourceJson: string; digest: string } | null = null;
  try { startingItems = JSON.parse(String(formData.get("startingItems") ?? "[]")); } catch { /* schema reports the error */ }
  try { characterOptions = JSON.parse(String(formData.get("characterOptions") ?? "[]")); } catch { return { fieldErrors: { characterOptions: ["The heritage and feat selections could not be read."] } }; }
  try { importApproval = formData.get("importApproval") ? JSON.parse(String(formData.get("importApproval"))) : null; } catch { return { formError: "The approved import could not be verified. Review it again." }; }
  const parsedOptions = z.array(characterOptionSelectionInputSchema).max(100).safeParse(characterOptions);
  if (!parsedOptions.success) return { fieldErrors: { characterOptions: parsedOptions.error.issues.map(({ message }) => message) } };
  const parsed = createCharacterInputSchema.safeParse({ name: formData.get("name"), characterNumber: formData.get("characterNumber"), startingLevel: formData.get("startingLevel"), startingCredits: formData.get("startingCredits"), startingItems, idempotencyKey: formData.get("idempotencyKey"), className: formData.get("className"), classValidationNote: formData.get("classValidationNote"), ancestry: formData.get("ancestry"), ancestryValidationNote: formData.get("ancestryValidationNote"), background: formData.get("background"), backgroundValidationNote: formData.get("backgroundValidationNote"), backstory: formData.get("backstory"), notes: formData.get("notes"), characterSheetUrl: formData.get("characterSheetUrl") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  let destination: string | null = null;
  try {
    const actor = await requireAuthenticatedActor();
    let importMetadata: { adapterVersion: number; digest: string } | undefined;
    if (importApproval) {
      const refreshed = await previewPathmuncherImportAction(importApproval.sourceJson);
      if (!refreshed.ok || refreshed.preview.approval.digest !== importApproval.digest) return { formError: "The catalog or import payload changed. Review the import again before creating the character." };
      const proposed = refreshed.preview.proposed;
      const approvedOptions = z.array(characterOptionSelectionInputSchema).parse(proposed.options);
      if (JSON.stringify({ name: parsed.data.name, className: parsed.data.className ?? "", ancestry: parsed.data.ancestry ?? "", background: parsed.data.background ?? "", options: parsedOptions.data }) !== JSON.stringify({ name: proposed.name, className: proposed.className, ancestry: proposed.ancestry, background: proposed.background, options: approvedOptions })) return { formError: "Imported values changed after approval. Review the import again before creating the character." };
      importMetadata = { adapterVersion: 1, digest: importApproval.digest };
    }
    await createCharacter(actor, parsed.data, getDb(), parsedOptions.data, importMetadata);
    destination = await resolveCharacterCreationReturnTo(formData.get("returnTo"), actor).catch(() => null);
  }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    if (error instanceof CharacterCreationError) return { formError: error.message };
    return { formError: "We couldn’t create that character. Please try again." };
  }
  redirect(destination ?? "/characters");
}

export interface SocietyNumberFormState { fieldErrors?: { societyPlayNumber?: string[] }; formError?: string; savedNumber?: string }
export async function saveSocietyNumberAction(_state: SocietyNumberFormState, formData: FormData): Promise<SocietyNumberFormState> {
  const parsed = societyPlayNumberSchema.safeParse(formData.get("societyPlayNumber"));
  if (!parsed.success) return { fieldErrors: { societyPlayNumber: parsed.error.issues.map(({ message }) => message) } };
  try {
    return { savedNumber: await updateSocietyPlayNumber(await requireAuthenticatedActor(), parsed.data) };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: "We couldn’t save your society number. Please try again." };
  }
}
