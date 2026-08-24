"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedActor } from "@/auth/actor";
import {
  cancelCommunityGmAdmission,
  requestCommunityGmAdmission,
} from "@/community/community-gm-admission";
import type { GmActionState } from "./gm-state";

export async function requestGmAction(
  slug: string,
  _previous: GmActionState,
): Promise<GmActionState> {
  void _previous;
  try {
    const result = await requestCommunityGmAdmission(await requireAuthenticatedActor(), slug);
    if (result.status !== "pending") return { error: "GM admission is not available." };
    revalidatePath(`/communities/${slug}`);
    return { status: "pending", message: "Your GM request is awaiting owner review." };
  } catch {
    return { error: "We couldn’t submit that GM request. Please try again." };
  }
}

export async function cancelGmAction(
  slug: string,
  requestId: string,
  _previous: GmActionState,
): Promise<GmActionState> {
  void _previous;
  try {
    const result = await cancelCommunityGmAdmission(await requireAuthenticatedActor(), requestId);
    if (result.status !== "cancelled") return { error: "That GM request is no longer available." };
    revalidatePath(`/communities/${slug}`);
    return { status: "cancelled", message: "Your GM request was cancelled." };
  } catch {
    return { error: "We couldn’t cancel that GM request. Please try again." };
  }
}
