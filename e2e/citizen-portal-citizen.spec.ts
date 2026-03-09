import { test, expect } from '@playwright/test';

test.describe('Citizen Portal — Functional Tests', () => {
  test('view taxes list', async ({ page }) => {
    await page.goto('/ro/portal/impozite');

    await expect(page.locator('main')).toBeVisible();

    // Should show a heading related to taxes
    await expect(
      page.getByRole('heading', { name: /impozit|taxe/i }).first()
    ).toBeVisible();

    // Should display either tax entries or an empty state
    const taxEntries = page.locator('table tbody tr, [data-testid="tax-item"]').or(
      page.getByText(/nu (există|sunt|aveți)|nu au fost găsite|nicio|empty/i)
    );
    await expect(taxEntries.first()).toBeVisible({ timeout: 10000 });
  });

  test('view properties list', async ({ page }) => {
    await page.goto('/ro/portal/proprietati');

    await expect(page.locator('main')).toBeVisible();

    // Should show a heading — actual heading is "Proprietățile mele"
    await expect(
      page.getByRole('heading', { name: /proprietăț|proprietat/i }).first()
    ).toBeVisible();

    // Should display property cards/list or empty state
    const propertyContent = page
      .locator('[class*="card"], table tbody tr, [data-testid="property-item"]')
      .or(page.getByText(/nu (există|sunt|aveți)|nicio proprietate|empty/i));
    await expect(propertyContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('view payment history', async ({ page }) => {
    await page.goto('/ro/portal/plati');

    await expect(page.locator('main')).toBeVisible();

    // Should show a heading related to payments
    await expect(
      page.getByRole('heading', { name: /plat|plăți|istoric/i }).first()
    ).toBeVisible();

    // Should display payment list or empty state
    const paymentContent = page
      .locator('table tbody tr, [data-testid="payment-item"]')
      .or(page.getByText(/nu (există|sunt|aveți)|nicio plată|empty/i));
    await expect(paymentContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('certificate page loads with request form', async ({ page }) => {
    await page.goto('/ro/portal/certificate');

    await expect(page.locator('main')).toBeVisible();

    // Should show a heading related to certificates
    await expect(
      page.getByRole('heading', { name: /certificat/i }).first()
    ).toBeVisible();

    // Look for the certificate request form or existing certificate requests
    const certificateContent = page
      .locator('form, [data-testid="certificate-form"]')
      .or(page.getByRole('button', { name: /solicit|cerere|request/i }))
      .or(page.getByText(/certificat fiscal|solicitare/i));
    await expect(certificateContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('view profile with citizen details', async ({ page }) => {
    await page.goto('/ro/portal/profil');

    await expect(page.locator('main')).toBeVisible();

    // Should show profile heading
    await expect(
      page.getByRole('heading', { name: /profil|cont/i }).first()
    ).toBeVisible();

    // Profile should display the citizen's email
    await expect(
      page.getByText('cetatean@example.ro').or(
        page.locator('input[value="cetatean@example.ro"]')
      )
    ).toBeVisible({ timeout: 10000 });

    // Should have name fields
    const nameInputs = page.locator('input[name*="name"], input[name*="nume"]').or(
      page.getByLabel(/nume|prenume|name/i)
    );
    await expect(nameInputs.first()).toBeVisible();
  });

  test('contact form renders and accepts input', async ({ page }) => {
    await page.goto('/ro/portal/contact');

    await expect(page.locator('main')).toBeVisible();

    // Should show contact heading
    await expect(
      page.getByRole('heading', { name: /contact/i }).first()
    ).toBeVisible();

    // Find subject and message fields
    const subjectField = page.locator('input[name="subject"]').or(
      page.getByLabel(/subiect|subject/i)
    );
    const messageField = page.locator('textarea[name="message"]').or(
      page.getByLabel(/mesaj|message/i)
    );

    await expect(subjectField.first()).toBeVisible();
    await expect(messageField.first()).toBeVisible();

    // Fill in the fields to verify they accept input
    await subjectField.first().fill('Test subiect');
    await messageField.first().fill('Acesta este un mesaj de test.');

    // Verify values were set
    await expect(subjectField.first()).toHaveValue('Test subiect');
    await expect(messageField.first()).toHaveValue('Acesta este un mesaj de test.');

    // Verify submit button exists (but don't click it to avoid sending real emails)
    const submitButton = page.getByRole('button', { name: /trimite|send|submit/i });
    await expect(submitButton.first()).toBeVisible();
  });

  test('documents page loads', async ({ page }) => {
    await page.goto('/ro/portal/documente');

    await expect(page.locator('main')).toBeVisible();

    // Should show a heading related to documents
    await expect(
      page.getByRole('heading', { name: /document/i }).first()
    ).toBeVisible();

    // Should display documents list or empty state
    const docContent = page
      .locator('table tbody tr, [class*="card"], [data-testid="document-item"]')
      .or(page.getByText(/nu (există|sunt|aveți)|niciun document|empty/i));
    await expect(docContent.first()).toBeVisible({ timeout: 10000 });
  });
});
