import { defineConfig } from '@playwright/test';

// Config for tests that do not require a running qBittorrent instance or Docker.
// Covers: app-startup.spec.ts, server-management.spec.ts (7 tests total).
export default defineConfig({
  testDir: './e2e/tests',
  testMatch: ['app-startup.spec.ts', 'server-management.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    actionTimeout: 10_000,
  },
});
