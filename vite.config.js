import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Production build inlines all JS/CSS into a single self-contained dist/index.html
// (non-negotiable #2). `base: './'` keeps references relative for GitHub Pages (P2);
// moot once everything is inlined, but correct.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
