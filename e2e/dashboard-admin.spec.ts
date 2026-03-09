import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/ro/dashboard');

    // Should be on the dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/ro\/dashboard/);

    // Dashboard content should be visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('sidebar navigation elements are present', async ({ page }) => {
    await page.goto('/ro/dashboard');

    // Sidebar / navigation should be visible
    const sidebar = page.getByRole('navigation').or(page.locator('aside'));
    await expect(sidebar.first()).toBeVisible();

    // Expect common admin navigation items
    await expect(page.getByRole('link', { name: /dashboard|panou/i }).first()).toBeVisible();
  });

  test('page title is correct', async ({ page }) => {
    await page.goto('/ro/dashboard');

    // Page should have a meaningful title (not blank or generic error)
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title).not.toMatch(/error|404|500/i);
  });
});
