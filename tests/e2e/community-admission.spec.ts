import { expect, test } from "@playwright/test";

test("preserves an invitation return path through sign-in without exposing details", async ({ page }) => {
  const token = "a".repeat(43);
  await page.goto(`/invitations/${token}`);

  await expect(page).toHaveURL(new RegExp(`/sign-in\\?callbackURL=${encodeURIComponent(`/invitations/${token}`)}`));
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/recipient|community name|expired|revoked/i);
});
