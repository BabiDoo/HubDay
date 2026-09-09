import { defineConfig, devices } from "@playwright/test";

/**
 * One real-browser (chromium) E2E covering the Hubday scheduling journey.
 * See apps/web/e2e/README.md for how to run it.
 *
 * Readiness is gated purely on health:
 *  - the API webServer is considered up when GET /health returns 2xx
 *  - the web webServer is considered up when GET / returns 2xx
 * No fixed waits or sleeps are used anywhere.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "off",
    video: "off",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // NestJS + Fastify API. Loads the repo-root .env itself. Run without
      // node --watch so a mid-test file touch can never restart it.
      command: "node --import @swc-node/register/esm-register src/main.ts",
      cwd: "../api",
      url: "http://localhost:3000/health",
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Vite dev server for apps/web (strict port 5173).
      command: "pnpm dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
