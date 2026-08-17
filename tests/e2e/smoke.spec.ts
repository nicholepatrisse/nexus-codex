import { expect, test } from "@playwright/test";

test("renders the application foundation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Hello World" })).toBeVisible();
  await expect(page).toHaveTitle("Nexus Codex");
  await expect(page.getByRole("link", { name: "Create a community" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your communities" })).toHaveCount(0);
});

test("protects the community creation form", async ({ page }) => {
  await page.goto("/communities/new");
  await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2Fcommunities%2Fnew$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});
