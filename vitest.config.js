import { defineConfig } from 'vitest/config';

// Unit-test config for the pure core modules (highlight, stats, palette,
// persistence, state). jsdom provides localStorage/sessionStorage + DOM for the
// persistence I/O tests without a real browser. The single-file build config
// lives separately in vite.config.js.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/highlight.js', 'src/stats.js', 'src/palette.js', 'src/persistence.js', 'src/state.js'],
      // Permissive starting threshold, to be ratcheted up later. The pure modules
      // carry the matching/counting/serialization logic that must stay correct.
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
