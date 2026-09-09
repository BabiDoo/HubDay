import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// DB integration tests hit the real test PostgreSQL (port 5433). API tests boot a
// Nest testing module, which needs decorator metadata — provided by unplugin-swc
// (vitest's default esbuild transform does not emit `design:paramtypes`).
// Everything runs in a single fork, no parallelism, so transactions across test
// files never collide.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    watch: false,
    globalSetup: ['./test/db/setup.ts'],
    include: ['test/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
