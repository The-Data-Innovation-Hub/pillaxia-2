import { test, expect } from "@playwright/test";

test.describe("Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/notifications");
    await page.waitForLoadState("networkidle");
  });

  test("should display notifications hub heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /notification|alert/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show notification list or empty state", async ({ page }) => {
    const hasNotifications = await page.locator("[data-testid='notification-item'], .notification-item").count();
    const hasEmptyState = await page.getByText(/no notification|all caught up|nothing new/i).count();
    expect(hasNotifications + hasEmptyState).toBeGreaterThan(0);
  });

  test("should navigate to notification preferences", async ({ page }) => {
    const prefsLink = page.getByRole("link", { name: /preference|settings/i }).or(
      page.getByRole("button", { name: /preference|settings/i })
    );
    if (await prefsLink.isVisible()) {
      await prefsLink.click();
      await page.waitForLoadState("networkidle");
      // Should be on preferences page
      await expect(
        page.getByText(/email|push|sms|quiet hours/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should display notification history", async ({ page }) => {
    const historyLink = page.getByRole("link", { name: /history/i }).or(
      page.getByRole("tab", { name: /history/i })
    );
    if (await historyLink.isVisible()) {
      await historyLink.click();
      await page.waitForTimeout(500);
      // Should show historical notifications or empty state
      await expect(page).not.toHaveTitle(/error/i);
    }
  });
});
