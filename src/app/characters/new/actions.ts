"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { CharacterCreationError, createCharacter, createCharacterInputSchema } from "@/character/characters";
import { societyPlayNumberSchema, updateSocietyPlayNumber } from "@/profile/profile";
export interface CreateCharacterFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }
export async function createCharacterAction(_state: CreateCharacterFormState, formData: FormData): Promise<CreateCharacterFormState> {
  const parsed = createCharacterInputSchema.safeParse({ name: formData.get("name"), characterNumber: formData.get("characterNumber") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try { await createCharacter(await requireAuthenticatedActor(), parsed.data); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    if (error instanceof CharacterCreationError) return { formError: error.message };
    return { formError: "We couldn’t create that character. Please try again." };
  }
  redirect("/characters");
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
