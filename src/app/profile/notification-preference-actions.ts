"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { updateCommunityNotificationPreferences } from "@/notifications/preferences";

export interface NotificationPreferencesState { formError?: string; saved?: boolean; enabledCommunityIds?: string[] }

export async function updateNotificationPreferencesAction(
  _previousState: NotificationPreferencesState,
  formData: FormData,
): Promise<NotificationPreferencesState> {
  try {
    const enabledCommunityIds = formData.getAll("enabledCommunityId").map(String);
    await updateCommunityNotificationPreferences(await requireAuthenticatedActor(), enabledCommunityIds);
    revalidatePath("/", "layout");
    revalidatePath("/profile");
    return { saved: true, enabledCommunityIds };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: "We couldn’t save your notification preferences. Please try again." };
  }
}
