import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env first, then fall back to cwd/.env, before anything reads env.
config({ path: resolve(here, '../../../../.env') });
config();

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolveDatabaseUrl } from './client.js';

const migrationsFolder = resolve(here, '../../drizzle');

/**
 * Applies every pending SQL migration in apps/api/drizzle against the target DB
 * (ADR 007). Accepts an explicit URL so tests can migrate the ephemeral test DB.
 */
export async function runMigrations(explicitUrl?: string): Promise<void> {
  const url = resolveDatabaseUrl(explicitUrl);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runMigrations()
    .then(() => {
      console.log('migrations applied');
      process.exit(0);
    })
    .catch((err) => {
      console.error('migration failed:', err);
      process.exit(1);
    });
}
