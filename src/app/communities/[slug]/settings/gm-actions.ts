"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedActor } from "@/auth/actor";
import { noPersistedFutureGmSessions, revokeCommunityGmGrant } from "@/community/revoke-community-gm-grant";
import { decideCommunityGmAdmission } from "@/community/community-gm-admission";
import type { OwnerGmActionState } from "./gm-state";

function refresh(slug: string) {
  revalidatePath(`/communities/${slug}`);
  revalidatePath(`/communities/${slug}/settings`);
}

export async function decideGmAction(slug: string, requestId: string, decision: "approve" | "reject", _previous: OwnerGmActionState): Promise<OwnerGmActionState> {
  void _previous;
  try {
    const result = await decideCommunityGmAdmission(await requireAuthenticatedActor(), slug, requestId, { decision });
    if (result.status === "not-found") return { error: "That GM request is no longer available." };
    refresh(slug);
    return { success: decision === "approve" ? "GM access approved." : "GM request rejected." };
  } catch {
    return { error: "That GM decision could not be saved." };
  }
}

export async function revokeGmAction(slug: string, grantId: string, _previous: OwnerGmActionState): Promise<OwnerGmActionState> {
  void _previous;
  try {
    const result = await revokeCommunityGmGrant(await requireAuthenticatedActor(), slug, grantId, {}, { inspectFutureSessions: noPersistedFutureGmSessions });
    if (result.status === "not-found") return { error: "That GM grant is no longer available." };
    if (result.status === "blocked") return { error: "Resolve future game assignments before changing this GM’s access." };
    refresh(slug);
    if (result.status === "unchanged") return { success: "GM access was already revoked." };
    return { success: "GM access revoked." };
  } catch {
    return { error: "That GM access change could not be saved." };
  }
}
