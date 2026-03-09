import { test, expect } from '@playwright/test';

const CITIZEN_ROUTES = [
  { path: '/ro/portal/dashboard', name: 'Dashboard' },
  { path: '/ro/portal/impozite', name: 'Impozite (Taxes)' },
  { path: '/ro/portal/proprietati', name: 'Proprietati (Properties)' },
  { path: '/ro/portal/plati', name: 'Plati (Payments)' },
  { path: '/ro/portal/documente', name: 'Documente (Documents)' },
  { path: '/ro/portal/certificate', name: 'Certificate' },
  { path: '/ro/portal/contact', name: 'Contact' },
  { path: '/ro/portal/profil', name: 'Profil (Profile)' },
];

test.describe('Citizen Portal Navigation — smoke tests', () => {
  for (const route of CITIZEN_ROUTES) {
    test(`${route.name} page loads at ${route.path}`, async ({ page }) => {
      await page.goto(route.path);

      // Should stay on the portal (not redirected to login)
      await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));

      // Main content area should be visible
      await expect(page.locator('main')).toBeVisible();

      // Page should have a meaningful title
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title).not.toMatch(/error|404|500/i);

      // Should contain at least one heading or meaningful content
      const content = page.getByRole('heading').or(
        page.getByText(/portal|taxe|impozite|proprietat|plat|document|certificat|contact|profil/i)
      );
      await expect(content.first()).toBeVisible();
    });
  }

  test('header navigation links are present', async ({ page }) => {
    await page.goto('/ro/portal/dashboard');

    // The portal uses a top header nav (not a sidebar)
    const nav = page.getByRole('navigation').or(page.locator('header'));
    await expect(nav.first()).toBeVisible();

    // Verify key navigation links exist — labels come from portal i18n:
    // "Panou principal", "Impozite", "Proprietăți", "Plăți", "Certificate"
    const navLinks = [
      /panou principal|dashboard/i,
      /impozite/i,
      /propriet[aă][tț]i/i,
      /pl[aă][tț]i/i,
      /certificate/i,
    ];

    for (const linkPattern of navLinks) {
      const link = page.getByRole('link', { name: linkPattern }).first();
      await expect(link).toBeVisible();
    }
  });

  test('no console errors on dashboard load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/ro/portal/dashboard');
    await expect(page.locator('main')).toBeVisible();

    // Filter out known benign errors (e.g. third-party scripts)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('third-party')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
