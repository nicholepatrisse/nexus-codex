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
import { completeSession, markSessionReportedToPaizo, saveSessionCharacterNotes, saveSessionReporting } from "@/session/complete-session";
import { DuplicateChronicleError } from "@/character/chronicles";
import { attachChronicleSheet } from "@/session/chronicle-sheets";
import { addPaizoScenario, previewPaizoScenario } from "@/catalog/add-paizo-scenario";
import { societyPlayNumberSchema, updateSocietyPlayNumber } from "@/profile/profile";

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
export type ScenarioLookupState = { error?: string; scenario?: { code: string; title: string; sourceUrl: string; minimumLevel: number; maximumLevel: number; productCode: string | null }; contentItemId?: string; existing?: boolean };
export type SessionSocietyNumberState = { fieldError?: string; formError?: string };

export async function addSessionSocietyNumberAction(slug: string, _state: SessionSocietyNumberState, formData: FormData): Promise<SessionSocietyNumberState> {
  const parsed = societyPlayNumberSchema.safeParse(formData.get("societyPlayNumber"));
  if (!parsed.success) return { fieldError: parsed.error.issues[0]?.message ?? "Enter your numeric society number." };
  try { await updateSocietyPlayNumber(await requireAuthenticatedActor(), parsed.data); }
  catch (error) { return { formError: error instanceof AuthenticationRequiredError ? "Your session expired. Sign in and try again." : "We couldn’t save your society number. Please try again." }; }
  revalidatePath(`/communities/${slug}/sessions/new`);
  redirect(`/communities/${slug}/sessions/new`);
}

function scenarioError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return "Your session expired. Sign in and try again.";
  return error instanceof Error ? error.message : "The Paizo scenario could not be fetched.";
}

export async function previewPaizoScenarioAction(slug: string, url: string): Promise<ScenarioLookupState> {
  try {
    const result = await previewPaizoScenario(await requireAuthenticatedActor(), slug, url);
    if (result.status === "forbidden") return { error: "Only an authorized community GM can add scenarios." };
    if (result.status === "not-found") return { error: "This community does not support that scenario catalog." };
    return { scenario: result.scenario, contentItemId: result.status === "existing" ? result.contentItemId : undefined, existing: result.status === "existing" };
  } catch (error) { return { error: scenarioError(error) }; }
}

export async function addPaizoScenarioAction(slug: string, url: string): Promise<ScenarioLookupState> {
  try {
    const result = await addPaizoScenario(await requireAuthenticatedActor(), slug, url);
    if (result.status === "forbidden") return { error: "Only an authorized community GM can add scenarios." };
    if (result.status === "not-found") return { error: "This community does not support that scenario catalog." };
    if (result.status === "ready") return { error: "The scenario was not added. Please try again." };
    revalidatePath(`/communities/${slug}/sessions/new`);
    return { scenario: result.scenario, contentItemId: result.contentItemId, existing: result.status === "existing" };
  } catch (error) { return { error: scenarioError(error) }; }
}

function characterNotes(formData: FormData) {
  return formData.getAll("characterId").map((value) => {
    const characterId = String(value);
    const number = (field: string) => Number(formData.get(`${field}:${characterId}`));
    const optionalNumber = (field: string) => formData.get(`${field}:${characterId}`) === "" ? null : number(field);
    const text = (field: string, max = 200) => String(formData.get(`${field}:${characterId}`) ?? formData.get(field) ?? "").trim().slice(0, max);
    const disposition = formData.get(`downtimeDisposition:${characterId}`) as "earn_income" | "other" | "declined" | null;
    const proficiency = formData.get(`downtimeProficiency:${characterId}`) as "trained" | "expert" | "master" | null;
    return { characterId, characterLevel: number("characterLevel"), advancementSpeed: formData.get(`advancementSpeed:${characterId}`) === "slow" ? "slow" as const : "standard" as const, xp: number("xp"), baseCreditsMinor: number("baseCreditsMinor"), downtimeDisposition: disposition === "earn_income" || disposition === "other" ? disposition : "declined" as const, downtimeCheckTotal: optionalNumber("downtimeCheckTotal"), downtimeProficiency: proficiency === "trained" || proficiency === "expert" || proficiency === "master" ? proficiency : null, downtimeOverrideCreditsMinor: optionalNumber("downtimeOverrideCreditsMinor"), downtimeCorrectionNote: text("downtimeCorrectionNote", 1000), downtimeActivity: text("downtimeActivity"), partnerCode: text("partnerCode", 100), eventName: text("eventName"), eventCode: text("eventCode", 100).replaceAll(",", ""), gmOrganizedPlayId: text("gmOrganizedPlayId", 100), gmNotes: text("note", 5000) };
  });
}

export async function completeSessionAction(slug: string, sessionId: string, _previous: CompleteSessionState, formData: FormData): Promise<CompleteSessionState> {
  try {
    const result = await saveSessionReporting(await requireAuthenticatedActor(), slug, sessionId, characterNotes(formData));
    if (result.status === "forbidden") return { error: "You no longer have permission to save reporting." };
    if (result.status !== "saved") return { error: "This reporting can no longer be saved." };
    revalidatePath(`/communities/${slug}`);
    revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    if (error instanceof DuplicateChronicleError) return { error: error.message };
    return { error: "The reporting could not be saved. Please try again." };
  }
  redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}?reporting=saved`);
}

export async function attachChronicleSheetAction(slug: string, sessionId: string, chronicleId: string, formData: FormData) {
  const file = formData.get("sheet");
  if (!(file instanceof File)) return;
  await attachChronicleSheet(await requireAuthenticatedActor(), slug, sessionId, chronicleId, file);
  revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
}

export async function finalizeSessionAction(slug: string, sessionId: string) {
  const result = await completeSession(await requireAuthenticatedActor(), slug, sessionId);
  if (result.status !== "completed") return;
  revalidatePath(`/communities/${slug}`);
  redirect(`/communities/${encodeURIComponent(slug)}/sessions/${sessionId}?completed=1`);
}

export async function markSessionReportedToPaizoAction(slug: string, sessionId: string) {
  const result = await markSessionReportedToPaizo(await requireAuthenticatedActor(), slug, sessionId);
  if (result.status !== "reported") return;
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath(`/communities/${slug}`);
  revalidatePath(`/communities/${slug}/sessions/${sessionId}`);
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
