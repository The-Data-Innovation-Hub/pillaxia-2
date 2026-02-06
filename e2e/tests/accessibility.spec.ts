import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility (WCAG)", () => {
  test("login page should have no critical accessibility violations", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // May need design-level fixes
      .analyze();

    // Filter to only critical and serious violations
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (critical.length > 0) {
      const summary = critical
        .map((v) => `${v.impact}: ${v.id} - ${v.description} (${v.nodes.length} occurrences)`)
        .join("\n");
      console.log("Accessibility violations found:\n" + summary);
    }

    expect(critical).toHaveLength(0);
  });

  test("landing page should have no critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(critical).toHaveLength(0);
  });

  test("dashboard should have no critical accessibility violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (critical.length > 0) {
      const summary = critical
        .map((v) => `${v.impact}: ${v.id} - ${v.description} (${v.nodes.length} occurrences)`)
        .join("\n");
      console.log("Dashboard accessibility violations:\n" + summary);
    }

    expect(critical).toHaveLength(0);
  });
});
