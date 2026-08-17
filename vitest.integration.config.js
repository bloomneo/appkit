import { defineConfig } from 'vitest/config';

/**
 * Integration gates — every module claim exercised against its real backend.
 *
 * Separate from vitest.config.js on purpose: `npm test` must stay hermetic and
 * fast, while these need real Redis/Postgres/S3. They are opt-in locally
 * (`npm run test:integration`) and mandatory in CI, where the services exist.
 *
 * Each suite skips loudly when its service is absent, so an unverified claim
 * is visible rather than silently green.
 */
export default defineConfig({
  test: {
    testTimeout: 30000,
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
  },
});
