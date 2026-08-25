"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { cancelOwnSessionSignup, signupForSession } from "@/session/session-signups";

export type SessionSignupActionState = {
  status?: "confirmed" | "waitlisted" | "cancelled";
  waitlistPosition?: number;
  error?: string;
};

export async function signupForSessionAction(
  slug: string,
  sessionId: string,
  _previous: SessionSignupActionState,
  formData: FormData,
): Promise<SessionSignupActionState> {
  void _previous;
  try {
    const characterId = formData.get("characterId");
    if (typeof characterId !== "string" || !characterId) return { error: "Choose a character to sign up." };
    const result = await signupForSession(await requireAuthenticatedActor(), slug, sessionId, characterId);
    if (result.status !== "confirmed" && result.status !== "waitlisted") {
      return { error: "This session is not available for signup." };
    }
    revalidatePath(`/communities/${slug}`);
    return { status: result.status, waitlistPosition: result.waitlistPosition };
  } catch (error) {
    return {
      error: error instanceof AuthenticationRequiredError
        ? "Your session expired. Sign in and try again."
        : "The signup could not be completed. Please try again.",
    };
  }
}

export async function cancelSessionSignupAction(
  slug: string,
  sessionId: string,
  _previous: SessionSignupActionState,
  _formData: FormData,
): Promise<SessionSignupActionState> {
  void _previous;
  void _formData;
  try {
    const result = await cancelOwnSessionSignup(await requireAuthenticatedActor(), slug, sessionId);
    if (result.status !== "cancelled") return { error: "This signup can no longer be cancelled." };
    revalidatePath(`/communities/${slug}`);
    return { status: "cancelled" };
  } catch (error) {
    return {
      error: error instanceof AuthenticationRequiredError
        ? "Your session expired. Sign in and try again."
        : "The signup could not be cancelled. Please try again.",
    };
  }
}
