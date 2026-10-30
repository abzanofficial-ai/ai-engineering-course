import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
export const MAIL_FILE = ".cache/e2e-mail.jsonl";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // flaky tests get fixed, not retried (test-strategy §9)
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      APP_URL: `http://localhost:${port}`,
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ?? "postgres://lms:lms_local_only@localhost:5432/lms_e2e",
      AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
      EMAIL_TRANSPORT: "file",
      AUTH_RATE_LIMIT: "off",
      MAIL_FILE,
      ADMIN_EMAILS: "owner@example.test",
    },
  },
});
