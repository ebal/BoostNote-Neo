Perfect! Now I have enough information to provide a comprehensive review. Let me compile all the findings:

---

# **COMPREHENSIVE BOOSTNOTE-LEGACY CODEBASE REVIEW**

## **1. PROJECT OVERVIEW**

### **Purpose & Goals**
BoostNote-Legacy is an **open-source, markdown-first note-taking application for developers** with the following design principles:
- **Developer-centric**: Markdown notes, code snippets, syntax highlighting, KaTeX math, diagramming (Mermaid, flowchart.js, PlantUML)
- **Privacy-first**: Notes stored as local `.cson` files (YAML-like CoffeeScript Object Notation) in user-defined directories, no cloud sync
- **Cross-platform**: macOS (Intel & Apple Silicon), Windows, Linux
- **Maintenance mode**: This is the legacy branch; a successor app exists at [BoostIO/BoostNote-App](https://github.com/BoostIO/BoostNote-App)

### **Current Version & Status**
- **Version**: 0.17.26 (released 2026-05-24)
- **Status**: **MAINTENANCE** (not active development)
- **Key milestones**:
  - v0.17.20–v0.17.26: Dependency-hardening sweep — 19 yarn `resolutions` covering CVE-driven runtime, build-only, and dev-server-only paths; mermaid 8.14 → ~9.1.7 (tier A pre-lazy-load); highlight.js 9.18 → ^10.4.1 (9.x EOL); set-getter / min-document / on-headers / express / brace-expansion / cookie / serve-static / sockjs / tmp / tough-cookie / node-fetch / moment / lodash / json5 / word-wrap / y18n / minimist / qs / json-schema all forced to patched versions. Dead dev tooling stripped (`devtron`, `redux-devtools-*`, `standard`, `concurrently`, `react-input-autosize`) + `.deb` / `.rpm` installer scaffolding dropped. ~70 MB freed from dev `node_modules`. See `UPGRADE.md` for the iteration log.
  - v0.17.18: Icon/logo update, mouse wheel fix
  - v0.17.x: Node 22 Docker upgrade, Linux ARM64 support, stripped dead code
  - v0.16.5: Removed all AWS telemetry/analytics
  - v0.16.7: **Major jump**: Electron 5.0.13 → 11.5.0, native Apple Silicon support

### **Key Statistics**
| Metric | Count |
|--------|-------|
| **Main directories** | ~12 (lib, browser, tests, resources, locales, dev-scripts, extra_scripts, __mocks__, gruntfile, webpack configs) |
| **Estimated LOC** | ~50,000+ (renderer: ~20K, components: ~10K, data API: ~10K, tests: ~5K) |
| **Browser components** | ~30+ (MarkdownEditor, MarkdownPreview, CodeEditor, ColorPicker, modals) |
| **Data API modules** | 35+ file operations (create/update/delete notes, storage management, export formats) |
| **Test files** | ~15 AVA + Jest test suites |
| **Markdown plugins** | 15+ (emoji, abbr, footnote, admonition, KaTeX, PlantUML, Mermaid, TOC, anchors, etc.) |

---

## **2. ARCHITECTURE & TECHNOLOGY STACK**

### **Frontend Layer (Browser Process)**
| Component | Technology | Notes |
|-----------|-----------|-------|
| **Framework** | React 16.14.0 | Legacy version; no Hooks |
| **State Management** | Redux 4.2.1 + Immutable.js 3.8.1 | Via custom `Mutable.js` wrapper (Map/Set) |
| **Router** | React Router DOM 5.3.4 | Hash-based routing (`history` library) |
| **Editor** | CodeMirror 5.65.0 | Supports Vim/Emacs/Sublime keymaps |
| **Markdown** | markdown-it 12.3.2 | 15+ plugin ecosystem |
| **Styling** | Stylus + CSS Modules | Pattern: `[name]__[local]___[path]` |
| **CSS-in-JS** | react-css-modules 4.7.9 | Legacy approach, not styled-components |

### **Main Process (Electron)**
| Component | Purpose | Implementation |
|-----------|---------|-----------------|
| **Window Management** | BrowserWindow creation | `lib/main-window.js` |
| **Menu System** | Native app menu + macOS TouchBar | `lib/main-menu.js`, `lib/touchbar-menu.js` |
| **IPC Server** | Main→Renderer communication | node-ipc 8.1.0 (`lib/ipcServer.js`) |
| **Config Management** | Preferences persistence | electron-config 1.0.0 |
| **Squirrel/Update** | Windows installer handling | `index.js` entry point (legacy) |

### **Data Persistence Layer**
| Layer | Technology | Implementation |
|-------|-----------|-----------------|
| **Storage** | Filesystem-based `.cson` files | `browser/main/lib/dataApi/` (35 modules) |
| **CSON Parser** | @rokt33r/season 5.3.0 | YAML variant with CoffeeScript syntax |
| **Folder Ops** | fs-extra 5.0.0, sander 0.5.1 | File utilities pinned to v5 (Webpack 1 compat) |
| **Search** | Full-text grep-like across notes | Custom search lib in `browser/lib/` |
| **Tags/Folders** | In-memory Redux state (persisted to disk) | Hierarchical note organization |

### **Build System**
| Tool | Version | Config | Notes |
|------|---------|--------|-------|
| **Bundler** | Webpack 1.12.2 | `webpack.config.js`, `webpack-production.config.js` | **VERY LEGACY** — loader chains use `!` syntax |
| **Transpiler** | Babel 6 + babel-register | `.babelrc` (2 presets: react, es2015) | Test env uses webpack-alias plugin |
| **Task Runner** | Grunt 1.6.1 | `gruntfile.js` — pack/compile tasks | Electron packager integration |
| **Dev Server** | webpack-dev-server 1.12.0 | :8080 with HMR | Manual refresh needed for constructor/CSS edits |
| **Package Manager** | Yarn | `yarn.lock` locked | `ignore-engines` flag for Node 22 compat |

### **Externals (Loaded via `<script>` tags, NOT bundled)**
Located in `webpack-skeleton.js`:
- `prettier`, `node-ipc`, `electron`
- `react`, `react-dom`, `react-redux`
- `redux`, `codemirror`, `lodash`, `moment`
- `raphael`, `flowchart`, `sequence-diagram`
- `markdown-it`, `markdown-it-emoji`, `markdown-it-kbd`, `markdown-it-plantuml`, `markdown-it-admonition`
- `@rokt33r/markdown-it-math`, `@rokt33r/season`
- `markdown-toc`, `fs-jetpack`

This reduces bundle size but requires manual HTML script injection (`lib/main.production.html`). Note: a previous `devtron` entry was removed in 0.17.26 — the package itself was never imported and was dropped from `devDependencies` along with its 32 MB transitive closure.

### **Electron Configuration**
| Setting | Value | Rationale |
|---------|-------|-----------|
| **Electron** | 11.5.0 | Chrome 87, Node 12.18.3 |
| **nodeIntegration** | true | Allows direct Node.js access from renderer |
| **contextIsolation** | false | Simplifies IPC, reduces security isolation |
| **enableRemoteModule** | true | Allows `remote.require()` in renderer |
| **Process shim** | Webpack injects `process.versions = {}` | Critical for fs-extra compat |

### **Testing Frameworks**
| Framework | Config | Usage |
|-----------|--------|-------|
| **AVA** | `tests/**/*-test.js` | Runs serially; Node.js unit tests |
| **Jest** | Everything else in `tests/` | Browser component + UI tests |
| **Mock setup** | `browser-env`, `jest-localstorage-mock` | DOM/localStorage simulation |
| **Run strategy** | `npm test` = `ava && jest` (sequential) | Pre-existing test failures (see issues below) |

---

## **3. DIRECTORY STRUCTURE & ORGANIZATION**

```
BoostNote-Legacy/
├── index.js                    # Electron entry point; Squirrel lifecycle handler
├── lib/                        # Main process (Node.js)
│   ├── main-app.js            # App lifecycle, menu, IPC server setup
│   ├── main-window.js         # BrowserWindow creation + dev tools
│   ├── main-menu.js           # Native menu template
│   ├── ipcServer.js           # node-ipc server (IPC communication)
│   ├── touchbar-menu.js       # macOS TouchBar menu
│   ├── main.development.html  # Dev window HTML
│   └── main.production.html   # Prod window HTML + externals <script> tags
├── browser/                    # Renderer process (React)
│   ├── main/
│   │   ├── index.js           # React root; Redux store setup
│   │   ├── Main.js            # Root React component
│   │   ├── store.js           # Redux store + reducers
│   │   ├── lib/
│   │   │   ├── dataApi/       # 35 CRUD modules for note file operations
│   │   │   ├── ConfigManager.js
│   │   │   ├── ShortcutManager.js
│   │   │   ├── ThemeManager.js
│   │   │   ├── ipcClient.js   # IPC renderer-side client
│   │   │   └── modal.js       # Modal control helpers
│   │   ├── components/        # Reusable UI components
│   │   ├── SideNav/           # Folder/tag navigation
│   │   ├── NoteList/          # Note list view
│   │   ├── Detail/            # Markdown/snippet note editors
│   │   ├── modals/            # Preferences, create, rename dialogs
│   │   └── DevTools.js        # Redux DevTools integration
│   ├── lib/
│   │   ├── markdown.js        # Markdown rendering pipeline
│   │   ├── Mutable.js         # Immutable.js Map/Set wrapper
│   │   ├── markdown-it plugins/
│   │   └── ...
│   └── styles/
├── compiled/                   # Webpack output (gitignored, generated)
│   └── main.js
├── dist/                       # Packaged Electron apps (gitignored)
│   ├── Boostnote-darwin-x64/
│   ├── Boostnote-darwin-arm64/
│   ├── Boostnote-linux-x64/
│   └── Boostnote-win32-x64/
├── tests/                      # Test suites
│   ├── **/*-test.js           # AVA tests (Node.js)
│   ├── **/*.test.js           # Jest tests (browser)
│   ├── helpers/
│   ├── fixtures/
│   └── jest.js
├── resources/                  # Icons, images
│   ├── app.png, app.ico, app.icns
│   └── fonts/
├── locales/                    # i18n (en_US only in v0.17+)
├── webpack.config.js          # Dev config
├── webpack-production.config.js
├── webpack-skeleton.js        # Shared config + externals
├── gruntfile.js              # Pack/compile tasks
├── Dockerfile                 # Multi-stage Docker build
├── package.json
├── yarn.lock
└── dev-scripts/
    └── dev.js                 # HMR dev server launcher

**Key file purposes:**
- `dataApi/`: ALL filesystem operations on .cson note files
- `components/`: Reusable UI (CodeEditor, MarkdownPreview, ColorPicker, etc.)
- `modals/`: Dialog overlays (Preferences, RenameTag, CreateFolder, etc.)
- `lib/Mutable.js`: Custom wrapper to make Immutable.js collections Redux-compatible
- `lib/markdown.js`: 600+ LOC markdown-it rendering + 15 plugins
```

### **Entry Points**
1. **Main Process**: `index.js` → Squirrel check → `lib/main-app.js`
2. **Renderer**: `browser/main/index.js` → webpack → `compiled/main.js` → rendered in BrowserWindow
3. **Dev Mode**: `dev-scripts/dev.js` spawns webpack-dev-server + Electron with HMR

---

## **4. DEPENDENCIES & PACKAGE MANAGEMENT**

### **Dependency Summary**
| Type | Count | Status |
|------|-------|--------|
| **Dependencies** | 50+ | Generally stable; no major updates possible without webpack 1 → 5 migration |
| **DevDependencies** | ~50 | Test, build, lint toolchain. Trimmed of ~5 unused entries in 0.17.26 (`devtron`, `redux-devtools-*`, `standard`, `concurrently`, `react-input-autosize`) |
| **`optionalDependencies`** | empty | Previously held `grunt-electron-installer-{debian,redhat}`; removed in 0.17.26 — release workflow only ships `.zip` / `.tar.gz` |
| **`resolutions`** | 19 | Each entry CVE-driven; see `CLAUDE.md#Dependency-policy` for the grouping by runtime impact |
| **node_modules (dev install)** | ~560 MB | Down from ~632 MB pre-sweep |
| **node_modules (production)** | ~200 MB | Unchanged by the sweep (devDeps don't ship) |

### **Critical Pinned Dependencies** (Do NOT upgrade)
```json
"fs-extra": "^5.0.0",              // Webpack 1 process.versions {} compat issue
"electron-packager": "^15.4.0",    // v15.2.0+ required for arm64 darwin
"webpack": "^1.12.2",              // Webpack 1 (NOT 2+) — see CLAUDE.md cliff list
"webpack-dev-server": "^1.12.0",   // Paired with Webpack 1
"babel": "6.*",                    // Babel 6 (NOT 7+) — paired with Webpack 1
"electron": "11.5.0",              // remote module deletion in 13+ blocks bump; migration plan in UpgradePlan_Electron11_to_Electron14.md (Electron 14.2.9 target)
"uuid": "^9.0.1",                  // 12+ pure-ESM = Webpack 1 hard fail
"mermaid": "~9.1.7",               // 9.2+ lazy-load import() chunks unresolvable
"highlight.js": "^10.4.1",         // 11.x ESM-only
```

Verified upgrade targets (compatible but not yet applied): `uuid ^11.1.1`. Documented ceilings in `CLAUDE.md#Dependency-policy`.

### **Outdated/At-Risk Dependencies**

| Package | Current | Issue | Impact |
|---------|---------|-------|--------|
| **React** | 16.14.0 | EOL; no Hooks support | No Suspense, Concurrent features |
| **Webpack** | 1.x | Ancient; no tree-shaking; pure-ESM deps unresolvable | Large bundles; HMR manual; pins uuid/mermaid/highlight.js/json5/sanitize-html ceilings |
| **Babel** | 6 | EOL; tied to Webpack 1 | Cannot adopt babel-loader 7+ without webpack 2+ |
| **CodeMirror** | 5.x | Legacy; v6 is modern | No native React integration |
| **ESLint** | 4.18.2 | Very old | Missing modern rules |
| **Electron** | 11.5.0 | many majors behind LTS | Bluetooth-CVE (GHSA-3p22-ghq8-v749) not exploitable here; 13+ deletes `remote` module → 24-file rewrite + 2 HTML edits + 1 shadow-import delete. **Migration plan tracked: `UpgradePlan_Electron11_to_Electron14.md`** (two-commit phased: `@electron/remote` swap on 11, then 11 → 14.2.9 bump). Phase 3 `contextIsolation` deferred. |
| **Immutable.js** | 3.8.1 | Legacy syntax | Map/List immutable structures only |
| **sanitize-html** | 1.27.5 | 1.x has multiple CVEs; renderer-bundled | 2.x is a major API change; needs call-site audit before bumping |
| **markdown-it (transitive)** | 5.1.0, 8.4.2 | Old XSS / ReDoS advisories | Already-locked 12.3.2 in one chain; collapse via resolutions once plugin chain verified |
| **loader-utils** | 0.2.17 | CVE-2022-37601 / -37603 proto pollution | No patched 0.2.x; bump requires webpack 1 → 2 migration. Not exploitable on Boostnote's hard-coded query strings — documented "deferred" |

### **Security Concerns**
- ✅ **Removed**: AWS SDK, analytics telemetry (v0.16.5+)
- ✅ **Removed**: Auto-update infrastructure (v0.16.4+)
- ✅ **Patched** (0.17.20–0.17.26): 19 transitive CVE bumps via `resolutions` — see `CLAUDE.md#Dependency-policy` for the grouped list with each CVE reference
- ⚠️ **nodeIntegration=true**: Renderer has direct Node.js access (security risk; required because Boostnote uses `require('electron').remote` and bundled Node APIs throughout the renderer)
- ⚠️ **contextIsolation=false**: No process boundary; preload scripts not used
- ⚠️ **enableRemoteModule=true**: `remote.require()` available (potential RCE) — flipping this default is **Phase 1 of `UpgradePlan_Electron11_to_Electron14.md`** (24-file `@electron/remote` swap, fully reversible, zero runtime change on Electron 11)
- ⚠️ **Deferred** (not exploitable in this codebase but tracked): Electron 11 Bluetooth-access CVE (no `navigator.bluetooth` in source), webpack-dev-server 1.x (dev-only), loader-utils 0.2.17 (no user input flows in). Full rationale in `CLAUDE.md#Skipped-CVE-bumps`.

These are **known trade-offs** for a local-first note-taking app, but reduce security isolation.

### **Lock File Strategy**
- **yarn.lock**: Committed; ensures reproducible builds
- **Docker-only npm install**: Prevents host node_modules pollution
- **Ignore-engines flag**: `yarn install --ignore-engines` allows Node 22 in Docker (v0.17.9+)
- **`resolutions` block in `package.json`**: 19 entries forcing transitive dep versions for CVE patches. Grouped by runtime impact (renderer-touching / build-only / dev-server-only) in `CLAUDE.md#Dependency-policy`. Adding an entry there + `yarn install --force` regenerates the lock with the single hoisted version.
- **Quick verify loop** for dep iteration: `docker build --target deps -t bn-deps .` then `docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps sh -c 'yarn install --ignore-engines --force && npm run compile'`. Full electron-packager build is only needed at the end of a sweep. See `CLAUDE.md#Quick-verify-loop-for-dependency-changes`.

---

## **5. CONFIGURATION FILES**

### **Build/Toolchain Configs**

| File | Purpose | Notable Settings |
|------|---------|------------------|
| **.eslintrc** | Lint rules | ESLint 4 + standard + prettier; warnings (not errors) for unused/undef |
| **.babelrc** | Transpiler | `react`, `es2015` presets; react-hmre in dev |
| **.prettierrc** | Code format | `singleQuote: true`, `semi: false`, `jsxSingleQuote: true` |
| **webpack.config.js** | Dev bundler | HMR on :8080; source maps; CSS Modules |
| **webpack-production.config.js** | Prod bundler | Inherits skeleton; uglified output |
| **webpack-skeleton.js** | Shared config | **Externals list** (react, redux, codemirror, etc.) |
| **gruntfile.js** | Pack tasks | electron-packager integration; platform-specific icons/metadata |
| **.editorconfig** | IDE settings | Indent, line endings consistency |

### **Runtime Configs**

| File | Purpose |
|------|---------|
| **Dockerfile** | Multi-stage Docker build; Node 22-bookworm base; unified amd64/arm64 |
| **Dockerfile.arm64** | (Legacy, superseded by unified Dockerfile) |
| **.dockerignore** | Docker context exclusions |
| **.boostnoterc.sample** | Example app config (CoffeeScript-like) |

### **Prettier & ESLint Pre-existing Issues**
- **6 lint errors** in Docker (prettier 1.19) vs host (prettier 1.18) in:
  - `MarkdownPreview.js` (1), `markdown.js` (4), `store.js` (1)
- **AGENTS.md note**: "Do NOT fix — versions keep reverting each other"

---

## **6. DEVELOPMENT WORKFLOW**

### **HMR / Development Mode**
```bash
docker run --rm boostnote-legacy npm run dev
```
1. Spawns webpack-dev-server on `:8080` with `--hot`
2. Electron dev process connects to HMR
3. **Manual refresh needed** when:
   - Editing component constructors (CSS class registration happens at construction)
   - Adding new CSS classes (not hot-swappable)
   - Modifying store reducers (state shape changes)

### **Testing Strategy**
```bash
# All tests (sequential)
docker run --rm boostnote-legacy npm test

# AVA only (Node.js unit tests)
docker run --rm boostnote-legacy npm run ava

# Jest only (component/integration tests)
docker run --rm boostnote-legacy npm run jest

# Single test file
docker run --rm boostnote-legacy npx ava tests/dataApi/createNote-test.js
```

### **Linting & Formatting**
```bash
docker run --rm boostnote-legacy npm run lint  # Check only
docker run --rm boostnote-legacy npm run fix   # Auto-fix
```

### **Building & Packaging**
```bash
# Compile webpack
docker run --rm boostnote-legacy npm run compile

# Build Intel app
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .

# Build Apple Silicon app
docker build --platform linux/arm64 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) --build-arg BUILDARCH=arm64 -t boostnote-legacy-arm64 .

# Export packaged app
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
```

### **Pre-commit Hooks**
- **Husky 4.3.8** configured
- Hook: `pre-commit` → `npm run lint`
- Prevents commits with lint errors

### **Docker-Only Policy**
**CRITICAL**: Never run npm/yarn/electron/grunt on the host:
```bash
❌ npm test                    # Don't do this
✅ docker run --rm boostnote-legacy npm test  # Do this
```
Host Node.js incompatibility issues (node_modules for Linux Docker only).

---

## **7. KNOWN ISSUES & OBSERVATIONS**

### **Pre-existing Test Failures** (Documented in AGENTS.md, CLAUDE.md)
1. **Jest picks up test files inside packaged `dist/Boostnote-darwin-*/`**
   - These fail with environment mismatch errors
   - Not related to code changes; ignore safely

2. **`createNote`/`createNoteFromUrl` Jest tests fail**
   - Error: "Target folder doesn't exist"
   - Root cause: test-data folder path issue; pre-existing

3. **`attachmentManagement` Jest test**
   - Incompatibility between `fs-extra@5` and `graceful-fs` mock
   - Pre-existing; not introduced by recent changes

4. **`normalizeEditorFontFamily` Jest test**
   - CSS class quoting mismatch (`font-display` property formatting)
   - Cosmetic; pre-existing

### **Node 22 Compatibility (v0.17.9+)**
- `global.navigator` became a read-only getter in Node 22 (WinterCG spec)
- **Fix**: Test files must use `Object.defineProperty(global, 'navigator', { get: () => window.navigator, configurable: true })` instead of assignment
- 18 test files patched in v0.17.9

### **Webpack 1 Process Shim Constraint**
- Webpack 1 injects `process.versions = {}`
- Dependencies that read `process.versions.node` at module load crash
- Examples: `fs-extra@7+` (pinned to v5)
- **Impact**: Can't upgrade fs-extra without breaking Webpack 1 bundling

### **Electron Security Trade-offs**
- `nodeIntegration: true` + `contextIsolation: false` → Renderer has full Node.js access
- `enableRemoteModule: true` → `remote.require()` available (potential RCE vector)
- **Rationale**: Local note-taking app, not internet-facing; security isolation less critical
- **Recommendation**: If exposing app over network, migrate to contextIsolation + preload scripts

### **Platform Support**
- ✅ **macOS**: Intel (x64) + Apple Silicon (arm64) via native builds (v0.16.7+)
- ✅ **Windows**: x64 (via electron-packager win32 target)
- ✅ **Linux**: x64 (experimental; added v0.17.12)
- ❌ **32-bit**: Not supported (x86 dropped)
- ❌ **Windows ARM**: Not built (only x64)

### **Technical Debt & Limitations**

| Issue | Impact | Severity |
|-------|--------|----------|
| **React 16 (no Hooks)** | Component state management verbose; no Suspense/Concurrent features | Medium |
| **Webpack 1** | No tree-shaking; HMR requires manual refresh; complex loader syntax | High |
| **Babel 6** | Limited transpilation options; separate presets needed | Low |
| **CodeMirror 5** | No modern editor features; v6 is React-unfriendly | Medium |
| **CSS Modules (stylus)** | Verbose class naming; no CSS-in-JS tooling | Low |
| **node-ipc for IPC** | Filesystem-based sockets; could use Electron's native ipcMain/ipcRenderer | Low |
| **Dead code remnants** | Stripe (v0.17.16: 23→18 MB git history cleanup) | Low |
| **No code splitting** | Entire app bundled as `main.js`; no lazy routes | Medium |

---

## **8. DOCUMENTATION QUALITY**

### **README Coverage**
✅ **Excellent**:
- Quick start (Docker build commands for both architectures)
- Feature list (markdown, snippets, search, multiple languages, keyboard nav)
- Tech stack table
- Build instructions (Intel/arm64)
- Development workflow

❌ **Missing**:
- Architecture diagram (ASCII art in AGENTS.md helps, but could be clearer)
- Component API documentation
- Data API module reference
- Keyboard shortcut list (mentioned but not enumerated)
- Theme/styling guide for contributors

### **Contributing Guidelines**
✅ **Strong**:
- Issue template (`ISSUE_TEMPLATE.md`)
- **Docker-only mandate** clearly stated in `contributing.md`
- Test/lint requirements before merge
- Copyright disclaimer

### **API Documentation**
❌ **Minimal**:
- No JSDoc comments in most modules
- Data API modules (`dataApi/*.js`) lack inline documentation
- Reducer action types not centralized (scattered across store.js)
- No Redux action creator documentation

### **Code Comments & TODOs**
- **Limited inline TODOs/FIXMEs** observed (codebase reasonably clean)
- **AGENTS.md** & **CLAUDE.md** provide excellent context for specific quirks (webpack process shim, global.navigator, etc.)
- **UPGRADE.md** is a detailed changelog of major version jumps (Electron 4→5→11, Node 8→14→22)

---

## **9. ARCHITECTURE PATTERNS & DESIGN DECISIONS**

### **Data Flow**
```
User Action (Click/Keydown)
    ↓
Redux Action → Reducer
    ↓
State Update (Immutable.js Map/Set)
    ↓
Component Re-render (React)
    ↓
ipcRenderer.send('action', data) [if needs main process]
    ↓
node-ipc (IPC server in main process)
    ↓
Filesystem operation (fs-extra on .cson files)
    ↓
Sync back via ipcMain.on() → dispatch Redux action
```

### **Storage Model**
- **Unit**: `.cson` text file per note
- **Hierarchy**: `storage/folder/note.cson`
- **Metadata**: Folder/tag info stored in Redux state + optional `.boostnoterc` config files
- **Search**: Full-text grep-like; no indexed database
- **Sync**: Local filesystem only; no cloud or real-time sync

### **Component Hierarchy**
```
App (Redux Provider)
├── Router (hash-based)
├── Main
│   ├── SideNav (Folders, Tags, Storages)
│   ├── NoteList (Filtered by selection)
│   ├── Detail (MarkdownNoteDetail | SnippetNoteDetail | CodeEditor)
│   ├── StatusBar (Mode, line count, zoom)
│   └── TopBar (Buttons, dropdowns)
├── Modals (PreferencesModal, RenameTagModal, CreateFolderModal, etc.)
└── DevTools (Redux DevTools dock in dev mode)
```

### **State Shape** (Redux)
```javascript
{
  data: {
    storageMap: Map<storageKey, storage>,
    noteMap: Map<noteKey, note>,
    starredSet: Set<noteKey>,
    trashedSet: Set<noteKey>,
    storageNoteMap: Map<storageKey, Set<noteKey>>,
    folderNoteMap: Map<folderKey, Set<noteKey>>,
    tagNoteMap: Map<tagKey, Set<noteKey>>
  },
  ui: {
    navFolded: boolean,
    sideNavFilter: string,
    currentNoteKey: string,
    currentStorageKey: string,
    ...
  },
  router: { location, action }  // connected-react-router
}
```

### **Markdown Rendering Pipeline**
1. **Raw CSON** → Parse to note object
2. **note.content** (markdown string)
3. **markdown-it** with 15 plugins:
   - GFM (tables, strikethrough)
   - KaTeX math
   - Emoji, footnotes, abbr, admonition
   - PlantUML, Mermaid, flowchart.js
   - Syntax highlighting via highlight.js
4. **HTML output** → React component (MarkdownPreview)
5. **DOMPurify** sanitization (via sanitize-html)

---

## **10. BUILD ARTIFACTS & OUTPUTS**

### **Compiled Artifacts**
| Path | Purpose | Size |
|------|---------|------|
| `compiled/main.js` | Webpack bundle (vendor + app code) | ~2-3 MB |
| `lib/main.production.html` | Electron window HTML + `<script>` tags for externals | ~1 KB |
| `dist/Boostnote-darwin-x64/` | Packaged macOS Intel app | ~300 MB |
| `dist/Boostnote-darwin-x64.zip` | Compressed Intel app | ~100 MB |
| `dist/Boostnote-darwin-arm64/` | Packaged macOS Apple Silicon app | ~300 MB |
| `dist/Boostnote-linux-x64.tar.gz` | Linux x64 tarball | ~150 MB |

### **Docker Build Output**
```
/app/dist/Boostnote-darwin-{x64,arm64}/Boostnote.app
/app/dist/Boostnote-darwin-{x64,arm64}.zip
/app/dist/Boostnote-linux-x64.tar.gz
```
Exported via `docker cp` to host `./dist/`

---

## **EXECUTIVE SUMMARY**

### **Strengths**
✅ **Well-organized** — Clear separation of main/renderer processes and data API  
✅ **Comprehensive markdown** — 15+ plugins for rich document support  
✅ **Privacy-first** — No analytics/telemetry (removed v0.16.5)  
✅ **Cross-platform** — Native builds for Intel/ARM macOS, Windows, Linux  
✅ **Reproducible builds** — Docker-only, locked yarn.lock, build args  
✅ **Good documentation** — AGENTS.md, CLAUDE.md, UPGRADE.md provide excellent context  
✅ **Test coverage** — AVA + Jest, though pre-existing failures exist  

### **Weaknesses**
⚠️ **Very outdated tech stack** — React 16, Webpack 1, Babel 6 (all end-of-life)  
⚠️ **Limited scalability** — No code splitting; 2-3 MB bundle; HMR requires manual refresh  
⚠️ **Security trade-offs** — nodeIntegration=true, contextIsolation=false (acceptable for local app)  
⚠️ **Maintenance burden** — Webpack 1 constrains dependency upgrades; process.versions {} shim  
⚠️ **Pre-existing test failures** — Jest picks up dist-packaged tests; some data-related failures  
⚠️ **No modern DX** — No TypeScript, no CSS-in-JS, no modern tooling (Next.js, Vite)  

### **Maintenance Posture**
- **Actively maintained** for bug fixes and critical updates
- **Not for new feature development** (legacy branch; successor app exists)
- **Docker-only policy** enforces reproducibility and compatibility
- **Stable for production use** (v0.16.7+ with Electron 11, v0.17.x with Node 22)

### **Key Takeaways for Contributors**
1. **Always use Docker** — host Node.js is incompatible
2. **Webpack 1 constraints** — can't easily upgrade dependencies
3. **HMR quirks** — manual refresh needed for some changes
4. **Test failures are pre-existing** — don't attempt to fix without understanding root causes
5. **Prettier/ESLint version mismatch** — don't "fix" the 6 lint errors
6. **Global.navigator in Node 22** — use Object.defineProperty instead of assignment
7. **Externals must be in HTML** — react, redux, codemirror, etc. are NOT bundled

---

This is a **well-structured, privacy-first developer tool with solid local-file storage architecture**, but one that reflects its age in tooling choices. It's maintained at a stable baseline rather than actively developed.___BEGIN___COMMAND_DONE_MARKER___0
