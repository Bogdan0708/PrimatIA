import { test, expect } from '@playwright/test';

/**
 * Smoke tests for admin sidebar navigation.
 * Verifies every admin-accessible route loads without errors.
 * Uses admin auth state (storageState: admin.json).
 */
test.describe.serial('Admin Navigation — Sidebar Links', () => {
  // Shared navigation timeout for the live GCP deployment
  const NAV_TIMEOUT = 30_000;

  const commonRoutes = [
    { name: 'Dashboard', path: '/ro/dashboard', heading: /panou principal|dashboard/i },
    { name: 'Contribuabili', path: '/ro/contribuabili', heading: /contribuabili/i },
    { name: 'Cladiri', path: '/ro/proprietati/cladiri', heading: /cl[aă]diri/i },
    { name: 'Terenuri', path: '/ro/proprietati/terenuri', heading: /terenuri/i },
    { name: 'Vehicule', path: '/ro/proprietati/vehicule', heading: /vehicule/i },
    { name: 'Plati', path: '/ro/plati', heading: /pl[aă][tț]i/i },
    { name: 'Documente', path: '/ro/documente', heading: /documente/i },
    { name: 'Somatii', path: '/ro/somatii', heading: /soma[tț]ii/i },
    { name: 'Rapoarte', path: '/ro/rapoarte', heading: /rapoarte/i },
    { name: 'Reglementari', path: '/ro/reglementari', heading: /legisla[tț]ie|reglementari/i },
  ];

  const adminRoutes = [
    { name: 'HCL Decisions', path: '/ro/admin/hcl', heading: /hot[aă]r[aâ]ri|hcl/i },
    { name: 'Scutiri', path: '/ro/admin/scutiri', heading: /scutiri/i },
    { name: 'Calcul', path: '/ro/admin/calcul', heading: /calcul/i },
    { name: 'Import', path: '/ro/admin/import', heading: /import/i },
    { name: 'Anomalii', path: '/ro/admin/anomalii', heading: /anomalii/i },
    { name: 'Previziuni', path: '/ro/admin/previziuni', heading: /previziuni|forecast/i },
    { name: 'Audit Log', path: '/ro/admin/audit-log', heading: /audit|jurnal/i },
  ];

  const allRoutes = [...commonRoutes, ...adminRoutes];

  for (const route of allRoutes) {
    test(`${route.name} (${route.path}) loads correctly`, async ({ page }) => {
      // Navigate to the route
      await page.goto(route.path, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

      // Should not be redirected to login
      await expect(page).not.toHaveURL(/\/login/);

      // Main content area should be visible
      await expect(page.locator('main')).toBeVisible({ timeout: NAV_TIMEOUT });

      // Page title should not indicate an error
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title).not.toMatch(/404|500|error/i);

      // No HTTP error text visible on the page — avoid bare number patterns
      // like /404|500/ which can match data in table cells (e.g. area "1500 mp").
      // The page title check above already catches numeric error codes.
      const errorIndicator = page.getByText(/server error|page not found|pagina nu a fost/i);
      await expect(errorIndicator).toHaveCount(0);

      // A heading matching the expected content should be present
      const heading = page.getByRole('heading', { name: route.heading }).first();
      await expect(heading).toBeVisible({ timeout: NAV_TIMEOUT });
    });
  }
});
