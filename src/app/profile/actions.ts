"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { updateProfile, updateProfileInputSchema } from "@/profile/profile";

export interface ProfileFormState {
  fieldErrors?: Record<string, string[] | undefined>;
  formError?: string;
  saved?: boolean;
}

export async function updateProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = updateProfileInputSchema.safeParse({
    displayName: formData.get("displayName"),
    discordHandle: formData.get("discordHandle"),
    societyPlayNumber: formData.get("societyPlayNumber"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await updateProfile(await requireAuthenticatedActor(), parsed.data);
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { formError: "Your session expired. Sign in and try again." };
    }
    return { formError: "We couldn’t save your profile. Please try again." };
  }
}
