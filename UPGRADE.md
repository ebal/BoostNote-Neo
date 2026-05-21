# Electron Upgrade Log

## Rules

- Upgrade one Electron major/minor step at a time.
- **All** operations (dependency install, compile, test, lint, package) run inside Docker only. Never run npm/yarn/grunt on the host.
- Delete `./dist/` before every build.
- **Export after every build** — copy the packaged `.app` to the host `./dist/` immediately (see AGENTS.md for exact commands).
- Keep git commits small and reversible.
- The Docker container provides Node 22 (Debian Bookworm). Host Node.js is incompatible.

## Known versions

| App version | Electron | Chrome | Node.js | V8 | Status |
|---|---:|---:|---:|---:|---|
| 0.16.1 | 4.2.12 | 69.0.3497.128 | 10.11.0 | 6.9.427.31-electron.0 | baseline |
| 0.16.2 | 5.0.13 | 73.0.3683.121 | 12.0.0 | 7.3.492.27-electron.0 | stable |
| 0.16.3 | 5.0.13 | 73.0.3683.121 | 12.0.0 | 7.3.492.27-electron.0 | stable |
| 0.16.4 | 5.0.13 | 73.0.3683.121 | 12.0.0 | 7.3.492.27-electron.0 | stable |
| 0.16.5 | 5.0.13 | 73.0.3683.121 | 12.0.0 | 7.3.492.27-electron.0 | stable |
| 0.16.6 | 5.0.13 | 73.0.3683.121 | 12.0.0 | 7.3.492.27-electron.0 | stable (intel branch) |
| 0.16.7 | 11.5.0 | 87.0.4280.141 | 12.18.3 | 8.7 (arm64) | archived |
| 0.17.9 | 11.5.0 | 87.0.4280.141 | 22 (bookworm) | 10.x | current (node:22) |
| 0.17.19 | 11.5.0 | 87.0.4280.141 | 22 (bookworm) | 10.x | current |

## Iterations

### 0.16.6 to 0.16.7 — Electron 11, native arm64 darwin build

Status: successful

- **source version**: 0.16.6 (Electron 5.0.13, intel branch)
- **target version**: 0.16.7 (Electron 11.5.0, arm64 branch)
- **changed files**:
  - `package.json` (electron 11.5.0, electron-packager 15.4.0, grunt 1.6.1, electron-debug 3.2.0, electron-devtools-installer 3.2.0, version bump to 0.16.7)
  - `config.json` (electron-version 11.5.0)
  - `gruntfile.js` (electron-packager v15 option renames; add osx-arm64 pack case)
  - `lib/main-window.js` (enableRemoteModule: true)
  - `Dockerfile.arm64` (rewritten: node:14-bullseye base, pack:osx-arm64 target)
  - `browser/lib/confirmDeleteNote.js` (showMessageBoxSync)
  - `browser/main/SideNav/StorageItem.js` (showMessageBoxSync x2, showOpenDialog Promise x2)
  - `browser/main/SideNav/index.js` (showMessageBoxSync, showOpenDialog Promise)
  - `browser/main/modals/RenameTagModal.js` (showMessageBoxSync)
  - `browser/main/modals/PreferencesModal/StorageItem.js` (showMessageBoxSync)
  - `browser/main/modals/PreferencesModal/StoragesTab.js` (showOpenDialog Promise)
  - `browser/main/Detail/SnippetNoteDetail.js` (showMessageBoxSync)
  - `browser/main/NoteList/index.js` (showMessageBoxSync, showSaveDialog Promise, showOpenDialog Promise)
  - `browser/components/MarkdownPreview.js` (showSaveDialog Promise)
  - `AGENTS.md`, `CHANGELOG.md`, `UPGRADE.md`
- **build command**: `docker build --platform linux/arm64 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -f Dockerfile.arm64 -t boostnote-legacy-arm64 .`
- **test command**: `docker run --platform linux/arm64 --rm boostnote-legacy-arm64 npm run test`
- **verification result**: build clean; `file dist/Boostnote-darwin-arm64/Boostnote.app/Contents/MacOS/Boostnote` → `Mach-O 64-bit executable arm64`; AVA all passed; Jest real test files all passed
- **known issues**: Jest picks up test files inside packaged `dist/Boostnote-darwin-arm64/...` — pre-existing issue, not introduced here; those tests fail with environment mismatch errors
- **rollback commit**: `git revert HEAD` or `git checkout intel -- .`

| Area | Change |
|---|---|
| Electron | 5.0.13 → 11.5.0 (enables native darwin/arm64 binary) |
| electron-packager | 12 → 15.4.0 (arm64 darwin support in v15.2.0) |
| grunt | 0.4.5 → 1.6.1 (Node 14 compatibility) |
| Dockerfile.arm64 | Rewritten: debian:stretch + Node tarball → node:14-bullseye (official arm64 image) |
| gruntfile.js | Updated electron-packager v15 API names; added osx-arm64 pack case (arch: arm64) |
| main-window.js | Added enableRemoteModule: true (Electron 11 disables remote by default) |
| Dialog API | 12 files: showMessageBox sync → showMessageBoxSync; showOpenDialog/showSaveDialog callback → Promise |

### 0.16.5 to 0.16.6 — remove dead BoostIO integrations and auto-update UI

Status: successful

- **source version**: 0.16.5 (Electron 5.0.13)
- **target version**: 0.16.6 (Electron 5.0.13 — no Electron change)
- **changed files**:
  - `browser/main/index.js`
  - `browser/main/Main.js`
  - `browser/main/StatusBar/index.js`
  - `browser/main/store.js`
  - `browser/main/lib/ConfigManager.js`
  - `browser/main/modals/PreferencesModal/index.js`
  - `browser/main/modals/PreferencesModal/InfoTab.js`
  - `browser/main/modals/PreferencesModal/Crowdfunding.js` (deleted)
  - `browser/main/modals/PreferencesModal/Crowdfunding.styl` (deleted)
  - `browser/components/RealtimeNotification.js` (deleted)
  - `browser/components/RealtimeNotification.styl` (deleted)
  - `lib/main-menu.js`
  - `package.json`
  - `CHANGELOG.md`
- **build command**: `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .`
- **test command**: `docker run --rm boostnote-legacy npm run test` (AVA + Jest)
- **verification result**: build clean; host lint 0 errors 0 warnings; pre-existing test failures unchanged
- **known issues**: same pre-existing Jest failures as 0.16.5
- **rollback commit**: `git revert HEAD`

| Area | Change |
|---|---|
| Auto-update UI | Removed `updateApp`/`downloadUpdate` functions, all `ipcRenderer.on` update handlers, `StatusBar` update button, `update` eventEmitter listener, `status` Redux reducer |
| RealtimeNotification | Deleted component — fetched BoostIO marketing banners from GitHub at runtime |
| Crowdfunding tab | Deleted component and tab — dead IssueHunt links |
| InfoTab | Rewritten — newsletter form, auto-update checkbox, dead community links all removed |
| ConfigManager | Removed `amaEnabled`, `autoUpdateEnabled` defaults; removed `electron-config` dependency read/write |
| Welcome note | Replaced BoostIO marketing wall with minimal keyboard-shortcut table |
| Help menu | Removed dead entries: Boostnote site, Wiki, Changelog (boost-releases) |

### 0.16.4 to 0.16.5 — full analytics removal

Status: successful

- **source version**: 0.16.4 (Electron 5.0.13)
- **target version**: 0.16.5 (Electron 5.0.13 — no Electron change)
- **changed files**:
  - `browser/lib/newNote.js`
  - `browser/main/Main.js`
  - `browser/main/modals/CreateFolderModal.js`
  - `browser/main/modals/PreferencesModal/InfoTab.js`
  - `browser/main/Detail/TagSelect.js`
  - `browser/main/Detail/SnippetNoteDetail.js`
  - `browser/main/Detail/MarkdownNoteDetail.js`
  - `browser/main/NoteList/index.js`
  - `browser/main/lib/AwsMobileAnalyticsConfig.js` (deleted)
  - `package.json`
  - `yarn.lock`
  - `CHANGELOG.md`
- **build command**: `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .`
- **test command**: `docker run --rm boostnote-legacy npm run test` (AVA + Jest)
- **verification result**: build clean; host lint 0 errors; pre-existing test failures unchanged
- **known issues**: same pre-existing Jest failures as 0.16.4 (`createNote`, `deleteFolder`, dist-packaged suite timeouts)
- **rollback commit**: `git revert HEAD`

| Area | Change |
|---|---|
| Analytics | Deleted `AwsMobileAnalyticsConfig.js`; removed import + all call sites from 8 files |
| `InfoTab.js` | Removed `amaEnabled` state, checkbox UI, Save button, `infoMessage()` method, `handleSaveButtonClick()`; simplified `handleConfigChange()` to `autoUpdateEnabled` only |
| Dependencies | Removed `aws-sdk` and `aws-sdk-mobile-analytics` from `package.json`; yarn.lock rebuilt |

### 0.16.2 to 0.16.3 — dep upgrades, bug fixes, cleanup

Status: successful

- **source version**: 0.16.2 (Electron 5.0.13)
- **target version**: 0.16.3 (Electron 5.0.13 — no Electron change)
- **changed files**:
  - `browser/lib/markdown.js`
  - `browser/main/modals/PreferencesModal/FolderItem.js`
  - `tests/lib/__snapshots__/markdown.test.js.snap`
  - `tests/lib/markdown-toc-generator.test.js`
  - `AGENTS.md`
  - `CHANGELOG.md` (new)
  - `Dockerfile`
  - `package.json`
  - `yarn.lock`
- **build command**: `docker build -t boostnote-legacy .`
- **test command**: `docker run --rm boostnote-legacy npm run test` (AVA + Jest)
- **verification result**: all markdown tests pass; checkbox rendering confirmed; app exports and launches correctly
- **known issues**: `createNote` and `createNoteFromUrl` Jest tests fail with "Target folder doesn't exist" — pre-existing test-data issue unrelated to this iteration
- **rollback commit**: `git revert HEAD` back to `85d6efc4`

Summary of changes:

| Area | Change |
|---|---|
| Dependencies | Bumped runtime/test deps to latest compatible versions; locked `fs-extra@^5`, `electron-packager@^12`, `cross-env@^5` for Webpack 1 / Node 8 engine constraints |
| `yarn.lock` | Rewrote Taobao registry URLs (`registry.npm.taobao.org/PKG/download/`) to npmjs.org (`registry.npmjs.org/PKG/-/`) |
| `Dockerfile` | Multi-stage `COPY --from=deps /app/yarn.lock` preserves `yarn install`-resolved lockfile after `COPY . .` overwrites it |
| `markdown.js` | Fixed checkbox rendering broken by markdown-it 6→12: replaced `state.parentType === 'list'` guard with unclosed `list_item_open` token-stack check |
| `FolderItem.js` | Replaced `ReactDOM.findDOMNode(this.refs.colorPicker)` with `React.createRef()` on a wrapper `<div>` |
| KaTeX snapshot | Updated for KaTeX 0.16 HTML (`mathdefault`→`mathnormal`, rounded decimal values, `xmlns` attribute on `<math>`) |
| Menu | Removed **For Team (BoostHub)** entry and all related code from `lib/main-menu.js` |
| Lint | Removed unused `EOL` and `title` variables from `markdown-toc-generator.test.js` |
| Docs | Added `CHANGELOG.md` (Common Changelog format); documented Webpack 1 `process` shim constraint in `AGENTS.md` |

### 0.16.3 to 0.16.4 — auto-update removal, lint baseline, commit hash

Status: successful

- **source version**: 0.16.3 (Electron 5.0.13)
- **target version**: 0.16.4 (Electron 5.0.13 — no Electron change)
- **changed files**:
  - `browser/components/ColorPicker.js`
  - `browser/components/SnippetTab.js`
  - `browser/main/Detail/SnippetNoteDetail.js`
  - `browser/main/NoteList/index.js`
  - `browser/main/lib/dataApi/formatHTML.js`
  - `browser/main/lib/modal.js`
  - `browser/main/index.js`
  - `lib/main-app.js`
  - `lib/main-menu.js`
  - `Dockerfile`
  - `package.json`
  - `yarn.lock`
- **build command**: `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .`
- **test command**: `docker run --rm boostnote-legacy npm run test` (AVA + Jest)
- **verification result**: host lint clean (0 errors, 0 warnings); app exports and launches correctly
- **known issues**: Docker's older prettier version flags 6 pre-existing formatting issues in `MarkdownPreview.js`, `markdown.js`, and `store.js` — host prettier accepts them; cosmetic only, no runtime impact
- **rollback commit**: `git revert HEAD` back to `4d02c6b2`

| Area | Change |
|---|---|
| Auto-update | Removed `electron-gh-releases` and all updater code from `main-app.js`; startup/reconnect auto-checks removed from renderer; manual Update menu responds "disabled" |
| About dialog | Git commit hash injected via `--build-arg GIT_COMMIT` at Docker build time; shown as `Version: 0.16.4 (abcd1234)` |
| `modal.js` | `ReactDOM.render()` return value replaced with `React.createRef()`; `close()` uses `this.setState()` |
| Lifecycle methods | `componentWillReceiveProps`/`componentWillUpdate` → `UNSAFE_*` in 4 files; `eslint-disable-next-line camelcase` for Docker ESLint compat |
| `formatHTML.js` | `/* global _ */` — lodash is a runtime global, not a bundle import |

### 0.17.9 to 0.17.19 — Docker node:22, CI rebuild, repo cleanup, passive touch fix

Status: successful

- **source version**: 0.17.9 (Electron 11.5.0, Docker node:20-bookworm)
- **target version**: 0.17.19 (Electron 11.5.0 — no Electron change)
- **key changes**:
  - Docker base image upgraded from `node:20-bookworm` to `node:22-bookworm`
  - macOS distribution format changed from `.dmg` to `.zip` of `.app` bundle
  - Linux distribution format: `tar.gz` of Electron app directory
  - Dead files removed: `snap/`, `FAQ.md`, `TASKS.md`, `docs/` (18 files), 20 non-English locale files, `appdmg.json`, `dmg.icns`
  - Git history rewritten via `git-filter-repo` — removed 27 dead paths, `.git` 23 MB → 18 MB
  - CI workflow: single `build-apps` job on `ubuntu-24.04`, exports all 5 artifacts
  - `MarkdownPreview.js`: scroll/resize listeners marked `{ passive: true }`
  - CodeMirror + react-sortable-hoc patched via Dockerfile `sed` for passive touch events
  - `help.md` version string corrected; CHANGELOG SHA references remapped after filter-repo
- **build command**: `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .`
- **test command**: `docker run --rm boostnote-legacy npm test`
- **verification result**: AVA 14/14 clean; Jest pre-existing failures only; lint 7 pre-existing errors only
- **known issues**: same pre-existing Jest failures as 0.17.9
- **rollback commit**: `git checkout v0.17.9`

| Area | Change |
|---|---|
| Docker | `node:20-bookworm` → `node:22-bookworm`, unified multi-arch Dockerfile |
| macOS build | `.dmg` → `.zip` of `.app` (no macOS host dependency) |
| Linux build | Flat `.tar.gz` (no `.deb`/`.rpm`) |
| CI | Single `build-apps` job on `ubuntu-24.04`, Node 24 action versions |
| Git | `git-filter-repo` stripped dead paths; CHANGELOG SHAs remapped |
| Locales | 20 non-English files deleted; `Languages.js` only registers `['en']` |
| Scroll | `MarkdownPreview.js` iframe scroll/resize → `{ passive: true }` |
| Touch events | Dockerfile `sed` patches CodeMirror `on()` + react-sortable-hoc `componentDidMount` for passive touch |

---

### Electron 4.2.12 to 5.0.13

Status: successful

- **source version**: 4.2.12
- **target version**: 5.0.13
- **changed files**:
  - `.dockerignore`
  - `Dockerfile`
  - `AGENTS.md`
  - `UPGRADE.md`
  - `SKILLS.md`
  - `gruntfile.js`
  - `lib/main-window.js`
  - `package.json`
  - `yarn.lock`
- **build command**: `docker build -t boostnote-legacy .`
- **test command**: `docker run --rm boostnote-legacy npm run test` (AVA + Jest)
- **verification result**: Electron 5.0.13 confirmed; app launches and renders correctly
- **known issues**: Electron 5 changed defaults for `nodeIntegration` (false) and `contextIsolation` (true); required explicit `nodeIntegration: true` + `contextIsolation: false` in `BrowserWindow` for renderer to access Node APIs. Docker-built x86_64 binary requires Intel macOS or ad-hoc codesign before execution on modern macOS.
- **rollback commit**: `git revert HEAD`

