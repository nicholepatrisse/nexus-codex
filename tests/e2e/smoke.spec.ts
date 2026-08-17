import { expect, test } from "@playwright/test";

test("renders the application foundation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Nexus Codex" })).toBeVisible();
  await expect(page).toHaveTitle("Nexus Codex");
});
