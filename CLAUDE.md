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
- Current entries (CVE-driven). Group by reason so the next maintainer doesn't have to rediscover the why:
  - **Renderer / runtime-touching**: `lodash ^4.17.21`, `moment ^2.30.1`, `highlight.js ^10.4.1`. All loaded via `<script>` externals or bundled into `compiled/main.js`.
  - **Build-time only (loader / packager chain)**: `json5 ^1.0.2`, `word-wrap ^1.2.4`, `y18n ^3.2.2`, `minimist ^1.2.8`, `qs ^6.5.3`, `json-schema ^0.4.0`, `tmp ^0.2.4`, `brace-expansion ^1.1.13`, `node-fetch ^2.6.7`, `tough-cookie ^4.1.3`.
  - **Dev-server (HMR) only**: `cookie ^0.7.0`, `serve-static ^1.16.0`, `sockjs ^0.3.20`. Loaded only by `npm run watch` / `dev-scripts/dev.js` through `webpack-dev-server@1.16.5`.
- **Pinned direct deps with a documented ceiling**:
  - **`uuid` is pinned to `^9.0.1`.** Do NOT bump past `12.x`: uuid `13.0.0+` is pure ESM with no `main` field, and Webpack 1 cannot resolve it. Verified upgrade target for the future is `^11.1.1` (still has CJS `main`); bumping past that needs the webpack 5 migration. Production consumer: `browser/lib/keygen.js` — `const { v4: uuidv4 } = require('uuid')`.
  - **`mermaid` is pinned to `~9.1.7`** (tier-A target chosen during the 8 → 9 investigation — last 9.x release before the v9.2 monorepo + lazy-load `import()` rewrite that Webpack 1 cannot resolve). Tiers B (`~9.3.0`) and C (`^9.4.3`) are still upgrade candidates if a tier-A → tier-B smoke pass is performed; v10 is blocked by the same ESM-only / pure-`exports` cliff that blocks `uuid 13+`.
  - **`highlight.js` is pinned to `^10.4.1`** (9.x is EOL). 11.x is ESM-only and blocked by the Webpack 1 cliff.
- **Skipped CVE bumps (documented "do nothing")**:
  - **`underscore`** — global `^1.12.1` resolution would force `nomnom` (runtime via `jsonlint-mod`) and old `argparse` (runtime via `markdown-toc` → `remarkable`) to underscore 1.10+, which removed `_.pluck` / `_.indexBy`. CVE-2021-23358 needs attacker-controlled `_.template` input; Boostnote never feeds user input into `_.template`. Skipped.
  - **`loader-utils`** — no patched 0.2.x release exists. Bumping to ^1.4.1 requires `babel-loader 7+`, `css-loader 1+`, `style-loader 1+`, `stylus-loader 3+`, i.e. the webpack 1 → 2 migration. CVE-2022-37601 / -37603 not exploitable on Boostnote's build path (no user-controlled query strings). Skipped.
  - **`minimatch ^3.0.2`** — `^3.x` consumers already resolve to 3.1.5 via hoist; the only sub-target version is `0.3.0` under `stylus@0.52.4 > glob@3.2.x`, which would break stylus's build if forced. ReDoS not exploitable on stylus's hard-coded internal patterns. Skipped.
- **Webpack 1 dep ceilings** (general rule): if a dep ships pure ESM (`"type": "module"` and no `main`), it will fail to resolve. Always check the candidate's `package.json` before accepting a major bump. Known blocked majors: `uuid 12+`, `mermaid 10+`, `json5 2+`, `sanitize-html 2.x` (renderer-bundled).
- **`optionalDependencies` is intentionally absent.** The previously-listed `grunt-electron-installer-debian` and `grunt-electron-installer-redhat` (plus their `electron-installer-*` task blocks in `gruntfile.js`) were removed once it was confirmed that the GH Actions release workflow only ships `.zip` / `.tar.gz` of the packaged app — no `.deb` or `.rpm` was ever built in CI. Restore the two devDeps, the task config blocks, and the entries in the `build:linux` task chain if you ever want to resume packaging Linux installers.

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

**Stale-deps trap**: the anonymous volume holds whatever `node_modules` was baked into the `bn-deps` image at *build time*. If you have edited `package.json` resolutions since then, plain `yarn install --ignore-engines` may decide the lockfile is satisfied and not actually rewrite `node_modules`. Use `yarn install --ignore-engines --force` to force a relink, or rebuild the image with `docker build --target deps -t bn-deps .` when the resolution churn is non-trivial.

**Pre-commit hook**: husky's `pre-commit` runs `npm run lint`. Because the docker-only policy keeps `npm` / `yarn` off the host, the hook prints `Can't find yarn in PATH` and reports `Skipping pre-commit hook`. The commit proceeds. This is expected — lint runs inside the image when you want it (`docker run --rm boostnote-legacy npm run lint`), not on the host.

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

Ordered by runtime impact (renderer-bundled first, build-only / blocked last). Items already applied or explicitly skipped live in the **Dependency policy** section above.

1. **`sanitize-html` 1.27.5 → 2.x** — renderer-bundled, multiple CVEs in 1.x. Major API differences; needs a code-level audit of every `sanitize-html` call site before bumping. Highest-impact remaining bump.
2. **`markdown-it` 5.1.0 and 8.4.2** still pinned by transitive consumers (`@enyaxu/markdown-it-anchor@5`, etc.); resolve to the already-locked 12.3.2 via the `resolutions` block once the parser-plugin chain (footnote, kbd, anchor) is verified.
3. **Build-only candidates that are still worth applying** (same `resolutions` recipe): `ws ^8.17.1`, `got ^11.8.5`. Dev/build only — not bundled into the renderer. Same recipe as `cookie` / `serve-static` / `sockjs`.
4. **Webpack 1 ceiling — deferred until webpack 1 → 5 migration**: `webpack-dev-server@1.16.5`, `loader-utils@0.2.17`. Both EOL and CVE-flagged, but no patched version exists within their pinned line. Bumping requires the full toolchain migration (webpack 1 → 2 → 5, babel 6 → 7, css-loader / style-loader / stylus-loader majors). Out of scope for incremental work — see the prior investigation summary in the git log around the `webpack-dev-server` / `loader-utils` "do nothing" decisions.
5. **Mermaid tier B / C** (`~9.3.0` then `^9.4.3`) — escalate only after manually rendering one of each diagram type from a packaged build and confirming no `ChunkLoadError` from the v9.2+ lazy-load chunks.
6. **`uuid` 9.0.1 → 11.1.1** — verified compatible (CJS `main: ./dist/cjs/index.js`, `??` and `?.` syntax supported by Electron 11 Chrome 87, no babel transpile of node_modules needed because webpack-production doesn't minify). Pending — apply when convenient. Do NOT bump past 12.x.
