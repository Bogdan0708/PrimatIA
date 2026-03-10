import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /e2e\/debug-live\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,

  use: {
    baseURL: 'https://primaria-j3dqdqxnyq-lm.a.run.app',
    ...devices['Desktop Chrome'],
    screenshot: 'on',
    trace: 'on',
  },
});
