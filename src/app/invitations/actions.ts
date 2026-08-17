"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAuthenticatedActor } from "@/auth/actor";
import { redeemCommunityInvitationAdmission } from "@/community/request-community-admission";
import { getDb } from "@/db/client";
import { communities } from "@/db/schema";
import type { InvitationRedemptionState } from "./state";

export async function redeemInvitationAction(
  token: string,
  _previous: InvitationRedemptionState,
): Promise<InvitationRedemptionState> {
  void _previous;
  try {
    const actor = await requireAuthenticatedActor();
    const result = await redeemCommunityInvitationAdmission(actor, token);
    if (result.status === "invalid" || result.status === "unavailable") {
      return { error: "This invitation is unavailable." };
    }
    if (result.status === "pending") redirect("/invitations/result?status=pending");
    const [community] = await getDb()
      .select({ slug: communities.slug })
      .from(communities)
      .where(eq(communities.id, result.communityId))
      .limit(1);
    if (!community) return { error: "This invitation is unavailable." };
    redirect(`/communities/${encodeURIComponent(community.slug)}?admission=accepted`);
  } catch (error) {
    // Next redirects are implemented as thrown control-flow errors.
    if (typeof error === "object" && error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    return { error: "This invitation is unavailable." };
  }
}
