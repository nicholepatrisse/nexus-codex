"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { cancelOwnSessionSignup, signupForSession, updateOwnSessionSignup } from "@/session/session-signups";

function signupChoice(formData: FormData) {
  const kind = formData.get("signupKind");
  if (kind === "pregen") {
    const pregenName = formData.get("pregenName");
    const pregenLevel = Number(formData.get("pregenLevel"));
    const creditRecipientCharacterId = formData.get("creditRecipientCharacterId");
    if (typeof pregenName !== "string" || !pregenName || !Number.isInteger(pregenLevel) || typeof creditRecipientCharacterId !== "string" || !creditRecipientCharacterId) return null;
    return { kind, pregenName, pregenLevel, creditRecipientCharacterId } as const;
  }
  const characterId = formData.get("characterId");
  return typeof characterId === "string" && characterId ? { kind: "character" as const, characterId } : null;
}

export type SessionSignupActionState = {
  status?: "confirmed" | "waitlisted" | "cancelled" | "updated";
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
    const choice = signupChoice(formData);
    if (!choice) return { error: "Choose who you are playing and, for a pregen, where the credit goes." };
    const result = await signupForSession(await requireAuthenticatedActor(), slug, sessionId, choice);
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

export async function updateSessionSignupAction(
  slug: string,
  sessionId: string,
  _previous: SessionSignupActionState,
  formData: FormData,
): Promise<SessionSignupActionState> {
  void _previous;
  try {
    const choice = signupChoice(formData);
    if (!choice) return { error: "Choose who you are playing and, for a pregen, where the credit goes." };
    const result = await updateOwnSessionSignup(await requireAuthenticatedActor(), slug, sessionId, choice);
    if (result.status !== "updated") return { error: "This signup can no longer be edited." };
    revalidatePath(`/communities/${slug}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
    return { status: "updated" };
  } catch (error) {
    return { error: error instanceof AuthenticationRequiredError
      ? "Your session expired. Sign in and try again."
      : "The signup could not be updated. Please try again." };
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
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
    return { status: "cancelled" };
  } catch (error) {
    return {
      error: error instanceof AuthenticationRequiredError
        ? "Your session expired. Sign in and try again."
        : "The signup could not be cancelled. Please try again.",
    };
  }
}
