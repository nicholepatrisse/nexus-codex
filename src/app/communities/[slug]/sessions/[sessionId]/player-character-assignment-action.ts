"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { assignSignupCharacterAsGm } from "@/session/session-signups";

export async function assignPlayerCharacterAction(slug: string, sessionId: string, signupId: string, _state: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const characterId = formData.get("characterId");
  if (typeof characterId !== "string" || !characterId) return { error: "Choose a character." };
  try {
    const result = await assignSignupCharacterAsGm(await requireAuthenticatedActor(), slug, sessionId, signupId, characterId);
    if (result.status !== "updated") return { error: "You cannot assign that character to this player." };
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
    revalidatePath(`/characters/${characterId}`);
    return {};
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    return { error: "The character could not be assigned. Please try again." };
  }
}
