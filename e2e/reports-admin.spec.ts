import { test, expect } from '@playwright/test';

test.describe('Admin Reports', () => {
  test('reports page loads with report options', async ({ page }) => {
    await page.goto('/ro/rapoarte');

    await expect(page.locator('main')).toBeVisible();

    // Should show the reports page heading
    await expect(
      page.getByRole('heading', { name: /rapoarte|reports/i }).first()
    ).toBeVisible();

    // Should display report type cards
    const reportCards = page.locator('[class*="card"], [class*="Card"]');
    await expect(reportCards.first()).toBeVisible();

    // Should have the fiscal year filter
    const fiscalYearInput = page.locator('input[type="number"]').or(
      page.getByLabel(/an fiscal|fiscal year/i)
    );
    await expect(fiscalYearInput.first()).toBeVisible();
  });

  test('report types are displayed', async ({ page }) => {
    await page.goto('/ro/rapoarte');
    await expect(page.locator('main')).toBeVisible();

    // Should show at least some of the report types
    // From the code: venituri_incasate, restante, registru_rol, borderou_zilnic, debite_incasari
    const reportNames = page.getByText(
      /venituri|restante|registru|borderou|debite|incasări/i
    );
    await expect(reportNames.first()).toBeVisible();
  });

  test('generate a report', async ({ page }) => {
    await page.goto('/ro/rapoarte');
    await expect(page.locator('main')).toBeVisible();

    // Click the first "Generează" (Generate) button
    const generateButton = page.getByRole('button', { name: /generează|generate/i }).first();
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // Wait for either report results (table) or a "no results" message
    const reportResult = page
      .locator('table')
      .or(page.getByText(/nu (există|sunt)|niciun rezultat|no results|generat/i));
    await expect(reportResult.first()).toBeVisible({ timeout: 15000 });
  });

  test('report results show table with columns', async ({ page }) => {
    await page.goto('/ro/rapoarte');
    await expect(page.locator('main')).toBeVisible();

    // Generate a report
    const generateButton = page.getByRole('button', { name: /generează|generate/i }).first();
    await generateButton.click();

    // If data exists, verify the table structure
    const table = page.locator('table');
    const noResults = page.getByText(/nu (există|sunt)|niciun rezultat|no results/i);

    // Wait for either outcome
    await expect(table.or(noResults).first()).toBeVisible({ timeout: 15000 });

    // If table is present, verify it has headers and at least structure
    if (await table.isVisible()) {
      const headers = table.locator('thead th');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
    }
  });

  test('CSV export button exists', async ({ page }) => {
    await page.goto('/ro/rapoarte');
    await expect(page.locator('main')).toBeVisible();

    // Should have CSV export buttons
    const csvButton = page.getByRole('button', { name: /csv/i }).first();
    await expect(csvButton).toBeVisible();
  });

  test('monthly report page loads', async ({ page }) => {
    await page.goto('/ro/rapoarte/lunar');

    await expect(page.locator('main')).toBeVisible();

    // Should not be an error page
    const title = await page.title();
    expect(title).not.toMatch(/404|500|error/i);

    // Should show monthly report content
    const content = page.getByRole('heading').or(
      page.getByText(/lunar|monthly|raport/i)
    );
    await expect(content.first()).toBeVisible();
  });

  test('anomalies page loads', async ({ page }) => {
    await page.goto('/ro/admin/anomalii');

    await expect(page.locator('main')).toBeVisible();

    // Should show anomalies heading or content
    await expect(
      page.getByRole('heading', { name: /anomalii|anomal/i }).or(
        page.getByText(/anomalii|detectare|verificare/i)
      ).first()
    ).toBeVisible({ timeout: 15000 });

    // Should display either anomaly entries or indicate none found
    const anomalyContent = page
      .locator('table tbody tr, [class*="card"]')
      .or(page.getByText(/nu (există|sunt)|nicio anomalie|nu au fost detectate/i));
    await expect(anomalyContent.first()).toBeVisible({ timeout: 15000 });
  });

  test('anomalies show severity badges', async ({ page }) => {
    await page.goto('/ro/admin/anomalii');
    await expect(page.locator('main')).toBeVisible();

    // If anomalies exist, they should show severity badges
    const table = page.locator('table');
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    if (await table.isVisible()) {
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Severity badges: Critic, Ridicat, Mediu, Scăzut
        const badges = page.getByText(/critic|ridicat|mediu|scăzut/i);
        await expect(badges.first()).toBeVisible();
      }
    }
  });

  test('forecast page loads with KPI cards', async ({ page }) => {
    await page.goto('/ro/admin/previziuni');

    await expect(page.locator('main')).toBeVisible();

    // Should show forecast heading
    await expect(
      page.getByRole('heading', { name: /previziuni|forecast|prognoză/i }).or(
        page.getByText(/previziuni|prognoză/i)
      ).first()
    ).toBeVisible({ timeout: 15000 });

    // Should display KPI cards with financial data (RON currency format)
    const kpiContent = page.getByText(/RON|lei|\d+,\d+/i).or(
      page.getByText(/%/)
    );
    await expect(kpiContent.first()).toBeVisible({ timeout: 15000 });
  });

  test('forecast page shows collection rate', async ({ page }) => {
    await page.goto('/ro/admin/previziuni');
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    // Should show a percentage for collection rate or growth
    const percentageText = page.getByText(/%/);
    await expect(percentageText.first()).toBeVisible({ timeout: 15000 });
  });

  test('date filters on reports page work', async ({ page }) => {
    await page.goto('/ro/rapoarte');
    await expect(page.locator('main')).toBeVisible();

    // Fill in date range filters
    const dateFromInput = page.locator('input[type="date"]').first();
    const dateToInput = page.locator('input[type="date"]').nth(1);

    if (await dateFromInput.isVisible()) {
      await dateFromInput.fill('2025-01-01');
      await expect(dateFromInput).toHaveValue('2025-01-01');
    }

    if (await dateToInput.isVisible()) {
      await dateToInput.fill('2025-12-31');
      await expect(dateToInput).toHaveValue('2025-12-31');
    }

    // Generate report with date filter applied
    const generateButton = page.getByRole('button', { name: /generează|generate/i }).first();
    await generateButton.click();

    // Should produce results or empty state (not an error)
    const result = page
      .locator('table')
      .or(page.getByText(/nu (există|sunt)|niciun rezultat|generat/i));
    await expect(result.first()).toBeVisible({ timeout: 15000 });
  });
});
