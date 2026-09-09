import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../../.env') });
config();

import { runMigrations } from '../../src/db/migrate.js';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (expected the port 5433 test database).');
  }
  return url;
}

/**
 * Vitest global setup: apply all migrations once against the ephemeral test DB
 * before any suite runs (ADR 009).
 */
export default async function globalSetup(): Promise<void> {
  await runMigrations(testDatabaseUrl());
}
