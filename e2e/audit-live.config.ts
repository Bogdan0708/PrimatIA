import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.AUDIT_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const auditArtifactsEnabled = process.env.AUDIT_ENABLE_ARTIFACTS === "true";
const isLocalTarget = baseURL
  ? /^(https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)(\/|$)/i.test(baseURL)
  : false;
const allowSensitiveArtifacts = process.env.AUDIT_ALLOW_SENSITIVE_ARTIFACTS === "true";

if (!baseURL) {
  throw new Error('AUDIT_BASE_URL or PLAYWRIGHT_BASE_URL must be set for live audit runs.');
}

if (auditArtifactsEnabled && !isLocalTarget && !allowSensitiveArtifacts) {
  throw new Error(
    'AUDIT_ENABLE_ARTIFACTS=true for a non-local audit target requires AUDIT_ALLOW_SENSITIVE_ARTIFACTS=true.'
  );
}

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
    baseURL,
    ...devices['Desktop Chrome'],
    screenshot: auditArtifactsEnabled ? 'on' : 'off',
    trace: auditArtifactsEnabled ? 'on' : 'off',
    video: auditArtifactsEnabled ? 'retain-on-failure' : 'off',
  },

  outputDir: 'test-results/audit-output',
});
