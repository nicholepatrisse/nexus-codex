import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestIdentity } from "@/auth/test-fixture";
import type { AuthenticatedActor } from "@/auth/actor";
import {
  acceptInvitationForAdmission,
  createCommunityInvitation,
  listCommunityInvitations,
  revokeCommunityInvitation,
} from "@/community/community-invitations";
import { createCommunity } from "@/community/create-community";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityAuditEvents,
  communityInvitations,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = crypto.randomUUID();
let communityId: string;
let communitySlug: string;
let owner: AuthenticatedActor;
let recipient: AuthenticatedActor;
let outsider: AuthenticatedActor;
const authUserIds: string[] = [];

describeWithDatabase("community invitations", () => {
  beforeAll(async () => {
    const identities = await Promise.all([
      createTestIdentity({
        subject: `invitation-owner-${suffix}`,
        email: `Invitation.Owner.${suffix}@fixture.invalid`,
        sessions: 0,
      }),
      createTestIdentity({
        subject: `invitation-recipient-${suffix}`,
        email: `Invitation.Recipient.${suffix}@fixture.invalid`,
        sessions: 0,
      }),
      createTestIdentity({
        subject: `invitation-outsider-${suffix}`,
        email: `invitation.outsider.${suffix}@fixture.invalid`,
        sessions: 0,
      }),
    ]);
    authUserIds.push(...identities.map(({ authUser }) => authUser.id));
    [owner, recipient, outsider] = identities.map(({ authUser, person }) => ({
      authUserId: authUser.id,
      personId: person.id,
      sessionId: `test-${suffix}`,
    })) as [AuthenticatedActor, AuthenticatedActor, AuthenticatedActor];
    const created = await createCommunity(
      { personId: owner.personId },
      { name: `Invitation Lodge ${suffix}` },
    );
    communityId = created.id;
    communitySlug = created.slug;
  });

  afterAll(async () => {
    if (!communityId) return;
    await getDb().delete(communityAuditEvents).where(eq(communityAuditEvents.communityId, communityId));
    await getDb().delete(communityInvitations).where(eq(communityInvitations.communityId, communityId));
    await getDb().delete(communityRoleGrants).where(eq(communityRoleGrants.communityId, communityId));
    await getDb().delete(communityMemberships).where(eq(communityMemberships.communityId, communityId));
    await getDb().delete(communities).where(eq(communities.id, communityId));
    await getDb().delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  it("authorizes freshly, normalizes the recipient, and stores only a token digest", async () => {
    const result = await createCommunityInvitation(
      owner,
      communitySlug,
      { recipientEmail: ` INVITATION.RECIPIENT.${suffix}@fixture.invalid ` },
      { now: new Date("2026-08-17T20:00:00Z") },
    );
    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const [stored] = await getDb()
      .select()
      .from(communityInvitations)
      .where(eq(communityInvitations.id, result.invitation.id));
    expect(stored?.recipientEmail).toBe(`invitation.recipient.${suffix}@fixture.invalid`);
    expect(stored?.tokenHash).toBe(
      createHash("sha256").update(result.token, "utf8").digest("hex"),
    );
    expect(JSON.stringify(stored)).not.toContain(result.token);

    const list = await listCommunityInvitations(owner, communitySlug);
    expect(list.status).toBe("found");
    expect(JSON.stringify(list)).not.toContain(stored?.tokenHash);

    const duplicate = await createCommunityInvitation(owner, communitySlug, {
      recipientEmail: `invitation.recipient.${suffix}@fixture.invalid`,
    });
    expect(duplicate.status).toBe("already-pending");
    expect(duplicate).not.toHaveProperty("token");
  });

  it("does not let a non-owner create, list, or revoke invitations", async () => {
    const createResult = await createCommunityInvitation(outsider, communitySlug, {
      recipientEmail: `blocked.${suffix}@fixture.invalid`,
    });
    expect(createResult.status).toBe("not-found");
    expect((await listCommunityInvitations(outsider, communitySlug)).status).toBe("not-found");
    expect(
      (await revokeCommunityInvitation(outsider, communitySlug, crypto.randomUUID())).status,
    ).toBe("not-found");
  });

  it("binds tokens to the intended account and accepts same-person replay idempotently", async () => {
    const created = await createCommunityInvitation(owner, communitySlug, {
      recipientEmail: `replay.${suffix}@fixture.invalid`,
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    await getDb()
      .update(authUsers)
      .set({ email: `replay.${suffix}@fixture.invalid` })
      .where(eq(authUsers.id, recipient.authUserId));
    expect(await acceptInvitationForAdmission(created.token, outsider)).toEqual({ status: "invalid" });
    const accepted = await acceptInvitationForAdmission(created.token, recipient);
    expect(accepted).toEqual({
      status: "accepted",
      invitation: { id: created.invitation.id, communityId },
    });
    expect(await acceptInvitationForAdmission(created.token, recipient)).toEqual({
      status: "accepted",
      invitation: { id: created.invitation.id, communityId },
    });

    const acceptanceEvents = await getDb()
      .select()
      .from(communityAuditEvents)
      .where(
        and(
          eq(communityAuditEvents.communityId, communityId),
          eq(communityAuditEvents.eventType, "community.invitation.accepted"),
        ),
      );
    expect(acceptanceEvents).toHaveLength(1);
  });

  it("rejects revoked and expired tokens without disclosing their state", async () => {
    const revoked = await createCommunityInvitation(owner, communitySlug, {
      recipientEmail: `revoked.${suffix}@fixture.invalid`,
    });
    expect(revoked.status).toBe("created");
    if (revoked.status !== "created") return;
    expect(
      (await revokeCommunityInvitation(owner, communitySlug, revoked.invitation.id, {
        reason: "Sent to the wrong address",
      })).status,
    ).toBe("revoked");
    expect(await acceptInvitationForAdmission(revoked.token, recipient)).toEqual({ status: "invalid" });

    const now = new Date("2026-08-17T20:00:00Z");
    const expiring = await createCommunityInvitation(
      owner,
      communitySlug,
      {
        recipientEmail: `expired.${suffix}@fixture.invalid`,
        expiresAt: new Date(now.getTime() + 1_000),
      },
      { now },
    );
    expect(expiring.status).toBe("created");
    if (expiring.status !== "created") return;
    await getDb()
      .update(authUsers)
      .set({ email: `expired.${suffix}@fixture.invalid` })
      .where(eq(authUsers.id, recipient.authUserId));
    expect(
      await acceptInvitationForAdmission(
        expiring.token,
        recipient,
        getDb(),
        new Date(now.getTime() + 2_000),
      ),
    ).toEqual({ status: "invalid" });
    const [stored] = await getDb()
      .select({ status: communityInvitations.status })
      .from(communityInvitations)
      .where(eq(communityInvitations.id, expiring.invitation.id));
    expect(stored?.status).toBe("expired");
  });

  it("expires an elapsed invitation instead of recording it as revoked", async () => {
    const now = new Date("2026-08-17T20:00:00Z");
    const created = await createCommunityInvitation(
      owner,
      communitySlug,
      {
        recipientEmail: `expire-before-revoke.${suffix}@fixture.invalid`,
        expiresAt: new Date(now.getTime() + 1_000),
      },
      { now },
    );
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    await expect(
      revokeCommunityInvitation(
        owner,
        communitySlug,
        created.invitation.id,
        {},
        { now: new Date(now.getTime() + 2_000) },
      ),
    ).resolves.toEqual({ status: "not-found" });
    const [stored] = await getDb()
      .select({ status: communityInvitations.status })
      .from(communityInvitations)
      .where(eq(communityInvitations.id, created.invitation.id));
    expect(stored?.status).toBe("expired");
  });
});
