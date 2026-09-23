import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3101', trace: 'retain-on-failure' },
  webServer: { command: 'rm -rf .portable-core-e2e && pnpm dev', url: 'http://127.0.0.1:3101/health/live', env: { PORT: '3101', PORTABLE_CORE_DATA_DIR: '.portable-core-e2e' }, reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
