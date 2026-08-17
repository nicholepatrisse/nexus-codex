import { describe, expect, it } from "vitest";
import {
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  withoutProviderTokens,
} from "@/auth/policy";

describe("M0 authentication policy", () => {
  it("uses a rolling seven-day session with a one-day refresh age", () => {
    expect(SESSION_EXPIRES_IN_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(SESSION_UPDATE_AGE_SECONDS).toBe(24 * 60 * 60);
  });

  it("removes provider credentials before persistence", () => {
    expect(
      withoutProviderTokens({
        providerId: "google",
        accountId: "immutable-subject",
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        idToken: "identity-secret",
        scope: "openid email profile",
      }),
    ).toEqual({
      providerId: "google",
      accountId: "immutable-subject",
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
    });
  });
});
