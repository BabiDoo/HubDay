import { z } from 'zod';

/**
 * Runtime environment contract (ADR 005). Parsed once at bootstrap; the process
 * exits on failure printing only the offending KEYS (never values).
 */
export const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  AUTH_TOKEN_SECRET: z.string().min(1),
  WEB_ORIGIN: z.string().min(1),
  VITE_API_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(root)'))];
    console.error(
      `Invalid environment configuration. Fix these keys in the repo-root .env: ${keys.join(', ')}`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const AUTH_TOKEN_TTL_SECONDS = 12 * 60 * 60;
