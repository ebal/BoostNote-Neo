# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Docker-only policy

**NEVER run npm/yarn/electron/grunt/node on the host.** Local `node_modules/` is for the Linux Docker build only. Allowed host commands: `git`, `docker`, `codesign`.

## Commands

| Task | Command |
|---|---|
| Build (Intel/amd64) | `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .` |
| Build (Apple Silicon/arm64) | `docker build --platform linux/arm64 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) --build-arg BUILDARCH=arm64 -t boostnote-legacy-arm64 .` |
| Test all | `docker run --rm boostnote-legacy npm test` |
| AVA tests only | `docker run --rm boostnote-legacy npm run ava` |
| Jest tests only | `docker run --rm boostnote-legacy npm run jest` |
| Lint | `docker run --rm boostnote-legacy npm run lint` |
| Lint fix | `docker run --rm boostnote-legacy npm run fix` |
| Compile (webpack) | `docker run --rm boostnote-legacy npm run compile` |
| Dev (HMR) | `docker run --rm boostnote-legacy npm run dev` |
| Export .app (Intel) | `docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/` |
| Export .app (arm64) | `docker cp $(docker create --rm boostnote-legacy-arm64):/app/dist/Boostnote-darwin-arm64 ./dist/` |

Omitting `GIT_COMMIT` build-arg → About dialog shows "unknown".

### Running a single test

AVA picks `tests/**/*-test.js`; run one file:
```bash
docker run --rm boostnote-legacy npx ava tests/dataApi/createNote-test.js
```

Jest picks everything else under `tests/`:
```bash
docker run --rm boostnote-legacy npx jest tests/components/MyComponent.test.js
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

- **Webpack 1 + Babel 6** — loader chains use `!` syntax (e.g. `style!css?modules!stylus`), not the modern `use:[]` form.
- **Externals:** electron, react, redux, codemirror, lodash, moment, prettier are loaded via `<script>` tags in the HTML skeleton (`webpack-skeleton.js`), not bundled. Do not attempt to import them as if they were bundled.
- **`process` shim:** Webpack 1 injects `process.versions = {}`. Any dep reading `process.versions.node` at module load (e.g. `fs-extra@7+`) crashes. Pin such deps or external them.
- **CSS Modules** via `react-css-modules` + Stylus. Class name pattern: `[name]__[local]___[path]`.
- **HMR dev:** Manual refresh needed when editing constructors or adding new CSS classes (registered at construction time).

## Electron quirks

- **Dialog API:** Electron 9+ removed sync/callback forms. Use `showMessageBoxSync` and Promise-based `showOpenDialog`/`showSaveDialog`.
- **webPreferences:** `enableRemoteModule: true`, `nodeIntegration: true`, `contextIsolation: false` are required.
- Node 22 (Debian bookworm) inside Docker for the build toolchain; Electron 11.5.0 (Chrome 87, Node 12) at runtime. Anything that runs in the renderer must stay compatible with Node 12 / Chrome 87, even though Docker has a newer Node.

## Dependency policy

- **`resolutions` block in `package.json`** is the canonical place to force-upgrade vulnerable transitive deps. Adding a new entry there + running `yarn install` regenerates `yarn.lock` with a single hoisted version. Use it whenever the parent package cannot be bumped (most of the Webpack 1 / Babel 6 stack).
- Current entries (CVE-driven): `json5 ^1.0.2`, `word-wrap ^1.2.4`, `y18n ^3.2.2`, `minimist ^1.2.8`, `qs ^6.5.3`, `json-schema ^0.4.0`, `lodash ^4.17.21`.
- **`uuid` is pinned to `^9.0.1`.** Do NOT bump past `12.x`: uuid `13.0.0+` is pure ESM with no `main` field, and Webpack 1 cannot resolve it. The only production consumer is `browser/lib/keygen.js`, which uses `const { v4: uuidv4 } = require('uuid')`. Dependabot PRs that raise uuid to 13+ must be closed or downgraded.
- **Webpack 1 dep ceilings** (general rule): if a dep ships pure ESM (`"type": "module"` and no `main`), it will fail to resolve. Always check the candidate's `package.json` before accepting a major bump.

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

## Test quirks (pre-existing failures — do not fix)

- `npm test` = `npm run ava && npm run jest` (sequential).
- AVA runs serially (`--serial`).
- Jest picks up test files inside `dist/Boostnote-darwin-*/` → fail with environment mismatch. Ignore.
- `createNote`/`createNoteFromUrl` Jest tests fail with "Target folder doesn't exist" (test-data issue). Ignore.

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

Ordered by runtime impact (renderer-bundled first, build-only last):

1. **`sanitize-html` 1.27.5 → 2.x** — renderer-bundled, multiple CVEs in 1.x. Major API differences; needs a code-level audit of every `sanitize-html` call site before bumping.
2. **`markdown-it` 5.1.0 and 8.4.2** still pinned by transitive consumers (`@enyaxu/markdown-it-anchor@5`, etc.); resolve to the already-locked 12.3.2 via the `resolutions` block once the parser-plugin chain is verified.
3. **`moment` 2.22.2 → 2.30.1** — 2.30.1 is already in the lock from a different chain; collapse via `resolutions: { moment: "^2.30.1" }`.
4. **Build-only (dev-time risk only)**: `tough-cookie ^4.1.3`, `ws ^8.17.1`, `got ^11.8.5`, `node-fetch ^2.6.7`, `underscore ^1.12.1`. None ship in the production bundle, but they execute during `npm install` / build.
5. **`webpack-dev-server@1.16.5`** is EOL. Only used by `npm run watch`. Out of scope for incremental bumps — would require a webpack 1 → 5 migration.
