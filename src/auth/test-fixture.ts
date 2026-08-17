import { createHmac, randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { authAccounts, authSessions, authUsers } from "@/db/schema";

interface TestIdentityInput {
  subject?: string;
  email?: string;
  name?: string;
  sessions?: number;
  now?: Date;
}

export async function createTestIdentity(input: TestIdentityInput = {}) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Authentication fixtures are available only in tests.");
  }

  const subject = input.subject ?? `subject-${randomUUID()}`;
  const now = input.now ?? new Date();
  const existing = await getDb().query.authAccounts.findFirst({
    where: (account, { and, eq }) =>
      and(eq(account.providerId, "google"), eq(account.accountId, subject)),
  });

  if (existing) {
    const authUser = await getDb().query.authUsers.findFirst({
      where: (user, { eq }) => eq(user.id, existing.userId),
    });
    const person = await getDb().query.people.findFirst({
      where: (person, { eq }) => eq(person.authUserId, existing.userId),
    });
    if (!authUser || !person) throw new Error("Authentication identity is incomplete.");
    return { authUser, person, sessions: [] };
  }

  return getDb().transaction(async (transaction) => {
    const userId = randomUUID();
    const [authUser] = await transaction
      .insert(authUsers)
      .values({
        id: userId,
        email: input.email ?? `${subject}@fixture.invalid`,
        emailVerified: true,
        name: input.name ?? "Test Person",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!authUser) throw new Error("Failed to create authentication user fixture.");

    await transaction.insert(authAccounts).values({
      id: randomUUID(),
      accountId: subject,
      providerId: "google",
      userId,
      createdAt: now,
      updatedAt: now,
    });

    const person = await transaction.query.people.findFirst({
      where: (row, { eq }) => eq(row.authUserId, userId),
    });
    if (!person) throw new Error("Person trigger did not create an application identity.");

    const sessionRows = Array.from({ length: input.sessions ?? 1 }, () => ({
      id: randomUUID(),
      token: randomUUID(),
      userId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    }));
    const sessions = sessionRows.length
      ? await transaction.insert(authSessions).values(sessionRows).returning()
      : [];

    return { authUser, person, sessions };
  });
}

export function testSessionHeaders(token: string): Headers {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Authentication fixtures are available only in tests.");
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for authentication tests.");
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  const signedToken = encodeURIComponent(`${token}.${signature}`);
  return new Headers({ cookie: `better-auth.session_token=${signedToken}` });
}
