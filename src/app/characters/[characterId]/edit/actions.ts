"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { updateCharacter, updateCharacterInputSchema } from "@/character/characters";

export interface EditCharacterFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }

export async function updateCharacterAction(characterId: string, _state: EditCharacterFormState, formData: FormData): Promise<EditCharacterFormState> {
  const parsed = updateCharacterInputSchema.safeParse({ name: formData.get("name"), level: formData.get("level"), className: formData.get("className"), ancestry: formData.get("ancestry"), background: formData.get("background"), backstory: formData.get("backstory"), notes: formData.get("notes") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const updated = await updateCharacter(await requireAuthenticatedActor(), characterId, parsed.data);
    if (!updated) return { formError: "You do not have permission to edit this character." };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: "We couldn’t update that character. Please try again." };
  }
  redirect(`/characters/${characterId}`);
}
