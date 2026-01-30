import { test as base, expect, Page } from "@playwright/test";

/**
 * Authentication fixtures for E2E tests
 * Provides login/signup helpers and authenticated page contexts
 */

// Test user credentials (should match test data in your environment)
export const TEST_USER = {
  email: "e2e-test@pillaxia.test",
  password: "TestPassword123!",
  firstName: "E2E",
  lastName: "Tester",
};

export const TEST_CLINICIAN = {
  email: "e2e-clinician@pillaxia.test",
  password: "ClinicianPass123!",
  firstName: "Dr. Test",
  lastName: "Clinician",
};

/**
 * Navigate to login page
 */
export async function goToLogin(page: Page): Promise<void> {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: /sign in|log in|welcome/i })).toBeVisible();
}

/**
 * Navigate to signup page
 */
export async function goToSignup(page: Page): Promise<void> {
  await page.goto("/auth");
  // Click on sign up tab/link if needed
  const signUpTab = page.getByRole("tab", { name: /sign up|register/i });
  if (await signUpTab.isVisible()) {
    await signUpTab.click();
  }
  await expect(page.getByRole("heading", { name: /sign up|create|register/i })).toBeVisible();
}

/**
 * Fill and submit login form
 */
export async function login(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  await goToLogin(page);
  
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  
  await page.getByRole("button", { name: /sign in|log in|submit/i }).click();
  
  // Wait for navigation away from auth page
  await expect(page).not.toHaveURL(/\/auth/);
}

/**
 * Fill and submit signup form
 */
export async function signup(
  page: Page,
  userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<void> {
  await goToSignup(page);
  
  // Fill first name if field exists
  const firstNameField = page.getByLabel(/first name/i);
  if (await firstNameField.isVisible()) {
    await firstNameField.fill(userData.firstName || "Test");
  }
  
  // Fill last name if field exists
  const lastNameField = page.getByLabel(/last name/i);
  if (await lastNameField.isVisible()) {
    await lastNameField.fill(userData.lastName || "User");
  }
  
  await page.getByLabel(/email/i).fill(userData.email);
  
  // Handle password and confirm password fields
  const passwordFields = page.getByLabel(/password/i);
  const passwordCount = await passwordFields.count();
  
  if (passwordCount >= 2) {
    await passwordFields.first().fill(userData.password);
    await passwordFields.last().fill(userData.password);
  } else {
    await passwordFields.first().fill(userData.password);
  }
  
  await page.getByRole("button", { name: /sign up|register|create/i }).click();
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Try to find and click logout button/link
  const logoutButton = page.getByRole("button", { name: /log out|sign out|logout/i });
  const logoutLink = page.getByRole("link", { name: /log out|sign out|logout/i });
  
  // Try menu first (common pattern)
  const userMenu = page.getByRole("button", { name: /user menu|profile|account/i });
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.waitForTimeout(500);
  }
  
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else if (await logoutLink.isVisible()) {
    await logoutLink.click();
  }
  
  // Wait for redirect to auth or landing page
  await expect(page).toHaveURL(/\/(auth)?$/);
}

/**
 * Check if user is logged in by looking for common authenticated UI elements
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for dashboard or authenticated content
  const dashboardIndicators = [
    page.getByText(/dashboard/i),
    page.getByText(/welcome/i),
    page.getByRole("navigation"),
  ];
  
  for (const indicator of dashboardIndicators) {
    if (await indicator.isVisible()) {
      return true;
    }
  }
  
  return false;
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForLoadState("domcontentloaded");
}

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await login(page);
    await waitForPageLoad(page);
    
    // Use the authenticated page
    await use(page);
    
    // Cleanup: logout after test
    try {
      await logout(page);
    } catch {
      // Ignore logout errors during cleanup
    }
  },
});

export { expect } from "@playwright/test";
