import { createHmac, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { createCommunity } from "@/community/create-community";
import { getDb } from "@/db/client";
import {
  authAccounts,
  authSessions,
  authUsers,
  communities,
  communityAuditEvents,
  communityGmRequests,
  communityMemberships,
  communityRoleGrants,
} from "@/db/schema";

config({ path: [".env.local", ".env"], quiet: true });

const suffix = randomUUID();
const database = getDb();
const authUserIds: string[] = [];
const communityIds: string[] = [];

async function identity(label: string) {
  const now = new Date();
  const userId = randomUUID();
  const token = randomUUID();
  const [user] = await database.insert(authUsers).values({
    id: userId,
    email: `gm-e2e-${label}-${suffix}@fixture.invalid`,
    emailVerified: true,
    name: label,
    createdAt: now,
    updatedAt: now,
  }).returning();
  if (!user) throw new Error("Failed to create E2E user.");
  await database.insert(authAccounts).values({
    id: randomUUID(), accountId: `gm-e2e-${label}-${suffix}`, providerId: "google", userId,
    createdAt: now, updatedAt: now,
  });
  const person = await database.query.people.findFirst({ where: (row, { eq: equal }) => equal(row.authUserId, userId) });
  if (!person) throw new Error("Failed to create E2E person.");
  await database.insert(authSessions).values({
    id: randomUUID(), token, userId, expiresAt: new Date(now.getTime() + 3_600_000), createdAt: now, updatedAt: now,
  });
  authUserIds.push(userId);
  return { actor: { personId: person.id, authUserId: userId, sessionId: token }, token };
}

function sessionCookie(token: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for GM browser tests.");
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

test.describe.serial("community GM admission", () => {
  let owner: Awaited<ReturnType<typeof identity>>;
  let member: Awaited<ReturnType<typeof identity>>;
  let approvedSlug: string;
  let selfServiceSlug: string;

  test.beforeAll(async () => {
    owner = await identity("Owner");
    member = await identity("Member");
    const approved = await createCommunity(owner.actor, { name: `Approved GM ${suffix}` });
    const selfService = await createCommunity(owner.actor, { name: `Self-service GM ${suffix}` });
    approvedSlug = approved.slug;
    selfServiceSlug = selfService.slug;
    communityIds.push(approved.id, selfService.id);
    await database.update(communities).set({ visibility: "public", gmAdmission: "self_service" }).where(eq(communities.id, selfService.id));
    await database.update(communities).set({ visibility: "public" }).where(eq(communities.id, approved.id));
    await database.insert(communityMemberships).values([
      { id: randomUUID(), communityId: approved.id, personId: member.actor.personId, status: "active" },
      { id: randomUUID(), communityId: selfService.id, personId: member.actor.personId, status: "active" },
    ]);
    await database.insert(communityRoleGrants).values({
      id: randomUUID(), communityId: selfService.id, personId: member.actor.personId, role: "gm",
      grantedByPersonId: owner.actor.personId, status: "revoked", grantedAt: new Date(Date.now() - 1_000),
      revokedAt: new Date(), revokedByPersonId: owner.actor.personId, updatedAt: new Date(),
    });
  });

  test.afterAll(async () => {
    await database.delete(communityAuditEvents).where(inArray(communityAuditEvents.communityId, communityIds));
    await database.delete(communityGmRequests).where(inArray(communityGmRequests.communityId, communityIds));
    await database.delete(communityRoleGrants).where(inArray(communityRoleGrants.communityId, communityIds));
    await database.delete(communityMemberships).where(inArray(communityMemberships.communityId, communityIds));
    await database.delete(communities).where(inArray(communities.id, communityIds));
    await database.delete(authUsers).where(inArray(authUsers.id, authUserIds));
  });

  test("requests, approves, and revokes approved-only GM access", async ({ page, context }) => {
    await context.addCookies([{ name: "better-auth.session_token", value: sessionCookie(member.token), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`/communities/${approvedSlug}`);
    await page.getByRole("button", { name: "Request GM access" }).click();
    await expect(page.getByText("awaiting owner review", { exact: false })).toBeVisible();

    await context.clearCookies();
    await context.addCookies([{ name: "better-auth.session_token", value: sessionCookie(owner.token), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`/communities/${approvedSlug}/settings`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Approve" }).click();
    const memberGrant = page.getByRole("listitem").filter({ hasText: "Member" });
    await expect(memberGrant.getByText("active", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await memberGrant.getByRole("button", { name: "Revoke" }).click();
    await expect(memberGrant.getByText("revoked", { exact: true })).toBeVisible();

    await context.clearCookies();
    await context.addCookies([{ name: "better-auth.session_token", value: sessionCookie(member.token), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`/communities/${approvedSlug}`);
    await expect(page.getByText("previous GM access was revoked", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request GM access" })).toBeVisible();
  });

  test("denies standalone recovery under self-service after revocation", async ({ page, context }) => {
    await context.addCookies([{ name: "better-auth.session_token", value: sessionCookie(member.token), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`/communities/${selfServiceSlug}`);
    await expect(page.getByText("cannot be restored through self-service", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request GM access" })).toHaveCount(0);
  });
});
