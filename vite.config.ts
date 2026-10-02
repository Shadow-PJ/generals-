import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the game from /<repo name>/; everywhere else it lives at the root.
  base: process.env.GITHUB_PAGES === 'true' ? '/generals-/' : '/',
  build: {
    // Phaser alone is about 1.3 MB minified; don't warn about it.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
  },
});
