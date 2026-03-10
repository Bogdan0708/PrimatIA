import { test, expect, Page } from '@playwright/test';

const BASE = 'https://primaria-j3dqdqxnyq-lm.a.run.app';

async function screenshotAndLog(page: Page, name: string) {
  await page.screenshot({ path: `test-results/audit-${name}.png`, fullPage: true });
}

async function staffLogin(page: Page) {
  await page.goto(`${BASE}/ro/login`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
  await page.getByLabel('Parolă').fill('Admin123!');
  await page.getByRole('button', { name: 'Autentificare', exact: true }).click();
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE B RETRY — Staff Admin (fixed selector)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE B2 — Staff Admin Full Sweep', () => {
  test.describe.configure({ mode: 'serial' });

  let p: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    p = await ctx.newPage();
  });
  test.afterAll(async () => { await p?.context().close(); });

  test('B1: Staff login + validation', async () => {
    await p.goto(`${BASE}/ro/login`);
    await p.waitForLoadState('networkidle');

    // Check ROeID button existence
    const roeidBtn = p.getByRole('button', { name: /ROeID/i });
    console.log('[B1] ROeID button count:', await roeidBtn.count());
    const roeidDisabled = await roeidBtn.first().isDisabled();
    console.log('[B1] ROeID disabled:', roeidDisabled);

    // Empty submit
    await p.getByRole('button', { name: 'Autentificare', exact: true }).click();
    await p.waitForTimeout(1500);
    await screenshotAndLog(p, 'B1r-empty-submit');

    // Wrong creds
    await p.getByLabel('Adresă de email').fill('wrong@wrong.com');
    await p.getByLabel('Parolă').fill('Wrong123!');
    await p.getByRole('button', { name: 'Autentificare', exact: true }).click();
    await p.waitForTimeout(3000);
    const errText = await p.textContent('body');
    console.log('[B1] Wrong creds result (200):', errText?.slice(0, 200));
    await screenshotAndLog(p, 'B1r-wrong-creds');

    // Actual login
    await p.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
    await p.getByLabel('Parolă').fill('Admin123!');
    await p.getByRole('button', { name: 'Autentificare', exact: true }).click();
    await p.waitForURL('**/dashboard**', { timeout: 20000 });
    console.log('[B1] Logged in:', p.url());
    await screenshotAndLog(p, 'B1r-logged-in');
  });

  test('B2: Dashboard inspection', async () => {
    await p.goto(`${BASE}/ro/dashboard`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(3000);

    const text = await p.textContent('body');
    console.log('[B2] Dashboard (600):', text?.slice(0, 600));

    const cards = p.locator('[class*="card"]');
    console.log('[B2] Cards:', await cards.count());
    await screenshotAndLog(p, 'B2r-dashboard');
  });

  test('B3: Sidebar navigation links', async () => {
    await p.goto(`${BASE}/ro/dashboard`);
    await p.waitForLoadState('networkidle');

    const navLinks = p.locator('nav a[href], aside a[href]');
    const count = await navLinks.count();
    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      const text = (await navLinks.nth(i).textContent())?.trim();
      results.push(`${href} → "${text}"`);
    }
    console.log('[B3] Nav links (' + count + '):\n' + results.join('\n'));
  });

  test('B4: Visit every admin route', async () => {
    const routes = [
      '/ro/dashboard',
      '/ro/contribuabili',
      '/ro/proprietati/cladiri',
      '/ro/proprietati/terenuri',
      '/ro/proprietati/vehicule',
      '/ro/plati',
      '/ro/rapoarte',
      '/ro/admin/anomalii',
      '/ro/admin/rate-impozitare',
      '/ro/admin/utilizatori',
      '/ro/admin/setari',
    ];

    for (const route of routes) {
      const resp = await p.goto(`${BASE}${route}`);
      await p.waitForLoadState('domcontentloaded');
      await p.waitForTimeout(2000);

      const status = resp?.status();
      const text = await p.textContent('body');
      console.log(`[B4] ${route} → ${status} | text(200): ${text?.slice(0, 200)}`);

      // Count table rows if any
      const rows = await p.locator('table tbody tr').count();
      if (rows > 0) console.log(`[B4]   Table rows: ${rows}`);

      await screenshotAndLog(p, `B4r-${route.replace(/\//g, '_')}`);
    }
  });

  test('B5: Contribuabili detail + search + pagination', async () => {
    await p.goto(`${BASE}/ro/contribuabili`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(3000);

    // Search
    const search = p.locator('input[placeholder*="caut" i], input[type="search"]');
    if (await search.count() > 0) {
      await search.first().fill('Popescu');
      await p.waitForTimeout(2000);
      console.log('[B5] Search "Popescu" rows:', await p.locator('table tbody tr').count());
      await screenshotAndLog(p, 'B5r-search-popescu');
      await search.first().clear();
      await p.waitForTimeout(2000);
    }

    // Click first row detail
    const firstLink = p.locator('table tbody tr a').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2000);
      console.log('[B5] Detail URL:', p.url());
      const detailText = await p.textContent('body');
      console.log('[B5] Detail (400):', detailText?.slice(0, 400));
      await screenshotAndLog(p, 'B5r-detail');
      await p.goBack();
    }

    // Pagination
    const nextBtn = p.locator('button:has-text("Următoarea"), button:has-text("Next"), [aria-label*="next" i]');
    console.log('[B5] Next page button:', await nextBtn.count());
    if (await nextBtn.count() > 0 && !(await nextBtn.first().isDisabled())) {
      await nextBtn.first().click();
      await p.waitForTimeout(2000);
      console.log('[B5] After next page rows:', await p.locator('table tbody tr').count());
      await screenshotAndLog(p, 'B5r-page2');
    }
  });

  test('B6: Properties detail views', async () => {
    // Buildings detail
    await p.goto(`${BASE}/ro/proprietati/cladiri`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(3000);

    const buildingLink = p.locator('table tbody tr a').first();
    if (await buildingLink.count() > 0) {
      await buildingLink.click();
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2000);
      console.log('[B6] Building detail URL:', p.url());
      await screenshotAndLog(p, 'B6r-building-detail');
      await p.goBack();
    }

    // Vehicles detail
    await p.goto(`${BASE}/ro/proprietati/vehicule`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(3000);

    const vehicleLink = p.locator('table tbody tr a').first();
    if (await vehicleLink.count() > 0) {
      await vehicleLink.click();
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2000);
      console.log('[B6] Vehicle detail URL:', p.url());
      await screenshotAndLog(p, 'B6r-vehicle-detail');
    }
  });

  test('B7: Reports — tabs, filters, exports', async () => {
    await p.goto(`${BASE}/ro/rapoarte`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(3000);

    // Tabs
    const tabs = p.locator('[role="tab"], [role="tablist"] button');
    const tabCount = await tabs.count();
    console.log('[B7] Report tabs:', tabCount);

    for (let i = 0; i < tabCount; i++) {
      const tabText = await tabs.nth(i).textContent();
      console.log(`[B7]   Tab ${i}: "${tabText?.trim()}"`);
      await tabs.nth(i).click();
      await p.waitForTimeout(2000);
      await screenshotAndLog(p, `B7r-report-tab-${i}`);
    }

    // Export buttons
    const exportBtns = p.locator('button:has-text("Export"), button:has-text("CSV"), button:has-text("PDF"), button:has-text("Descarcă")');
    console.log('[B7] Export buttons:', await exportBtns.count());
  });

  test('B8: Admin Anomalii — details', async () => {
    await p.goto(`${BASE}/ro/admin/anomalii`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(5000);

    const text = await p.textContent('body');
    console.log('[B8] Anomalii (500):', text?.slice(0, 500));

    // Check for scan/refresh button
    const scanBtn = p.locator('button:has-text("Scanare"), button:has-text("Verificare"), button:has-text("Refresh")');
    console.log('[B8] Scan button:', await scanBtn.count());

    await screenshotAndLog(p, 'B8r-anomalii');
  });

  test('B9: Admin Settings — tabs and forms', async () => {
    await p.goto(`${BASE}/ro/admin/setari`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(3000);

    const tabs = p.locator('[role="tab"]');
    const tabCount = await tabs.count();
    console.log('[B9] Settings tabs:', tabCount);

    for (let i = 0; i < tabCount; i++) {
      const tabText = await tabs.nth(i).textContent();
      console.log(`[B9]   Tab ${i}: "${tabText?.trim()}"`);
      await tabs.nth(i).click();
      await p.waitForTimeout(1500);
      await screenshotAndLog(p, `B9r-settings-tab-${i}`);
    }
  });

  test('B10: Check all buttons on dashboard for dead clicks', async () => {
    await p.goto(`${BASE}/ro/dashboard`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(2000);

    const buttons = p.locator('button');
    const btnCount = await buttons.count();
    console.log('[B10] Dashboard buttons:', btnCount);

    for (let i = 0; i < btnCount; i++) {
      const text = (await buttons.nth(i).textContent())?.trim();
      const disabled = await buttons.nth(i).isDisabled();
      const visible = await buttons.nth(i).isVisible();
      console.log(`[B10]   Button ${i}: "${text?.slice(0, 50)}" disabled=${disabled} visible=${visible}`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE D RETRY — Diagnostics (fixed selector)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE D2 — Diagnostics', () => {
  test('D1: Console errors across key pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`UNCAUGHT: ${err.message}`));

    await staffLogin(page);
    await page.waitForTimeout(3000);

    const pages = [
      '/ro/dashboard',
      '/ro/contribuabili',
      '/ro/proprietati/cladiri',
      '/ro/plati',
      '/ro/rapoarte',
      '/ro/admin/anomalii',
    ];

    for (const p of pages) {
      await page.goto(`${BASE}${p}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('[D1] Total console errors:', errors.length);
    errors.forEach(e => console.log('[D1]   ERROR:', e.slice(0, 250)));
  });

  test('D2: Network failures across pages', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', resp => {
      if (resp.status() >= 400) {
        failed.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await staffLogin(page);

    const routes = [
      '/ro/dashboard',
      '/ro/contribuabili',
      '/ro/proprietati/cladiri',
      '/ro/proprietati/terenuri',
      '/ro/proprietati/vehicule',
      '/ro/plati',
      '/ro/rapoarte',
      '/ro/admin/anomalii',
    ];

    for (const r of routes) {
      await page.goto(`${BASE}${r}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('[D2] Failed requests:', failed.length);
    failed.forEach(f => console.log('[D2]  ', f.slice(0, 200)));
  });

  test('D3: Citizen portal console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`UNCAUGHT: ${err.message}`));

    // Login as citizen
    await page.goto(`${BASE}/ro/portal/login`);
    await page.locator('input[type="email"], input[name="email"]').first().fill('cetatean@example.ro');
    await page.locator('input[type="password"]').first().fill('Citizen123!');
    await page.getByRole('button', { name: /autentificare/i }).click();

    try {
      await page.waitForURL('**/portal/dashboard**', { timeout: 15000 });
    } catch {
      console.log('[D3] Citizen login may have failed, URL:', page.url());
    }

    const portalRoutes = [
      '/ro/portal/dashboard',
      '/ro/portal/proprietati',
      '/ro/portal/plati',
      '/ro/portal/certificate',
    ];

    for (const r of portalRoutes) {
      await page.goto(`${BASE}${r}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('[D3] Citizen portal console errors:', errors.length);
    errors.forEach(e => console.log('[D3]  ', e.slice(0, 250)));
  });

  test('D4: Performance — page load timing', async ({ page }) => {
    await staffLogin(page);

    const routes = [
      '/ro/dashboard',
      '/ro/contribuabili',
      '/ro/proprietati/cladiri',
      '/ro/rapoarte',
    ];

    for (const route of routes) {
      const start = Date.now();
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      console.log(`[D4] ${route}: ${elapsed}ms`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE E RETRY — Responsive (fixed selector)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE E2 — Responsive', () => {
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    test(`E-${vp.name}: Login + dashboard + table`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();

      // Staff login page
      await page.goto(`${BASE}/ro/login`);
      await page.waitForLoadState('networkidle');
      await screenshotAndLog(page, `E-${vp.name}-staff-login`);

      // Portal login page
      await page.goto(`${BASE}/ro/portal/login`);
      await page.waitForLoadState('networkidle');
      await screenshotAndLog(page, `E-${vp.name}-portal-login`);

      // Login as admin
      await page.goto(`${BASE}/ro/login`);
      await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
      await page.getByLabel('Parolă').fill('Admin123!');
      await page.getByRole('button', { name: 'Autentificare', exact: true }).click();
      await page.waitForURL('**/dashboard**', { timeout: 20000 });
      await page.waitForTimeout(2000);
      await screenshotAndLog(page, `E-${vp.name}-dashboard`);

      // Sidebar check
      if (vp.width <= 768) {
        const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="meniu" i], button:has(svg)').first();
        const isHamburgerVisible = await hamburger.isVisible().catch(() => false);
        console.log(`[E-${vp.name}] Hamburger visible: ${isHamburgerVisible}`);
        if (isHamburgerVisible) {
          await hamburger.click();
          await page.waitForTimeout(500);
          await screenshotAndLog(page, `E-${vp.name}-hamburger-open`);
        }
      }

      // Table page
      await page.goto(`${BASE}/ro/contribuabili`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await screenshotAndLog(page, `E-${vp.name}-table`);

      // Portal register
      await page.goto(`${BASE}/ro/portal/register`);
      await page.waitForLoadState('networkidle');
      await screenshotAndLog(page, `E-${vp.name}-register`);

      await ctx.close();
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE F — Edge Cases (fixed selector)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE F2 — Edge Cases', () => {
  test('F1: Auth redirects — unauthed staff routes', async ({ page }) => {
    const routes = ['/ro/dashboard', '/ro/contribuabili', '/ro/plati', '/ro/admin/anomalii'];
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
      console.log(`[F1] ${route} → ${page.url()}`);
    }
  });

  test('F2: Auth redirects — unauthed portal routes', async ({ page }) => {
    const routes = ['/ro/portal/dashboard', '/ro/portal/proprietati', '/ro/portal/plati', '/ro/portal/certificate'];
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
      console.log(`[F2] ${route} → ${page.url()}`);
    }
  });

  test('F3: SQL injection in search', async ({ page }) => {
    await staffLogin(page);
    await page.goto(`${BASE}/ro/contribuabili`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const search = page.locator('input[placeholder*="caut" i], input[type="search"]');
    if (await search.count() > 0) {
      await search.first().fill("'; DROP TABLE--");
      await page.waitForTimeout(3000);
      console.log('[F3] After injection, rows:', await page.locator('table tbody tr').count());
      await screenshotAndLog(page, 'F3r-injection');
    }
  });

  test('F4: XSS in login fields', async ({ page }) => {
    await page.goto(`${BASE}/ro/login`);
    await page.getByLabel('Adresă de email').fill('<script>alert(1)</script>@t.com');
    await page.getByLabel('Parolă').fill('<img onerror=alert(1)>');
    await page.getByRole('button', { name: 'Autentificare', exact: true }).click();
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    // Check that the script tag is NOT rendered
    const hasScript = text?.includes('<script>');
    console.log('[F4] Script tag in DOM:', hasScript);
    await screenshotAndLog(page, 'F4r-xss');
  });

  test('F5: Double-click login', async ({ page }) => {
    await page.goto(`${BASE}/ro/login`);
    await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
    await page.getByLabel('Parolă').fill('Admin123!');
    const btn = page.getByRole('button', { name: 'Autentificare', exact: true });
    await btn.dblclick();
    await page.waitForTimeout(5000);
    console.log('[F5] After double-click URL:', page.url());
    await screenshotAndLog(page, 'F5r-dblclick');
  });

  test('F6: Session persistence — refresh after login', async ({ page }) => {
    await staffLogin(page);
    const url1 = page.url();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const url2 = page.url();
    console.log(`[F6] Before reload: ${url1}`);
    console.log(`[F6] After reload: ${url2}`);
    const stayedLoggedIn = url2.includes('/dashboard');
    console.log(`[F6] Session persisted: ${stayedLoggedIn}`);
  });

  test('F7: Locale persistence', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    console.log('[F7] /en/login final URL:', url);
    const text = await page.textContent('body');
    console.log('[F7] English login (200):', text?.slice(0, 200));
    await screenshotAndLog(page, 'F7r-en-login');

    await page.goto(`${BASE}/hu/login`);
    await page.waitForLoadState('networkidle');
    console.log('[F7] /hu/login final URL:', page.url());
    const huText = await page.textContent('body');
    console.log('[F7] Hungarian login (200):', huText?.slice(0, 200));
    await screenshotAndLog(page, 'F7r-hu-login');
  });

  test('F8: Register form validation', async ({ page }) => {
    await page.goto(`${BASE}/ro/portal/register`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try submitting empty form
    const submitBtn = page.getByRole('button', { name: /înregistrare/i });
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await screenshotAndLog(page, 'F8r-empty-register');
      const text = await page.textContent('body');
      console.log('[F8] Empty submit result (400):', text?.slice(0, 400));
    }

    // Fill partial — email only
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill('test@test.com');
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await screenshotAndLog(page, 'F8r-partial-register');
    }

    // Fill with mismatched passwords
    const allInputs = page.locator('input:visible');
    const inputCount = await allInputs.count();
    console.log('[F8] Visible inputs:', inputCount);

    // Fill all fields with test data
    const nameInput = page.locator('input[name*="last" i], input[placeholder*="Nume" i]').first();
    const firstNameInput = page.locator('input[name*="first" i], input[placeholder*="Prenume" i]').first();
    const cnpInput = page.locator('input[name*="cnp" i], input[placeholder*="CNP" i]').first();
    const phoneInput = page.locator('input[name*="phone" i], input[name*="telefon" i], input[placeholder*="Telefon" i]').first();
    const pwInputs = page.locator('input[type="password"]');

    if (await nameInput.count() > 0) await nameInput.fill('Test');
    if (await firstNameInput.count() > 0) await firstNameInput.fill('User');
    if (await emailInput.count() > 0) await emailInput.first().fill('testuser@test.com');
    if (await cnpInput.count() > 0) await cnpInput.fill('1234567890123');
    if (await phoneInput.count() > 0) await phoneInput.fill('0712345678');

    // Mismatched passwords
    if (await pwInputs.count() >= 2) {
      await pwInputs.nth(0).fill('Password123!');
      await pwInputs.nth(1).fill('DifferentPass!');
      await submitBtn.click();
      await page.waitForTimeout(2000);
      const mismatchText = await page.textContent('body');
      console.log('[F8] Mismatched pw result (300):', mismatchText?.slice(0, 300));
      await screenshotAndLog(page, 'F8r-mismatch-pw');
    }
  });

  test('F9: Forgot password form', async ({ page }) => {
    await page.goto(`${BASE}/ro/portal/forgot-password`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const submitBtn = page.getByRole('button', { name: /trimite|resetare|reset|send/i });

    console.log('[F9] Email input:', await emailInput.count());
    console.log('[F9] Submit btn:', await submitBtn.count());

    if (await submitBtn.count() > 0) {
      // Empty submit
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await screenshotAndLog(page, 'F9r-empty-forgot');

      // Valid email
      if (await emailInput.count() > 0) {
        await emailInput.first().fill('test@test.com');
        await submitBtn.click();
        await page.waitForTimeout(3000);
        const text = await page.textContent('body');
        console.log('[F9] After submit (300):', text?.slice(0, 300));
        await screenshotAndLog(page, 'F9r-forgot-submitted');
      }
    }
  });
});
