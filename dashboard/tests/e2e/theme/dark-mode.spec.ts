import { expect, test } from "@playwright/test";

test("dashboard loads for authenticated user", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page).toHaveTitle(/CLIProxyAPI Dashboard/i);
});
