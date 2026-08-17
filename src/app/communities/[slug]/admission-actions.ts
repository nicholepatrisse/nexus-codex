"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedActor } from "@/auth/actor";
import { cancelCommunityAdmission } from "@/community/decide-community-admission";
import { requestCommunityAdmission } from "@/community/request-community-admission";
import type { AdmissionActionState } from "./admission-state";

export async function requestAdmissionAction(
  slug: string,
  _previous: AdmissionActionState,
): Promise<AdmissionActionState> {
  void _previous;
  try {
    const actor = await requireAuthenticatedActor();
    const result = await requestCommunityAdmission(actor, slug);
    revalidatePath(`/communities/${slug}`);
    if (result.status === "admitted" || result.status === "already-member") {
      return { status: "admitted", message: "You’re now a member." };
    }
    if (result.status === "pending") {
      return { status: "pending", requestId: result.requestId ?? undefined, message: "Your request is awaiting review." };
    }
    return { error: "This request is unavailable. Refresh and try again." };
  } catch {
    return { error: "We couldn’t submit that request. Please try again." };
  }
}

export async function cancelAdmissionAction(
  slug: string,
  requestId: string,
  _previous: AdmissionActionState,
): Promise<AdmissionActionState> {
  void _previous;
  try {
    const actor = await requireAuthenticatedActor();
    const result = await cancelCommunityAdmission(actor, requestId);
    if (result.status !== "cancelled") {
      return { error: "This request is unavailable. Refresh and try again." };
    }
    revalidatePath(`/communities/${slug}`);
    return { status: "cancelled", message: "Your membership request was cancelled." };
  } catch {
    return { error: "We couldn’t cancel that request. Please try again." };
  }
}
