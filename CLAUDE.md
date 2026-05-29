# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docker-only policy

**NEVER run npm/yarn/electron/grunt/node on the host.** Local `node_modules/` is for the Linux Docker build only. Allowed host commands: `git`, `docker`, `codesign`.

## Commands

| Task | Command |
|---|---|
| Build (Intel/amd64) | `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-neo .` |
| Build (Apple Silicon/arm64) | `docker build --platform linux/arm64 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) --build-arg BUILDARCH=arm64 -t boostnote-neo-arm64 .` |
| Test all | `docker run --rm boostnote-neo npm test` |
| Jest tests only | `docker run --rm boostnote-neo npm run jest` |
| Lint | `docker run --rm boostnote-neo npm run lint` |
| Lint fix | `docker run --rm boostnote-neo npm run fix` |
| Compile (webpack) | `docker run --rm boostnote-neo npm run compile` |
| Dev (HMR) | `docker run --rm boostnote-neo npm run dev` |
| Export .app (Intel) | `docker cp $(docker create --rm boostnote-neo):/app/dist/Boostnote-darwin-x64 ./dist/` |
| Export .app (arm64) | `docker cp $(docker create --rm boostnote-neo-arm64):/app/dist/Boostnote-darwin-arm64 ./dist/` |

Omitting `GIT_COMMIT` build-arg → About dialog shows "unknown".

### Running a single test

Jest picks `tests/**/*.test.js`:
```bash
docker run --rm boostnote-neo npx jest tests/dataApi/createNote.test.js
```

## Architecture

```
index.js → Squirrel lifecycle → lib/main-app.js
    ├── lib/main-window.js     BrowserWindow creation
    ├── lib/main-menu.js       native app menu
    ├── lib/ipcServer.js       node-ipc server (main process)
    └── lib/touchbar-menu.js

browser/main/index.js  (webpack entry → compiled/main.js)
    ├── store.js               Redux store + Immutable.js via Mutable.js wrappers
    ├── Main.js                root component → SideNav | NoteList | Detail
    ├── lib/dataApi/           CRUD operations on .cson note files
    ├── lib/ConfigManager.js   electron-config wrapper
    ├── lib/shortcutManager.js keyboard shortcut registry
    └── lib/ThemeManager.js
```

Notes are stored as `.cson` files in user-defined storage directories on disk. `browser/main/lib/dataApi/` contains all read/write operations against those files.

Webpack aliases: `lib` → `./lib`, `browser` → `./browser`. These are used throughout import paths.

## Toolchain quirks

- **Webpack 5 + Babel 7** (migrated in v0.20.0 from webpack 1 + babel 6). `module.rules` array form; loader options under `options:` object. `targets: { ie: 11 }` in `.babelrc` forces full ES5 transpile — required to keep ES5 HOCs (`react-css-modules`) compatible with user code (see "Babel target quirk" below). Terser `keep_classnames + keep_fnames + ecma:5` in webpack-production.config.js preserves the ES5 output through minify.
- **Externals:** electron, react, redux, codemirror, lodash, moment, prettier are loaded via `<script>` tags in the HTML skeleton (`webpack-skeleton.js`), not bundled. Do not attempt to import them as if they were bundled.
- **`process` shim (legacy webpack 1 quirk, mostly resolved in webpack 5):** Webpack 5 with `target: 'electron-renderer'` uses real Node's `process` — no shim. `resolve.fallback: false` for all node built-ins in `webpack-skeleton.js` because `nodeIntegration: true` loads modules through real Node, not webpack polyfills.
- **CSS Modules** via `react-css-modules` + Stylus. Class name pattern: `[name]__[local]___[path]`.
- **HMR dev:** Manual refresh needed when editing constructors or adding new CSS classes (registered at construction time).

## Electron quirks

- **Dialog API:** Electron 9+ removed sync/callback forms. Use `showMessageBoxSync` and Promise-based `showOpenDialog`/`showSaveDialog`.
- **webPreferences:** `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false` are required.
- Electron 42.3.0 (Chromium 138, Node 22.x) at runtime, built with Node 22 (Debian bookworm) inside Docker.

## Dependency policy

- **`resolutions` block in `package.json`** is canonical for force-upgrading vulnerable transitives. Add entry → `yarn install` rewrites `yarn.lock` with single hoisted version. `yarn.lock` is source of truth for what is actually installed — read it directly rather than re-deriving from CLAUDE.md.
- **Post-v0.20.0 state (2026-05-29):** webpack 5 + babel 7 + acorn 8 active. Zero open Dependabot alerts. Most pre-v0.20 resolutions exist to collapse webpack-1-era duplicate ranges and may now be removable (already trimmed once in v0.20.1, see commit `39b52195`). Audit before adding; many transitive CVE chains no longer reach the tree.
- **Active exact-pin invariants** (caret forbidden — re-adding `^` breaks the build at next `yarn install --force`):
  - **`raphael` = `2.2.7`** (no caret). 2.3.0 produces NaN SVG dimensions where 2.2.7 silently coerced undefined width/height to 0. Triggered by every flowchart / sequence-diagram code block: `rewriteIframe` → `diagram.drawSVG(el, opts)` → Raphael geometry math → `<svg>` attributes come out as `"NaN"` → React throws `<svg> attribute height: Expected length, "NaN"`. Loaded as external (`webpack-skeleton.js` maps `raphael: 'var Raphael'`; `lib/main.production.html` `<script src=".../raphael/raphael.min.js">`). `flowchart.js@1.12.0` itself declares `raphael: "2.2.7"` exact upstream.
  - **`flowchart.js` = `1.12.0`** (no caret). Last release shipping the pre-built UMD at `release/flowchart.min.js`; 1.12.1+ deleted `release/` and publishes only `src/`. `lib/main.{production,development}.html` and `webpack-skeleton.js` expect the UMD global at runtime. Bump = 404 → `ReferenceError: flowchart is not defined`. Moving forward requires bundling flowchart.js as a normal `import` instead of an external — out of scope for incremental work, and no CVE driving it.
  - **`codemirror-mode-elixir` = `1.1.1`** (no caret). 1.1.2 renamed `dist/elixir.js` → `dist/codemirror-mode-elixir.{js,m.js,umd.js}`. `lib/main.{production,development}.html` load the old path via `<script>` and 404 on 1.1.2 → Elixir syntax highlighting silently fails. Moving forward needs an HTML edit pointing at `dist/codemirror-mode-elixir.umd.js`; no CVE urgency.
- **`optionalDependencies` is intentionally absent.** `grunt-electron-installer-debian` / `-redhat` and their `electron-installer-*` gruntfile blocks were removed — CI workflow only ships `.zip` / `.tar.gz`, never `.deb` / `.rpm`. Restore the two devDeps + task configs + `build:linux` chain entries to resume Linux installer packaging.
- **Upgrade backlog.** See [`.claude/plans/UpgradePlan_Post_v0.20.md`](.claude/plans/UpgradePlan_Post_v0.20.md) for tier A/B/C/D survey of in-major bump candidates (mermaid 11, react-redux 9, redux 5, react 19, eslint 9, prettier 3, etc.).

## Quick verify loop for dependency changes

Full `docker build .` takes ~5 min (compile + electron-packager + grunt pack). For iterative dependency work, build the deps stage once and reuse it:

```bash
# One-time: build deps-only image
docker build --target deps -t bn-deps .

# Per iteration: edit package.json resolutions, then:
docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps \
  sh -c 'yarn install --ignore-engines && npm run compile'
```

The `-v /app/node_modules` anonymous volume preserves the container's `node_modules` while bind-mounting the host source over `/app`. `npm run compile` reuses the cached deps and finishes in ~5s; it is the fastest reliable signal that a dep change has not broken the webpack bundle. Run the full `docker build .` once at the end to validate electron-packager.

**Stale-deps trap**: the anonymous volume holds whatever `node_modules` was baked into the `bn-deps` image at *build time*. If you have edited `package.json` resolutions since then, plain `yarn install --ignore-engines` may decide the lockfile is satisfied and not actually rewrite `node_modules`. `yarn install --ignore-engines --force` is *insufficient* on its own — empirically observed to leave webpack@1.15.0 in `node_modules/webpack` even after `webpack@^5.90.0` was already in `yarn.lock`. The reliable sequence is `rm -rf node_modules/* node_modules/.[^.]* && yarn install --ignore-engines --check-files`, which forces yarn to re-extract every tarball against the lock. Alternatively rebuild the image with `docker build --target deps -t bn-deps .` when the resolution churn is non-trivial.

**Pre-commit hook**: husky's `pre-commit` runs `npm run lint`. Because the docker-only policy keeps `npm` / `yarn` off the host, the hook prints `Can't find yarn in PATH` and reports `Skipping pre-commit hook`. The commit proceeds. This is expected — lint runs inside the image when you want it (`docker run --rm boostnote-neo npm run lint`), not on the host.

## Test quirks

- `npm test` = `cross-env NODE_ENV=test jest` (jest@27 since the Jest 22→27 migration in v0.19.0).
- Jest picks up test files inside `dist/Boostnote-darwin-*/` → fail with environment mismatch. Ignore.
- `createNote` / `createNoteFromUrl` tests fail with "Target folder doesn't exist" (fixture issue). Ignore.
- `attachmentManagement` test fails (`fs-extra` vs `graceful-fs` environment mismatch). Ignore.
- `normalize-editor-font-family` test fails (CSS quoting diff between Docker/host prettier). Ignore.
- ~6 tests use `done` callback + Promise return (jest 27 forbids dual pattern) — pre-existing, not regressions.

## Lint / Prettier

- ESLint: `standard` + `standard-jsx` + `plugin:react/recommended` + `prettier`.
- Prettier config: `singleQuote: true`, `semi: false`, `jsxSingleQuote: true`.
- Unused vars/undef are warnings, not errors.
- **Do NOT fix** the 6 pre-existing `prettier/prettier` errors in `MarkdownPreview.js`, `markdown.js`, `store.js` — host prettier (1.18) and Docker prettier (1.19) disagree; fixing one breaks the other.
- Pre-commit hook runs `npm run lint` (husky).

## CodeQL / security history

- GitHub Advanced Security CodeQL scans land on `main` as commits titled `Potential fix for code scanning alert no. N` (Copilot Autofix). These are usually safe ReDoS / regex tightenings, but each one mutates a parser/sanitizer regex — review before assuming the diff is harmless, and run the full docker build afterwards. Recent sweep: alerts 14, 15, 16, 20, 24 (May 2026).
- `js/incomplete-sanitization` was hit in `browser/components/CodeEditor.js` (`escapePipe`). The fix lives in `browser/lib/utils.js` as `escapeMarkdownPipe(str)` — it escapes backslashes before pipes so the encoding is reversible. Unit-tested in `tests/lib/escapeMarkdownPipe.test.js`. Reuse that helper rather than inlining new escape logic.

## Outstanding security work (next priorities)

All previously blocked items cleared by v0.20.0 webpack 1→5 + babel 6→7 migration (see commits 3649d68a..da841c2f for the 7-phase migration log). Two follow-up alerts (semver ReDoS GHSA #165, markdown-it ReDoS GHSA #226) cleared 2026-05-29 by the resolutions + extensions edits below. Open Dependabot alerts: **0**.

1. ~~`markdown-it` 5.1.0 and 8.4.2 transitive pins.~~ — Cleared 2026-05-29 as a side-effect of the webpack 5 migration. Lock now carries only 14.1.x / 14.2.x entries. The direct dep was bumped from `^13.0.2` to `^14.1.1` in the same change to patch GHSA #226 (markdown-it ReDoS, vulnerable range `>= 13.0.0, < 14.1.1`). markdown-it 14 ships only `lib/token.mjs` (no `lib/token.js`) and `@hikerpig/markdown-it-toc-and-anchor@4.5.0`'s transpiled `dist/index.js` does `require("markdown-it/lib/token")` — webpack 5 resolves this through the `.mjs` extension once it is added to `resolve.extensions` in `webpack-skeleton.js` (`['.js', '.mjs', '.jsx', '.styl']`). The `_interopRequireDefault(require(...))` interop pattern handles the ESM `export default Token` correctly under webpack's ESM-to-CJS wrapping. The `markdownlint@^0.37.4` exact pin `markdown-it "14.1.0"` is force-overridden to `14.1.1` via the selective resolution `"markdownlint/markdown-it": "14.1.1"` to clear the same advisory on the dev-tool path. Verified: `compiled/main.js` contains `span_open` / `link_open` token construction (toc-and-anchor's `new _token.default("span_open", ...)` call sites) — Token class loaded successfully through the .mjs resolution. Full `docker build .` produced both `Boostnote-darwin-x64` and `Boostnote-linux-x64` artifacts.
2. **markdownlint 0.11 → 0.34+** — done in v0.20.0 (pinned at `^0.37.4` since the migration). markdownlint 0.34+ is ESM-only; `browser/components/CodeEditor.js` uses dynamic `import('markdownlint/promise')`. Webpack 5 emits a `Critical dependency: require function is used in a way in which dependencies cannot be statically extracted` warning from `markdownlint/lib/resolve-module.cjs:7` — benign, the dynamic require resolves at runtime and the linter still functions in the rendered editor.
3. ~~**Webpack 1 ceiling**~~ — **done 2026-05-29** in 7 phases (v0.20.0). Webpack 5.107.2 + babel 7 + acorn 8. Cleared 15 open Dependabot alerts.
4. ~~**Electron renderer `vm` deprecation warning** — **Suppressed 2026-05-28** via `app.commandLine.appendSwitch('disable-features', 'V8VmDeprecation')` in `lib/main-app.js`. vm is still functional through Electron 42.~~
5. ~~**Electron 14→42** — **Completed 2026-05-28** in 4 phases (v0.19.0).~~

## Babel target quirk (v0.20.0)

`.babelrc` uses `targets: { ie: 11 }` — full ES5 transpile of user code. This is deliberate, not legacy. **Do not change to a modern target** (electron, chrome, defaults) without reading this section.

Reason: several node_modules deps ship pre-transpiled ES5 with `_inherits` HOC pattern that wraps user components via `class WrappedComponent extends UserComponent` → at runtime `_Component.apply(this, arguments)`. When user code is ES6 class, calling it via `.apply(this, ...)` (no `new`) triggers V8's "Class constructor X cannot be invoked without 'new'" error. Specifically affects:

- `react-css-modules@4.7.11` (`dist/extendReactClass.js`) — wraps Main + every CSS-Modules-styled component
- Other suspects with ES5 HOC pattern: `react-debounce-render`, `react-autosuggest@10`, `react-image-carousel`, `react-composition-input`, `react-sortable-hoc`, `react-color`, `connected-react-router`

Forcing user code to ES5 (matching the deps' transpile level) avoids the cross-class boundary. Verified by inspecting `compiled/main.js`: contains `function Main(a)` (not `class Main`), 87 `_inherits` helpers — all ES5.

Webpack-production.config.js terser also pinned to `ecma: 5` for the same reason — `keep_classnames: true, keep_fnames: true` keep names readable in stack traces for debugging without restoring ES6 syntax.
