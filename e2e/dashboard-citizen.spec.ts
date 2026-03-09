import { test, expect } from '@playwright/test';

test.describe('Citizen Dashboard', () => {
  test('citizen portal dashboard loads', async ({ page }) => {
    // Navigate directly to the dashboard (the portal root redirects based on NextAuth,
    // not citizen-token, so it would send us to login)
    await page.goto('/ro/portal/dashboard');

    // Should be on the dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/ro\/portal\/dashboard/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('citizen-specific elements are visible', async ({ page }) => {
    await page.goto('/ro/portal/dashboard');

    // The portal should show citizen-oriented content
    // Look for portal-specific headings, links, or sections
    const portalContent = page.getByRole('heading').or(
      page.getByText(/portal|taxe|impozite|proprietat|pl[aă][tț]i|bun venit/i)
    );
    await expect(portalContent.first()).toBeVisible();
  });
});
