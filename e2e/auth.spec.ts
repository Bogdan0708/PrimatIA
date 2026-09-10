import { test, expect } from '@playwright/test';

// Must match the SEED_PASSWORD used for `npm run db:seed` (see prisma/seed.ts).
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? '';

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/ro/login');

    // Should show the login form
    await expect(page.getByLabel('Adresă de email')).toBeVisible();
    await expect(page.getByLabel('Parolă')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Autentificare', exact: true })).toBeVisible();
  });

  test('login with valid admin credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/ro/login');

    await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
    await page.getByLabel('Parolă').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Autentificare', exact: true }).click();

    // Should redirect to the dashboard
    await page.waitForURL('**/ro/dashboard**');
    await expect(page).toHaveURL(/\/ro\/dashboard/);
  });

  test('login with invalid password shows error', async ({ page }) => {
    await page.goto('/ro/login');

    await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
    await page.getByLabel('Parolă').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Autentificare', exact: true }).click();

    // Should remain on the login page and show an error message
    await expect(page.getByLabel('Adresă de email')).toBeVisible();
    await expect(page.getByText(/invalid|greșit|incorect|eroare/i)).toBeVisible();
  });

  test('forgot password link is present and navigable', async ({ page }) => {
    await page.goto('/ro/login');

    const forgotLink = page.getByText('Ai uitat parola?');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    // Should navigate to a password reset page
    await expect(page).toHaveURL(/\/(forgot|reset|recuperare)/i);
  });

  test('ROeID section shows disabled state', async ({ page }) => {
    await page.goto('/ro/login');

    // ROeID authentication section should be visible but in a disabled state
    await expect(page.getByText('Dezactivat')).toBeVisible();

    const roeidButton = page.getByRole('button', { name: /ROeID/i });
    await expect(roeidButton).toBeDisabled();
  });
});
