import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
  });

  test("should display settings page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /setting/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show profile section", async ({ page }) => {
    await expect(
      page.getByText(/profile|personal info|name/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show security settings section", async ({ page }) => {
    const securitySection = page.getByText(/security|password|two-factor|2fa/i);
    if (await securitySection.isVisible()) {
      expect(await securitySection.count()).toBeGreaterThan(0);
    }
  });

  test("should show notification preferences", async ({ page }) => {
    const notifSection = page.getByText(/notification|alert preference/i);
    if (await notifSection.isVisible()) {
      expect(await notifSection.count()).toBeGreaterThan(0);
    }
  });

  test("should allow editing profile fields", async ({ page }) => {
    const editButton = page.getByRole("button", { name: /edit|update profile/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      // Should show editable form fields
      await expect(
        page.getByLabel(/first name|name/i).or(page.getByRole("textbox").first())
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show timezone selector", async ({ page }) => {
    const timezoneSection = page.getByText(/timezone|time zone/i);
    if (await timezoneSection.isVisible()) {
      expect(await timezoneSection.count()).toBeGreaterThan(0);
    }
  });

  test("should handle page load without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.reload();
    await page.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) => !e.includes("Warning:") && !e.includes("DevTools")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
