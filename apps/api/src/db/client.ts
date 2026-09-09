import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index.js';

/**
 * Standalone database client factory (ADR 007 / 012).
 *
 * Importing this module must NOT open a connection. Callers create a client
 * explicitly; migrate/seed scripts and DB integration tests pass their own URL.
 */
export function resolveDatabaseUrl(explicit?: string): string {
  const url = explicit ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env at the repo root.');
  }
  return url;
}

export function createDbClient(explicitUrl?: string) {
  const url = resolveDatabaseUrl(explicitUrl);
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export { schema };
export type Database = ReturnType<typeof createDbClient>['db'];
