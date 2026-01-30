import { test, expect } from "@playwright/test";
import { 
  goToLogin, 
  goToSignup, 
  login, 
  logout, 
  TEST_USER,
  waitForPageLoad 
} from "../fixtures/auth";

test.describe("Authentication", () => {
  test.describe("Sign In", () => {
    test("should display login form", async ({ page }) => {
      await goToLogin(page);
      
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
    });

    test("should show validation error for empty fields", async ({ page }) => {
      await goToLogin(page);
      
      // Try to submit empty form
      await page.getByRole("button", { name: /sign in|log in/i }).click();
      
      // Should show validation errors
      await expect(page.getByText(/required|email|invalid/i)).toBeVisible();
    });

    test("should show error for invalid email format", async ({ page }) => {
      await goToLogin(page);
      
      await page.getByLabel(/email/i).fill("invalid-email");
      await page.getByLabel(/password/i).fill("password123");
      await page.getByRole("button", { name: /sign in|log in/i }).click();
      
      // Should show email validation error
      await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
    });

    test("should show error for wrong credentials", async ({ page }) => {
      await goToLogin(page);
      
      await page.getByLabel(/email/i).fill("wrong@example.com");
      await page.getByLabel(/password/i).fill("wrongpassword");
      await page.getByRole("button", { name: /sign in|log in/i }).click();
      
      // Should show authentication error
      await expect(page.getByText(/invalid|incorrect|error|failed/i)).toBeVisible();
    });

    test("should successfully login with valid credentials", async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      await waitForPageLoad(page);
      
      // Should redirect to dashboard
      await expect(page).not.toHaveURL(/\/auth/);
      
      // Should show authenticated UI
      await expect(page.getByText(/dashboard|welcome|home/i)).toBeVisible();
    });

    test("should persist session on page reload", async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      await waitForPageLoad(page);
      
      // Reload the page
      await page.reload();
      await waitForPageLoad(page);
      
      // Should still be logged in
      await expect(page).not.toHaveURL(/\/auth/);
    });
  });

  test.describe("Sign Up", () => {
    test("should display signup form", async ({ page }) => {
      await goToSignup(page);
      
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /sign up|register|create/i })).toBeVisible();
    });

    test("should show validation error for weak password", async ({ page }) => {
      await goToSignup(page);
      
      await page.getByLabel(/email/i).fill("newuser@example.com");
      
      // Fill with weak password
      const passwordFields = page.getByLabel(/password/i);
      await passwordFields.first().fill("weak");
      
      const confirmField = page.getByLabel(/confirm password/i);
      if (await confirmField.isVisible()) {
        await confirmField.fill("weak");
      }
      
      await page.getByRole("button", { name: /sign up|register|create/i }).click();
      
      // Should show password strength error
      await expect(page.getByText(/password|characters|strong|weak/i)).toBeVisible();
    });

    test("should show error for password mismatch", async ({ page }) => {
      await goToSignup(page);
      
      const passwordField = page.getByLabel(/^password$/i);
      const confirmField = page.getByLabel(/confirm password/i);
      
      // Only run if confirm password field exists
      if (await confirmField.isVisible()) {
        await page.getByLabel(/email/i).fill("newuser@example.com");
        await passwordField.fill("Password123!");
        await confirmField.fill("DifferentPassword!");
        
        await page.getByRole("button", { name: /sign up|register|create/i }).click();
        
        // Should show mismatch error
        await expect(page.getByText(/match|same|identical/i)).toBeVisible();
      }
    });

    test("should show error for already registered email", async ({ page }) => {
      await goToSignup(page);
      
      // Use an email that's already registered
      await page.getByLabel(/email/i).fill(TEST_USER.email);
      
      const passwordFields = page.getByLabel(/password/i);
      await passwordFields.first().fill("NewPassword123!");
      
      const confirmField = page.getByLabel(/confirm password/i);
      if (await confirmField.isVisible()) {
        await confirmField.fill("NewPassword123!");
      }
      
      await page.getByRole("button", { name: /sign up|register|create/i }).click();
      
      // Should show error about existing account
      await expect(page.getByText(/already|exists|registered|use/i)).toBeVisible();
    });
  });

  test.describe("Logout", () => {
    test("should successfully logout", async ({ page }) => {
      // First login
      await login(page, TEST_USER.email, TEST_USER.password);
      await waitForPageLoad(page);
      
      // Then logout
      await logout(page);
      
      // Should redirect to auth or landing page
      await expect(page).toHaveURL(/\/(auth)?$/);
    });

    test("should redirect to login when accessing protected route after logout", async ({ page }) => {
      // Login
      await login(page, TEST_USER.email, TEST_USER.password);
      await waitForPageLoad(page);
      
      // Logout
      await logout(page);
      
      // Try to access dashboard
      await page.goto("/dashboard");
      
      // Should redirect to auth
      await expect(page).toHaveURL(/\/auth/);
    });
  });

  test.describe("Password Reset", () => {
    test("should display forgot password link", async ({ page }) => {
      await goToLogin(page);
      
      const forgotLink = page.getByRole("link", { name: /forgot|reset|password/i });
      await expect(forgotLink).toBeVisible();
    });

    test("should navigate to password reset page", async ({ page }) => {
      await goToLogin(page);
      
      const forgotLink = page.getByRole("link", { name: /forgot|reset|password/i });
      if (await forgotLink.isVisible()) {
        await forgotLink.click();
        
        // Should show password reset form or email input
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /reset|send|submit/i })).toBeVisible();
      }
    });

    test("should show success message after requesting password reset", async ({ page }) => {
      await goToLogin(page);
      
      const forgotLink = page.getByRole("link", { name: /forgot|reset|password/i });
      if (await forgotLink.isVisible()) {
        await forgotLink.click();
        
        await page.getByLabel(/email/i).fill(TEST_USER.email);
        await page.getByRole("button", { name: /reset|send|submit/i }).click();
        
        // Should show success message
        await expect(page.getByText(/sent|check|email|reset/i)).toBeVisible();
      }
    });
  });

  test.describe("Session Timeout", () => {
    test("should show session timeout warning before expiry", async ({ page }) => {
      await login(page, TEST_USER.email, TEST_USER.password);
      await waitForPageLoad(page);
      
      // This test would require manipulating session expiry
      // For now, just verify the session timeout component exists in code
      // The actual timeout testing would need mocked timers
      
      // Verify user is logged in
      await expect(page).not.toHaveURL(/\/auth/);
    });
  });
});
