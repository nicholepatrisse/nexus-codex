import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db/client";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "@/db/schema";
import { getServerEnvironment, type ServerEnvironment } from "@/env";
import {
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  withoutProviderTokens,
} from "@/auth/policy";

export function createAuth(environment: ServerEnvironment = getServerEnvironment()) {
  return betterAuth({
    appName: "Nexus Codex",
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      transaction: true,
      schema: {
        user: authUsers,
        account: authAccounts,
        session: authSessions,
        verification: authVerifications,
      },
    }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
        scope: ["openid", "email", "profile"],
      },
    },
    account: {
      updateAccountOnSignIn: false,
      storeAccountCookie: false,
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => ({ data: withoutProviderTokens(account) }),
        },
        update: {
          before: async (account) => ({ data: withoutProviderTokens(account) }),
        },
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  });
}

export const auth = createAuth();
