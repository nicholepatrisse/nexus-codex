export const AUTH_PROVIDER = "google" as const;
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

type ProviderAccountData = Record<string, unknown>;

/** Provider credentials are deliberately ephemeral in M0. */
export function withoutProviderTokens<T extends ProviderAccountData>(account: T): T {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
  };
}
