"use server";

import { revalidatePath } from "next/cache";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { communityPreferenceKeys, updateNotificationPreferences } from "@/notifications/preferences";

export interface NotificationPreferencesState { formError?: string; saved?: boolean }

export async function updateNotificationPreferencesAction(
  _previousState: NotificationPreferencesState,
  formData: FormData,
): Promise<NotificationPreferencesState> {
  try {
    const communities = Object.fromEntries(communityPreferenceKeys.map((key) => [key, formData.getAll(key).map(String)])) as Record<typeof communityPreferenceKeys[number], string[]>;
    await updateNotificationPreferences(await requireAuthenticatedActor(), { communities, membershipStatus: formData.get("membershipStatus") === "on" });
    revalidatePath("/", "layout");
    revalidatePath("/profile");
    return { saved: true };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    return { formError: "We couldn’t save your notification preferences. Please try again." };
  }
}
