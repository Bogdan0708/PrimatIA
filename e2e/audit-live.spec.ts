import { test, expect, Page } from '@playwright/test';

const BASE = process.env.AUDIT_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL ?? '';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD ?? '';
const CITIZEN_EMAIL = process.env.E2E_CITIZEN_EMAIL ?? '';
const CITIZEN_PASSWORD = process.env.E2E_CITIZEN_PASSWORD ?? '';
const AUDIT_ARTIFACTS_ENABLED = process.env.AUDIT_ENABLE_ARTIFACTS === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`PAGE_ERROR: ${err.message}`));
  return errors;
}

async function collectFailedRequests(page: Page): Promise<string[]> {
  const failed: string[] = [];
  page.on('response', resp => {
    if (resp.status() >= 400) {
      failed.push(`${resp.status()} ${resp.url()}`);
    }
  });
  return failed;
}

async function screenshotAndLog(page: Page, name: string) {
  if (!AUDIT_ARTIFACTS_ENABLED) {
    return;
  }

  await page.screenshot({ path: `test-results/audit-${name}.png`, fullPage: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE A — RECON: API Health, Landing, Route Discovery
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE A — Recon & Health', () => {
  test('A1: API /api/health returns ok', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    const body = await res.json();
    console.log('[A1] health:', JSON.stringify(body));
    expect(res.ok()).toBeTruthy();
    expect(body.status).toBe('ok');
  });

  test('A2: API /api/health/deep — DB, Redis, AI', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health/deep`);
    const body = await res.json();
    console.log('[A2] deep-health:', JSON.stringify(body, null, 2));
    expect(body.database).toBeDefined();
    expect(body.database.status).toBe('ok');
    console.log('[A2] DB latency:', body.database.latencyMs, 'ms');
    console.log('[A2] Redis:', body.redis?.status, body.redis?.message);
    console.log('[A2] AI:', body.ai?.status, body.ai?.provider, body.ai?.model);
  });

  test('A3: Root URL redirects to /ro (locale)', async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    const failed = await collectFailedRequests(page);
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    console.log('[A3] Final URL:', url);
    console.log('[A3] Console errors:', errors);
    console.log('[A3] Failed requests:', failed);
    expect(url).toContain('/ro');
    await screenshotAndLog(page, 'A3-root-redirect');
  });

  test('A4: Map public pages — login, portal login, register', async ({ page }) => {
    const routes = [
      '/ro/login',
      '/ro/portal/login',
      '/ro/portal/register',
      '/ro/portal/forgot-password',
    ];
    for (const route of routes) {
      const resp = await page.goto(`${BASE}${route}`);
      console.log(`[A4] ${route} → ${resp?.status()} | ${page.url()}`);
      await screenshotAndLog(page, `A4-${route.replace(/\//g, '_')}`);
    }
  });

  test('A5: Locale switching — /en, /hu', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await page.waitForLoadState('networkidle');
    const enText = await page.textContent('body');
    console.log('[A5] /en/login text (first 200):', enText?.slice(0, 200));
    await screenshotAndLog(page, 'A5-en-login');

    await page.goto(`${BASE}/hu/login`);
    await page.waitForLoadState('networkidle');
    const huText = await page.textContent('body');
    console.log('[A5] /hu/login text (first 200):', huText?.slice(0, 200));
    await screenshotAndLog(page, 'A5-hu-login');
  });

  test('A6: 404 page handling', async ({ page }) => {
    const resp = await page.goto(`${BASE}/ro/nonexistent-page-xyz`);
    console.log('[A6] 404 status:', resp?.status());
    const text = await page.textContent('body');
    console.log('[A6] 404 content (first 300):', text?.slice(0, 300));
    await screenshotAndLog(page, 'A6-404');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE B — STAFF ADMIN: Login + Full Sweep
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE B — Staff Admin Full Sweep', () => {
  test.describe.configure({ mode: 'serial' });

  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await collectConsoleErrors(adminPage);
    await collectFailedRequests(adminPage);
  });

  test.afterAll(async () => {
    await adminPage?.context().close();
  });

  test('B1: Staff login flow', async () => {
    await adminPage.goto(`${BASE}/ro/login`);
    await adminPage.waitForLoadState('networkidle');
    await screenshotAndLog(adminPage, 'B1-login-page');

    // Check form fields exist
    const emailInput = adminPage.getByLabel(/email/i);
    const pwInput = adminPage.getByLabel(/parol/i);
    const submitBtn = adminPage.getByRole('button', { name: /autentificare/i });

    await expect(emailInput).toBeVisible();
    await expect(pwInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Test empty submit
    await submitBtn.click();
    await adminPage.waitForTimeout(1000);
    await screenshotAndLog(adminPage, 'B1-login-empty-submit');

    // Test invalid email
    await emailInput.fill('not-an-email');
    await pwInput.fill('x');
    await submitBtn.click();
    await adminPage.waitForTimeout(2000);
    await screenshotAndLog(adminPage, 'B1-login-invalid');
    const bodyAfterInvalid = await adminPage.textContent('body');
    console.log('[B1] After invalid login (first 300):', bodyAfterInvalid?.slice(0, 300));

    // Test wrong credentials
    await emailInput.fill('wrong@wrong.com');
    await pwInput.fill('WrongPass123!');
    await submitBtn.click();
    await adminPage.waitForTimeout(3000);
    await screenshotAndLog(adminPage, 'B1-login-wrong-creds');
    const bodyAfterWrong = await adminPage.textContent('body');
    console.log('[B1] After wrong creds (first 300):', bodyAfterWrong?.slice(0, 300));

    // Actual login
    await emailInput.fill(STAFF_EMAIL);
    await pwInput.fill(STAFF_PASSWORD);
    await submitBtn.click();
    await adminPage.waitForURL('**/dashboard**', { timeout: 20000 });
    console.log('[B1] Logged in, URL:', adminPage.url());
    await screenshotAndLog(adminPage, 'B1-login-success');
  });

  test('B2: Dashboard — stats, charts, widgets', async () => {
    await adminPage.goto(`${BASE}/ro/dashboard`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(2000);

    const text = await adminPage.textContent('body');
    console.log('[B2] Dashboard text (500):', text?.slice(0, 500));

    // Check for stat cards
    const cards = adminPage.locator('[class*="card"], [class*="Card"]');
    console.log('[B2] Card count:', await cards.count());

    // Check for charts
    const charts = adminPage.locator('svg.recharts-surface, [class*="chart"], canvas');
    console.log('[B2] Chart elements:', await charts.count());

    await screenshotAndLog(adminPage, 'B2-dashboard');
  });

  test('B3: Sidebar navigation — enumerate all links', async () => {
    await adminPage.goto(`${BASE}/ro/dashboard`);
    await adminPage.waitForLoadState('networkidle');

    const sidebarLinks = adminPage.locator('nav a, aside a, [role="navigation"] a');
    const count = await sidebarLinks.count();
    console.log('[B3] Sidebar links count:', count);

    const hrefs: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await sidebarLinks.nth(i).getAttribute('href');
      const text = await sidebarLinks.nth(i).textContent();
      if (href) {
        hrefs.push(`${href} → "${text?.trim()}"`);
      }
    }
    console.log('[B3] All nav links:\n' + hrefs.join('\n'));
    await screenshotAndLog(adminPage, 'B3-sidebar');
  });

  test('B4: Contribuabili — list, search, filters', async () => {
    await adminPage.goto(`${BASE}/ro/contribuabili`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const rows = await adminPage.locator('table tbody tr').count();
    console.log('[B4] Contribuabili rows:', rows);

    // Test search if exists
    const search = adminPage.locator('input[placeholder*="Caut"], input[type="search"], input[placeholder*="caut"]');
    if (await search.count() > 0) {
      await search.first().fill('Ion');
      await adminPage.waitForTimeout(2000);
      const filteredRows = await adminPage.locator('table tbody tr').count();
      console.log('[B4] After search "Ion":', filteredRows, 'rows');
      await screenshotAndLog(adminPage, 'B4-contribuabili-search');

      // Clear search
      await search.first().fill('');
      await adminPage.waitForTimeout(2000);
    }

    // Check pagination
    const pagination = adminPage.locator('[class*="pagination"], nav[aria-label*="pagination"], button:has-text("Următoarea"), button:has-text("Anterioara")');
    console.log('[B4] Pagination elements:', await pagination.count());

    // Try clicking first row for detail
    if (rows > 0) {
      const firstRowLink = adminPage.locator('table tbody tr').first().locator('a');
      if (await firstRowLink.count() > 0) {
        await firstRowLink.first().click();
        await adminPage.waitForLoadState('networkidle');
        await adminPage.waitForTimeout(2000);
        console.log('[B4] Detail page URL:', adminPage.url());
        await screenshotAndLog(adminPage, 'B4-contribuabil-detail');
        await adminPage.goBack();
        await adminPage.waitForLoadState('networkidle');
      }
    }

    await screenshotAndLog(adminPage, 'B4-contribuabili');
  });

  test('B5: Properties — Clădiri', async () => {
    await adminPage.goto(`${BASE}/ro/proprietati/cladiri`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const rows = await adminPage.locator('table tbody tr').count();
    console.log('[B5] Clădiri rows:', rows);

    if (rows > 0) {
      const firstText = await adminPage.locator('table tbody tr').first().textContent();
      console.log('[B5] First row:', firstText?.slice(0, 200));
    }

    // Check for "Adaugă" button
    const addBtn = adminPage.getByRole('button', { name: /adaug/i }).or(adminPage.getByRole('link', { name: /adaug/i }));
    console.log('[B5] Add button exists:', await addBtn.count() > 0);

    // Try filters/tabs if present
    const tabs = adminPage.locator('[role="tablist"] button, [role="tab"]');
    console.log('[B5] Tab count:', await tabs.count());

    await screenshotAndLog(adminPage, 'B5-cladiri');
  });

  test('B6: Properties — Terenuri', async () => {
    await adminPage.goto(`${BASE}/ro/proprietati/terenuri`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const rows = await adminPage.locator('table tbody tr').count();
    console.log('[B6] Terenuri rows:', rows);
    await screenshotAndLog(adminPage, 'B6-terenuri');
  });

  test('B7: Properties — Vehicule', async () => {
    await adminPage.goto(`${BASE}/ro/proprietati/vehicule`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const rows = await adminPage.locator('table tbody tr').count();
    console.log('[B7] Vehicule rows:', rows);
    await screenshotAndLog(adminPage, 'B7-vehicule');
  });

  test('B8: Plăți (Payments)', async () => {
    await adminPage.goto(`${BASE}/ro/plati`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const text = await adminPage.textContent('body');
    console.log('[B8] Plăți content (400):', text?.slice(0, 400));
    await screenshotAndLog(adminPage, 'B8-plati');
  });

  test('B9: Rapoarte (Reports)', async () => {
    await adminPage.goto(`${BASE}/ro/rapoarte`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const text = await adminPage.textContent('body');
    console.log('[B9] Rapoarte content (400):', text?.slice(0, 400));

    // Check for download/export buttons
    const exportBtn = adminPage.getByRole('button', { name: /export|descarca|csv|pdf/i });
    console.log('[B9] Export buttons:', await exportBtn.count());

    await screenshotAndLog(adminPage, 'B9-rapoarte');
  });

  test('B10: Admin — Anomalii', async () => {
    await adminPage.goto(`${BASE}/ro/admin/anomalii`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(5000);

    const text = await adminPage.textContent('body');
    console.log('[B10] Anomalii content (400):', text?.slice(0, 400));
    await screenshotAndLog(adminPage, 'B10-anomalii');
  });

  test('B11: Admin — Rate de impozitare', async () => {
    await adminPage.goto(`${BASE}/ro/admin/rate-impozitare`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const text = await adminPage.textContent('body');
    console.log('[B11] Rate impozitare content (400):', text?.slice(0, 400));
    await screenshotAndLog(adminPage, 'B11-rate-impozitare');
  });

  test('B12: Admin — Utilizatori', async () => {
    await adminPage.goto(`${BASE}/ro/admin/utilizatori`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const text = await adminPage.textContent('body');
    console.log('[B12] Utilizatori content (400):', text?.slice(0, 400));
    await screenshotAndLog(adminPage, 'B12-utilizatori');
  });

  test('B13: Admin — Setări', async () => {
    await adminPage.goto(`${BASE}/ro/admin/setari`);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(3000);

    const text = await adminPage.textContent('body');
    console.log('[B13] Setări content (400):', text?.slice(0, 400));
    await screenshotAndLog(adminPage, 'B13-setari');
  });

  test('B14: Click ALL sidebar links and report status', async () => {
    await adminPage.goto(`${BASE}/ro/dashboard`);
    await adminPage.waitForLoadState('networkidle');

    const sidebarLinks = adminPage.locator('nav a[href], aside a[href], [role="navigation"] a[href]');
    const count = await sidebarLinks.count();
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
      const href = await sidebarLinks.nth(i).getAttribute('href');
      if (!href || href === '#' || href.startsWith('javascript:')) continue;

      const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`;
      try {
        const resp = await adminPage.goto(fullUrl);
        await adminPage.waitForLoadState('domcontentloaded');
        await adminPage.waitForTimeout(1500);
        const status = resp?.status() || 0;
        const title = await adminPage.title();
        results.push(`${status} | ${href} | "${title}"`);
        if (status >= 400) {
          await screenshotAndLog(adminPage, `B14-error-${href.replace(/\//g, '_')}`);
        }
      } catch (e) {
        results.push(`ERROR | ${href} | ${(e as Error).message.slice(0, 100)}`);
      }
    }

    console.log('[B14] All sidebar route results:\n' + results.join('\n'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE C — CITIZEN PORTAL: Login + Full Sweep
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE C — Citizen Portal', () => {
  test.describe.configure({ mode: 'serial' });

  let citizenPage: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    citizenPage = await ctx.newPage();
    await collectConsoleErrors(citizenPage);
    await collectFailedRequests(citizenPage);
  });

  test.afterAll(async () => {
    await citizenPage?.context().close();
  });

  test('C1: Portal login page — inspect form', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/login`);
    await citizenPage.waitForLoadState('networkidle');
    await screenshotAndLog(citizenPage, 'C1-portal-login');

    const emailInput = citizenPage.locator('input[type="email"], input[name="email"]');
    const pwInput = citizenPage.locator('input[type="password"]');
    const submitBtn = citizenPage.getByRole('button', { name: /autentificare|login|conectare/i });

    console.log('[C1] Email input:', await emailInput.count());
    console.log('[C1] Password input:', await pwInput.count());
    console.log('[C1] Submit btn:', await submitBtn.count());

    // Check for register link
    const registerLink = citizenPage.getByRole('link', { name: /înregistr|register|cont nou/i });
    console.log('[C1] Register link:', await registerLink.count());

    // Check forgot password link
    const forgotLink = citizenPage.getByRole('link', { name: /uitat|forgot|resetare/i });
    console.log('[C1] Forgot password link:', await forgotLink.count());
  });

  test('C2: Portal login — validation tests', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/login`);
    await citizenPage.waitForLoadState('networkidle');

    const submitBtn = citizenPage.getByRole('button', { name: /autentificare|login|conectare/i });

    // Empty submit
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await citizenPage.waitForTimeout(1500);
      await screenshotAndLog(citizenPage, 'C2-portal-empty-submit');
      const text = await citizenPage.textContent('body');
      console.log('[C2] After empty submit (300):', text?.slice(0, 300));
    }

    // Wrong credentials
    const emailInput = citizenPage.locator('input[type="email"], input[name="email"]').first();
    const pwInput = citizenPage.locator('input[type="password"]').first();
    if (await emailInput.count() > 0 && await pwInput.count() > 0) {
      await emailInput.fill('wrong@test.com');
      await pwInput.fill('WrongPass!');
      await submitBtn.click();
      await citizenPage.waitForTimeout(3000);
      await screenshotAndLog(citizenPage, 'C2-portal-wrong-creds');
      const text = await citizenPage.textContent('body');
      console.log('[C2] After wrong creds (300):', text?.slice(0, 300));
    }
  });

  test('C3: Portal register page — inspect form', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/register`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(2000);

    const text = await citizenPage.textContent('body');
    console.log('[C3] Register page (500):', text?.slice(0, 500));

    // Count all form inputs
    const inputs = citizenPage.locator('input, select, textarea');
    const count = await inputs.count();
    console.log('[C3] Total form inputs:', count);

    for (let i = 0; i < count; i++) {
      const type = await inputs.nth(i).getAttribute('type');
      const name = await inputs.nth(i).getAttribute('name');
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      console.log(`[C3]   Input ${i}: type=${type} name=${name} placeholder=${placeholder}`);
    }

    await screenshotAndLog(citizenPage, 'C3-portal-register');
  });

  test('C4: Portal forgot-password page', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/forgot-password`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(2000);

    const text = await citizenPage.textContent('body');
    console.log('[C4] Forgot password (400):', text?.slice(0, 400));
    await screenshotAndLog(citizenPage, 'C4-portal-forgot-pw');
  });

  test('C5: Portal login — actual citizen login', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/login`);
    await citizenPage.waitForLoadState('networkidle');

    const emailInput = citizenPage.locator('input[type="email"], input[name="email"]').first();
    const pwInput = citizenPage.locator('input[type="password"]').first();
    const submitBtn = citizenPage.getByRole('button', { name: /autentificare|login|conectare/i });

    await emailInput.fill(CITIZEN_EMAIL);
    await pwInput.fill(CITIZEN_PASSWORD);
    await submitBtn.click();

    try {
      await citizenPage.waitForURL('**/portal/dashboard**', { timeout: 15000 });
      console.log('[C5] Citizen logged in, URL:', citizenPage.url());
      await screenshotAndLog(citizenPage, 'C5-citizen-dashboard');
    } catch {
      console.log('[C5] Login might have failed. URL:', citizenPage.url());
      const text = await citizenPage.textContent('body');
      console.log('[C5] Page content (300):', text?.slice(0, 300));
      await screenshotAndLog(citizenPage, 'C5-citizen-login-result');
    }
  });

  test('C6: Citizen dashboard content', async () => {
    // Navigate directly if already logged in
    await citizenPage.goto(`${BASE}/ro/portal/dashboard`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(3000);

    const text = await citizenPage.textContent('body');
    console.log('[C6] Citizen dashboard (500):', text?.slice(0, 500));

    // Check for stat cards, debt summaries
    const cards = citizenPage.locator('[class*="card"], [class*="Card"]');
    console.log('[C6] Cards:', await cards.count());

    await screenshotAndLog(citizenPage, 'C6-citizen-dashboard-full');
  });

  test('C7: Citizen — Proprietăți', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/proprietati`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(3000);

    const text = await citizenPage.textContent('body');
    console.log('[C7] Proprietăți (400):', text?.slice(0, 400));
    await screenshotAndLog(citizenPage, 'C7-citizen-proprietati');
  });

  test('C8: Citizen — Plăți', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/plati`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(3000);

    const text = await citizenPage.textContent('body');
    console.log('[C8] Plăți (400):', text?.slice(0, 400));
    await screenshotAndLog(citizenPage, 'C8-citizen-plati');
  });

  test('C9: Citizen — Certificate', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/certificate`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(3000);

    const text = await citizenPage.textContent('body');
    console.log('[C9] Certificate (400):', text?.slice(0, 400));
    await screenshotAndLog(citizenPage, 'C9-citizen-certificate');
  });

  test('C10: Citizen — Profile/Settings', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/profil`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(3000);

    const text = await citizenPage.textContent('body');
    console.log('[C10] Profil (400):', text?.slice(0, 400));
    await screenshotAndLog(citizenPage, 'C10-citizen-profil');
  });

  test('C11: Citizen — AI Chatbot widget', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/dashboard`);
    await citizenPage.waitForLoadState('networkidle');
    await citizenPage.waitForTimeout(2000);

    // Find chat trigger button
    const chatTrigger = citizenPage.locator('button[aria-label*="chat" i], button[aria-label*="asistent" i], [data-testid*="chat"], button:has(svg.lucide-message-circle), button:has(svg.lucide-bot)');

    if (await chatTrigger.count() > 0) {
      await chatTrigger.first().click();
      await citizenPage.waitForTimeout(1000);
      await screenshotAndLog(citizenPage, 'C11-chatbot-opened');

      // Try typing a message
      const chatInput = citizenPage.locator('input[placeholder*="mesaj" i], input[placeholder*="întreab" i], textarea[placeholder*="mesaj" i], textarea[placeholder*="întreab" i]');
      if (await chatInput.count() > 0) {
        await chatInput.first().fill('Ce taxe am de plătit?');
        await chatInput.first().press('Enter');
        await citizenPage.waitForTimeout(10000); // Wait for AI response
        await screenshotAndLog(citizenPage, 'C11-chatbot-response');
        const chatText = await citizenPage.textContent('body');
        console.log('[C11] After chatbot (400):', chatText?.slice(-400));
      } else {
        console.log('[C11] Chat input not found after opening');
      }
    } else {
      console.log('[C11] Chat trigger button not found');
      // Try broader search
      const allButtons = citizenPage.locator('button');
      const btnCount = await allButtons.count();
      console.log('[C11] Total buttons on page:', btnCount);
      for (let i = 0; i < btnCount; i++) {
        const label = await allButtons.nth(i).getAttribute('aria-label');
        const text = await allButtons.nth(i).textContent();
        if (label || (text && text.trim())) {
          console.log(`[C11]   Button ${i}: label="${label}" text="${text?.trim().slice(0, 50)}"`);
        }
      }
    }
  });

  test('C12: Citizen portal — enumerate all nav links', async () => {
    await citizenPage.goto(`${BASE}/ro/portal/dashboard`);
    await citizenPage.waitForLoadState('networkidle');

    const allLinks = citizenPage.locator('a[href]');
    const count = await allLinks.count();
    const hrefs: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await allLinks.nth(i).getAttribute('href');
      const text = await allLinks.nth(i).textContent();
      if (href && href.includes('/portal/')) {
        hrefs.push(`${href} → "${text?.trim().slice(0, 60)}"`);
      }
    }
    console.log('[C12] Portal nav links:\n' + hrefs.join('\n'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE D — BROWSER DIAGNOSTICS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE D — Diagnostics', () => {
  test('D1: Console errors on staff dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`UNCAUGHT: ${err.message}`));

    // Login first
    await page.goto(`${BASE}/ro/login`);
    await page.getByLabel(/email/i).fill(STAFF_EMAIL);
    await page.getByLabel(/parol/i).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: /autentificare/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
    await page.waitForTimeout(5000);

    console.log('[D1] Console errors on dashboard:', errors.length);
    errors.forEach(e => console.log('[D1]   ERROR:', e.slice(0, 200)));
  });

  test('D2: Network failures on key pages', async ({ page }) => {
    const failed: { url: string; status: number }[] = [];
    page.on('response', resp => {
      if (resp.status() >= 400) {
        failed.push({ url: resp.url(), status: resp.status() });
      }
    });

    // Login
    await page.goto(`${BASE}/ro/login`);
    await page.getByLabel(/email/i).fill(STAFF_EMAIL);
    await page.getByLabel(/parol/i).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: /autentificare/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 20000 });

    // Visit key pages
    const pages = [
      '/ro/dashboard',
      '/ro/contribuabili',
      '/ro/proprietati/cladiri',
      '/ro/proprietati/terenuri',
      '/ro/proprietati/vehicule',
      '/ro/plati',
      '/ro/rapoarte',
    ];

    for (const p of pages) {
      await page.goto(`${BASE}${p}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('[D2] Total failed requests:', failed.length);
    failed.forEach(f => console.log(`[D2]   ${f.status} ${f.url.slice(0, 150)}`));
  });

  test('D3: API response times', async ({ request }) => {
    const endpoints = [
      '/api/health',
      '/api/health/deep',
    ];

    for (const ep of endpoints) {
      const start = Date.now();
      const res = await request.get(`${BASE}${ep}`);
      const elapsed = Date.now() - start;
      console.log(`[D3] ${ep}: ${res.status()} in ${elapsed}ms`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE E — RESPONSIVE SWEEP
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE E — Responsive', () => {

  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    test(`E1-${vp.name}: Staff login at ${vp.width}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();

      await page.goto(`${BASE}/ro/login`);
      await page.waitForLoadState('networkidle');
      await screenshotAndLog(page, `E1-${vp.name}-login`);

      // Check if form is usable
      const emailInput = page.getByLabel(/email/i);
      const isVisible = await emailInput.isVisible();
      console.log(`[E1-${vp.name}] Login email visible: ${isVisible}`);

      await ctx.close();
    });

    test(`E2-${vp.name}: Portal login at ${vp.width}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();

      await page.goto(`${BASE}/ro/portal/login`);
      await page.waitForLoadState('networkidle');
      await screenshotAndLog(page, `E2-${vp.name}-portal-login`);

      await ctx.close();
    });

    test(`E3-${vp.name}: Staff dashboard at ${vp.width}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();

      // Login
      await page.goto(`${BASE}/ro/login`);
      await page.getByLabel(/email/i).fill(STAFF_EMAIL);
      await page.getByLabel(/parol/i).fill(STAFF_PASSWORD);
      await page.getByRole('button', { name: /autentificare/i }).click();
      await page.waitForURL('**/dashboard**', { timeout: 20000 });
      await page.waitForTimeout(2000);
      await screenshotAndLog(page, `E3-${vp.name}-dashboard`);

      // Check sidebar visibility
      const sidebar = page.locator('nav, aside, [role="navigation"]').first();
      const sidebarVisible = await sidebar.isVisible();
      console.log(`[E3-${vp.name}] Sidebar visible: ${sidebarVisible}`);

      // Check for hamburger menu on mobile
      if (vp.width <= 768) {
        const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="meniu" i], button:has(svg.lucide-menu)');
        console.log(`[E3-${vp.name}] Hamburger menu: ${await hamburger.count() > 0}`);
        if (await hamburger.count() > 0) {
          await hamburger.first().click();
          await page.waitForTimeout(500);
          await screenshotAndLog(page, `E3-${vp.name}-hamburger-open`);
        }
      }

      // Test a table page
      await page.goto(`${BASE}/ro/contribuabili`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await screenshotAndLog(page, `E3-${vp.name}-table`);

      await ctx.close();
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE F — EDGE CASES & SECURITY UX
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PHASE F — Edge Cases', () => {
  test('F1: Protected routes without auth redirect to login', async ({ page }) => {
    const protectedRoutes = [
      '/ro/dashboard',
      '/ro/contribuabili',
      '/ro/proprietati/cladiri',
      '/ro/plati',
      '/ro/admin/anomalii',
    ];

    for (const route of protectedRoutes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
      const finalUrl = page.url();
      console.log(`[F1] ${route} → ${finalUrl}`);
      const redirectedToLogin = finalUrl.includes('/login');
      console.log(`[F1]   Redirected to login: ${redirectedToLogin}`);
    }
  });

  test('F2: Portal protected routes without auth', async ({ page }) => {
    const portalRoutes = [
      '/ro/portal/dashboard',
      '/ro/portal/proprietati',
      '/ro/portal/plati',
      '/ro/portal/certificate',
      '/ro/portal/profil',
    ];

    for (const route of portalRoutes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
      const finalUrl = page.url();
      console.log(`[F2] ${route} → ${finalUrl}`);
    }
  });

  test('F3: SQL injection-like input in search', async ({ page }) => {
    await page.goto(`${BASE}/ro/login`);
    await page.getByLabel(/email/i).fill(STAFF_EMAIL);
    await page.getByLabel(/parol/i).fill(STAFF_PASSWORD);
    await page.getByRole('button', { name: /autentificare/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 20000 });

    await page.goto(`${BASE}/ro/contribuabili`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const search = page.locator('input[placeholder*="Caut"], input[type="search"], input[placeholder*="caut"]');
    if (await search.count() > 0) {
      await search.first().fill("'; DROP TABLE contribuabil; --");
      await page.waitForTimeout(3000);
      const text = await page.textContent('body');
      console.log('[F3] After SQL injection test (300):', text?.slice(0, 300));
      await screenshotAndLog(page, 'F3-sql-injection-test');
    } else {
      console.log('[F3] No search input found');
    }
  });

  test('F4: XSS-like input in login', async ({ page }) => {
    await page.goto(`${BASE}/ro/login`);
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('<script>alert("xss")</script>@test.com');
    const pwInput = page.getByLabel(/parol/i);
    await pwInput.fill('Test<img onerror=alert(1) src=x>');
    await page.getByRole('button', { name: /autentificare/i }).click();
    await page.waitForTimeout(2000);
    await screenshotAndLog(page, 'F4-xss-test');
    const text = await page.textContent('body');
    console.log('[F4] After XSS test (300):', text?.slice(0, 300));
  });

  test('F5: Double-click submit on login', async ({ page }) => {
    await page.goto(`${BASE}/ro/login`);
    await page.getByLabel(/email/i).fill(STAFF_EMAIL);
    await page.getByLabel(/parol/i).fill(STAFF_PASSWORD);
    const btn = page.getByRole('button', { name: /autentificare/i });
    // Rapid double click
    await btn.dblclick();
    await page.waitForTimeout(5000);
    console.log('[F5] After double-click URL:', page.url());
    await screenshotAndLog(page, 'F5-double-click');
  });
});
