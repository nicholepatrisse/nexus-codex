import { expect, test } from "@playwright/test";

test("renders the application foundation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Nexus Codex" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Nexus Codex" })).toBeVisible();
  await expect(page).toHaveTitle("Nexus Codex | Starfinder 2E Game Management");
  await expect(page.getByRole("link", { name: "Create a community" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your communities" })).toHaveCount(0);
});

test("renders a custom not-found page with a working home link", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText("Error 404")).toBeVisible();

  await page.getByRole("link", { name: "Return home" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Nexus Codex" })).toBeVisible();
});

test("protects the community creation form", async ({ page }) => {
  await page.goto("/communities/new");
  await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2Fcommunities%2Fnew$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("protects the all-games view and preserves its return path", async ({ page }) => {
  await page.goto("/games");
  await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2Fgames$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});
