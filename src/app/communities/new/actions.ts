"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import {
  CommunityCreationError,
  createCommunity,
  createCommunityInputSchema,
} from "@/community/create-community";

export interface CreateCommunityFormState {
  fieldErrors?: {
    name?: string[];
    requestedSlug?: string[];
  };
  formError?: string;
}

export async function createCommunityAction(
  _previousState: CreateCommunityFormState,
  formData: FormData,
): Promise<CreateCommunityFormState> {
  const parsed = createCommunityInputSchema.safeParse({
    name: formData.get("name"),
    requestedSlug: formData.get("requestedSlug") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let createdSlug: string;
  try {
    const actor = await requireAuthenticatedActor();
    const created = await createCommunity(actor, parsed.data);
    createdSlug = created.slug;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: z.flattenError(error).fieldErrors };
    }
    if (error instanceof CommunityCreationError) {
      return { formError: "We couldn’t create that community. Please try again." };
    }
    if (error instanceof AuthenticationRequiredError) {
      return { formError: "Your session expired. Sign in and try again." };
    }
    return { formError: "We couldn’t create that community. Please try again." };
  }

  redirect(`/communities/${encodeURIComponent(createdSlug)}`);
}
