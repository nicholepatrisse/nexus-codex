import { expect, test } from "@playwright/test";

test("browses public communities without signing in", async ({ page }) => {
  await page.goto("/communities");

  await expect(page.getByRole("heading", { level: 1, name: "Public communities" })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/private community|archived community/i);
});
