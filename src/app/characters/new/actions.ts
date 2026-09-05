"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { CharacterCreationError, createCharacter, createCharacterInputSchema } from "@/character/characters";
import { resolveCharacterCreationReturnTo } from "@/character/character-creation-return";
import { societyPlayNumberSchema, updateSocietyPlayNumber } from "@/profile/profile";
import { characterOptionSelectionInputSchema, replaceCharacterOptionSelections } from "@/character/option-selections";
export interface CreateCharacterFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }
export async function createCharacterAction(_state: CreateCharacterFormState, formData: FormData): Promise<CreateCharacterFormState> {
  let startingItems: unknown = [];
  let characterOptions: unknown = [];
  try { startingItems = JSON.parse(String(formData.get("startingItems") ?? "[]")); } catch { /* schema reports the error */ }
  try { characterOptions = JSON.parse(String(formData.get("characterOptions") ?? "[]")); } catch { return { fieldErrors: { characterOptions: ["The heritage and feat selections could not be read."] } }; }
  const parsedOptions = z.array(characterOptionSelectionInputSchema).max(100).safeParse(characterOptions);
  if (!parsedOptions.success) return { fieldErrors: { characterOptions: parsedOptions.error.issues.map(({ message }) => message) } };
  const parsed = createCharacterInputSchema.safeParse({ name: formData.get("name"), characterNumber: formData.get("characterNumber"), startingLevel: formData.get("startingLevel"), startingCredits: formData.get("startingCredits"), startingItems, idempotencyKey: formData.get("idempotencyKey"), className: formData.get("className"), classValidationNote: formData.get("classValidationNote"), ancestry: formData.get("ancestry"), ancestryValidationNote: formData.get("ancestryValidationNote"), background: formData.get("background"), backgroundValidationNote: formData.get("backgroundValidationNote"), backstory: formData.get("backstory"), notes: formData.get("notes") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  let destination: string | null = null;
  try {
    const actor = await requireAuthenticatedActor();
    const character = await createCharacter(actor, parsed.data);
    await replaceCharacterOptionSelections(actor, character.id, parsedOptions.data);
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
