import { defineConfig } from 'vitest/config';

// Database tests run against a real Supabase Postgres (docker compose or
// `supabase start`). Every test runs in a transaction that is rolled back, so
// the seed data is never modified.
export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
