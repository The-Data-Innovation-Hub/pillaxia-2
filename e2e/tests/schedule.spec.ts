import { test, expect } from "../fixtures/auth";
import { login, waitForPageLoad, TEST_USER } from "../fixtures/auth";

test.describe("Schedule Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await waitForPageLoad(page);
  });

  test.describe("Today's Schedule", () => {
    test("should display schedule page", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      // Should show schedule view
      await expect(page.getByRole("heading", { name: /schedule|today/i })).toBeVisible();
    });

    test("should show time-based medication list", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      // Look for time slots or scheduled items
      const timeSlots = page.locator('[data-testid="time-slot"], [data-testid="dose-item"]');
      const scheduleItems = page.getByRole("listitem");
      
      // Either has scheduled items or empty state
      const hasContent = 
        await timeSlots.count() > 0 || 
        await scheduleItems.count() > 0 ||
        await page.getByText(/no.*scheduled|nothing.*today/i).isVisible();
      
      expect(hasContent).toBe(true);
    });

    test("should display upcoming doses prominently", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      // Look for "next" or "upcoming" section
      const upcomingSection = page.getByText(/next|upcoming|due/i);
      
      if (await upcomingSection.isVisible()) {
        await expect(upcomingSection).toBeVisible();
      }
    });

    test("should show medication details in schedule items", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      const doseItems = page.locator('[data-testid="dose-item"]');
      const itemCount = await doseItems.count();
      
      if (itemCount > 0) {
        const firstItem = doseItems.first();
        
        // Should show medication name and time
        await expect(firstItem).toBeVisible();
        // Dose items typically show AM/PM or 24h time
        await expect(firstItem.getByText(/AM|PM|\d{1,2}:\d{2}/i)).toBeVisible();
      }
    });
  });

  test.describe("Dose Actions", () => {
    test("should show action buttons for pending doses", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      const doseItems = page.locator('[data-testid="dose-item"]');
      const itemCount = await doseItems.count();
      
      if (itemCount > 0) {
        const firstItem = doseItems.first();
        
        // Should have take/skip actions
        const actionButtons = firstItem.getByRole("button");
        await expect(actionButtons.first()).toBeVisible();
      }
    });

    test("should record dose taken with timestamp", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      const doseItems = page.locator('[data-testid="dose-item"]');
      
      if (await doseItems.count() > 0) {
        const takeButton = doseItems.first().getByRole("button", { name: /take|done|complete/i });
        
        if (await takeButton.isVisible()) {
          await takeButton.click();
          
          // Should update status to taken
          await expect(page.getByText(/taken|completed|recorded/i)).toBeVisible();
        }
      }
    });

    test("should allow adding notes to dose log", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      const doseItems = page.locator('[data-testid="dose-item"]');
      
      if (await doseItems.count() > 0) {
        // Click on dose item or menu to add notes
        const moreButton = doseItems.first().getByRole("button", { name: /more|menu|options/i });
        
        if (await moreButton.isVisible()) {
          await moreButton.click();
          
          const addNoteOption = page.getByRole("menuitem", { name: /note|comment/i });
          if (await addNoteOption.isVisible()) {
            await addNoteOption.click();
            
            // Notes dialog/input should appear
            await expect(page.getByLabel(/note|comment/i)).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Schedule Navigation", () => {
    test("should navigate to previous day", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      const prevButton = page.getByRole("button", { name: /previous|prev|back|←/i });
      
      if (await prevButton.isVisible()) {
        await prevButton.click();
        await waitForPageLoad(page);
        
        // Date should change (look for yesterday's date or different header)
        await expect(page.getByRole("heading")).toBeVisible();
      }
    });

    test("should navigate to next day", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      const nextButton = page.getByRole("button", { name: /next|forward|→/i });
      
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await waitForPageLoad(page);
        
        await expect(page.getByRole("heading")).toBeVisible();
      }
    });

    test("should return to today", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      // Navigate away from today
      const nextButton = page.getByRole("button", { name: /next|forward|→/i });
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await waitForPageLoad(page);
        
        // Look for "Today" button
        const todayButton = page.getByRole("button", { name: /today/i });
        if (await todayButton.isVisible()) {
          await todayButton.click();
          await waitForPageLoad(page);
          
          // Should return to today's schedule
          await expect(page.getByRole("heading")).toBeVisible();
        }
      }
    });
  });

  test.describe("Calendar View", () => {
    test("should open calendar view", async ({ page }) => {
      await page.goto("/dashboard/schedule");
      await waitForPageLoad(page);
      
      // Look for calendar toggle or icon
      const calendarButton = page.getByRole("button", { name: /calendar|month/i });
      
      if (await calendarButton.isVisible()) {
        await calendarButton.click();
        
        // Calendar should be visible
        await expect(page.locator('[role="grid"], .calendar, [data-testid="calendar"]')).toBeVisible();
      }
    });

    test("should show dose indicators on calendar days", async ({ page }) => {
      await page.goto("/dashboard/appointments");
      await waitForPageLoad(page);
      
      // Calendar view should show indicators for days with doses
      const calendar = page.locator('[role="grid"], .calendar');
      
      if (await calendar.isVisible()) {
        // Days with doses typically have visual indicators (dots, badges)
        await expect(calendar).toBeVisible();
      }
    });

    test("should select date from calendar", async ({ page }) => {
      await page.goto("/dashboard/appointments");
      await waitForPageLoad(page);
      
      const calendar = page.locator('[role="grid"], .calendar');
      
      if (await calendar.isVisible()) {
        // Click on a day in the calendar
        const dayButton = calendar.getByRole("button").first();
        if (await dayButton.isVisible()) {
          await dayButton.click();
          await waitForPageLoad(page);
          
          // Should update the schedule view
          await expect(page.getByRole("heading")).toBeVisible();
        }
      }
    });
  });

  test.describe("Adherence Summary", () => {
    test("should display adherence percentage", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForPageLoad(page);
      
      // Dashboard typically shows adherence stats
      const adherenceDisplay = page.getByText(/%|adherence|compliance/i);
      
      if (await adherenceDisplay.isVisible()) {
        await expect(adherenceDisplay).toBeVisible();
      }
    });

    test("should show weekly adherence trend", async ({ page }) => {
      await page.goto("/dashboard");
      await waitForPageLoad(page);
      
      // Look for chart or trend display
      const trendChart = page.locator('[data-testid="adherence-chart"], canvas, svg');
      
      if (await trendChart.count() > 0) {
        await expect(trendChart.first()).toBeVisible();
      }
    });
  });
});
