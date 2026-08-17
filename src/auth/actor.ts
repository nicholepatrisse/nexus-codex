import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth/server";
import { getDb } from "@/db/client";
import { people } from "@/db/schema";

export interface AuthenticatedActor {
  personId: string;
  authUserId: string;
  sessionId: string;
}

export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication is required for this operation.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getAuthenticatedActor(
  requestHeaders?: Headers,
): Promise<AuthenticatedActor | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });

  if (!session) return null;

  const [person] = await getDb()
    .select({ id: people.id })
    .from(people)
    .where(eq(people.authUserId, session.user.id))
    .limit(1);

  if (!person) return null;

  return {
    personId: person.id,
    authUserId: session.user.id,
    sessionId: session.session.id,
  };
}

export function requireActor(actor: AuthenticatedActor | null): AuthenticatedActor {
  if (!actor) throw new AuthenticationRequiredError();
  return actor;
}

export async function requireAuthenticatedActor(requestHeaders?: Headers) {
  return requireActor(await getAuthenticatedActor(requestHeaders));
}
