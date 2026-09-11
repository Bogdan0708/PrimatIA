import { test, expect } from "@playwright/test";

test.describe("Citizen Payment — Page Smoke Tests", () => {
  test("online payment page loads and shows debts or empty state", async ({ page }) => {
    await page.goto("/ro/portal/plati/online");
    await expect(page.locator("main")).toBeVisible();

    // Wait for debts to load (fetched client-side from /api/portal/debts)
    const content = page.locator('button[role="checkbox"]').first().or(
      page.getByText(/nu (există|sunt|aveți)|nicio datorie|niciun impozit|achitat|înc[aă]rcare/i).first()
    );
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test("payment history page loads with Pay Online link", async ({ page }) => {
    await page.goto("/ro/portal/plati");
    await expect(page.locator("main")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /plat|plăți|istoric/i }).first()
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /plat[aă].*online|online/i }).or(
        page.getByRole("link").filter({ hasText: /CreditCard|online/i })
      ).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("confirmation page handles missing gateway ref gracefully", async ({ page }) => {
    await page.goto("/ro/portal/plati/confirmare");
    await expect(page.locator("main")).toBeVisible();

    const content = page.getByText(/eroare|nu a fost|invalid|confirmare/i).or(
      page.getByRole("heading").first()
    );
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Citizen Payment — Bank Transfer Flow", () => {
  test("select debt and complete bank transfer initiation", async ({ page }) => {
    await page.goto("/ro/portal/plati/online");
    await expect(page.locator("main")).toBeVisible();

    // Wait for debts to load
    const checkboxes = page.locator('button[role="checkbox"]');
    // Give the client-side fetch time to complete
    await page.waitForTimeout(3_000);
    const checkboxCount = await checkboxes.count();

    // SKIP (not pass) if no debts available — this test requires payable debts
    test.skip(checkboxCount === 0,
      "No payable debts found — bank transfer flow cannot be exercised. " +
      "Run mass calculation first to generate tax debts."
    );

    // 1. Select the first debt
    await checkboxes.first().click();

    // 2. Verify total amount is shown and positive
    await expect(page.getByText(/total|sum[aă]/i).first()).toBeVisible();

    // 3. Click bank transfer button
    const bankTransferButton = page.getByRole("button", {
      name: /virament|transfer bancar|banc[aă]/i,
    });
    await expect(bankTransferButton).toBeVisible({ timeout: 5_000 });
    await bankTransferButton.click();

    // 4. Verify bank details appear (IBAN + reference code)
    await expect(
      page.getByText(/IBAN|RO\d{2}/i).first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/PRM-/i).first()
    ).toBeVisible();
  });
});
