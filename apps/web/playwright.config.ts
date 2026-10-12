import { defineConfig, devices } from '@playwright/test';

/**
 * E2E_BACKEND=mock      (default) builds the app against the in-browser mock backend
 * E2E_BACKEND=supabase  builds it against a local Supabase (docker compose / supabase start)
 * E2E_BASE_URL          test an already-running deployment instead of building one
 */
const backend = process.env.E2E_BACKEND === 'supabase' ? 'supabase' : 'mock';
const port = 4173;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 740 }, hasTouch: true },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx vite build --outDir dist-e2e-${backend} && npx vite preview --outDir dist-e2e-${backend} --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env:
          backend === 'supabase'
            ? {
                VITE_BACKEND: 'supabase',
                VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321',
                VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY,
              }
            : { VITE_BACKEND: 'mock', VITE_MOCK_LATENCY_MS: '50' },
      },
});
