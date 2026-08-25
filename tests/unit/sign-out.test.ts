import { describe, expect, it, vi } from "vitest";
import { signOutAndRedirect } from "@/auth/sign-out";

describe("sign out", () => {
  it("redirects home after sign-out succeeds", async () => {
    const redirect = vi.fn();

    await expect(signOutAndRedirect(async () => ({ error: null }), redirect)).resolves.toEqual({
      error: null,
    });
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("preserves the current UI when sign-out fails", async () => {
    const redirect = vi.fn();
    const result = { error: { message: "Sign-out failed" } };

    await expect(signOutAndRedirect(async () => result, redirect)).resolves.toBe(result);
    expect(redirect).not.toHaveBeenCalled();
  });
});
