import { test, expect } from '@playwright/test';

const CITIZEN_EMAIL = process.env.E2E_CITIZEN_EMAIL ?? '';
const CITIZEN_PASSWORD = process.env.E2E_CITIZEN_PASSWORD ?? '';

test.describe('Portal Authentication Flows', () => {
  test('citizen login flow works', async ({ page }) => {
    // Navigate to citizen portal login
    await page.goto('/ro/portal/login');

    // Fill in credentials
    await page.getByLabel(/adres[aă] de email/i).fill(CITIZEN_EMAIL);
    await page.getByLabel(/parol[aă]/i).fill(CITIZEN_PASSWORD);
    await page.getByRole('button', { name: /autentificare/i }).click();

    // Verify redirect to dashboard
    await page.waitForURL('**/ro/portal/dashboard**', { timeout: 15000 });
    await expect(page).toHaveURL(/\/ro\/portal\/dashboard/);

    // Verify dashboard content loads
    await expect(page.getByRole('heading', { name: /panou principal|dashboard/i }).first()).toBeVisible();
  });

  test('citizen registration flow UI works', async ({ page }) => {
    await page.goto('/ro/portal/register');

    // Check presence of registration form
    await expect(page.getByLabel(/prenume|first name/i)).toBeVisible();
    await expect(page.getByLabel(/nume|last name/i)).toBeVisible();
    await expect(page.getByLabel(/adres[aă] de email/i)).toBeVisible();
    await expect(page.getByLabel(/^parol[aă]/i)).toBeVisible();
    await expect(page.getByLabel(/confirmare parol[aă]|confirm password/i)).toBeVisible();

    // Fill registration form with test data
    await page.getByLabel(/prenume|first name/i).fill('Test');
    await page.getByLabel(/nume|last name/i).fill('Citizen');
    await page.getByLabel(/adres[aă] de email/i).fill(`test-${Date.now()}@example.ro`);
    await page.getByLabel(/^parol[aă]/i).fill('StrongPassword123!');
    await page.getByLabel(/confirmare parol[aă]|confirm password/i).fill('StrongPassword123!');

    // Check password mismatch warning UI
    await page.getByLabel(/confirmare parol[aă]|confirm password/i).fill('WrongPassword');
    await expect(page.getByText(/parolele nu se potrivesc|passwords do not match/i)).toBeVisible();

    // Fix the mismatch
    await page.getByLabel(/confirmare parol[aă]|confirm password/i).fill('StrongPassword123!');
    await expect(page.getByText(/parolele nu se potrivesc|passwords do not match/i)).not.toBeVisible();

    // Verify submit button is available
    const submitBtn = page.getByRole('button', { name: /creeaz[aă] cont|register/i });
    await expect(submitBtn).toBeVisible();
  });

  test('portal dashboard redirects to login when unauthenticated', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/ro/portal/dashboard');

    // Should be redirected to login page
    await page.waitForURL('**/ro/portal/login**');
    await expect(page).toHaveURL(/\/ro\/portal\/login/);

    await context.close();
  });
});
