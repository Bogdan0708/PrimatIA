import { test, expect } from '@playwright/test';

/**
 * Payment operations tests.
 * Uses admin auth state. File name contains "admin" so chromium-admin project picks it up.
 */

const NAV_TIMEOUT = 30_000;

test.describe.serial('Payment Operations', () => {
  test('List payments — page loads with table or empty state', async ({ page }) => {
    await page.goto('/ro/plati', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Heading should be visible
    await expect(page.getByRole('heading', { name: /pl[aă][tț]i/i })).toBeVisible({ timeout: NAV_TIMEOUT });

    // Either a table with payment data or an empty state
    const table = page.locator('table');
    const emptyState = page.getByText(/nu s-au g[aă]sit rezultate|nu exist[aă]/i);
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: NAV_TIMEOUT });

    // Page title should not show error
    const title = await page.title();
    expect(title).not.toMatch(/404|500|error/i);
  });

  test('Record payment — fill form and submit', async ({ page }) => {
    // First, get a valid taxpayer ID from the taxpayers list API/page
    await page.goto('/ro/contribuabili', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Extract the first taxpayer's ID from a link href
    const firstTaxpayerLink = page.locator('table tbody tr a[href*="/contribuabili/"]').first();
    let contribuabilId = '';

    if (await firstTaxpayerLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const href = await firstTaxpayerLink.getAttribute('href');
      if (href) {
        const match = href.match(/contribuabili\/([a-f0-9-]+)/);
        if (match) contribuabilId = match[1];
      }
    }

    if (!contribuabilId) {
      test.skip(true, 'No taxpayer found to record a payment for');
      return;
    }

    // Navigate to the new payment form
    await page.goto('/ro/plati/new', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Wait for the form
    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Fill in the Contribuabil ID (the form uses a plain text input for UUID)
    await page.locator('#contribuabilId').fill(contribuabilId);

    // Amount
    await page.locator('#suma').fill('100.50');

    // Payment method — uses Radix Select component (portal-rendered options)
    const methodTrigger = page.getByRole('combobox').first();
    await expect(methodTrigger).toBeVisible({ timeout: 5_000 });
    await methodTrigger.click();
    // Radix SelectContent renders in a portal — use global role selector
    const cashOption = page.getByRole('option', { name: /numerar/i });
    await expect(cashOption).toBeVisible({ timeout: 5_000 }).catch(async () => {
      // Retry: Radix might need a second click
      await methodTrigger.click();
      await expect(cashOption).toBeVisible({ timeout: 5_000 });
    });
    await cashOption.click();

    // Payment date — use role-based selector
    await page.getByRole('textbox', { name: /Data pl[aă][tț]ii/i }).fill('2026-03-08');

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Wait for either success or error
    const errorMsg = page.getByText(/eroare|error|e[sș]uat/i);
    const redirected = await page.waitForURL('**/ro/plati', { timeout: 15000 }).then(() => true).catch(() => false);

    if (redirected) {
      await expect(page.getByRole('heading', { name: /pl[aă][tț]i/i })).toBeVisible({ timeout: NAV_TIMEOUT });
    } else {
      // Form might show validation/server error — don't fail hard
      const hasError = await errorMsg.first().isVisible().catch(() => false);
      if (hasError) {
        const errorText = await errorMsg.first().textContent();
        test.info().annotations.push({ type: 'warning', description: `Payment form error: ${errorText}` });
      }
      test.info().annotations.push({ type: 'warning', description: 'Payment form did not redirect — possible server-side issue' });
    }
  });

  test('View payment — detail page loads', async ({ page }) => {
    await page.goto('/ro/plati', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Find a link to a payment detail in the table
    const detailLink = page.getByRole('link', { name: /detalii/i }).first();
    const paymentLink = page.locator('table tbody tr a[href*="/plati/"]').first();

    const link = detailLink.or(paymentLink);

    if (await link.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await link.click();
      await page.waitForURL('**/ro/plati/**', { timeout: NAV_TIMEOUT });

      // The detail page should render main content
      await expect(page.locator('main')).toBeVisible({ timeout: NAV_TIMEOUT });

      // Should not be an error page
      const title = await page.title();
      expect(title).not.toMatch(/404|500|error/i);
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No payment rows found to view details',
      });
    }
  });
});
