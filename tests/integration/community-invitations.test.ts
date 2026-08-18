import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
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
const tokenSecret = `invitation-test-secret-${suffix}`;
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

  it("authorizes freshly and stores only a token digest with the selected use limit", async () => {
    const result = await createCommunityInvitation(
      owner,
      communitySlug,
      { maxUses: null },
      { now: new Date("2026-08-17T20:00:00Z"), tokenSecret },
    );
    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const [stored] = await getDb()
      .select()
      .from(communityInvitations)
      .where(eq(communityInvitations.id, result.invitation.id));
    expect(stored).toMatchObject({ maxUses: null, useCount: 0, status: "pending" });
    expect(stored?.tokenHash).toBe(
      createHash("sha256").update(result.token, "utf8").digest("hex"),
    );
    expect(JSON.stringify(stored)).not.toContain(result.token);

    const list = await listCommunityInvitations(owner, communitySlug, { tokenSecret });
    expect(list.status).toBe("found");
    expect(JSON.stringify(list)).not.toContain(stored?.tokenHash);
    if (list.status === "found") {
      expect(list.invitations.find(({ id }) => id === result.invitation.id)?.token).toBe(
        result.token,
      );
    }

    expect((await createCommunityInvitation(owner, communitySlug, { maxUses: 5 })).status).toBe("created");
  });

  it("does not let a non-owner create, list, or revoke invitations", async () => {
    const createResult = await createCommunityInvitation(outsider, communitySlug, { maxUses: 1 });
    expect(createResult.status).toBe("not-found");
    expect((await listCommunityInvitations(outsider, communitySlug)).status).toBe("not-found");
    expect(
      (await revokeCommunityInvitation(outsider, communitySlug, crypto.randomUUID())).status,
    ).toBe("not-found");
  });

  it("lets the owner revoke limited and unlimited links while they have capacity", async () => {
    const limited = await createCommunityInvitation(owner, communitySlug, { maxUses: 2 });
    const unlimited = await createCommunityInvitation(owner, communitySlug, { maxUses: null });
    expect(limited.status).toBe("created");
    expect(unlimited.status).toBe("created");
    if (limited.status !== "created" || unlimited.status !== "created") return;

    expect(await acceptInvitationForAdmission(limited.token, outsider)).toMatchObject({
      status: "accepted",
    });
    expect(
      (await revokeCommunityInvitation(owner, communitySlug, limited.invitation.id)).status,
    ).toBe("revoked");
    expect(
      (await revokeCommunityInvitation(owner, communitySlug, unlimited.invitation.id)).status,
    ).toBe("revoked");
    expect(await acceptInvitationForAdmission(limited.token, recipient)).toEqual({
      status: "invalid",
    });
    expect(await acceptInvitationForAdmission(unlimited.token, recipient)).toEqual({
      status: "invalid",
    });
  });

  it("allows the selected number of distinct people and then exhausts the link", async () => {
    const created = await createCommunityInvitation(owner, communitySlug, { maxUses: 2 });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    expect(await acceptInvitationForAdmission(created.token, outsider)).toEqual({
      status: "accepted",
      invitation: { id: created.invitation.id, communityId },
    });
    expect(await acceptInvitationForAdmission(created.token, recipient)).toEqual({
      status: "accepted",
      invitation: { id: created.invitation.id, communityId },
    });
    expect(await acceptInvitationForAdmission(created.token, owner)).toEqual({ status: "invalid" });

    const [stored] = await getDb()
      .select({ status: communityInvitations.status, useCount: communityInvitations.useCount })
      .from(communityInvitations)
      .where(eq(communityInvitations.id, created.invitation.id));
    expect(stored).toEqual({ status: "exhausted", useCount: 2 });

    const acceptanceEvents = await getDb()
      .select()
      .from(communityAuditEvents)
      .where(
        and(
          eq(communityAuditEvents.communityId, communityId),
          eq(communityAuditEvents.eventType, "community.invitation.accepted"),
          sql`${communityAuditEvents.details}->>'invitationId' = ${created.invitation.id}`,
        ),
      );
    expect(acceptanceEvents).toHaveLength(2);
  });

  it("rejects revoked and expired tokens without disclosing their state", async () => {
    const revoked = await createCommunityInvitation(owner, communitySlug, { maxUses: 1 });
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
        expiresAt: new Date(now.getTime() + 1_000),
      },
      { now },
    );
    expect(expiring.status).toBe("created");
    if (expiring.status !== "created") return;
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
