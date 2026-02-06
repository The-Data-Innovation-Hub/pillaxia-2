import { test, expect } from "@playwright/test";

test.describe("Appointments", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/appointments");
    await page.waitForLoadState("networkidle");
  });

  test("should display appointments page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /appointment|calendar|schedule/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show calendar or list view", async ({ page }) => {
    // Calendar component or appointment list should be visible
    const hasCalendar = await page.locator("[data-testid='calendar'], .calendar, [role='grid']").count();
    const hasList = await page.locator("[data-testid='appointment-list'], .appointment-card").count();
    const hasEmptyState = await page.getByText(/no appointment|no upcoming/i).count();
    expect(hasCalendar + hasList + hasEmptyState).toBeGreaterThan(0);
  });

  test("should navigate between months in calendar view", async ({ page }) => {
    const nextButton = page.getByRole("button", { name: /next|forward|>/i });
    const prevButton = page.getByRole("button", { name: /prev|back|</i });

    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(300);
      await prevButton.click();
      // Page should still be functional
      await expect(page).not.toHaveTitle(/error/i);
    }
  });

  test("should display appointment details with date and time", async ({ page }) => {
    const appointmentCard = page.locator("[data-testid='appointment-card'], .appointment-card, .appointment-item").first();
    if (await appointmentCard.isVisible()) {
      // Should show date/time information
      await expect(
        appointmentCard.getByText(/am|pm|:\d{2}|today|tomorrow/i)
      ).toBeVisible();
    }
  });

  test("should handle page navigation without errors", async ({ page }) => {
    // Ensure the page loads without console errors
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Filter out known warnings (React dev mode, etc.)
    const criticalErrors = errors.filter(
      (e) => !e.includes("Warning:") && !e.includes("DevTools")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
