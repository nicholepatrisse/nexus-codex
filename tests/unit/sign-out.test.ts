import { describe, expect, it, vi } from "vitest";
import { signOutAndRefresh } from "@/auth/sign-out";

describe("sign out", () => {
  it("refreshes server-rendered user content after sign-out succeeds", async () => {
    const refresh = vi.fn();

    await expect(signOutAndRefresh(async () => ({ error: null }), refresh)).resolves.toEqual({
      error: null,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("preserves the current UI when sign-out fails", async () => {
    const refresh = vi.fn();
    const result = { error: { message: "Sign-out failed" } };

    await expect(signOutAndRefresh(async () => result, refresh)).resolves.toBe(result);
    expect(refresh).not.toHaveBeenCalled();
  });
});
