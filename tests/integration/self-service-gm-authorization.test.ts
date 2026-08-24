import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssignedGameWithSelfServiceGm } from "@/community/create-assigned-game-with-self-service-gm";
import { getDb } from "@/db/client";
import {
  appMetadata,
  authUsers,
  communities,
  communityAuditEvents,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
  people,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const communityIds = {
  selfService: `gm-self-community-${suffix}`,
  approvedOnly: `gm-approved-community-${suffix}`,
  archived: `gm-archived-community-${suffix}`,
};
const actorNames = ["member", "inactive", "stranger", "rollback", "revoked"] as const;
const authIds = Object.fromEntries(actorNames.map((name) => [name, `gm-self-${name}-${suffix}`])) as Record<(typeof actorNames)[number], string>;
const personIds = {} as Record<(typeof actorNames)[number], string>;

describeWithDatabase("self-service GM authorization seam", () => {
  beforeAll(async () => {
    await getDb().insert(authUsers).values(actorNames.map((name) => ({ id: authIds[name], name, email: `gm-self-${name}-${suffix}@example.test` })));
    for (const name of actorNames) {
      const [person] = await getDb().select({ id: people.id }).from(people).where(eq(people.authUserId, authIds[name]));
      if (!person) throw new Error(`Missing person for ${name}`);
      personIds[name] = person.id;
    }
    await getDb().insert(communities).values([
      { id: communityIds.selfService, name: "Self service", slug: `gm-self-${suffix}`, gmAdmission: "self_service" },
      { id: communityIds.approvedOnly, name: "Approved only", slug: `gm-approved-${suffix}`, gmAdmission: "approved_only" },
      { id: communityIds.archived, name: "Archived", slug: `gm-archived-${suffix}`, gmAdmission: "self_service", lifecycleStatus: "archived" },
    ]);
    await getDb().insert(communityMemberships).values([
      { id: `member-self-${suffix}`, communityId: communityIds.selfService, personId: personIds.member, status: "active" },
      { id: `member-approved-${suffix}`, communityId: communityIds.approvedOnly, personId: personIds.member, status: "active" },
      { id: `member-archived-${suffix}`, communityId: communityIds.archived, personId: personIds.member, status: "active" },
      { id: `inactive-self-${suffix}`, communityId: communityIds.selfService, personId: personIds.inactive, status: "left" },
      { id: `rollback-self-${suffix}`, communityId: communityIds.selfService, personId: personIds.rollback, status: "active" },
      { id: `revoked-self-${suffix}`, communityId: communityIds.selfService, personId: personIds.revoked, status: "active" },
    ]);
    const now = new Date();
    await getDb().insert(communityRoleGrants).values([
      { id: `revoked-grant-${suffix}`, communityId: communityIds.selfService, personId: personIds.revoked, role: "gm", grantedByPersonId: personIds.revoked, status: "revoked", grantedAt: new Date(now.getTime() - 1_000), revokedAt: now, revokedByPersonId: personIds.revoked },
    ]);
  });

  afterAll(async () => {
    await getDb().delete(appMetadata).where(like(appMetadata.key, `gm-self-test-${suffix}-%`));
    await getDb().delete(communityAuditEvents).where(inArray(communityAuditEvents.communityId, Object.values(communityIds)));
    await getDb().delete(communityGmRequests).where(inArray(communityGmRequests.communityId, Object.values(communityIds)));
    await getDb().delete(communityRoleGrants).where(inArray(communityRoleGrants.communityId, Object.values(communityIds)));
    await getDb().delete(communityMemberships).where(inArray(communityMemberships.communityId, Object.values(communityIds)));
    await getDb().delete(communities).where(inArray(communities.id, Object.values(communityIds)));
    await getDb().delete(authUsers).where(inArray(authUsers.id, Object.values(authIds)));
  });

  it("promotes an active member only while atomically creating their assigned game", async () => {
    const first = await createAssignedGameWithSelfServiceGm(
      { personId: personIds.member },
      communityIds.selfService,
      async (transaction, context) => {
        expect(context).toEqual({ communityId: communityIds.selfService, gmPersonId: personIds.member });
        const key = `gm-self-test-${suffix}-first`;
        await transaction.insert(appMetadata).values({ key, value: "assigned-game" });
        return key;
      },
    );
    expect(first).toEqual({ status: "created", value: `gm-self-test-${suffix}-first`, promoted: true });

    const second = await createAssignedGameWithSelfServiceGm(
      { personId: personIds.member },
      communityIds.selfService,
      async (transaction) => {
        const key = `gm-self-test-${suffix}-second`;
        await transaction.insert(appMetadata).values({ key, value: "assigned-game" });
        return key;
      },
    );
    expect(second).toMatchObject({ status: "created", promoted: false });
    const grants = await getDb().select().from(communityRoleGrants).where(and(
      eq(communityRoleGrants.communityId, communityIds.selfService),
      eq(communityRoleGrants.personId, personIds.member),
      eq(communityRoleGrants.role, "gm"),
    ));
    expect(grants).toHaveLength(1);
    const requests = await getDb().select().from(communityGmRequests).where(and(
      eq(communityGmRequests.communityId, communityIds.selfService),
      eq(communityGmRequests.personId, personIds.member),
    ));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      status: "approved",
      admissionPolicy: "self_service",
      decidedByPersonId: null,
      decisionReason: null,
    });
    expect(requests[0]!.requestedAt).toEqual(requests[0]!.decidedAt);
    expect(requests[0]!.updatedAt).toEqual(requests[0]!.decidedAt);
  });

  it("denies approved-only, inactive, nonmember, archived, and cross-community attempts without invoking the callback", async () => {
    const cases = [
      [personIds.member, communityIds.approvedOnly],
      [personIds.inactive, communityIds.selfService],
      [personIds.stranger, communityIds.selfService],
      [personIds.member, communityIds.archived],
      [personIds.stranger, communityIds.approvedOnly],
    ] as const;
    for (const [personId, communityId] of cases) {
      let called = false;
      const result = await createAssignedGameWithSelfServiceGm({ personId }, communityId, async () => {
        called = true;
        return "should-not-run";
      });
      expect(result).toEqual({ status: "unavailable" });
      expect(called).toBe(false);
    }
  });

  it("rolls the grant, audit, and triggering game back when creation fails", async () => {
    const key = `gm-self-test-${suffix}-rollback`;
    await expect(createAssignedGameWithSelfServiceGm(
      { personId: personIds.rollback },
      communityIds.selfService,
      async (transaction) => {
        await transaction.insert(appMetadata).values({ key, value: "assigned-game" });
        throw new Error("game insert failed");
      },
    )).rejects.toThrow("game insert failed");
    const [grant] = await getDb().select().from(communityRoleGrants).where(and(
      eq(communityRoleGrants.communityId, communityIds.selfService),
      eq(communityRoleGrants.personId, personIds.rollback),
      eq(communityRoleGrants.role, "gm"),
    ));
    const [game] = await getDb().select().from(appMetadata).where(eq(appMetadata.key, key));
    const [request] = await getDb().select().from(communityGmRequests).where(and(
      eq(communityGmRequests.communityId, communityIds.selfService),
      eq(communityGmRequests.personId, personIds.rollback),
    ));
    expect(grant).toBeUndefined();
    expect(game).toBeUndefined();
    expect(request).toBeUndefined();
  });

  it("does not bypass a revoked owner decision", async () => {
    let called = false;
    const result = await createAssignedGameWithSelfServiceGm({ personId: personIds.revoked }, communityIds.selfService, async () => {
      called = true;
      return "should-not-run";
    });
    expect(result).toEqual({ status: "unavailable" });
    expect(called).toBe(false);
  });
});
