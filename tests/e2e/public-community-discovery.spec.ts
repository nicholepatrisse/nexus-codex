import { expect, test } from "@playwright/test";

test("browses and searches public communities without signing in", async ({ page }) => {
  await page.goto("/communities");

  await expect(page.getByRole("heading", { level: 1, name: "Find a public community" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search by community name or slug" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search by community name or slug" }).fill(
    "a-public-community-that-does-not-exist",
  );
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/communities\?q=a-public-community-that-does-not-exist$/);
  await expect(page.getByRole("heading", { name: "No public communities found" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/private community|archived community/i);
});
