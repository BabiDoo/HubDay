import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Side-effect module: load the repo-root `.env` (then cwd `.env`) BEFORE any
 * other module reads `process.env`. Mirrors src/db/migrate.ts. Import this first
 * in main.ts so ESM evaluates it ahead of AppModule.
 */
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../../.env') });
config();
