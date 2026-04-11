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
