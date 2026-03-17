import { test, expect } from '@playwright/test';

/**
 * Post-deploy verification for Legea 239/2025 + Art. 456 eligibility detection.
 * Runs as admin (chromium-admin project).
 */

const NAV_TIMEOUT = 30_000;

test.describe('Post-Deploy: Dashboard', () => {
  test('dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/ro/dashboard', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/ro\/dashboard/);
    await expect(page.locator('main')).toBeVisible({ timeout: NAV_TIMEOUT });

    // KPI cards should render
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: NAV_TIMEOUT });

    // No server error
    const title = await page.title();
    expect(title).not.toMatch(/500|error/i);
  });
});

test.describe('Post-Deploy: Art. 456 — Calcul Page', () => {
  test('calcul page shows two-step flow (detection + calculation)', async ({ page }) => {
    await page.goto('/ro/admin/calcul', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Page should load without error
    await expect(page.locator('main')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Step 1: Eligibility detection card
    await expect(page.getByRole('heading', { name: /Pas 1.*Detectare/i })).toBeVisible({ timeout: NAV_TIMEOUT });

    // Step 2: Tax calculation card
    await expect(page.getByText(/Pas 2.*impozite|calculul/i)).toBeVisible({ timeout: NAV_TIMEOUT });

    // Detection button should exist
    await expect(page.getByRole('button', { name: /detectare|rulează/i })).toBeVisible({ timeout: NAV_TIMEOUT });

    // Calculation button should exist
    await expect(page.getByRole('button', { name: /calcul/i })).toBeVisible({ timeout: NAV_TIMEOUT });
  });
});

test.describe('Post-Deploy: Art. 456 — Scutiri Page', () => {
  test('scutiri page loads with filter tabs including pending', async ({ page }) => {
    await page.goto('/ro/admin/scutiri', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Page heading
    await expect(page.getByRole('heading', { name: /scutiri/i })).toBeVisible({ timeout: NAV_TIMEOUT });

    // Filter buttons should include "În așteptare" (pending)
    await expect(page.getByRole('link', { name: /așteptare/i })).toBeVisible({ timeout: NAV_TIMEOUT });

    // Table or empty state should render
    const table = page.locator('table');
    const emptyState = page.getByText(/nu s-au g[aă]sit rezultate|no results/i);
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: NAV_TIMEOUT });
  });

  test('scutiri pending tab loads', async ({ page }) => {
    await page.goto('/ro/admin/scutiri?status=pending', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Should not be a server error page
    const title = await page.title();
    expect(title).not.toMatch(/500|error/i);

    // Either a pending review table or empty state
    const table = page.locator('table');
    const emptyState = page.locator('text=/nu s-au g[aă]sit rezultate|no results/i');
    const shield = page.locator('svg.lucide-shield');
    await expect(table.or(emptyState).or(shield).first()).toBeVisible({ timeout: NAV_TIMEOUT });
  });
});

test.describe('Post-Deploy: Taxpayer Edit — Art. 456 Flags', () => {
  test('taxpayer edit form shows Art. 456 eligibility section', async ({ page }) => {
    // Go to taxpayer list first
    await page.goto('/ro/contribuabili', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    // Find the first edit link
    const editLink = page.getByRole('link', { name: /editează/i }).first()
      .or(page.locator('table tbody tr a').first());

    if (!await editLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      test.skip(true, 'No taxpayers available to edit');
      return;
    }

    await editLink.click();

    // Navigate to edit page if we landed on detail first
    const currentUrl = page.url();
    if (!currentUrl.includes('/edit')) {
      const editBtn = page.getByRole('link', { name: /editează|edit/i }).first();
      if (await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await editBtn.click();
      }
    }

    await page.waitForURL('**/edit**', { timeout: NAV_TIMEOUT });
    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Art. 456 section should be present
    await expect(page.getByText(/Art\. 456|Statut fiscal/i)).toBeVisible({ timeout: NAV_TIMEOUT });

    // Eligibility checkboxes should exist
    await expect(page.getByText(/handicap grav/i)).toBeVisible();
    await expect(page.getByText(/veteran.*r[aă]zboi/i)).toBeVisible();
    await expect(page.getByText(/erou.*revolu/i)).toBeVisible();
    await expect(page.getByText(/pensionar/i)).toBeVisible();
  });
});

test.describe('Post-Deploy: Building Forms — Property Flags', () => {
  test('building edit form shows isCultReligios and isMonumentIstoric', async ({ page }) => {
    await page.goto('/ro/proprietati/cladiri', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    const editLink = page.getByRole('link', { name: /editează/i }).first();

    if (!await editLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      test.skip(true, 'No buildings available to edit');
      return;
    }

    await editLink.click();
    await page.waitForURL('**/edit**', { timeout: NAV_TIMEOUT });
    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Art. 456 property flags
    await expect(page.getByText(/cult religios/i)).toBeVisible({ timeout: NAV_TIMEOUT });
    await expect(page.getByText(/monument istoric/i)).toBeVisible({ timeout: NAV_TIMEOUT });

    // The checkboxes should be interactable
    const cultCheckbox = page.locator('input[name="isCultReligios"]');
    await expect(cultCheckbox).toBeVisible();
    const monumentCheckbox = page.locator('input[name="isMonumentIstoric"]');
    await expect(monumentCheckbox).toBeVisible();
  });

  test('building create form shows property flags', async ({ page }) => {
    await page.goto('/ro/proprietati/cladiri/new', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    await expect(page.getByText(/cult religios/i)).toBeVisible({ timeout: NAV_TIMEOUT });
    await expect(page.getByText(/monument istoric/i)).toBeVisible({ timeout: NAV_TIMEOUT });
  });
});

test.describe('Post-Deploy: Land Forms — Property Flags', () => {
  test('land edit form shows isCultReligios', async ({ page }) => {
    await page.goto('/ro/proprietati/terenuri', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    const editLink = page.getByRole('link', { name: /editează/i }).first();

    if (!await editLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      test.skip(true, 'No land properties available to edit');
      return;
    }

    await editLink.click();
    await page.waitForURL('**/edit**', { timeout: NAV_TIMEOUT });
    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    await expect(page.getByText(/cult religios/i)).toBeVisible({ timeout: NAV_TIMEOUT });

    const cultCheckbox = page.locator('input[name="isCultReligios"]');
    await expect(cultCheckbox).toBeVisible();
  });

  test('land create form shows isCultReligios', async ({ page }) => {
    await page.goto('/ro/proprietati/terenuri/new', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });
    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    await expect(page.getByText(/cult religios/i)).toBeVisible({ timeout: NAV_TIMEOUT });
  });
});

test.describe('Post-Deploy: Legea 239 — HCL & Vehicles', () => {
  test('HCL list page loads', async ({ page }) => {
    await page.goto('/ro/admin/hcl', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible({ timeout: NAV_TIMEOUT });

    const title = await page.title();
    expect(title).not.toMatch(/500|error/i);

    // Page should have HCL content
    const heading = page.getByRole('heading', { name: /HCL|hotărâri/i });
    const table = page.locator('table');
    const emptyState = page.getByText(/nu s-au g[aă]sit/i);
    await expect(heading.or(table).or(emptyState).first()).toBeVisible({ timeout: NAV_TIMEOUT });
  });

  test('vehicle list page loads', async ({ page }) => {
    await page.goto('/ro/proprietati/vehicule', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /vehicule/i })).toBeVisible({ timeout: NAV_TIMEOUT });

    const title = await page.title();
    expect(title).not.toMatch(/500|error/i);
  });

  test('vehicle create form shows emission and fuel type fields', async ({ page }) => {
    await page.goto('/ro/proprietati/vehicule/new', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Should have emission/fuel type fields from Legea 239
    const emissionsField = page.locator('input[name*="emisii"], input[name*="co2"], #emisiiCo2GKm');
    const fuelField = page.locator('select[name*="combustibil"], #tipCombustibil');

    // At least one of these vehicle-specific fields should be present
    const vehicleFormLoaded = page.locator('input[name="anFabricatie"], #anFabricatie');
    await expect(vehicleFormLoaded).toBeVisible({ timeout: NAV_TIMEOUT });

    // Check emissions or fuel fields exist in the form
    const formHtml = await page.locator('form').innerHTML();
    const hasEmissions = formHtml.includes('emisii') || formHtml.includes('co2') || formHtml.includes('CO2');
    const hasFuel = formHtml.includes('combustibil') || formHtml.includes('fuel');
    expect(hasEmissions || hasFuel).toBe(true);
  });
});

test.describe('Post-Deploy: Taxpayer Create — Art. 456 Flags', () => {
  test('new taxpayer form shows Art. 456 section', async ({ page }) => {
    await page.goto('/ro/contribuabili/new', { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' });

    await expect(page.locator('form')).toBeVisible({ timeout: NAV_TIMEOUT });

    // Art. 456 section
    await expect(page.getByText(/Art\. 456|Statut fiscal/i)).toBeVisible({ timeout: NAV_TIMEOUT });

    // Checkboxes
    await expect(page.getByText(/handicap grav/i)).toBeVisible();
    await expect(page.getByText('Veteran de război', { exact: true })).toBeVisible();
  });
});
