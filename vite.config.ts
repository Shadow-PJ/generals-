import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // Phaser alone is about 1.3 MB minified; don't warn about it.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
  },
});
