import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /e2e\/audit-live(-p2)?\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/audit-report' }],
  ],
  timeout: 120_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'https://primaria-j3dqdqxnyq-lm.a.run.app',
    ...devices['Desktop Chrome'],
    screenshot: 'on',
    trace: 'on',
    video: 'retain-on-failure',
  },

  outputDir: 'test-results/audit-output',
});
