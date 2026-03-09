import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'https://primaria-j3dqdqxnyq-lm.a.run.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup project — authenticates and saves storage state
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Authenticated tests as admin
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /.*admin.*\.spec\.ts/,
    },

    // Authenticated tests as citizen
    {
      name: 'chromium-citizen',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/citizen.json',
      },
      dependencies: ['setup'],
      testMatch: /.*citizen.*\.spec\.ts/,
    },

    // Unauthenticated tests (no storageState, no setup dependency)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /auth\.spec\.ts/,
    },
  ],
});
