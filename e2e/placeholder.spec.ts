import { test, expect } from "@playwright/test";

/**
 * E2E placeholder. Expand with:
 * - Venue booking flow
 * - Guard shift acceptance
 * - Incident report submission
 */
test.describe("App smoke", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Shield|security/i);
  });
});
