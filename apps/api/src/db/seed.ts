import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env first, then fall back to cwd/.env, before anything reads env.
config({ path: resolve(here, '../../../../.env') });
config();

import { sql as raw } from 'drizzle-orm';
import { createDbClient } from './client.js';
import {
  companies,
  users,
  professionals,
  services,
  customers,
  availabilityRules,
} from '../schema/index.js';
import {
  companiesSeed,
  usersSeed,
  professionalsSeed,
  servicesSeed,
  customersSeed,
  availabilityRulesSeed,
} from './seed-data.js';

/**
 * Idempotent seed (ADR 007). One transaction: TRUNCATE ... RESTART IDENTITY
 * CASCADE, then insert the deterministic two-company dataset. Safe to re-run on a
 * clean or already-seeded database.
 */
export async function runSeed(explicitUrl?: string): Promise<void> {
  const { db, sql } = createDbClient(explicitUrl);
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        raw`TRUNCATE TABLE companies, users, professionals, services, customers, availability_rules, appointments RESTART IDENTITY CASCADE`,
      );
      await tx.insert(companies).values(companiesSeed);
      await tx.insert(professionals).values(professionalsSeed);
      await tx.insert(services).values(servicesSeed);
      await tx.insert(customers).values(customersSeed);
      await tx.insert(users).values(usersSeed);
      await tx.insert(availabilityRules).values(availabilityRulesSeed);
    });
    console.log(
      `seed ok: ${companiesSeed.length} companies, ${usersSeed.length} users, ` +
        `${professionalsSeed.length} professionals, ${servicesSeed.length} services, ` +
        `${customersSeed.length} customers, ${availabilityRulesSeed.length} availability rules`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('seed failed:', err);
      process.exit(1);
    });
}
