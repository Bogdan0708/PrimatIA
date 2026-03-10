import { test, expect } from '@playwright/test';

// ─── 1. API Health ──────────────────────────────────────────────────────────

test.describe('API Health & AI Gateway', () => {
  test('GET /api/health', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = await res.json();
    console.log('[HEALTH]', JSON.stringify(body));
    expect(res.ok()).toBeTruthy();
    expect(body.status).toBe('ok');
  });

  test('GET /api/health/deep — DB, Redis, AI status', async ({ request }) => {
    const res = await request.get('/api/health/deep');
    const body = await res.json();
    console.log('[DEEP-HEALTH] status:', res.status());
    console.log('[DEEP-HEALTH] full:', JSON.stringify(body, null, 2));

    expect(body).toHaveProperty('database');
    expect(body.database.status).toBe('ok');
    console.log('[DB] latency:', body.database.latencyMs, 'ms');

    if (body.redis) {
      console.log('[REDIS] status:', body.redis.status, '| message:', body.redis.message ?? 'none');
    }

    if (body.ai) {
      console.log('[AI] status:', body.ai.status);
      console.log('[AI] provider:', body.ai.provider);
      console.log('[AI] model:', body.ai.model);
      console.log('[AI] latency:', body.ai.latencyMs, 'ms');
      console.log('[AI] httpStatus:', body.ai.httpStatus);
    }
  });

  test('AI chatbot responds', async ({ request }) => {
    // Test the chatbot API endpoint directly
    const res = await request.post('/api/chatbot', {
      data: {
        message: 'Ce taxe trebuie să plătesc pentru o clădire?',
        history: [],
      },
    });
    console.log('[CHATBOT] status:', res.status());
    if (res.ok()) {
      const body = await res.json();
      console.log('[CHATBOT] response keys:', Object.keys(body));
      console.log('[CHATBOT] answer (first 300):', JSON.stringify(body).slice(0, 300));
    } else {
      const text = await res.text();
      console.log('[CHATBOT] error:', text.slice(0, 300));
    }
  });
});

// ─── 2. Staff Admin Full Flow ───────────────────────────────────────────────

test.describe('Staff Admin', () => {
  test('login → dashboard → all sections', async ({ page }) => {
    // Login
    await page.goto('/ro/login');
    await page.getByLabel('Adresă de email').fill('admin@bogdanvoda.ro');
    await page.getByLabel('Parolă').fill('Admin123!');
    await page.getByRole('button', { name: 'Autentificare', exact: true }).click();
    await page.waitForURL('**/ro/dashboard**', { timeout: 20000 });
    console.log('[STAFF] Dashboard loaded');

    // Dashboard stats
    const dashText = await page.evaluate(() => document.body.innerText);
    console.log('[STAFF-DASH]', dashText.slice(0, 500));
    await page.screenshot({ path: 'test-results/live-staff-dashboard.png', fullPage: true });

    // Contribuabili
    await page.goto('/ro/contribuabili');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const contribRows = await page.locator('table tbody tr').count();
    console.log('[CONTRIBUABILI] rows:', contribRows);
    await page.screenshot({ path: 'test-results/live-staff-contribuabili.png', fullPage: true });

    // Buildings (cladiri)
    await page.goto('/ro/proprietati/cladiri');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const buildingRows = await page.locator('table tbody tr').count();
    console.log('[CLADIRI] rows:', buildingRows);
    if (buildingRows > 0) {
      const firstRow = await page.locator('table tbody tr').first().textContent();
      console.log('[CLADIRI] first row:', firstRow?.slice(0, 200));
    }
    await page.screenshot({ path: 'test-results/live-staff-cladiri.png', fullPage: true });

    // Land (terenuri)
    await page.goto('/ro/proprietati/terenuri');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log('[TERENURI] rows:', await page.locator('table tbody tr').count());
    await page.screenshot({ path: 'test-results/live-staff-terenuri.png', fullPage: true });

    // Vehicles
    await page.goto('/ro/proprietati/vehicule');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log('[VEHICULE] rows:', await page.locator('table tbody tr').count());
    await page.screenshot({ path: 'test-results/live-staff-vehicule.png', fullPage: true });

    // Payments
    await page.goto('/ro/plati');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log('[PLATI] loaded');
    await page.screenshot({ path: 'test-results/live-staff-plati.png', fullPage: true });

    // Reports
    await page.goto('/ro/rapoarte');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log('[RAPOARTE] loaded');
    await page.screenshot({ path: 'test-results/live-staff-rapoarte.png', fullPage: true });

    // Anomalies
    await page.goto('/ro/admin/anomalii');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);
    const anomalyText = await page.evaluate(() => document.body.innerText);
    console.log('[ANOMALII] text (first 400):', anomalyText.slice(0, 400));
    await page.screenshot({ path: 'test-results/live-staff-anomalii.png', fullPage: true });
  });
});

// ─── 3. Citizen Portal Full Flow ────────────────────────────────────────────

test.describe('Citizen Portal', () => {
  test('login → dashboard → properties → payments → certificates → AI chatbot', async ({ page }) => {
    // Login
    await page.goto('/ro/portal/login');
    await page.getByLabel(/adres[aă] de email/i).fill('cetatean@example.ro');
    await page.getByLabel(/parol[aă]/i).fill('Citizen123!');
    await page.getByRole('button', { name: /autentificare/i }).click();
    await page.waitForURL('**/ro/portal/dashboard**', { timeout: 20000 });
    console.log('[CITIZEN] Dashboard loaded');

    const dashText = await page.evaluate(() => document.body.innerText);
    console.log('[CITIZEN-DASH]', dashText.slice(0, 500));
    await page.screenshot({ path: 'test-results/live-citizen-dashboard.png', fullPage: true });

    // Properties
    const propLink = page.getByRole('link', { name: /propriet[aă][tț]i/i });
    if (await propLink.count() > 0) {
      await propLink.first().click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      const propText = await page.evaluate(() => document.body.innerText);
      console.log('[CITIZEN-PROPS]', propText.slice(0, 400));
      await page.screenshot({ path: 'test-results/live-citizen-props.png', fullPage: true });
    } else {
      console.log('[CITIZEN-PROPS] no properties link found, trying direct nav');
      await page.goto('/ro/portal/proprietati');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/live-citizen-props.png', fullPage: true });
    }

    // Payments
    await page.goto('/ro/portal/plati');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const platiText = await page.evaluate(() => document.body.innerText);
    console.log('[CITIZEN-PLATI]', platiText.slice(0, 400));
    await page.screenshot({ path: 'test-results/live-citizen-plati.png', fullPage: true });

    // Certificates
    await page.goto('/ro/portal/certificate');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const certText = await page.evaluate(() => document.body.innerText);
    console.log('[CITIZEN-CERT]', certText.slice(0, 400));
    await page.screenshot({ path: 'test-results/live-citizen-cert.png', fullPage: true });

    // AI Chatbot widget
    const chatButton = page.locator('[aria-label*="chat"], [data-testid*="chat"], button:has(svg)').last();
    if (await chatButton.isVisible()) {
      await chatButton.click();
      await page.waitForTimeout(1000);
      const chatInput = page.locator('input[placeholder*="mesaj"], input[placeholder*="întreab"], textarea').last();
      if (await chatInput.isVisible()) {
        await chatInput.fill('Când sunt scadente impozitele?');
        await chatInput.press('Enter');
        await page.waitForTimeout(8000); // Wait for AI response
        await page.screenshot({ path: 'test-results/live-citizen-chatbot.png', fullPage: true });
        const chatArea = await page.evaluate(() => document.body.innerText);
        // Find chatbot response area
        const chatContent = chatArea.split('Când sunt scadente impozitele?').pop();
        console.log('[CITIZEN-CHATBOT] response:', chatContent?.slice(0, 400));
      } else {
        console.log('[CITIZEN-CHATBOT] chat input not found');
      }
    } else {
      console.log('[CITIZEN-CHATBOT] chat button not found');
    }
  });
});
