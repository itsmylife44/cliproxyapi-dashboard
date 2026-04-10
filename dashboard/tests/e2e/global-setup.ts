import { expect, test } from "@playwright/test";

const getRequiredEnv = (name: "E2E_ADMIN_USERNAME" | "E2E_ADMIN_PASSWORD") => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

test("authenticate admin and save storage state", async ({ page }) => {
  const username = getRequiredEnv("E2E_ADMIN_USERNAME");
  const password = getRequiredEnv("E2E_ADMIN_PASSWORD");

  const setupResponse = await page.request.get("/api/setup");
  if (!setupResponse.ok()) {
    throw new Error(`Failed to fetch /api/setup: ${setupResponse.status()} ${setupResponse.statusText()}`);
  }

  const setupBody = (await setupResponse.json()) as { data?: { setupRequired?: boolean }; setupRequired?: boolean };
  const setupRequired = (setupBody.data?.setupRequired ?? setupBody.setupRequired) === true;

  if (setupRequired) {
    await page.goto("/setup");
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL("**/dashboard");
  } else {
    await page.goto("/login");
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL("**/dashboard");
  }

  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: "./tests/e2e/.auth/admin.json" });
});
