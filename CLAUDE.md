# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Presupuestos is a static PWA (no build step, no framework, no bundler) for creating construction/trade quotes ("presupuestos") on mobile and exporting them as PDF. It's a personal-use app; all data lives in the browser's `localStorage` on the user's device — there is no backend, database, or server-side code. The UI text and all user-facing strings are in Spanish.

## Running / developing

The deployed app itself has no build step, no framework, and no runtime dependencies. To work on it:

- Serve the directory statically and open it in a browser, e.g. `python3 -m http.server 8000` or `npx serve`, then visit `index.html`.
- Because `index.html` loads `js/main.js` as an ES module (`<script type="module">`), it must be served over HTTP(S) — opening `index.html` directly via `file://` will fail due to module CORS restrictions.
- Also verify changes manually in the browser for anything the automated tests don't cover (visual layout, PDF appearance, PWA install/offline behavior).
- Deployment is via Vercel with framework preset "Other" (static site) — `vercel.json` sets `buildCommand`/`installCommand` to empty strings so Vercel never runs `npm install`/build (the `package.json` below is dev-only test tooling, not part of the deployed app), plus header config for `sw.js` and `manifest.webmanifest`. Pushes to the main branch auto-deploy.

### Testing

`package.json` (dev-only; not deployed) declares a single devDependency, `playwright`, and uses Node's built-in test runner — no Jest/Vitest/bundler.

- `npm install` — install `playwright`. Browsers aren't downloaded automatically in this environment (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`); run `npx playwright install chromium` once if `tests/e2e` can't find a browser. In a sandbox without internet access to the Playwright CDN, point `PW_CHROMIUM_PATH` at a pre-provisioned Chromium binary instead (see `tests/e2e/helpers.js`).
- `npm run test:unit` — `tests/unit/*.test.js`: pure-logic tests for `utils.js`, `state.js` (including `normalizeLinea()` migration from every legacy línea shape), `views.js` (HTML output, including XSS-safety of `escapeHtml`), and the DOM-free branches of `actions.js`'s `handleAction` (new/save/duplicate/delete/reset/add-line/navigation), driven via a mock `{ getState, setState, getUI, setUI, render, toast }` context — no browser needed.
- `npm run test:e2e` — `tests/e2e/app.test.js`: drives the real app in Chromium via Playwright against a plain `node:http` static server (`tests/e2e/helpers.js`) serving the repo root, covering full user flows (create/edit/save/duplicate/delete a presupuesto, legacy-format migration, PDF generation using the vendored jsPDF, IVA math, export, XSS safety, and no-horizontal-overflow checks at 320/390/768/1440px).
- `npm test` — runs both.

When adding app logic, prefer a unit test against the pure function; when a change affects DOM wiring, rendering, or a full user flow, add or extend an e2e test.

## Architecture

Everything renders into a single `#app` div in `index.html` via full innerHTML re-renders — there is no virtual DOM or component framework. All CSS is inlined in a `<style>` block in `index.html`.

Module responsibilities (`js/`):

- **`state.js`** — `DEFAULT_STATE` shape, `STORAGE_KEY` (`presupuestos_app_v1`), and `loadState()`/`saveState()` for reading/writing the single localStorage blob. `loadState` merges saved data over `DEFAULT_STATE` so new settings fields get defaults on older saved data, and runs each línea through `normalizeLinea()` to migrate older shapes (a single lump `precio`, or the short-lived `cantidad`/`precioUnitario` pair) onto today's `items` array as one item, preserving the original total. `actions.js`'s import flow re-runs the same normalization on imported backups.
- **`utils.js`** — small pure helpers: `uuid()`, date/price formatting (`formatDate`, `formatPrice` — Spanish `.`/`,` grouping), `calcLineaTotal` (sums a línea's `items[].precio`), `calcSubtotal`/`calcTotal` (sum of line totals, optional IVA), `escapeHtml`, and `setPath(obj, "a.b.c", value)` used to write into nested state from dotted `data-field`/`data-setting` attributes.
- **`views.js`** — pure functions returning HTML strings: `renderHome` (list/search), `renderEditor` (presupuesto form), `renderSettings`. No side effects; they just read state/draft and interpolate (always via `escapeHtml` for user input).
- **`actions.js`** — `createActions(ctx)` factory holding all state-mutating flows: save/duplicate/delete a presupuesto, save settings, export/import JSON backup, trigger PDF generation. Takes `{ getState, setState, getUI, setUI, render, toast }` from `main.js` so it stays decoupled from the DOM/render loop.
- **`pdf.js`** — `generatePDF(presupuesto, state)` builds the PDF with jsPDF (global `window.jspdf`, loaded via a `<script>` tag in `index.html` from the vendored `./vendor/jspdf.umd.min.js`, *not* as an ES import), replicating a specific orange-themed layout (header, emisor/client info, line-item table with page-break handling, total, notes, validity note). Uses `navigator.share` with file support when available, falling back to `doc.save()`.
- **`main.js`** — entry point: owns the `state`/`ui` in-memory objects, the `render()`/`attachHandlers()` cycle (event delegation on `data-action`, `data-open`, `data-field`, `data-line-field`, `data-setting`, `data-toggle` attributes), debounced autosave of the editor draft (600ms), and service worker registration.

### Render/event flow

There's no reactive framework: `render()` replaces `#app.innerHTML` from the current `state`/`ui`, then `attachHandlers()` re-binds listeners by querying `data-*` attributes on the freshly rendered DOM. Views communicate user intent purely through these attributes:

- `data-action="X"` → `actions.handleAction("X")` (navigation, save, pdf, duplicate, delete, export/import, reset, etc. — see the `if/else if` chain in `actions.js`)
- `data-open="<id>"` → opens a presupuesto into the editor (`openPresupuesto` in `main.js`)
- `data-field="a.b"` / `data-line-field` (a línea's `titulo`) / `data-item-field` (an item's `texto`/`precio`, addressed by `data-line-idx`+`data-item-idx`) / `data-setting="a.b"` → write into `ui.draft`, a línea, an item, or `state.settings` respectively
- `data-add-item="<lineIdx>"` / `data-remove-item="<lineIdx>,<itemIdx>"` → add/remove an item row within a concepto (handled directly in `main.js`, not through `handleAction`)
- `data-toggle="iva"` / `data-toggle="iva-setting"` → IVA on/off switches (handled directly in `main.js`, not through `handleAction`)

When adding a new interactive element in a view, follow this same attribute-driven pattern rather than attaching ad-hoc listeners — `attachHandlers()` is the single place DOM listeners get wired up after each render.

### Data model

A presupuesto: `{ id, numero, fecha, cliente: { dni, nombre, direccion, localidad }, lineas: [{ titulo, items: [{ texto, precio }] }], notas, ivaActivo, ivaPorcentaje, validez, modificado }`. Each línea (concepto) is a title plus a list of items — one text line and one price each; the línea's total is the sum of its items' `precio` (`calcLineaTotal` in `utils.js`), not a stored field. In the PDF each item becomes a bullet under the bold título, with a single total price for the whole concepto on the right. `numero` auto-increments from `state.settings.siguienteNumero`. Settings hold the emisor (issuer) info pre-filled into new PDFs and defaults (notes text, IVA, validity days).

### PWA / offline

`sw.js` precaches the app shell (cache name `presupuestos-v3` — bump this when precached assets change materially) with a network-first strategy for navigations and cache-first for other assets. `manifest.webmanifest` defines install metadata. `index.html` loads jsPDF from the vendored `./vendor/jspdf.umd.min.js` (not a CDN), matching what `sw.js` precaches, so PDF generation works fully offline.

`_check_0.js` at the repo root is an unused auxiliary file (per its own comment) and not referenced by the app.
