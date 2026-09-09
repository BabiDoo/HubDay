# Web E2E (Playwright)

One real-browser (chromium only) test of the full scheduling journey:
sign in -> pick professional/service/customer -> load availability -> create ->
see it listed -> reschedule -> confirm -> cancel -> original slot open again.

The 409 conflict is deliberately left to `apps/api/test/api/concurrency.test.ts`.

## Run it

From the repo root, once:

```bash
pnpm db:up          # Postgres containers (5432 app, 5433 test)
pnpm migrate        # only on a fresh database
```

Then:

```bash
pnpm test:e2e                       # repo root  (delegates to the web package)
# or
pnpm --filter @hubday/web test:e2e
```

Playwright itself:

- starts the API (`:3000`) and web (`:5173`) dev servers and waits on
  `GET /health` and `GET /` (no sleeps, no fixed waits);
- reuses servers you already have running (`reuseExistingServer: true`);
- runs `global-setup.ts`, which executes the idempotent `pnpm --filter
  @hubday/api seed` exactly once before the run.

Fixtures are the seeded fictitious dataset only (`owner@aurora.test` /
`hubday-dev`, Aurora Estudio, `America/Sao_Paulo`). No external network.

Artifacts (`test-results/`, `playwright-report/`) are git-ignored; screenshots,
video and trace are off (`trace` is `on-first-retry`).
