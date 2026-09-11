import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

const ADMIN_AUTH_FILE = path.join(__dirname, '.auth/admin.json');
const CITIZEN_AUTH_FILE = path.join(__dirname, '.auth/citizen.json');

// Must match the SEED_PASSWORD used for `npm run db:seed` (see prisma/seed.ts).
const SEED_PASSWORD = process.env.SEED_PASSWORD;

setup('authenticate as admin', async ({ page }) => {
  if (!SEED_PASSWORD) {
    throw new Error('Set SEED_PASSWORD to the value used by `npm run db:seed` before running e2e tests.');
  }

  // Navigate to login page
  await page.goto('/ro/login');

  // Fill in admin credentials
  await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
  await page.getByLabel('Parolă').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Autentificare', exact: true }).click();

  // Wait for redirect to dashboard after successful login
  await page.waitForURL('**/ro/dashboard**');
  await expect(page).toHaveURL(/\/ro\/dashboard/);

  // Save signed-in state
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

setup('authenticate as citizen', async ({ page }) => {
  // Navigate to the PORTAL login page (citizen uses a separate auth system)
  await page.goto('/ro/portal/login');

  // Fill in citizen credentials — labels come from portal i18n
  await page.getByLabel(/adres[aă] de email/i).fill('cetatean@example.ro');
  await page.getByLabel(/parol[aă]/i).fill(SEED_PASSWORD!);
  await page.getByRole('button', { name: /autentificare/i }).click();

  // Wait for redirect to the portal dashboard after successful login
  await page.waitForURL('**/ro/portal/dashboard**', { timeout: 30_000 });
  await expect(page).toHaveURL(/\/ro\/portal\/dashboard/);

  // Save signed-in state
  await page.context().storageState({ path: CITIZEN_AUTH_FILE });
});
