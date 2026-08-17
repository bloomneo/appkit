import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global timeout for all tests (15 seconds)
    testTimeout: 15000,

    // Your existing configuration
    globals: true,
    environment: 'node',

    // Setup file runs once before any test file is loaded — used to set
    // env vars that modules validate at import time (e.g. BLOOM_AUTH_SECRET).
    setupFiles: ['./vitest.setup.ts'],

    // Integration gates need real Redis/Postgres/S3 and are opt-in via
    // `npm run test:integration`. They are excluded here so a plain `npm test`
    // stays hermetic — but they are NOT optional in CI, where the services
    // exist and an unverified module claim is what they are there to catch.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integration/**'],

    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        'src/**/examples/**',
        'src/**/tests/**',
        'src/**/*.test.ts',
      ],
    },
  },
});
