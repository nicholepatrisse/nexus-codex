"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import {
  CommunityLifecycleError,
  changeCommunityLifecycle,
} from "@/community/change-community-lifecycle";
import {
  CommunitySettingsUpdateError,
  updateCommunitySettings,
  updateCommunitySettingsInputSchema,
} from "@/community/update-community-settings";
import type {
  CommunityLifecycleFormState,
  CommunitySettingsFormState,
} from "./state";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";

export async function updateCommunitySettingsAction(
  currentSlug: string,
  _previousState: CommunitySettingsFormState,
  formData: FormData,
): Promise<CommunitySettingsFormState> {
  const parsed = updateCommunitySettingsInputSchema.safeParse({
    name: formData.get("name"),
    requestedSlug: formData.get("requestedSlug"),
    description: formData.get("description") || null,
    eventName: formData.get("eventName") || null,
    eventCode: formData.get("eventCode") || null,
    supportedProgramIds: [SUPPORTED_GAME_SYSTEM.organizedPlayProgramId],
    visibility: formData.get("visibility"),
    membershipApproval: formData.get("membershipApproval"),
    gmAdmission: formData.get("gmAdmission"),
    scheduleVisibility: formData.get("scheduleVisibility"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const actor = await requireAuthenticatedActor();
    const result = await updateCommunitySettings(actor, currentSlug, parsed.data);
    if (result.status !== "updated") {
      return { formError: "You no longer have permission to update this community." };
    }
    revalidatePath("/");
    // Revalidate the profile itself without invalidating the active settings
    // page. Invalidating the route tree here can remount the form with its
    // pre-save server props before the action result reaches the client.
    revalidatePath(`/communities/${currentSlug}`, "page");
    if (result.community.slug !== currentSlug) {
      revalidatePath(`/communities/${result.community.slug}`, "page");
      revalidatePath(`/communities/${result.community.slug}/settings`, "page");
      redirect(`/communities/${encodeURIComponent(result.community.slug)}/settings?saved=1`);
    }
    return {
      success: "Settings saved.",
      saved: {
        slug: result.community.slug,
        visibility: parsed.data.visibility,
        membershipApproval: parsed.data.membershipApproval,
        gmAdmission: parsed.data.gmAdmission,
        scheduleVisibility: parsed.data.scheduleVisibility,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: z.flattenError(error).fieldErrors };
    }
    if (error instanceof AuthenticationRequiredError) {
      return { formError: "Your session expired. Sign in and try again." };
    }
    if (error instanceof CommunitySettingsUpdateError) {
      return { formError: "We couldn’t save those settings. Please try again." };
    }
    throw error;
  }
}

export async function changeCommunityLifecycleAction(
  slug: string,
  action: "archive" | "restore",
  _previousState: CommunityLifecycleFormState,
  formData: FormData,
): Promise<CommunityLifecycleFormState> {
  if (formData.get("confirmation") !== slug) {
    return { formError: `Type ${slug} to confirm.` };
  }

  try {
    const actor = await requireAuthenticatedActor();
    await changeCommunityLifecycle(actor, { slug, action, confirmed: true });
    revalidatePath("/");
    revalidatePath(`/communities/${slug}`);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { formError: "Your session expired. Sign in and try again." };
    }
    if (error instanceof CommunityLifecycleError) {
      return { formError: "That lifecycle change is unavailable. Refresh and try again." };
    }
    throw error;
  }

  redirect(action === "archive" ? `/communities/${encodeURIComponent(slug)}/settings` : `/communities/${encodeURIComponent(slug)}`);
}
