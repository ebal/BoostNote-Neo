# AGENTS.md — BoostNote-Neo

## Docker-only policy

**NEVER run npm/yarn/electron/grunt/node on the host.** Local `node_modules/` is for the Linux Docker build only. Allowed host commands: `git`, `docker`, `codesign`.

| Task | Command |
|---|---|
| Build (Intel) | `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-neo .` |
| Build (arm64) | `docker build --platform linux/arm64 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) --build-arg BUILDARCH=arm64 -t boostnote-neo-arm64 .` |
| Test all | `docker run --rm boostnote-neo npm test` |
| Lint | `docker run --rm boostnote-neo npm run lint` |
| Fix | `docker run --rm boostnote-neo npm run fix` |
| AVA only | `docker run --rm boostnote-neo npm run ava` |
| Jest only | `docker run --rm boostnote-neo npm run jest` |
| Compile (webpack) | `docker run --rm boostnote-neo npm run compile` |
| Export all (Intel) | `docker cp $(docker create --rm boostnote-neo):/app/dist/Boostnote-darwin-x64 ./dist/ && docker cp $(docker create --rm boostnote-neo):/app/dist/Boostnote-darwin-x64.zip ./dist/ && docker cp $(docker create --rm boostnote-neo):/app/dist/Boostnote-linux-x64.tar.gz ./dist/` |
| Export all (arm64) | `docker cp $(docker create --rm boostnote-neo-arm64):/app/dist/Boostnote-darwin-arm64 ./dist/ && docker cp $(docker create --rm boostnote-neo-arm64):/app/dist/Boostnote-darwin-arm64.zip ./dist/` |
| Dev | `docker run --rm boostnote-neo npm run dev` (WDS :8080 + Electron HMR) |

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

- Webpack 5 + Babel 7 (migrated from webpack 1 + babel 6 in v0.20.0) — `module.rules` array, loader `use:` config
- Many deps externaled (electron, react, redux, codemirror, lodash, moment, prettier) — loaded via `<script>` tags, not bundled (see `webpack-skeleton.js`)
- CSS Modules via `react-css-modules` + Stylus; class pattern `[name]__[local]___[path]`
- `.babelrc` target `ie: 11` — full ES5 transpile, required to match ES5 HOC pattern in `react-css-modules` and friends. See CLAUDE.md "Babel target quirk" before changing.
- Terser `keep_classnames`, `keep_fnames`, `ecma: 5` in webpack-production.config.js — preserves ES5 output and readable names.

## Dependency quirks

- **uuid v11 now supported (v0.20.0):** acorn 8 in webpack 5 parses ES2020 syntax. uuid pinned to `^11.1.1`. Code uses `v4()` only.
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
