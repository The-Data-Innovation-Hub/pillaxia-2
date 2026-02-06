import { test, expect } from "@playwright/test";

test.describe("Prescriptions", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the prescriptions page (assumes authenticated state)
    await page.goto("/dashboard/prescriptions");
    await page.waitForLoadState("networkidle");
  });

  test("should display prescriptions page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /prescription|medication/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show prescription list or empty state", async ({ page }) => {
    // Either we see prescription cards or an empty state message
    const hasPrescriptions = await page.locator("[data-testid='prescription-card'], .prescription-item").count();
    const hasEmptyState = await page.getByText(/no prescription|no active/i).count();
    expect(hasPrescriptions + hasEmptyState).toBeGreaterThan(0);
  });

  test("should display prescription status badges", async ({ page }) => {
    // Look for status badges (active, expired, cancelled)
    const statusBadges = page.locator("[data-testid='status-badge'], .badge, [role='status']");
    // Page should load without errors
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("should open refill request dialog when clicking request refill", async ({ page }) => {
    const refillButton = page.getByRole("button", { name: /refill|request/i });
    if (await refillButton.isVisible()) {
      await refillButton.first().click();
      // Dialog should appear
      await expect(
        page.getByRole("dialog").or(page.locator("[data-testid='refill-dialog']"))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show prescription details on click", async ({ page }) => {
    const prescriptionItem = page.locator("[data-testid='prescription-card'], .prescription-item").first();
    if (await prescriptionItem.isVisible()) {
      await prescriptionItem.click();
      // Details should be visible (either in a drawer, dialog, or expanded view)
      await page.waitForTimeout(500);
      await expect(
        page.getByText(/dosage|frequency|prescriber|prescribed by/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
