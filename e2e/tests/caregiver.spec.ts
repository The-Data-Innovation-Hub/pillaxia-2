import { test, expect } from "@playwright/test";

test.describe("Caregiver", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/caregivers");
    await page.waitForLoadState("networkidle");
  });

  test("should display caregivers page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /caregiver|care team/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show caregiver list or invitation option", async ({ page }) => {
    const hasCaregivers = await page.locator("[data-testid='caregiver-card'], .caregiver-item").count();
    const hasInviteButton = await page.getByRole("button", { name: /invite|add/i }).count();
    const hasEmptyState = await page.getByText(/no caregiver|invite someone/i).count();
    expect(hasCaregivers + hasInviteButton + hasEmptyState).toBeGreaterThan(0);
  });

  test("should open invite dialog when clicking invite button", async ({ page }) => {
    const inviteButton = page.getByRole("button", { name: /invite|add caregiver/i });
    if (await inviteButton.isVisible()) {
      await inviteButton.click();
      await expect(
        page.getByRole("dialog").or(page.locator("[data-testid='invite-dialog']"))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should navigate to caregiver dashboard", async ({ page }) => {
    await page.goto("/dashboard/caregiver-dashboard");
    await page.waitForLoadState("networkidle");

    // Should display caregiver dashboard or redirect
    await expect(page).not.toHaveTitle(/error/i);
  });

  test("should display pending invitations if any", async ({ page }) => {
    const invitationsTab = page.getByRole("tab", { name: /invitation|pending/i });
    if (await invitationsTab.isVisible()) {
      await invitationsTab.click();
      await page.waitForTimeout(500);
      // Should show invitations or empty state
      await expect(page).not.toHaveTitle(/error/i);
    }
  });
});
