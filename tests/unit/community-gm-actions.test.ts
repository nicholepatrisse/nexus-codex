import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: { personId: "person-one", authUserId: "user-one", sessionId: "session-one" },
  revalidatePath: vi.fn(),
  request: vi.fn(),
  cancel: vi.fn(),
  decide: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/auth/actor", () => ({ requireAuthenticatedActor: vi.fn(async () => mocks.actor) }));
vi.mock("@/community/community-gm-admission", () => ({
  requestCommunityGmAdmission: mocks.request,
  cancelCommunityGmAdmission: mocks.cancel,
  decideCommunityGmAdmission: mocks.decide,
}));
vi.mock("@/community/revoke-community-gm-grant", () => ({
  noPersistedFutureGmSessions: vi.fn(async () => ({ status: "clear" })),
  revokeCommunityGmGrant: mocks.revoke,
}));

import { cancelGmAction, requestGmAction } from "@/app/communities/[slug]/gm-actions";
import { decideGmAction, revokeGmAction } from "@/app/communities/[slug]/settings/gm-actions";

describe("community GM server actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits and cancels a member request with profile revalidation", async () => {
    mocks.request.mockResolvedValue({ status: "pending", requestId: "request-one", communityId: "community-one" });
    mocks.cancel.mockResolvedValue({ status: "cancelled", requestId: "request-one" });

    await expect(requestGmAction("lodge", {})).resolves.toMatchObject({ status: "pending" });
    await expect(cancelGmAction("lodge", "request-one", {})).resolves.toMatchObject({ status: "cancelled" });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/communities/lodge");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/communities/lodge");
  });

  it("returns safe member errors for stale and failed requests", async () => {
    mocks.request.mockResolvedValue({ status: "not-found" });
    mocks.cancel.mockRejectedValue(new Error("private detail"));

    await expect(requestGmAction("private-lodge", {})).resolves.toEqual({ error: "GM admission is not available." });
    await expect(cancelGmAction("private-lodge", "missing", {})).resolves.toEqual({ error: "We couldn’t cancel that GM request. Please try again." });
  });

  it("approves and rejects requests while refreshing profile and settings", async () => {
    mocks.decide.mockResolvedValueOnce({ status: "approved", requestId: "request-one" }).mockResolvedValueOnce({ status: "rejected", requestId: "request-two" });

    await expect(decideGmAction("lodge", "request-one", "approve", {})).resolves.toEqual({ success: "GM access approved." });
    await expect(decideGmAction("lodge", "request-two", "reject", {})).resolves.toEqual({ success: "GM request rejected." });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("maps stale, blocked, repeated, and completed revocations safely", async () => {
    mocks.revoke
      .mockResolvedValueOnce({ status: "not-found" })
      .mockResolvedValueOnce({ status: "blocked", impact: { status: "affected", futureSessionIds: ["secret-session"] } })
      .mockResolvedValueOnce({ status: "unchanged", grantId: "grant-one" })
      .mockResolvedValueOnce({ status: "revoked", grantId: "grant-two" });

    await expect(revokeGmAction("lodge", "missing", {})).resolves.toEqual({ error: "That GM grant is no longer available." });
    await expect(revokeGmAction("lodge", "grant-one", {})).resolves.toEqual({ error: "Resolve future game assignments before changing this GM’s access." });
    await expect(revokeGmAction("lodge", "grant-one", {})).resolves.toEqual({ success: "GM access was already revoked." });
    await expect(revokeGmAction("lodge", "grant-two", {})).resolves.toEqual({ success: "GM access revoked." });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });
});
