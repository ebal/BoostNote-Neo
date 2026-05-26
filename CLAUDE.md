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
  - **Renderer / runtime-touching**: `lodash ^4.17.21`, `moment ^2.30.1`, `highlight.js ^10.4.1`, `set-getter ^0.1.1` (resolved at renderer runtime via `markdown-toc` → `lazy-cache`; the package is in `webpack-skeleton.js#externals` but Electron's `nodeIntegration: true` loads it through Node's `require`), `dot-prop ^4.2.1` (renderer runtime via `electron-config` → `conf` → `dot-prop`; used by `browser/main/lib/ConfigManager.js` to persist user preferences), `decode-uri-component ^0.2.1` (renderer runtime via `query-string@^6.13.8` → `decode-uri-component`; query-string is imported by `browser/lib/newNote.js`, `browser/main/Detail/*`, `browser/main/modals/NewNoteModal.js`, `browser/main/NoteList/index.js`). All loaded via `<script>` externals or bundled into `compiled/main.js`. For `dot-prop`, the CVE-2020-8116 sink is unreachable because every preference `path` argument is a hard-coded string (`'keyMap'`, `'theme'`, `'editor.fontSize'`, …) — the bump is defence-in-depth. For `decode-uri-component`, CVE-2022-38900 is a DoS via repeated malformed `%`-encoded sequences (pre-0.2.1 looped instead of throwing) — Boostnote's only inputs to `query-string` are note-creation URL parameters constructed by the app itself, but the upgrade also collapses the build-time consumer (`source-map-resolve@^0.5.x`) to the patched 0.2.2.
  - **Build-time only (loader / packager chain)**: `json5 ^1.0.2`, `word-wrap ^1.2.4`, `y18n ^3.2.2`, `minimist ^1.2.8`, `qs ^6.5.3`, `json-schema ^0.4.0`, `tmp ^0.2.4`, `brace-expansion ^1.1.13`, `node-fetch ^2.6.7`, `tough-cookie ^4.1.3`, `underscore ^1.12.1`, `async ^2.6.4`, `sha.js ^2.4.12`, `ua-parser-js ^0.7.22`, `ws ^8.17.1`, `got ^11.8.5`, `glob-parent ^5.1.2`. The `ws` resolution collapses `ws@^4.0.0` + `ws@^5.2.0` (both consumed by `jsdom@11.x`, which is a devDep used only by AVA/Jest browser-env helpers in `tests/helpers/setup-browser-env.js`) to a single `ws@8.17.1+` — patches CVE-2024-37890 (DoS via excessive request headers, <7.5.10 / <8.17.1) and CVE-2021-32640 (ReDoS in Sec-WebSocket-Protocol header, <5.2.4). jsdom's `WebSocket-impl.js` uses the stable `new WebSocket(url)` client API which is unchanged ws 4 → 8. The `got` resolution collapses `got@^6.7.1` (ava → update-notifier → package-json → got, an auto-update check that's a no-op under CI) and `got@^9.6.0` (`@electron/get` → got, used by `electron-packager` at build time to fetch the Electron binary) to a single `got@11.8.5+` — patches CVE-2022-33987 (UNIX-socket redirect bypass, <11.8.5 / <12.1.0). Verified end-to-end by running the full `docker build .`: `@electron/get` successfully downloaded Electron 11.5.0 binaries through the bumped `got`, and `electron-packager` produced both `Boostnote-darwin-x64` and `Boostnote-linux-x64` artifacts. The `glob-parent` resolution forces the legacy `glob-parent@^2.0.0` consumers (`chokidar@^1.x` via `ava@0.25` test runner and `watchpack@^0.2.x` webpack-1 file watcher; `glob-base@^0.3.0` via `parse-glob`) up to `5.1.2+`, patching CVE-2020-28469 (ReDoS in the `is-glob`-style regex). API is stable across glob-parent majors — single `globParent(pattern)` function with identical return surface, so the chokidar/watchpack call sites are unaffected. The `underscore` consumers in the tree (`nomnom` via `jsonlint-mod/lib/cli.js`, `argparse@0.1.16` via `remarkable`'s CLI binary, `underscore-plus` via `fs-plus`) all live behind CLI entries that Boostnote's renderer never loads — `jsonlint-mod` is used via `web/jsonlint.js`, `markdown-toc` consumes remarkable through its library entry, and `js-sequence-diagrams` inlines its own underscore copy inside the pre-built UMD bundle. Forcing the bump therefore clears the audit complaint without exercising any of the methods (`_.any`, `_.contains`) that were removed in underscore 1.9. The `async` resolution collapses 5 coexisting majors (0.2 / 0.9 / 1.5 / 2.6 / 3.2 in the lock) to a single 2.6.4 — the CVE-2021-43138 sink (`async.mapValues`) is not exercised by any consumer (the vulnerable copy was `istanbul-api@1.3.1`, which only calls `async.map` and `async.queue`); the cross-major coverage holds because every method the actual consumers call is API-stable from 0.9 → 3.x. The `sha.js` resolution covers the `crypto-browserify` polyfill graph, which webpack 1's `NodeTargetPlugin` externalizes at runtime — sha.js never actually loads in the shipped renderer. The `ua-parser-js` resolution covers `fbjs`, a React-16-era utility library that is never bundled into the renderer.
  - **Dev-server (HMR) only**: `cookie ^0.7.0`, `serve-static ^1.16.0`, `sockjs ^0.3.20`, `on-headers ^1.1.0`, `express ^4.20.0`, `url-parse ^1.5.8`, `min-document ^2.19.1`. The first six load through `webpack-dev-server@1.16.5` — `cookie` / `serve-static` / `on-headers` / `express` are middleware in the dev HTTP server, `sockjs` is the WebSocket HMR transport, and `url-parse` is consumed by `sockjs-client` for parsing the HMR socket URL. `min-document` reaches the renderer only via the `babel-preset-react-hmre` toolchain — `react-transform-hmr` → `global` → `min-document` — which is gated on `.babelrc#env.development.presets`. Webpack 1's `DefinePlugin` constant-folds the dev branch out of the production compile, so none of these touch the shipped Electron binary.
- **Pinned direct deps with a documented ceiling**:
  - **`uuid` is pinned to `^9.0.1`.** Bumping past 9.x is BLOCKED by webpack 1's acorn parser, not by the ESM cliff. uuid `10.x` and `11.x` still ship a CJS `main` (`./dist/cjs/index.js`), so they look bumpable, but the files under `dist/cjs/` use ES2020 nullish coalescing (`??`) and optional chaining (`?.`) — webpack 1's bundled acorn (v3.x) cannot tokenize either operator and the compile aborts with `Module parse failed … Unexpected token` at every `v1.js` / `v4.js` / `v6.js` / `v7.js` / `v35.js` entrypoint. Tried 9.0.1 → 11.1.1 empirically; rolled back. uuid `13.0.0+` adds the ESM-only cliff on top (no `main` field at all). Bumping requires either the webpack 1 → 5 migration (acorn 8 supports ES2020), or a babel-loader exception that transpiles `node_modules/uuid` through `@babel/plugin-proposal-nullish-coalescing-operator` + `@babel/plugin-proposal-optional-chaining` (babel 7-only — would mean dragging a parallel babel 7 install in for one dep). Both are out of scope for incremental work. Production consumer: `browser/lib/keygen.js` — `const { v4: uuidv4 } = require('uuid')`.
  - **`mermaid` is pinned to `~9.1.7`** (tier-A target chosen during the 8 → 9 investigation — last 9.x release before the v9.2 monorepo + lazy-load `import()` rewrite that Webpack 1 cannot resolve). Tiers B (`~9.3.0`) and C (`^9.4.3`) are still upgrade candidates if a tier-A → tier-B smoke pass is performed; v10 is blocked by the same ESM-only / pure-`exports` cliff that blocks `uuid 13+`.
  - **`highlight.js` is pinned to `^10.4.1`** (9.x is EOL). 11.x is ESM-only and blocked by the Webpack 1 cliff.
- **Skipped CVE bumps (documented "do nothing")**:
  - **`loader-utils`** — no patched 0.2.x release exists. Bumping to ^1.4.1 requires `babel-loader 7+`, `css-loader 1+`, `style-loader 1+`, `stylus-loader 3+`, i.e. the webpack 1 → 2 migration. CVE-2022-37601 / -37603 not exploitable on Boostnote's build path (no user-controlled query strings). Skipped.
  - **`electron 11.5.0 → 13.x`** — GHSA-3p22-ghq8-v749 (renderer accesses random Bluetooth device without permission) requires the renderer to call `navigator.bluetooth.requestDevice(...)`. Boostnote source has zero `navigator.bluetooth` references; the CVE is not exploitable. Upgrading to Electron 13 deletes the `remote` module entirely (replaced by the separate `@electron/remote` npm package) and flips `enableRemoteModule` to `false` by default — both require a multi-week code migration touching every `remote.*` call site (~20 files: `browser/components/MarkdownPreview.js`, `browser/lib/contextMenuBuilder.js`, `browser/lib/context.js`, `browser/main/Main.js`, `browser/main/SideNav/*`, `browser/main/Detail/*`, `browser/main/modals/*`, etc.) plus `lib/main-window.js` (drop `enableRemoteModule: true`, add `@electron/remote/main.enable(webContents)` instead). Skipped — defer until the upgrade is bundled with another renderer-touching workstream (React 17/18 or the webpack 1 → 5 migration). When that day comes, the right path is `Electron 11 → current LTS` in one coordinated commit, not a series of incremental Electron bumps.
  - **`minimatch ^3.0.2`** — `^3.x` consumers already resolve to 3.1.5 via hoist; the only sub-target version is `0.3.0` under `stylus@0.52.4 > glob@3.2.x`, which would break stylus's build if forced. ReDoS not exploitable on stylus's hard-coded internal patterns. Skipped.
  - **`braces ^3.0.3`** — lock has three coexisting majors: `braces@1.8.5` (consumed by `micromatch@^2` via `jest@22`, `ava@0.25` chokidar, `http-proxy-middleware@~0.17.1`, `anymatch@^1`), `braces@2.3.2` (consumed by `micromatch@^3` via newer jest, `sane@^2`, `test-exclude@^4`), and `braces@3.0.3` (consumed by `micromatch@^4`). CVE-2024-4068 (ReDoS via attacker-controlled brace-pattern string) affects 1.x and 2.x. A global `"braces": "^3.0.3"` resolution would break every `micromatch@^2`/`^3` consumer because braces 3 changed the public API (returns an array by default, different option keys). Bumping `micromatch` itself to `^4.x` would propagate through deeply-pinned dev tools (`jest@22`, `ava@0.25`, `http-proxy-middleware@~0.17.1`) which are not API-compatible with micromatch 4. The CVE sink is not reachable in this project: every micromatch consumer feeds developer-authored glob patterns (test paths, watch globs, webpack-dev-server proxy maps) — never user input. Skipped, same reasoning as `loader-utils` / `minimatch`.
- **Webpack 1 dep ceilings** (general rule): if a dep ships pure ESM (`"type": "module"` and no `main`), it will fail to resolve. Always check the candidate's `package.json` before accepting a major bump. Known blocked majors: `uuid 12+`, `mermaid 10+`, `json5 2+`, `sanitize-html 2.x` (renderer-bundled).
- **`optionalDependencies` is intentionally absent.** The previously-listed `grunt-electron-installer-debian` and `grunt-electron-installer-redhat` (plus their `electron-installer-*` task blocks in `gruntfile.js`) were removed once it was confirmed that the GH Actions release workflow only ships `.zip` / `.tar.gz` of the packaged app — no `.deb` or `.rpm` was ever built in CI. Restore the two devDeps, the task config blocks, and the entries in the `build:linux` task chain if you ever want to resume packaging Linux installers.
- **Removed dev-only deps (dead code):**
  - **`devtron`** — deprecated Electron DevTools extension (removed from official Electron docs in v10+; Boostnote ships on v11). No source file ever imported it; only references were a stale `'devtron'` entry in `webpack-skeleton.js#externals` and the devDep declaration. Removed; freed ~32 MB of dev `node_modules`.
  - **`redux-devtools`, `redux-devtools-dock-monitor`, `redux-devtools-log-monitor`** — powered an in-app Redux debug overlay loaded only when `NODE_ENV === 'development'`. CI always builds production, so the dev branch was dead code in every shipped binary. Removed alongside `browser/main/DevTools/index.dev.js` and `index.prod.js`; `browser/main/DevTools/index.js` is now the single no-op stub (`() => <div />` plus `instrument: () => {}`) — keeps `store.js` and `browser/main/index.js` call sites unchanged. To restore the overlay, recreate `index.dev.js` with `createDevTools(...)` and add the env-switch back to `index.js`.
  - **`standard`** — the standalone "StandardJS" CLI. Never invoked (no `npm run standard` script, no grunt task). `.eslintrc#extends: ["standard"]` resolves to `eslint-config-standard` (a separate devDep), not the `standard` package itself. Removed; freed ~33 MB of transitive closure (its own nested eslint, eslint-plugin-import, eslint-plugin-node, etc.). **Side effect**: `eslint-plugin-promise@^3.4.2` is now declared as a direct devDep — it was previously hoisted out of `standard`'s nested copy and is required as a peer of `eslint-config-standard@6.2.1`. Without that explicit pin, ESLint refuses to load the config.
  - **`concurrently`** — never invoked (no `npm` script, no grunt task, no source reference). The 100-ish transitive descendants (yargs 17, chalk 4, supports-color 8, modern lodash variants) were pure build-time bloat. Removed; freed ~13 MB and ~110 lockfile lines. To restore for a future parallel dev workflow, re-add `concurrently@^9.x` and wire it into a new `npm run dev` script.
  - **`react-input-autosize`** — never imported anywhere in `browser/` or `lib/`. Likely leftover from an early autosizing tag-input component that was replaced. Removed; freed a small (~25 KB) entry plus its `react-prop-types` transitive.
  - **`immutable`** (production dep, not dev) — never imported in source. `browser/lib/Mutable.js` is a thin wrapper around the native ES `Map`/`Set`, unrelated to immutable.js despite the name. The only other consumer is `connected-react-router@6.9.3`, which lists `immutable` as an **optional peer** — CRR keeps working without it for the standard `ConnectedRouter` / `connectRouter` / `routerMiddleware` / `push` API surface that Boostnote uses. Dropping the direct dep also resolved the CVE proto-pollution advisory: yarn now installs immutable@4.3.8 through CRR's optional-dep range (`^3.8.1 || ^4.0.0`), well past the patched 3.8.3. To restore for a future immutable-keyed router variant, re-add `immutable` as a direct dep at the version of choice.

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

1. **`markdown-it` 5.1.0 and 8.4.2** still pinned by transitive consumers (`@enyaxu/markdown-it-anchor@5`, etc.); resolve to the already-locked 12.3.2 via the `resolutions` block once the parser-plugin chain (footnote, kbd, anchor) is verified.
2. **Mermaid tier B / C** (`~9.3.0` then `^9.4.3`) — escalate only after manually rendering one of each diagram type from a packaged build and confirming no `ChunkLoadError` from the v9.2+ lazy-load chunks.
3. **Webpack 1 ceiling — deferred until webpack 1 → 5 migration**: `webpack-dev-server@1.16.5`, `loader-utils@0.2.17`, and `uuid >= 10` (see Pinned direct deps above for the acorn-cliff post-mortem). Both EOL and CVE-flagged, but no patched version exists within their pinned line. Bumping requires the full toolchain migration (webpack 1 → 2 → 5, babel 6 → 7, css-loader / style-loader / stylus-loader majors). Out of scope for incremental work — see the prior investigation summary in the git log around the `webpack-dev-server` / `loader-utils` "do nothing" decisions.
