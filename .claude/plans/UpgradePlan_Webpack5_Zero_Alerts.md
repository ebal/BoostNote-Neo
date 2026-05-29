# Upgrade Plan: webpack 1 → 5 + babel 6 → 7 — Clear All Dependabot Alerts

**Author**: 2026-05-29
**Goal**: Bring open Dependabot alert count from 15 → 0 by completing the build-chain modernization that CLAUDE.md "Outstanding security work" item #3 has long deferred. After this plan, every CVE-flagged dep in the tree is either patched or removed.

## Target alert inventory (15 open)

| # | Pkg | Severity | Cleared by phase |
|---|-----|----------|------------------|
| 3 | webpack-dev-server | high | 6 |
| 92 | loader-utils | critical | 6 |
| 107 | postcss | medium | 5 |
| 118 | webpack-dev-middleware | high | 6 |
| 120 | babel-traverse | critical | 2 |
| 136 | mermaid (DOMPurify) | high | 4 (or dismiss — not loaded in 9.1.7 UMD) |
| 143 | webpack-dev-server | medium | 6 |
| 144 | webpack-dev-server | medium | 6 |
| 217 | postcss | medium | 5 |
| 218 | mermaid (classDef CSS) | medium | 4 |
| 219 | mermaid (classDef HTML) | medium | 4 |
| 220 | mermaid (Gantt DoS) | medium | 4 |
| 221 | mermaid (config CSS) | medium | 4 |
| 222 | webpack-dev-server | medium | 6 |
| 223 | uuid | medium | 4 |

## Why all 15 share one chokepoint

Every alert is gated on **acorn 8** (for ES2020 syntax in uuid 11 / mermaid 10) or on **post-webpack-1 loader API** (for css-loader 6+ / babel-loader 8 / wds 5). Both arrive in **webpack 5**. Hence the staircase is unavoidably linear: bump webpack OR drop the alerts. There is no shortcut.

CLAUDE.md "Pinned direct deps with a documented ceiling" lists every dep affected by the same parser cliff: `uuid 10+`, `mermaid 9.3+`, `markdownlint 0.12+`, `highlight.js 11+`, `json5 2+`. All unlock after this plan.

## Phase staircase (7 phases, each independently smoke-gated)

Pattern matches the Electron 14→42 migration: small commits, manual launch test between phases, `docker build .` end-to-end gate.

### Phase 1: webpack 1 → 2

- Bump `webpack@^1.12.2` → `^2.7.0` (last 2.x release before mode requirement)
- Convert `webpack.config.js` + `webpack-production.config.js`:
  - `loaders:` → `rules:`
  - `loader: 'style!css?modules!stylus'` → `use: [{loader: 'style-loader'}, {loader: 'css-loader', options: {modules: true, ...}}, {loader: 'stylus-loader'}]`
  - drop `debug: true` (removed in webpack 2)
  - rename `NoErrorsPlugin` → `NoEmitOnErrorsPlugin`
  - rename `OccurenceOrderPlugin` → `OccurrenceOrderPlugin` (typo fix)
  - `loader: 'babel?cacheDirectory'` → `use: 'babel-loader', options: {cacheDirectory: true}`
- Keep babel-loader 6, css-loader 0.19, style-loader 0.12, stylus-loader 2 — these still work with webpack 2 (deprecation warnings only)
- Keep `webpack-skeleton.js` externals as-is (string array form still supported)
- Smoke gate: `docker build .` succeeds + `open dist/Boostnote-darwin-arm64/Boostnote.app` launches without console errors

### Phase 2: webpack 2 → 4 + babel 6 → 7 (paired migration)

Webpack 3 is invisible (internal scope-hoisting only); skip to 4. But webpack 4 requires `mode:` and bumps minimum babel-loader to 7. babel-loader 7 still works with babel 6 packages but emits deprecation; babel-loader 8 requires babel 7. Easier to do both together.

- `webpack@^2.7.0` → `^4.46.0`
- Add `mode: 'development'` / `mode: 'production'` to configs
- Replace `babel-core@^6.14.0` with `@babel/core@^7.20.0` (already in devDeps from jest 27 migration — drop the babel-6 copy)
- Replace `babel-loader@^6.2.0` with `babel-loader@^8.3.0`
- Drop `babel-preset-es2015@^6.3.13`, `babel-preset-env@^1.6.1` (use already-installed `@babel/preset-env`)
- Drop `babel-preset-react@^6.24.1` (use already-installed `@babel/preset-react`)
- Drop `babel-preset-react-hmre@^1.0.1` (no replacement; HMR will lose component-state preservation until Phase 6 adds react-refresh-webpack-plugin)
- Drop `babel-plugin-react-transform@^2.0.0` (paired with react-hmre)
- Drop `babel-plugin-webpack-alias@^2.1.1` (webpack `resolve.alias` already does the same; remove `.babelrc` plugin entry)
- Replace `babel-register@^6.11.6` with `@babel/register@^7.20.0`
- Convert `.babelrc` to babel 7 syntax:
  ```json
  {
    "presets": [
      ["@babel/preset-env", {"targets": {"electron": "42"}}],
      "@babel/preset-react"
    ]
  }
  ```
- Remove the jest 27 inline override (no longer needed — babel 7 is the only babel installed)
- Smoke gate: `docker build .` + manual launch + `docker run --rm boostnote-legacy npm test`
- **Alert #120 babel-traverse cleared automatically** (legacy unscoped pkg removed)

### Phase 3: webpack 4 → 5 + acorn 8

- `webpack@^4.46.0` → `^5.90.0` (latest stable as of 2026-05)
- Update `webpack-skeleton.js`:
  - `externals: ['electron', 'react', ...]` → `externals: {electron: 'commonjs2 electron', react: 'var React', ...}` (webpack 5 enforces explicit type)
  - Add `externalsPresets: {electron: true}` and `target: 'electron-renderer'`
- Add `resolve.fallback` for removed Node polyfills if any module needs them (most renderer code uses Node natively under `nodeIntegration: true`, so fallback is rarely needed — verify per error)
- Replace `ExtractTextPlugin` → `MiniCssExtractPlugin` (if used in production config; current configs use `style-loader` direct so this is a no-op)
- Bump `json-loader` → drop (webpack 5 has built-in `type: 'asset/resource'` and `.json` is parsed natively)
- Bump css-loader, style-loader, stylus-loader to webpack-5-compatible versions (covered in Phase 5)
- Smoke gate: `docker build .` + manual launch
- **acorn 8 now in the toolchain** — uuid 10+/mermaid 10+/markdownlint 0.40+/highlight.js 11+ become bumpable

### Phase 4: post-acorn dep bumps

- `uuid@^9.0.1` → `^11.1.1` (`require('uuid')` → `import { v4 as uuidv4 } from 'uuid'`; CJS path under `dist/cjs/index.js` now parses cleanly under acorn 8). Clears **#223**.
- `mermaid@~9.1.7` → `^10.9.6`:
  - BREAKING: `mermaid.render(id, def, callback)` → `await mermaid.render(id, def)` (returns `{svg, bindFunctions}`)
  - BREAKING: ESM-only; webpack 5 handles ESM natively
  - Rewrite `browser/components/render/MermaidRender.js` to async/await
  - Verify `MermaidRender.js`, `browser/components/MarkdownPreview.js` mermaid integration
  - Clears **#136, #218, #219, #220, #221**
- `highlight.js@^10.4.1` → `^11.x` (some language exports renamed; `import` paths shift slightly — audit `browser/lib/markdown.js`)
- `markdownlint@^0.11.0` → `^0.34.0` (last callback-API version before pure-ESM at 0.34+; or jump to `^0.40.0` with dynamic import). Audit `browser/components/CodeEditor.js:31` call site.
- Smoke gate: full manual flow — create a mermaid + flowchart + plantuml diagram, save, reopen
- Drop CLAUDE.md sections that describe ceilings (uuid/mermaid/highlight/markdownlint)

### Phase 5: postcss 8 chain

- `css-loader@^0.19.0` → `^6.10.0` (CSS Modules config now under `modules: {localIdentName: '...'}`)
- `style-loader@^0.12.4` → `^3.3.0`
- `stylus-loader@^2.3.1` → `^8.1.0`
- `autoprefixer@^6.x` → `^10.4.0` (replace transitive via direct dep)
- Remove `postcss ^5.x` resolution (drop), let css-loader pull `postcss@^8.4.31` natively. Clears **#107, #217**.
- Verify CSS Modules class name pattern still emits `[name]__[local]___[path]` — config moves from loader URL params to options object
- Smoke gate: visual inspection of compiled CSS in DevTools — class names match prior format

### Phase 6: webpack-dev-server 1 → 5 + loader-utils removal

- `webpack-dev-server@^1.12.0` → `^5.0.0` (CLI rewrite: `webpack serve` not `webpack-dev-server`)
- Rewrite `dev-scripts/dev.js` — new flag set: `devServer.hot`, `devServer.client`, `devServer.static`, `devServer.allowedHosts`
- Add `react-refresh-webpack-plugin` to restore HMR component-state preservation (lost in Phase 2 when react-hmre was dropped)
- Drop `loader-utils ^1.4.1` resolution (no longer in tree — webpack 5 built-ins replace it). Clears **#92**.
- Clears **#3, #118, #143, #144, #222**
- Smoke gate: `npm run dev` launches HMR server, edit a component, see hot reload without losing state

### Phase 7: cleanup + version bump

- Verify all 15 alerts cleared: `gh api /repos/ebal/BoostNote-Legacy/dependabot/alerts?state=open`
- Update **CLAUDE.md**: drop "Skipped CVE bumps" entries for postcss/loader-utils/braces/babel-traverse; drop "Pinned direct deps with documented ceiling" for uuid/mermaid/highlight/markdownlint (no longer pinned); update "Toolchain quirks" section (webpack 5 + babel 7 syntax)
- Update **AGENTS.md**: drop uuid v11 cliff note; update dependency quirks section
- Update **README.md** "Tech stack" table: Webpack 1 → 5, Babel 6 → 7
- Update **CHANGELOG.md**: 0.20.0 entry summarizing the migration
- Bump `package.json` version 0.19.0 → 0.20.0
- Single PR-style commit: `feat(build): webpack 1 → 5 + babel 6 → 7 — clears 15 CVE alerts`

## Estimated total LOE

| Phase | Files touched | Complexity | Risk |
|-------|---------------|------------|------|
| 1 | 3 (webpack configs) | medium — loader syntax migration | low |
| 2 | 8 (.babelrc, package.json, jest config, 2 webpack configs, 2 babel preset deletes) | high — paired migration | medium |
| 3 | 3 (webpack-skeleton.js, 2 configs) | high — externals model change | medium |
| 4 | 4 (MermaidRender.js, CodeEditor.js, markdown.js, keygen.js) | medium — mermaid API break | medium |
| 5 | 3 (webpack configs + autoprefixer config) | medium — postcss plugin chain | low |
| 6 | 2 (dev-scripts/dev.js, webpack.config.js devServer) | high — wds rewrite | low (dev-only) |
| 7 | 4 (docs + version bump) | trivial | none |

Each phase is independently committable + smoke-testable. User should manual-launch between every commit.

## Rollback strategy

Every phase commits in isolation. If Phase 4 mermaid 10 rewrite breaks user diagrams that worked in 9.1.7, revert that commit and stay at 9.1.7 (alerts #218-#221 remain open). All other phases stand independently.

## Out of scope

- Migrating off `nodeIntegration: true` (Electron security hardening — separate effort)
- Migrating React Router 5 → 6 (not blocked by webpack 5)
- Replacing CodeMirror 5 → 6 (not blocked by webpack 5)
- Replacing Redux 4 → Redux Toolkit (orthogonal)
