# AGENTS.md — BoostNote-Legacy

## Docker-only policy

**NEVER run npm/yarn/electron/grunt/node on the host.** Local `node_modules/` is for the Linux Docker build only. Allowed host commands: `git`, `docker`, `codesign`.

| Task | Command |
|---|---|
| Build (Intel) | `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .` |
| Build (arm64) | `docker build --platform linux/arm64 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) --build-arg BUILDARCH=arm64 -t boostnote-legacy-arm64 .` |
| Test all | `docker run --rm boostnote-legacy npm test` |
| Lint | `docker run --rm boostnote-legacy npm run lint` |
| Fix | `docker run --rm boostnote-legacy npm run fix` |
| AVA only | `docker run --rm boostnote-legacy npm run ava` |
| Jest only | `docker run --rm boostnote-legacy npm run jest` |
| Compile (webpack) | `docker run --rm boostnote-legacy npm run compile` |
| Export all (Intel) | `docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/ && docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64.zip ./dist/ && docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-linux-x64.tar.gz ./dist/` |
| Export all (arm64) | `docker cp $(docker create --rm boostnote-legacy-arm64):/app/dist/Boostnote-darwin-arm64 ./dist/ && docker cp $(docker create --rm boostnote-legacy-arm64):/app/dist/Boostnote-darwin-arm64.zip ./dist/` |
| Dev | `docker run --rm boostnote-legacy npm run dev` (WDS :8080 + Electron HMR) |

Without `GIT_COMMIT` build-arg → About dialog shows "unknown".

Node 22 (bookworm) inside Docker. Unified Dockerfile supports both amd64 and arm64 builds.

## Architecture

- `index.js` → Squirrel lifecycle → `lib/main-app.js` (app ready, menu, IPC server)
- `lib/` — main process: `main-window.js` (BrowserWindow), `main-menu.js`, `ipcServer.js`, `touchbar-menu.js`
- `browser/` — renderer process, webpack entry `browser/main/index.js`
- Redux store at `browser/main/store.js` — uses `browser/lib/Mutable.js` (wraps Immutable.js Map/Set)
- Webpack aliases: `lib` → `./lib`, `browser` → `./browser`
- `compiled/` — webpack output; `dist/` — packaged Electron app

- **`global.navigator` on Node 22+:** `global.navigator` is now a read-only getter (WinterCG). Test files that do `global.navigator = window.navigator` crash. Use `Object.defineProperty(global, 'navigator', { get: () => window.navigator, configurable: true })` instead.

## Test quirks

- `npm test` = `npm run ava && npm run jest` (sequential)
- AVA picks `tests/**/*-test.js`; Jest picks everything else
- AVA runs serially (`--serial`)
- **Pre-existing failures (ignore):** Jest picks up test files inside `dist/Boostnote-darwin-*/` → fail with environment mismatch. `attachmentManagement` Jest test fails with `fs-extra`/`graceful-fs` incompatibility. `normalizeEditorFontFamily` test fails with CSS quoting mismatch.

## Toolchain

- Webpack 1 + Babel 6 — loader chains use `!` syntax (`style!css?modules!stylus`)
- Many deps externaled (electron, react, redux, codemirror, lodash, moment, prettier) — loaded via `<script>` tags, not bundled (see `webpack-skeleton.js`)
- CSS Modules via `react-css-modules` + Stylus; class pattern `[name]__[local]___[path]`
- **Webpack `process` shim:** Webpack 1 injects `process.versions = {}`. Any dep reading `process.versions.node` at module load (e.g. `fs-extra@7+`) crashes. Pin such deps or external them.

## Dependency quirks

- **uuid v11 broken with Webpack 1:** uuid v11 CJS dist uses ES2020+ syntax (optional chaining, nullish coalescing). Webpack 1's bundled acorn parser cannot handle it. Keep uuid pinned to `^9.0.1`.
- **uuid CVE (GHSA-j3pc-g49g-gw9v):** Only affects `v3()/v5()/v6()` with external output buffers. Our usage is `v4()` only — not affected.
- **`request` removal:** Removed from tree by deleting unused `jsdom@^9.4.2` and `grunt-electron-installer` devDeps. The `grunt-electron-installer` also pulled in `uuid@3.x` (function-call API), which conflicted with modern uuid resolution.
- **Windows installer removed:** `grunt-electron-installer` + `create-windows-installer` grunt task removed. Re-add when Windows builds are needed.
- **Yarn resolutions preferred:** Use `"resolutions"` in package.json to pin transitive deps rather than bumping dep ranges directly — minimizes lockfile churn.

## Electron quirks

- **Dialog API:** Electron 9+ removed sync/callback forms. Use `showMessageBoxSync` and Promise-based `showOpenDialog`/`showSaveDialog`
- **`webPreferences`:** `enableRemoteModule: true`, `nodeIntegration: true`, `contextIsolation: false` required
- `secret/auth_code.json` needed for codesigning; absent → skips silently

## Prettier / lint

- ESLint: `standard` + `standard-jsx` + `plugin:react/recommended` + `prettier`
- Prettier: `singleQuote: true`, `semi: false`, `jsxSingleQuote: true`
- Unused vars/undef are warnings, not errors
- **Pre-existing:** 7 `prettier/prettier` errors inside Docker (prettier 1.19) in `MarkdownPreview.js` (1), `contextMenuBuilder.js` (1), `markdown.js` (4), `store.js` (1). Host prettier (1.18) accepts them. Do NOT fix — versions keep reverting each other.

## HMR dev notes

Manual refresh needed when editing constructors or adding CSS classes (registered at construction time).
