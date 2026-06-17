import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Production build inlines all JS/CSS into a single self-contained dist/index.html.
// `base: './'` keeps asset references relative (moot once everything is inlined,
// but correct for static hosting).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    // Everything is inlined into one file, so there are no modulepreload links to
    // hydrate. Dropping the polyfill removes its runtime fetch() and keeps the
    // built artifact provably free of network calls.
    modulePreload: false,
  },
});
