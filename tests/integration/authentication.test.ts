import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "@/auth/server";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { createTestIdentity, testSessionHeaders } from "@/auth/test-fixture";
import { getDb } from "@/db/client";
import { authAccounts, authSessions, authUsers, people } from "@/db/schema";

const describeWithDatabase = process.env.CI ? describe : describe.skip;
const createdUserIds: string[] = [];

describeWithDatabase("authentication persistence", () => {
  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await getDb().delete(authUsers).where(eq(authUsers.id, id));
    }
  });

  it("creates exactly one person and resolves repeat sign-in by Google subject", async () => {
    const subject = `google-sub-${crypto.randomUUID()}`;
    const first = await createTestIdentity({ subject, sessions: 0 });
    createdUserIds.push(first.authUser.id);
    const repeated = await createTestIdentity({
      subject,
      email: "a-different-email@fixture.invalid",
      name: "A Different Name",
      sessions: 0,
    });

    expect(repeated.authUser.id).toBe(first.authUser.id);
    expect(repeated.person.id).toBe(first.person.id);
    expect(await getDb().select().from(people).where(eq(people.authUserId, first.authUser.id))).toHaveLength(1);
    expect(
      await getDb().select().from(authAccounts).where(eq(authAccounts.accountId, subject)),
    ).toHaveLength(1);
  });

  it("fails closed when a write boundary has no authenticated actor", async () => {
    await expect(requireAuthenticatedActor(new Headers())).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it("keeps device sessions independent and sign-out revokes only the active session", async () => {
    const identity = await createTestIdentity({ sessions: 2 });
    createdUserIds.push(identity.authUser.id);
    const [first, second] = identity.sessions;
    expect(first && second).toBeTruthy();

    const firstHeaders = testSessionHeaders(first!.token);
    const secondHeaders = testSessionHeaders(second!.token);
    expect(await auth.api.getSession({ headers: firstHeaders })).not.toBeNull();
    expect(await auth.api.getSession({ headers: secondHeaders })).not.toBeNull();

    await auth.api.signOut({ headers: firstHeaders });

    expect(await auth.api.getSession({ headers: firstHeaders })).toBeNull();
    expect(await auth.api.getSession({ headers: secondHeaders })).not.toBeNull();
  });

  it("rejects expired and revoked sessions on the next database check", async () => {
    const identity = await createTestIdentity({ sessions: 1 });
    createdUserIds.push(identity.authUser.id);
    const session = identity.sessions[0]!;
    const sessionHeaders = testSessionHeaders(session.token);

    await getDb()
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(authSessions.id, session.id));
    expect(await auth.api.getSession({ headers: sessionHeaders })).toBeNull();

    await getDb().delete(authSessions).where(eq(authSessions.id, session.id));
    expect(await auth.api.getSession({ headers: sessionHeaders })).toBeNull();
  });

  it("refreshes an active session after one day", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const identity = await createTestIdentity({ sessions: 1, now: twoDaysAgo });
    createdUserIds.push(identity.authUser.id);
    const session = identity.sessions[0]!;
    const previousExpiry = session.expiresAt;

    expect(await auth.api.getSession({ headers: testSessionHeaders(session.token) })).not.toBeNull();

    const refreshed = await getDb().query.authSessions.findFirst({
      where: (row, { eq }) => eq(row.id, session.id),
    });
    expect(refreshed!.updatedAt.getTime()).toBeGreaterThan(twoDaysAgo.getTime());
    expect(refreshed!.expiresAt.getTime()).toBeGreaterThan(previousExpiry.getTime());
  });

  it("never persists OAuth provider tokens", async () => {
    const identity = await createTestIdentity({ sessions: 0 });
    createdUserIds.push(identity.authUser.id);
    const [account] = await getDb()
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.userId, identity.authUser.id));

    expect(account).toMatchObject({
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
  });
});
