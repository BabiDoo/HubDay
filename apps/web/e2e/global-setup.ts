import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FullConfig } from "@playwright/test";

/**
 * Minimal, documented state reset: run the idempotent seed exactly once before
 * the E2E run. The seed truncates and re-inserts the two fictitious companies,
 * so every run starts from the same known dataset.
 *
 * No migrations, no schema changes, no extra fixtures. Readiness of the API and
 * web servers is handled by Playwright's `webServer.url` health checks.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..", "..");

  // eslint-disable-next-line no-console
  console.log("[e2e] seeding fictitious dataset (pnpm --filter @hubday/api seed)…");
  execSync("pnpm --filter @hubday/api seed", {
    cwd: repoRoot,
    stdio: "inherit",
  });
}
