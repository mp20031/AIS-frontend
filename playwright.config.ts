import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: a real browser against the real stack — portal, iam-api,
 * Postgres and Redis — as `docker compose up` in D:\IAM-SAL brings it up.
 *
 *   docker compose up -d --build      (in the folder with docker-compose.yml)
 *   npm run test:e2e
 *
 * They exercise what unit tests can't: the httpOnly refresh cookie actually
 * crossing from :5173 to :8010, and sessions ending on the server.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/globalSetup.ts',
  // One database behind every test: running them in parallel would let one
  // test's revocations land in another's session.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
