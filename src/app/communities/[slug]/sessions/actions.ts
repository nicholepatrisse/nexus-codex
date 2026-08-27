"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import {
  createSessionDraft,
  SessionDraftValidationError,
  sessionDraftInputSchema,
  updateSessionDraft,
} from "@/session/session-drafts";
import { publishSession } from "@/session/publish-session";
import { cancelPublishedSession, updatePublishedSession } from "@/session/published-session";
import { completeSession, saveSessionCharacterNotes } from "@/session/complete-session";

export type SessionDraftFormState = {
  fieldErrors?: Record<string, string[] | undefined>;
  formError?: string;
  success?: string;
  values?: {
    contentItemId: string;
    gmPersonId: string;
    localStartsAt: string;
    localEndsAt: string;
    notes: string;
    locationType: string;
  };
};

export type PublishSessionState = { error?: string };
export type CancelSessionState = { error?: string };
export type CompleteSessionState = { error?: string; saved?: boolean };

function characterNotes(formData: FormData) {
  return formData.getAll("characterId").map((value) => {
    const characterId = String(value);
    const number = (field: string) => Number(formData.get(`${field}:${characterId}`));
    return { characterId, characterLevel: number("characterLevel"), advancementSpeed: formData.get(`advancementSpeed:${characterId}`) === "slow" ? "slow" as const : "standard" as const, xp: number("xp"), creditsMinor: number("creditsMinor"), reputation: number("reputation"), downtime: number("downtime"), gmNotes: String(formData.get(`note:${characterId}`) ?? "").trim().slice(0, 5000) };
  });
}

export async function completeSessionAction(slug: string, sessionId: string, _previous: CompleteSessionState, formData: FormData): Promise<CompleteSessionState> {
  try {
    const result = await completeSession(await requireAuthenticatedActor(), slug, sessionId, characterNotes(formData));
    if (result.status === "forbidden") return { error: "You no longer have permission to complete this session." };
    if (result.status !== "completed") return { error: "This session can no longer be completed." };
    revalidatePath(`/communities/${slug}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    return { error: "The session could not be completed. Please try again." };
  }
  redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}?completed=1`);
}

export async function saveSessionNotesAction(slug: string, sessionId: string, _previous: CompleteSessionState, formData: FormData): Promise<CompleteSessionState> {
  try {
    const result = await saveSessionCharacterNotes(await requireAuthenticatedActor(), slug, sessionId, characterNotes(formData));
    if (result.status !== "updated") return { error: "You no longer have permission to update these Chronicles." };
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    return { error: "The Chronicles could not be saved. Please try again." };
  }
}

function submittedValues(formData: FormData): NonNullable<SessionDraftFormState["values"]> {
  const value = (name: string) => String(formData.get(name) ?? "");
  return {
    contentItemId: value("contentItemId"),
    gmPersonId: value("gmPersonId"),
    localStartsAt: value("localStartsAt"),
    localEndsAt: value("localEndsAt"),
    notes: value("notes"),
    locationType: value("locationType"),
  };
}

function parseForm(formData: FormData) {
  return sessionDraftInputSchema.safeParse({
    contentItemId: formData.get("contentItemId"),
    gmPersonId: formData.get("gmPersonId") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    displayTimeZone: formData.get("displayTimeZone"),
    notes: formData.get("notes") || undefined,
    locationType: formData.get("locationType"),
  });
}

function errorState(
  error: unknown,
  values: NonNullable<SessionDraftFormState["values"]>,
): SessionDraftFormState {
  if (error instanceof z.ZodError) {
    return { fieldErrors: z.flattenError(error).fieldErrors, values };
  }
  if (error instanceof AuthenticationRequiredError) {
    return { formError: "Your session expired. Sign in and try again.", values };
  }
  if (error instanceof SessionDraftValidationError) {
    return { formError: error.message, values };
  }
  return { formError: "The session draft could not be saved. Please try again.", values };
}

export async function createSessionDraftAction(
  slug: string,
  _previous: SessionDraftFormState,
  formData: FormData,
): Promise<SessionDraftFormState> {
  const values = submittedValues(formData);
  const parsed = parseForm(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  let sessionId: string;
  try {
    const result = await createSessionDraft(await requireAuthenticatedActor(), slug, parsed.data);
    if (result.status !== "created") {
      return { formError: "You no longer have permission to create this draft.", values };
    }
    sessionId = result.sessionId;
    revalidatePath(`/communities/${slug}`);
  } catch (error) {
    return errorState(error, values);
  }
  redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}`);
}

export async function updateSessionDraftAction(
  slug: string,
  sessionId: string,
  _previous: SessionDraftFormState,
  formData: FormData,
): Promise<SessionDraftFormState> {
  const values = submittedValues(formData);
  const parsed = parseForm(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  let updated = false;
  try {
    const actor = await requireAuthenticatedActor();
    const draftResult = await updateSessionDraft(
      actor,
      slug,
      sessionId,
      parsed.data,
    );
    const resultStatus = draftResult.status === "not-found"
      ? (await updatePublishedSession(actor, slug, sessionId, parsed.data)).status
      : draftResult.status;
    if (resultStatus !== "updated") {
      return { formError: "You no longer have permission to edit this draft.", values };
    }
    updated = true;
    revalidatePath(`/communities/${slug}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}/edit`);
  } catch (error) {
    return errorState(error, values);
  }
  if (updated) redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}`);
  return { formError: "The session draft could not be saved.", values };
}

export async function cancelSessionAction(slug: string, sessionId: string): Promise<CancelSessionState> {
  try {
    const result = await cancelPublishedSession(await requireAuthenticatedActor(), slug, sessionId);
    if (result.status === "forbidden") return { error: "You no longer have permission to cancel this session." };
    if (result.status !== "cancelled") return { error: "This session can no longer be cancelled." };
    revalidatePath(`/communities/${slug}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    return { error: "The session could not be cancelled. Please try again." };
  }
  redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}`);
}

export async function publishSessionAction(
  slug: string,
  sessionId: string,
  _previous: PublishSessionState,
  _formData: FormData,
): Promise<PublishSessionState> {
  void _previous;
  void _formData;
  try {
    const result = await publishSession(await requireAuthenticatedActor(), slug, sessionId);
    if (result.status === "forbidden") {
      return { error: "You no longer have permission to publish this session." };
    }
    if (result.status !== "published") {
      return { error: "This session can no longer be published." };
    }
    revalidatePath(`/communities/${slug}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { error: "Your session expired. Sign in and try again." };
    }
    return { error: "The session could not be published. Please try again." };
  }
  redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}`);
}
