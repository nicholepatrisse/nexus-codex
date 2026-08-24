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
    const result = await updateSessionDraft(
      await requireAuthenticatedActor(),
      slug,
      sessionId,
      parsed.data,
    );
    if (result.status !== "updated") {
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
  redirect(`/communities/${encodeURIComponent(slug)}?published=1`);
}
