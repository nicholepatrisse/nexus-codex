import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import {
  authUsers,
  communities,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
  people,
} from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const suffix = randomUUID();
const communityId = `gm-persistence-community-${suffix}`;
const ownerAuthId = `gm-persistence-owner-${suffix}`;
const applicantAuthId = `gm-persistence-applicant-${suffix}`;
let ownerPersonId: string;
let applicantPersonId: string;

describeWithDatabase("community GM persistence", () => {
  beforeAll(async () => {
    await getDb().insert(authUsers).values([
      { id: ownerAuthId, name: "GM Test Owner", email: `gm-owner-${suffix}@example.test` },
      { id: applicantAuthId, name: "GM Applicant", email: `gm-applicant-${suffix}@example.test` },
    ]);
    const [owner] = await getDb().select().from(people).where(eq(people.authUserId, ownerAuthId));
    const [applicant] = await getDb().select().from(people).where(eq(people.authUserId, applicantAuthId));
    if (!owner || !applicant) throw new Error("Expected auth triggers to create people.");
    ownerPersonId = owner.id;
    applicantPersonId = applicant.id;
    await getDb().insert(communities).values({ id: communityId, name: "GM Persistence", slug: `gm-persistence-${suffix}` });
    await getDb().insert(communityMemberships).values([
      { id: `owner-membership-${suffix}`, communityId, personId: ownerPersonId, status: "active" },
      { id: `applicant-membership-${suffix}`, communityId, personId: applicantPersonId, status: "active" },
    ]);
    await getDb().insert(communityRoleGrants).values({ id: `owner-role-${suffix}`, communityId, personId: ownerPersonId, role: "owner", grantedByPersonId: ownerPersonId });
  });

  afterAll(async () => {
    await getDb().delete(communityGmRequests).where(eq(communityGmRequests.communityId, communityId));
    await getDb().delete(communityRoleGrants).where(eq(communityRoleGrants.communityId, communityId));
    await getDb().delete(communityMemberships).where(eq(communityMemberships.communityId, communityId));
    await getDb().delete(communities).where(eq(communities.id, communityId));
    await getDb().delete(authUsers).where(eq(authUsers.id, ownerAuthId));
    await getDb().delete(authUsers).where(eq(authUsers.id, applicantAuthId));
  });

  it("enforces one pending request and retains policy and decision history", async () => {
    await getDb().insert(communityGmRequests).values({
      id: `gm-request-a-${suffix}`,
      communityId,
      personId: applicantPersonId,
      admissionPolicy: "approved_only",
    });
    await expect(getDb().insert(communityGmRequests).values({
      id: `gm-request-duplicate-${suffix}`,
      communityId,
      personId: applicantPersonId,
      admissionPolicy: "self_service",
    })).rejects.toBeDefined();

    await getDb().update(communityGmRequests).set({
      status: "rejected",
      decidedAt: new Date(),
      decidedByPersonId: ownerPersonId,
      decisionReason: "More table experience requested",
    }).where(eq(communityGmRequests.id, `gm-request-a-${suffix}`));
    await getDb().insert(communityGmRequests).values({
      id: `gm-request-b-${suffix}`,
      communityId,
      personId: applicantPersonId,
      status: "approved",
      admissionPolicy: "self_service",
      decidedAt: new Date(),
    });

    const history = await getDb().select().from(communityGmRequests).where(and(
      eq(communityGmRequests.communityId, communityId),
      eq(communityGmRequests.personId, applicantPersonId),
    ));
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "rejected", admissionPolicy: "approved_only", decidedByPersonId: ownerPersonId }),
      expect.objectContaining({ status: "approved", admissionPolicy: "self_service", decidedByPersonId: null }),
    ]));
  });

  it("rejects terminal request shapes and unbounded internal reasons", async () => {
    await expect(getDb().insert(communityGmRequests).values({
      id: `gm-request-invalid-${suffix}`,
      communityId,
      personId: ownerPersonId,
      status: "rejected",
      admissionPolicy: "approved_only",
    })).rejects.toBeDefined();
    await expect(getDb().insert(communityGmRequests).values({
      id: `gm-request-long-reason-${suffix}`,
      communityId,
      personId: ownerPersonId,
      status: "rejected",
      admissionPolicy: "approved_only",
      decidedAt: new Date(),
      decidedByPersonId: ownerPersonId,
      decisionReason: "x".repeat(501),
    })).rejects.toBeDefined();
  });

  it("tracks GM revocation without deleting grant history", async () => {
    const grantId = `gm-role-${suffix}`;
    const [createdGrant] = await getDb().insert(communityRoleGrants).values({ id: grantId, communityId, personId: applicantPersonId, role: "gm", grantedByPersonId: ownerPersonId }).returning({ grantedAt: communityRoleGrants.grantedAt });
    if (!createdGrant) throw new Error("GM grant fixture was not created");
    const revokedAt = new Date(createdGrant.grantedAt.getTime() + 1);
    await getDb().update(communityRoleGrants).set({ status: "revoked", revokedAt, revokedByPersonId: ownerPersonId, revocationReason: "Access withdrawn" }).where(eq(communityRoleGrants.id, grantId));

    const [grant] = await getDb().select().from(communityRoleGrants).where(eq(communityRoleGrants.id, grantId));
    expect(grant).toMatchObject({ status: "revoked", revokedByPersonId: ownerPersonId });
    await getDb().insert(communityRoleGrants).values({ id: `gm-role-replacement-${suffix}`, communityId, personId: applicantPersonId, role: "gm", grantedByPersonId: ownerPersonId });
  });

  it("rejects incomplete GM revocation while preserving legacy owner revocation", async () => {
    await expect(getDb().insert(communityRoleGrants).values({
      id: `invalid-revoked-gm-${suffix}`,
      communityId,
      personId: ownerPersonId,
      role: "gm",
      grantedByPersonId: ownerPersonId,
      status: "revoked",
      revokedAt: new Date(),
    })).rejects.toBeDefined();
    await getDb().update(communityRoleGrants).set({ revokedAt: new Date() }).where(eq(communityRoleGrants.id, `owner-role-${suffix}`));
    const [ownerGrant] = await getDb().select().from(communityRoleGrants).where(eq(communityRoleGrants.id, `owner-role-${suffix}`));
    expect(ownerGrant).toMatchObject({ role: "owner", status: "active" });
  });
});
