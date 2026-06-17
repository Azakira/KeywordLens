# KeywordLens

**A local, offline resume keyword highlighter.** Paste your resume on the left and the
keywords from a job description on the right — KeywordLens live-highlights every match,
counts occurrences, and shows you exactly which keywords are present and which are
missing. Nothing ever leaves your machine.

> 🔒 **100% private.** No upload, no account, no server. The entire app runs in your
> browser and makes **zero network requests** — you can save the page and run it
> completely offline from a `file://` URL.

[![Download keywordlens.html](https://img.shields.io/badge/Download-keywordlens.html-2ea44f?style=for-the-badge&logo=html5&logoColor=white)](https://github.com/Azakira/KeywordLens/releases/latest/download/keywordlens.html)
&nbsp;
[**▶ Open the live demo**](https://azakira.github.io/KeywordLens/)

## Why

Tailoring a resume to a job description means checking, over and over, whether you've
actually used the words that matter. KeywordLens makes that loop fast and visual: group
the job's keywords into themed **families**, give each a color, and instantly see your
coverage and gaps across one or several resume versions.

It is intentionally **not** an ATS simulator, a "resume score," an AI rewriter, or a
PDF/DOCX parser. It counts and highlights plain text — that's it.

## Features

- **Live, color-coded highlighting** of keyword matches as you type.
- **Keyword families** — group related keywords by theme, each with its own color from a
  curated palette.
- **Occurrence counts** plus present / missing badges per keyword, with a one-click copy
  of everything that's missing.
- **Multiple resume tabs** — keep several resume versions open, sharing one set of keyword
  families. Compare coverage with a scope toggle (count against *this* resume or *all* of
  them).
- **Whole-word matching** toggle for precise counts.
- **Line-numbered editor.**
- **Local autosave**, undo/redo history, and **JSON session export/import** so you can
  back up or move a session between machines.

## Try it

- **Hosted (static, still 100% client-side):**
  [azakira.github.io/KeywordLens](https://azakira.github.io/KeywordLens/)
- **Download the offline app:** grab the latest single-file build —
  [**keywordlens.html**](https://github.com/Azakira/KeywordLens/releases/latest/download/keywordlens.html)
  — and open it in any browser. It's one self-contained HTML file with no dependencies, so
  it works completely offline, forever. (This download is rebuilt automatically on every
  release.)
- **Build it yourself:** see [Development](#development) below and open `dist/index.html`.

### Verifying the download

Each released `keywordlens.html` is built in CI and signed with a keyless
[Sigstore](https://www.sigstore.dev/) build-provenance attestation, so you can confirm it
was produced by this repository's workflow (and not tampered with afterward):

```bash
# Authenticity — verify the build provenance (requires the GitHub CLI):
gh attestation verify keywordlens.html --repo Azakira/KeywordLens

# Integrity — check the published SHA-256 checksum:
sha256sum -c keywordlens.html.sha256
```

## Privacy & trust model

Your resume text and keywords are sensitive personal data, so KeywordLens is built around
one rule: **that data never leaves your machine.** All highlighting, counting, autosave,
history, and import/export happen entirely in the browser. The shipped build references no
external scripts, fonts, CDNs, analytics, or telemetry. Data is stored only in your own
browser's `localStorage`/`sessionStorage`, or in files you explicitly export.

## Development

KeywordLens is a [Vite](https://vitejs.dev/) project that bundles into a **single
self-contained `dist/index.html`** via
[`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile). The
core logic lives in DOM-free, unit-tested ES modules; a thin render layer handles the DOM.

```bash
npm install      # install dependencies
npm run dev      # start the dev server with hot reload
npm run build    # produce the single-file dist/index.html
npm run preview  # serve the production build locally
npm test         # run the Vitest unit tests
npm run coverage # run tests with coverage
npm run lint     # run oxlint
```

### Project layout

```
src/
├─ main.js          # boot: hydrate state, wire up render
├─ state.js         # in-memory state, mutators, subscribe/notify
├─ highlight.js     # match-regex build + highlight generation (pure)
├─ stats.js         # counts, present/missing, recap, scope (pure)
├─ persistence.js   # autosave, undo/redo, JSON import/export, fail-safe load
├─ palette.js       # color swatches + per-family color application
├─ render.js        # DOM rendering + event wiring
└─ styles.css       # styles
test/               # Vitest specs mirroring src/
```

CI (GitHub Actions) runs lint → tests → build on every push and pull request; pushes to
`main` re-run the gate and deploy the single-file build to GitHub Pages.

## License

Licensed under the [Apache License 2.0](LICENSE).
