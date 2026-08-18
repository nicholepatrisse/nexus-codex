"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedActor } from "@/auth/actor";
import { createCommunityInvitation, revokeCommunityInvitation } from "@/community/community-invitations";
import { decideCommunityAdmission } from "@/community/decide-community-admission";
import type { OwnerAdmissionState } from "./admission-state";

function refresh(slug: string) {
  revalidatePath(`/communities/${slug}/settings`);
}

export async function createInvitationAction(slug: string, _previous: OwnerAdmissionState, formData: FormData): Promise<OwnerAdmissionState> {
  try {
    const actor = await requireAuthenticatedActor();
    const rawMaxUses = String(formData.get("maxUses") ?? "1");
    const result = await createCommunityInvitation(actor, slug, {
      maxUses: rawMaxUses === "unlimited" ? null : Number(rawMaxUses),
    });
    if (result.status === "created") {
      refresh(slug);
      return { success: "Sharing link created. Copy it now; it won’t be shown again.", invitationPath: `/invitations/${result.token}` };
    }
    return { error: "That invitation could not be created." };
  } catch {
    return { error: "That sharing link could not be created. Check the usage limit and try again." };
  }
}

export async function revokeInvitationAction(slug: string, invitationId: string, _previous: OwnerAdmissionState): Promise<OwnerAdmissionState> {
  void _previous;
  try {
    const actor = await requireAuthenticatedActor();
    const result = await revokeCommunityInvitation(actor, slug, invitationId);
    if (result.status !== "revoked") return { error: "That invitation is no longer available." };
    refresh(slug);
    return { success: "Invitation revoked." };
  } catch {
    return { error: "That invitation could not be revoked." };
  }
}

export async function decideAdmissionAction(slug: string, requestId: string, decision: "approve" | "reject", _previous: OwnerAdmissionState, formData: FormData): Promise<OwnerAdmissionState> {
  try {
    const actor = await requireAuthenticatedActor();
    const result = await decideCommunityAdmission(actor, slug, requestId, { decision, reason: String(formData.get("reason") ?? "") });
    if (result.status === "not-found") return { error: "That request is no longer available." };
    refresh(slug);
    return { success: decision === "approve" ? "Membership approved." : "Membership request rejected." };
  } catch {
    return { error: "That decision could not be saved." };
  }
}
