# Upgrade Plan: Electron 11 → 14

## Execution Plan (safest, no-breaking-change, test-gated)

Strategy: ~~split into **two independent commits** with a manual smoke gate between~~. **Re-investigated 2026-05-27: Phase 1 cannot run in isolation on Electron 11.** `@electron/remote@1.x` claims peer `electron: ">= 10.0.0-beta.1"` but the renderer code calls `getElectronBinding('v8_util')` which resolves to `process._linkedBinding('electron_common_v8_util')` — that binding name was introduced in Electron 12 (Electron 11 still used the legacy `atom_common_*` prefix). On Electron 11 the binding lookup returns null and `getContextId()` throws `Error: Electron >=v13.0.0-beta.6 required to support sandboxed renderers` at every renderer entry. Phases 1 and 2 must therefore land in **one combined commit**: install `@electron/remote@^1.2.2`, swap all renderer imports, *and* bump Electron 11.5.0 → 14.2.9 together. The original manual-smoke-gate-between-phases idea is not viable.

Phase 3 (`contextIsolation`) remains deferred — separate work.

Each phase ends at a commit checkpoint. If the smoke checklist passes, commit; if anything regresses, `git revert` and re-investigate.

### Phase 1 — `@electron/remote` swap, still on Electron 11 (Commit A)

Reversible. Same APIs, same behavior — only the source of the `remote` import changes.

| # | Action | File(s) | Verify |
|---|---|---|---|
| 1.1 | Add `"@electron/remote": "^1.2.2"` to `package.json#dependencies` | `package.json` | — |
| 1.2 | Regen lock: `docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps sh -c 'yarn install --ignore-engines --force'` | `yarn.lock` | install clean, no peer warning |
| 1.3 | Add `require('@electron/remote/main').initialize()` after existing requires at top of `lib/main-window.js` | `lib/main-window.js` | — |
| 1.4 | ~~Add `require('@electron/remote/main').enable(mainWindow.webContents)`~~ — **DO NOT DO ON 1.x.** `@electron/remote@1.2.2` does not export `.enable()` (verified via `node_modules/@electron/remote/main/index.d.ts`: only `{ initialize }` is exported). On 1.x, `.initialize()` alone is the full main-side setup — all windows are auto-enabled. Calling `.enable()` throws `TypeError: require(...).enable is not a function` at module load and prevents app launch. Re-add this line **only after** Phase D lifts the dep to `^2.1.3` (Step 2.7), where `.enable(webContents)` is mandatory per-window. | `lib/main-window.js` | — |
| 1.5 | ~~Delete `enableRemoteModule: true,` from `webPreferences` (line 54)~~ — **DO NOT DO ON 1.x.** `@electron/remote@1.x` uses `webPreferences.enableRemoteModule` as its own enable gate (verified in `node_modules/@electron/remote/dist/src/main/server.js:290-292`: `return webPreferences.enableRemoteModule != null ? !!webPreferences.enableRemoteModule : false;`). Removing the option makes every renderer-side `remote.*` call throw `Error: @electron/remote is disabled for this WebContents. Set {enableRemoteModule: true} in WebPreferences to enable it.` Keep `enableRemoteModule: true` until Phase D lifts the dep to 2.x (Step 2.7), which removes the webPreferences gate in favor of per-window `.enable(webContents)`. Electron 12+ ignores unknown / removed webPreferences keys, so leaving `enableRemoteModule` set is harmless after the Phase B Electron 14 bump. | `lib/main-window.js` | — |
| 1.6 | Swap 24 renderer imports per Step 1.3 table | 24 source files | — |
| 1.7 | Delete shadow re-import at `browser/main/NoteList/index.js:1029` | `NoteList/index.js` | — |
| 1.8 | Swap 2 HTML inline scripts: `electron.remote.process.argv` → `require('@electron/remote').process.argv` | `lib/main.production.html:175`, `lib/main.development.html:179` | — |
| 1.9 | `docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps sh -c 'npm run compile'` | — | bundle compiles, ~9.21 MB |
| 1.10 | `docker run --rm boostnote-legacy npm run lint` | — | only 7 pre-existing prettier baseline errors |
| 1.11 | `docker run --rm boostnote-legacy npm test` | — | only pre-existing AVA/Jest failures (CLAUDE.md "Test quirks") |
| 1.12 | Full build: `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .` | — | full pipeline green |
| 1.13 | Export & launch: `docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/ && open ./dist/Boostnote-darwin-x64/Boostnote.app` | — | smoke checklist below |
| 1.14 | **Commit A** if smoke passes | git | — |

**Phase 1 smoke checklist** (each exercises a `remote.*` path):
- Right-click in editor — context menu appears
- Right-click sidebar storage folder — menu appears
- Preferences → Storages → "Add Storage" — dialog opens
- File → Export → HTML, then PDF — files written
- Cmd+/Cmd-/Cmd-0 — zoom changes
- Snippet edit dialog opens/saves
- Delete-note confirmation appears
- Spell-check underline appears on misspelled word

If any path silently no-ops, the `.enable(webContents)` call in step 1.4 is wired wrong (most likely target).

### Phase 2 — Electron 11.5.0 → 14.2.9 (Commit B)

Runtime change. Apply only after Phase 1 has been used for 1-2 days without regression.

| # | Action | File(s) | Verify |
|---|---|---|---|
| 2.1 | Bump `"electron": "14.2.9"` in devDeps and `"electron-version": "14.2.9"` in `config` | `package.json` | — |
| 2.2 | Regen lock: `yarn install --ignore-engines --force` in `bn-deps` | `yarn.lock` | resolves Electron 14.2.9 |
| 2.3 | `menu.popup(remote.getCurrentWindow())` → `menu.popup({ window: remote.getCurrentWindow() })` × 3 | `browser/lib/context.js:9`, `browser/components/CodeEditor.js:110`, `browser/components/MarkdownPreview.js:136` | — |
| 2.4 | `printToPDF({}, cb)` → Promise form with `.finally(() => printout.destroy())` | `browser/main/lib/dataApi/formatPDF.js:18` | — |
| 2.5 | (Optional) Lift `"@electron/remote": "^1.2.2"` → `"^2.1.3"` | `package.json` | — |
| 2.6 | Full build: `docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .` | — | `@electron/get` fetches `electron-v14.2.9-darwin-{x64,arm64}.zip` + linux-x64 |
| 2.7 | `npm run compile` + `npm run lint` + `npm test` in container | — | green / pre-existing only |
| 2.8 | Export & launch packaged `.app`; run full smoke (priority list below) | — | — |
| 2.9 | **Commit B** if smoke passes | git | — |

**Phase 2 smoke priority** (regression-risk order on a major Electron bump):
1. Window opens & renderer loads (DevTools: no `enableRemoteModule` errors)
2. All dialogs (File→Open, Export HTML+PDF, Add Storage, delete-confirm)
3. All context menus (editor, preview, sidebar, notelist)
4. Zoom Cmd+ / Cmd- / Cmd-0
5. PDF export (exercises migrated Promise form)
6. Snippet editor in Preferences
7. Mermaid + flowchart + KaTeX rendering (codemirror 5.65.21 / mermaid 9.1.7 / flowchart.js 1.12.0 / katex 0.16.47 must survive Chrome 93 / V8 9.3)
8. Spell check (typo-js 1.3.2) + emoji picker (react-emoji-render 1.2.4)
9. All keyboard shortcuts
10. Preferences modal opens + edits persist (electron-config + dot-prop chain)

**Skipped sub-steps per re-investigation**: original Step 2.5 (main-menu.js callback fix) and Step 2.6 (Dockerfile X11 libs) are no-ops in this repo — see existing "Investigation notes" at bottom of this document.

### Phase 3 — `contextIsolation: true` — DEFERRED

Out of scope for this upgrade. Major refactor (~1-2 days, 24 files × 50+ call sites, new preload + IPC handlers). Track as a separate workstream after Phase 2 has shipped.

### Reversibility

| To undo | Action |
|---|---|
| Phase 1 | `git revert <commit-A>`. `@electron/remote` is additive — Electron 11's built-in `remote` still works once `enableRemoteModule: true` is restored. |
| Phase 2 | `git revert <commit-B>`. Pin `electron: 11.5.0` back. Phase 1 changes remain valid on Electron 11. |

### Local-test loop before any commit

Per CLAUDE.md Docker-only policy — never run `npm`/`yarn` on host. Iterate inside `bn-deps`:

```bash
# One-time
docker build --target deps -t bn-deps .

# Per edit cycle (~5s feedback)
docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps \
  sh -c 'yarn install --ignore-engines --force && npm run compile'

# Pre-commit gate (~5 min)
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
```

---

## Current State (Electron 11.5.0)

| Setting | Current | Target |
|---|---|---|
| `nodeIntegration` | `true` | `true` (unchanged) |
| `contextIsolation` | `false` | `false` (see Phase 3) |
| `enableRemoteModule` | `true` | removed (replaced by `@electron/remote`) |
| `remote` module | built-in (`require('electron').remote`) | `require('@electron/remote')` |
| Preload script | none | none (see Phase 3) |
| `@electron/remote` | not installed | installed as dependency |

## Overview

Three phases, ordered by risk:

- **Phase 1** (zero risk): Install `@electron/remote`, swap all imports
- **Phase 2** (low risk): Bump Electron to 14.2.9, fix deprecated syntax
- **Phase 3** (separate effort): Enable `contextIsolation: true` — major refactor

---

## Phase 1: Install `@electron/remote` (on Electron 11)

**Goal:** Replace built-in `remote` with `@electron/remote` npm package while still on Electron 11. Same API, same behavior — purely a mechanical import swap.

### Step 1.1 — Install package

**Critical:** pin to the 1.x line for the Electron 11 phase. `@electron/remote@2.x` declares a peer dependency on Electron `>=13.0.0` from 2.0.4 onwards — yarn will refuse to link or surface a peer-warning. Stay on 1.x while still on Electron 11, then optionally bump to 2.x as part of Phase 2.

```bash
# Docker-only policy (per CLAUDE.md): never run yarn/npm on the host.
# Edit package.json to add the direct dep, then regenerate the lock
# inside the bn-deps quick-verify image:

docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps \
  sh -c 'yarn install --ignore-engines --force && npm run compile'
```

Target version (pin in `package.json#dependencies`):

```diff
+ "@electron/remote": "^1.2.2",
```

`@electron/remote@1.2.2` ships CJS (`main: renderer/index.js`, no `type: module`) and is webpack-1 / acorn 5.7.4 compatible. Peer declared as `electron: ">= 10.0.0-beta.1"` — clears the Electron 11 install.

### Step 1.2 — Initialize in main process

Edit `lib/main-window.js`. Current state (verified at re-investigation):

- `lib/main-window.js:1-3` already has `const electron = require('electron'); const app = electron.app; const BrowserWindow = electron.BrowserWindow`.
- The `webPreferences` block lives at **lines 51-57** (not ~48), and `enableRemoteModule: true` sits at **line 54**.

Apply three edits:

```js
// 1. Add at top of file AFTER existing requires
require('@electron/remote/main').initialize()
```

```js
// 2. Add AFTER `mainWindow = new BrowserWindow({...})` creation
//    (before `mainWindow.loadURL(...)`)
require('@electron/remote/main').enable(mainWindow.webContents)
```

> Note: `@electron/remote/main.enable()` takes a `webContents`, not a `BrowserWindow`. The 1.x README example showed `enable(win)` but the function actually inspects `win.webContents`; the 2.x signature is explicit `(webContents)`. Passing `mainWindow.webContents` works on both lines.

```diff
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
-   enableRemoteModule: true,
    zoomFactor: 1.0,
    enableBlinkFeatures: 'OverlayScrollbars'
  },
```

`enableRemoteModule` was deprecated in Electron 10 and **removed entirely in Electron 14** — leaving it in webPreferences becomes a hard error (`TypeError: Invalid webPreferences option`) on the Phase 2 bump. Removing it here in Phase 1 is forward-compat without runtime side effects on Electron 11 (the option is ignored, and `@electron/remote/main.enable(...)` is what now grants remote access).

### Step 1.3 — Swap all renderer imports (24 source files + 2 HTML files + 1 second-import anti-pattern)

Every file that currently does `const { remote } = require('electron')`, `const { remote } = electron`, or `import { remote } from 'electron'` must change to `require('@electron/remote')` or `import ... from '@electron/remote'`.

**Full file list (line numbers re-verified against current HEAD):**

| # | File | Current import | Change to |
|---|---|---|---|
| 1 | `browser/main/lib/eventEmitter.js:2` | `const { ipcRenderer, remote } = electron` | Split: `const { ipcRenderer } = electron; const { remote } = require('@electron/remote')` |
| 2 | `browser/main/lib/ipcClient.js:4` | `const { remote, ipcRenderer } = require('electron')` | Split: `const { ipcRenderer } = require('electron'); const { remote } = require('@electron/remote')` |
| 3 | `browser/main/lib/ZoomManager.js:4` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 4 | `browser/main/lib/dataApi/formatPDF.js:2` | `import { remote } from 'electron'` | `import { remote } from '@electron/remote'` |
| 5 | `browser/main/lib/dataApi/formatHTML.js:5` | `import { remote } from 'electron'` | `import { remote } from '@electron/remote'` |
| 6 | `browser/main/Main.js:23` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 7 | `browser/main/NoteList/index.js:26` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 7b | `browser/main/NoteList/index.js:1029` | `const { remote } = electron` (re-import inside a function — anti-pattern, shadows the file-top import) | **Delete this line entirely**; the file-top import from step 7 already brings `remote` into scope |
| 8 | `browser/main/NewNoteButton/index.js:12` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 9 | `browser/main/SideNav/index.js:24` | `import { remote } from 'electron'` | `import { remote } from '@electron/remote'` |
| 10 | `browser/main/SideNav/StorageItem.js:16` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 11 | `browser/main/modals/RenameTagModal.js:13` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 12 | `browser/main/modals/PreferencesModal/StoragesTab.js:13` | `const { shell, remote } = electron` | Split: `const { shell } = electron; const { remote } = require('@electron/remote')` |
| 13 | `browser/main/modals/PreferencesModal/StorageItem.js:11` | `const { shell, remote } = require('electron')` | Split: `const { shell } = require('electron'); const { remote } = require('@electron/remote')` |
| 14 | `browser/main/modals/PreferencesModal/InfoTab.js:7` | `const { shell, remote } = electron` | Split as above |
| 15 | `browser/main/modals/PreferencesModal/PluginsTab.js:12` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 16 | `browser/main/Detail/SnippetNoteDetail.js:35` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 17 | `browser/components/CodeEditor.js:16` | `const { ipcRenderer, remote, clipboard } = require('electron')` | Split: `const { ipcRenderer, clipboard } = require('electron'); const { remote } = require('@electron/remote')` |
| 18 | `browser/components/MarkdownPreview.js:33` | `import { remote, shell } from 'electron'` | Split: `import { shell } from 'electron'; import remote from '@electron/remote'` (or named: `import { remote } from '@electron/remote'`) |
| 19 | `browser/lib/context.js:1` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 20 | `browser/lib/contextMenuBuilder.js:4-7` | `const { remote } = require('electron')` + `const { Menu, clipboard, shell } = remote.require('electron')` | Top-level: `const { remote } = require('@electron/remote'); const { Menu, clipboard, shell } = require('electron')` (drop the `remote.require('electron')` round-trip — those modules are directly importable in the renderer with `nodeIntegration: true`) |
| 21 | `browser/lib/consts.js:3` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 22 | `browser/lib/i18n.js:2` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 23 | `browser/lib/confirmDeleteNote.js:3` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 24 | `extra_scripts/codemirror/addon/hyperlink/hyperlink.js:16` | `const remote = require('electron').remote` | `const remote = require('@electron/remote')` |
| **HTML 1** | `lib/main.production.html:175` | `electron.remote.process.argv` (inline script in the HTML skeleton) | `require('@electron/remote').process.argv` — note: this HMR / dev script runs in the renderer page context, the `electron` global comes from `nodeIntegration: true` — replace the dotted access with the explicit `require()` |
| **HTML 2** | `lib/main.development.html:179` | `electron.remote.process.argv` | Same fix as HTML 1 |

**Notes on the table above:**

- Files that import other things alongside `remote` (`ipcRenderer`, `shell`, `clipboard`, etc.) MUST be split into two imports: one from `'electron'` (or `electron`), one from `'@electron/remote'`. Bundling both names into one destructure breaks once `remote` moves out of the `electron` module.
- `browser/main/Detail/SnippetNoteDetail.js` line number drifted from `:34` (original plan) to `:35` after a 2026 sweep — re-verified.
- `browser/main/SideNav/index.js` line number drifted from `:16` (original plan) to `:24` — re-verified.
- `browser/components/MarkdownPreview.js` original plan referenced `:43` (`const dialog = remote.dialog`), but the actual import is at `:33`. Migration target is the `:33` import.
- `browser/main/NoteList/index.js` has *two* `remote` imports: one at the file top (`:26`) and a stale re-import inside a function (`:1029`). The latter must be deleted — leaving it in place would re-shadow the migrated top import with the legacy `electron.remote` source after the module-level swap.
- Two HTML files contain inline `<script>` blocks that read `electron.remote.process.argv`. These were missing from the original plan but must be migrated, otherwise the HMR `--hot` detection in dev mode breaks.

### Step 1.4 — Handle `ipcClient.js` special case

`browser/main/lib/ipcClient.js:5` uses `remote.app.getPath('userData')`. After the import swap to `@electron/remote`, this continues to work — no additional changes needed.

### Step 1.5 — Test

Per the Docker-only policy in CLAUDE.md:

```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
docker run --rm boostnote-legacy npm run compile   # webpack bundle smoke
docker run --rm boostnote-legacy npm run lint       # eslint passes — expect only the 7 pre-existing prettier baseline errors
docker run --rm boostnote-legacy npm test           # ava + jest; jest has pre-existing failures, ignore per CLAUDE.md
```

Then smoke-test the packaged .app on the host:

```bash
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
```

Verify in the running .app:
- Right-click context menu in the editor
- Sidebar storage menu (right-click on a folder)
- Preferences → Storages → "Add Storage" dialog
- Note export (`File → Export → HTML/PDF`) — exercises `formatPDF.js` + `formatHTML.js`
- Zoom in/out (Cmd-+ / Cmd--)
- Snippet edit dialog
- Delete-note confirmation

No behavior changes expected — `@electron/remote` is wire-compatible with the built-in `electron.remote` of Electron 11. If any of the dialog/menu paths above silently no-op, the most likely cause is that `require('@electron/remote/main').enable(mainWindow.webContents)` did not run for that window — re-check `lib/main-window.js` step 1.2.

---

## Phase 2: Bump Electron to 14.2.9

**Goal:** Upgrade the Electron runtime to 14.x. All `remote` calls now go through `@electron/remote` (installed in Phase 1).

### Step 2.1 — Update package.json

```diff
- "electron": "11.5.0",
+ "electron": "14.2.9",
```

```diff
- "electron-version": "11.5.0"
+ "electron-version": "14.2.9"
```

### Step 2.2 — Rebuild lockfile

```bash
docker run --rm boostnote-legacy npm install
```

### Step 2.3 — Fix `menu.popup(win)` → `menu.popup({ window: win })`

In Electron 14, `menu.popup(window)` still works but the positional form is deprecated. Migrate to object form:

| File | Line | Change |
|---|---|---|
| `browser/lib/context.js` | 9 | `menu.popup(remote.getCurrentWindow())` → `menu.popup({ window: remote.getCurrentWindow() })` |
| `browser/components/CodeEditor.js` | 110 | `menu.popup(remote.getCurrentWindow())` → `menu.popup({ window: remote.getCurrentWindow() })` |
| `browser/components/MarkdownPreview.js` | 136 | `menu.popup(remote.getCurrentWindow())` → `menu.popup({ window: remote.getCurrentWindow() })` |

### Step 2.4 — Fix `printToPDF` callback in formatPDF.js

`browser/main/lib/dataApi/formatPDF.js:18` uses the callback form, removed in Electron 12. Current code (re-verified at re-investigation):

```js
printout.webContents.printToPDF({}, (err, data) => {
  if (err) reject(err)
  else resolve(data)
  printout.destroy()
})
```

Note the options object is `{}` (empty), not `{ printBackground: true }` as the original plan implied. Migrate to the Promise form:

```diff
- printout.webContents.printToPDF({}, (err, data) => {
-   if (err) reject(err)
-   else resolve(data)
-   printout.destroy()
- })
+ printout.webContents.printToPDF({}).then(data => {
+   resolve(data)
+   printout.destroy()
+ }).catch(err => {
+   reject(err)
+   printout.destroy()
+ })
```

`printout.destroy()` must run in both the success and failure paths (the callback form ran it unconditionally after the if/else — the Promise form needs it duplicated in `.then`/`.catch` or refactored through `.finally()` for the same effect). If preferred:

```diff
+ printout.webContents.printToPDF({})
+   .then(resolve, reject)
+   .finally(() => printout.destroy())
```

### Step 2.5 — ~~Fix dialog callback in main-menu.js~~ (no longer needed)

The original plan claimed `lib/main-menu.js:449` used the removed callback form of `dialog.showMessageBox`. Re-verified at re-investigation — the current call site (now still at line 449) is already the Promise/no-callback form:

```js
electron.dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
  title: 'BoostNote',
  message: 'BoostNote',
  type: 'info',
  detail: `\n${detail}`
})
```

No trailing callback argument — the return value is discarded, which is valid. The historical callback-form regression must have been fixed in an earlier sweep. **Skip this step.**

### Step 2.6 — ~~Update Dockerfile system deps~~ (not applicable)

The original plan suggested adding X11 / Chromium libraries (libgtk-3-0, libnss3, libgbm1, libdrm2, etc.) to the Dockerfile. Re-verified at re-investigation — this is **not applicable to this repository**.

The Dockerfile in this repo does **not** run Electron inside the container. `electron-packager@15.5.2` (build stage) downloads the precompiled Electron binary for each target platform (`darwin-x64`, `darwin-arm64`, `linux-x64`) via `@electron/get@^1.6.0` and bundles it into a `.app` / `.tar.gz` artifact. The host (macOS) then runs the packaged binary.

The base Docker image (`node:22-bookworm`) only needs the toolchain to assemble the artifact: `python3`, `build-essential`, `fakeroot`, `git`, `zip` — already present in the current Dockerfile. No Electron *runtime* libraries are required because Electron itself never executes in the build container.

Verify by running the full docker build after the Electron bump:

```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
```

`@electron/get` will fetch `electron-v14.2.9-darwin-x64.zip`, `electron-v14.2.9-darwin-arm64.zip`, and `electron-v14.2.9-linux-x64.zip` from `github.com/electron/electron/releases` over HTTPS. `electron-packager` then unpacks and assembles. No Dockerfile change required.

**Skip this step.** If the docker build does fail at the `@electron/get` step (e.g. ChromiumZip checksum or signature change between Electron 11 → 14 line releases), the failure will be in the build container's `npm install` / `yarn install` output, not at Electron-runtime.

### Step 2.7 — (Optional) Bump `@electron/remote` to 2.x

If Phase 1 pinned `@electron/remote` to `^1.2.2`, this is the moment to consider lifting it to `^2.1.3`. The 2.x line declares `peerDependency: electron >= 13.0.0` (satisfied by Electron 14.2.9) and otherwise has the same public API. Skipping this step is also fine — 1.2.2 keeps working on Electron 14 in practice; the peer declaration is the only formal blocker.

```diff
- "@electron/remote": "^1.2.2",
+ "@electron/remote": "^2.1.3",
```

**If lifting to 2.x, also do two follow-ups in `lib/main-window.js`** (both deferred from Phase 1 because they don't apply on 1.x):

```diff
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
-   enableRemoteModule: true,
    zoomFactor: 1.0,
    enableBlinkFeatures: 'OverlayScrollbars'
  },
  icon: path.resolve(__dirname, '../resources/app.png')
})

+ require('@electron/remote/main').enable(mainWindow.webContents)
+
const url = path.resolve(
```

`@electron/remote@2.x` removed the auto-enable-all-windows behavior of 1.x — every `BrowserWindow` must be explicitly opted in via `.enable(webContents)` after creation, before `loadURL()`. Skipping the `.enable()` on 2.x makes every renderer-side `remote.*` call hang silently (no error, just no response). The `enableRemoteModule` webPreferences gate also stops being read in 2.x, so it can be safely dropped at the same time.

### Step 2.8 — Notes on Electron 12-14 API changes that affect this codebase

Re-verified at re-investigation. Items already correctly handled or not used:

- **`app.allowRendererProcessReuse`** — deprecated in Electron 12, removed in 14. Boostnote source does not set it (`grep -r allowRendererProcessReuse` returns no hits). No action.
- **`webFrame.setVisualZoomLevelLimits`** — deprecated in Electron 12, still functional through Electron 24, removed in 25+. Used at `lib/main.production.html:174` and `lib/main.development.html:178`: `electron.webFrame.setVisualZoomLevelLimits(1, 1)`. Electron 14 still supports it — no action needed for this upgrade, but flag for the eventual Electron 25+ migration (would need to be replaced with `webFrame.setLayoutZoomLevelLimits(0, 0)` plus user-input zoom handling).
- **`crashReporter.start()`** — `lib/main-app.js:4` has it commented out (`// electron.crashReporter.start()`). No action.
- **`shell.openExternal(url)` signature** — Electron 12 accepted both `openExternal(url)` and `openExternal(url, options)`. Electron 14 unchanged. No action.
- **`BrowserWindow#zoomFactor` constructor option** (used in `lib/main-window.js:55`) — stable across 11 → 14.
- **`enableBlinkFeatures: 'OverlayScrollbars'`** (used in `lib/main-window.js:56`) — Chrome 93 (in Electron 14) deprecated `OverlayScrollbars` as a Blink feature flag (overlay scrollbars became default behavior elsewhere). The flag is still accepted but a no-op in Electron 14. Leave it in place — no functional regression.

### Step 2.9 — Build and test

```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
docker run --rm boostnote-legacy npm run compile
docker run --rm boostnote-legacy npm run lint
docker run --rm boostnote-legacy npm test
```

### Step 2.10 — Smoke test the packaged app

```bash
# Export the macOS .app and launch it
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
```

Verify, in this priority order (the items most likely to regress on a major Electron bump):

1. **Window opens and the renderer loads** — if the renderer crashes immediately, check DevTools for `enableRemoteModule`-related errors (would mean Step 1.2 was skipped).
2. **Dialog boxes** — `File → Open`, `File → Export → HTML/PDF`, sidebar `Add Storage`, delete-note confirmation.
3. **Context menus** — right-click in editor, markdown preview, sidebar, notelist.
4. **Zoom in/out** (Cmd-+ / Cmd-− / Cmd-0) — exercises `ZoomManager.js` and the deprecated-but-functional `setVisualZoomLevelLimits`.
5. **PDF export** — exercises the migrated `printToPDF` Promise form (Step 2.4).
6. **Snippet editor** in Preferences.
7. **Mermaid / flowchart / katex** rendering — exercises the renderer-bundled chain (codemirror 5.65.21, mermaid 9.1.7, flowchart.js 1.12.0, katex 0.16.47) to confirm Electron 14's V8 (9.3) hasn't broken any of the pinned-ceiling deps.
8. **Spell check** (typo-js 1.3.2) and **emoji picker** (react-emoji-render 1.2.4).
9. **All keyboard shortcuts**.
10. **Preferences modal opens, edits save** — exercises `electron-config` and the renderer-bundled `dot-prop` chain.

---

## Phase 3: Enable `contextIsolation: true` (separate effort)

**Goal:** Security hardening by isolating the renderer context. This is a separate project after Phase 2 is stable.

### Step 3.1 — Create preload script

`lib/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  getCurrentWindow: () => ipcRenderer.invoke('get-current-window'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Dialogs
  showMessageBox: (options) => ipcRenderer.invoke('dialog-show-message-box', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog-show-open', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog-show-save', options),
  showErrorBox: (title, content) => ipcRenderer.invoke('dialog-show-error', title, content),

  // App info
  getPath: (name) => ipcRenderer.invoke('app-get-path', name),
  getAppPath: () => ipcRenderer.invoke('app-get-app-path'),
  getVersion: () => ipcRenderer.invoke('app-get-version'),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  openPath: (path) => ipcRenderer.invoke('shell-open-path', path),

  // IPC (existing event bridge)
  on: (channel, callback) => ipcRenderer.on(channel, (_event, ...args) => callback(...args)),
  off: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),

  // Zoom
  setZoomFactor: (factor) => ipcRenderer.invoke('set-zoom-factor', factor),

  // Clipboard
  readText: () => ipcRenderer.invoke('clipboard-read-text'),
  writeText: (text) => ipcRenderer.invoke('clipboard-write-text', text),

  // Menu
  popupMenu: (template) => ipcRenderer.invoke('menu-popup', template),
})
```

### Step 3.2 — Register IPC handlers in main process

`lib/ipcServer.js` (or a new `lib/preload-bridge.js`):

Register `ipcMain.handle()` for each channel defined in the preload. Each handler performs the equivalent of the current `remote.xxx()` call.

### Step 3.3 — Update webPreferences in main-window.js

```diff
  webPreferences: {
-   nodeIntegration: true,
-   contextIsolation: false,
-   enableRemoteModule: true,
+   nodeIntegration: false,
+   contextIsolation: true,
+   preload: path.join(__dirname, 'preload.js'),
    zoomFactor: 1.0,
    enableBlinkFeatures: 'OverlayScrollbars'
  },
```

### Step 3.4 — Refactor all renderer files

Every file that currently uses `remote.xxx()` must switch to `window.electronAPI.xxx()`. This touches **24 files** and **~50+ call sites**.

### Step 3.5 — Test exhaustively

All dialogs, menus, clipboard, zoom, shell operations, and IPC events must be verified.

---

## Summary

| Phase | What | Risk | Effort | Can be done |
|-------|------|------|--------|-------------|
| 1 | `@electron/remote@^1.2.2` install + import swap | ✅ Zero | ~30-45 min | While still on Electron 11 |
| 2 | Bump to Electron 14.2.9 + API fixes + (optional) `@electron/remote@^2.1.3` | 🟢 Low | ~2-3 hours | After Phase 1 |
| 3 | `contextIsolation: true` | 🟡 Medium-High | ~1-2 days | After Phase 2 |

## Files changed per phase

| Phase | Files |
|-------|-------|
| 1 | `package.json`, `yarn.lock`, `lib/main-window.js`, **24 renderer source files** (1-line import swaps) + **2 HTML files** (`lib/main.production.html`, `lib/main.development.html` inline-script edits) + delete the duplicate `NoteList/index.js:1029` re-import |
| 2 | `package.json`, `yarn.lock`, `formatPDF.js`, `context.js`, `CodeEditor.js`, `MarkdownPreview.js` (Step 2.3's `menu.popup` migration). The previously-listed `Dockerfile` and `lib/main-menu.js` edits are no longer needed (see Steps 2.5 and 2.6) |
| 3 | `lib/preload.js` (new), `lib/main-window.js`, `lib/ipcServer.js` (or new `lib/preload-bridge.js`), **24 renderer files + 2 HTML files** (refactor `remote.*` → `window.electronAPI.*`) |

## Investigation notes (added 2026-05-27)

This plan was re-investigated against current `main` to verify accuracy. Findings:

- **Line numbers drifted** in three files (`SideNav/index.js`, `Detail/SnippetNoteDetail.js`, `MarkdownPreview.js`) since the original plan was written. All 24 entries in Step 1.3's table now point at the *current* line numbers (verified by `grep -n 'remote' ...`).
- **Two HTML files were missing** from the original migration list. They contain inline `<script>` blocks that read `electron.remote.process.argv` for HMR `--hot` detection. Now listed in Step 1.3 as HTML 1 + HTML 2.
- **A duplicate `const { remote } = electron` import** at `browser/main/NoteList/index.js:1029` (inside a function) shadows the file-top import. Must be deleted, not migrated. Added as row 7b.
- **`@electron/remote` peer constraint**: 2.x requires Electron `>=13.0.0` (from 2.0.4 onwards); 1.x (1.2.2 latest) supports Electron `>=10` and is what Phase 1 must pin (Step 1.1 updated). Lifting to 2.x is now an optional Phase 2 step (Step 2.7).
- **`@electron/remote@1.x` API surface**: only exports `{ initialize }` from `main/`. The plan originally said to call `.enable(webContents)` per window — that API does not exist on 1.x. `main/index.d.ts` is `export { initialize } from './server';` and calling `.enable()` throws `TypeError: require(...).enable is not a function` at module load. On 1.x, `.initialize()` alone auto-enables every BrowserWindow. The 2.x line added mandatory per-window `.enable(webContents)`; re-add that line only when lifting the dep to 2.x in Step 2.7.
- **`@electron/remote@1.x` still uses `webPreferences.enableRemoteModule` as its enable gate**. Source: `node_modules/@electron/remote/dist/src/main/server.js:290-292` returns `false` when the option is absent and refuses every IPC call with the message `@electron/remote is disabled for this WebContents. Set {enableRemoteModule: true} in WebPreferences to enable it.` Plan Step 1.5 was wrong to instruct removing this in Phase 1 — it must stay until the 2.x lift. Electron 12+ silently ignores the option (the built-in remote module was removed in Electron 12), so leaving it set is forward-compatible with the Phase B Electron 14 bump.
- **`@electron/remote@1.x` requires Electron 12+ at runtime despite peer-dep claiming `>=10`**. Renderer code at `node_modules/@electron/remote/dist/src/renderer/remote.js:34-42` calls `getContextId()`, which looks up `process._linkedBinding('electron_common_v8_util')` via `dist/src/common/get-electron-binding.js`. The `electron_common_*` binding namespace was introduced in Electron 12 — Electron 11 still used the legacy `atom_common_*` prefix. On Electron 11 the binding lookup returns null and the renderer throws `Error: Electron >=v13.0.0-beta.6 required to support sandboxed renderers` at every entry, blocking the renderer from booting. **Consequence**: the Phase 1 "swap to `@electron/remote` while still on Electron 11" strategy cannot ship as an independent commit. Phases 1 and 2 must be combined.
- **`@electron/remote@1.x` hard-refuses Electron ≥ 14 from the main side as well**. The main-process `initialize()` at `node_modules/@electron/remote/dist/src/main/server.js:342` throws `Error: @electron/remote >= 2.x is required for Electron >= 14. See https://github.com/electron/remote/blob/main/docs/migration-2.md for migration instructions.` at app boot. **Consequence**: Phase 2's Electron 14 bump must ship alongside the `@electron/remote` 1.x → 2.x lift (Step 2.7 promoted from optional to required). The 2.x line also flips the enable model — `webPreferences.enableRemoteModule` is no longer read; every `BrowserWindow` must be opted in via `require('@electron/remote/main').enable(webContents)` after creation and before `loadURL()`.
- **Anonymous-volume stale-deps trap (CLAUDE.md)**: the `bn-deps` quick-verify loop normally uses `-v /app/node_modules` to keep the container's `node_modules` separate from the host bind-mount. During the @electron/remote 1.x → 2.x lift, this masked the install — `yarn install` wrote to the anonymous volume, but the subsequent `npm run compile` saw the image-baked 1.2.2 copy and failed with `Cannot resolve module '@electron/remote'` (webpack 1 was scanning an empty / stale `node_modules`). Workaround during dep-change cycles: drop the `-v /app/node_modules` flag so the install writes to the host bind-mount, and the compile that follows resolves against the up-to-date `node_modules` on disk. Use the anonymous-volume form only once the lockfile is stable.
- **Webpack 1 process-shim trap for `@electron/remote`**: with `NodeTargetPlugin` enabled, webpack 1 still injects a browser-style `process` shim (module 12 in the bundle, the standard `process/browser` polyfill that exposes only `process.versions = {}` and a few stubs) into any bundled module that references `process.X`. When `@electron/remote` is renderer-bundled, the shim replaces Node's real `process` at module load — so `process.contextId` is undefined and `process._linkedBinding` doesn't exist. The renderer code in `dist/src/renderer/remote.js` does `const contextId = process.contextId || getContextId()` at module load, falls through to `getContextId()`, the binding lookup returns null, and the renderer throws `Error: Electron >=v13.0.0-beta.6 required to support sandboxed renderers` at every entry. This is the same trap CLAUDE.md flagged for `fs-extra@7+` reading `process.versions.node` at module load. **Fix**: add `'@electron/remote'` to `webpack-skeleton.js#externals` (alongside the existing `'electron'` entry) so the renderer resolves `require('@electron/remote')` via Node's real `require` at runtime — bypassing webpack's wrapping and the shimmed `process`. After the fix, `compiled/main.js` no longer contains the `Electron >=v13` error string and the bundle drops from 1154 → 1148 modules (the @electron/remote source files are no longer inlined).
- **`@electron/remote@2.x` export shape differs from `electron.remote`**. The built-in `require('electron').remote` returned a `remote` namespace, so `const { remote } = require('electron')` worked. `require('@electron/remote')` returns the remote interface directly — it has `app`, `dialog`, `Menu`, `MenuItem`, `BrowserWindow`, `clipboard`, `shell`, etc. exposed as direct properties via `Object.defineProperty(exports, name, { get: () => getBuiltin(name) })` in `dist/src/renderer/remote.js`. The Step 1.3 import-swap table prescribed `const { remote } = require('@electron/remote')`, which reads `undefined.remote` and crashes the renderer at the first `remote.app` / `remote.dialog` access with `TypeError: Cannot read properties of undefined (reading 'app')`. **Fix pattern**: drop the destructure — either `const remote = require('@electron/remote')` (preserves all existing `remote.app` / `remote.dialog` call sites unchanged), or destructure named members directly like the README example `const { BrowserWindow } = require('@electron/remote')`. Across the 23 source files + 2 HTML inline scripts, the minimum-change swap is the bare `const remote = require('@electron/remote')` form. ESM files that previously used `import { remote } from '@electron/remote'` mix `import + const remote = require(...)` cleanly — there is no `default` export to bind to a default import.
- **`Menu` / `MenuItem` are main-process-only in renderer**: Step 1.3 row 20 simplified `contextMenuBuilder.js` from the legacy `const { Menu } = remote.require('electron')` pattern to `const { Menu, clipboard, shell } = require('electron')`. This was wrong — `Menu` and `MenuItem` are not exposed in the renderer's `require('electron')` even with `nodeIntegration: true`; they live behind `@electron/remote` (which routes the constructor through IPC to the main process). The wrong simplification produces a renderer crash on right-click: `TypeError: Cannot read properties of undefined (reading 'buildFromTemplate')` from `Menu.buildFromTemplate(template)`. **Fix**: pull `Menu` from `@electron/remote` (same as `context.js`'s `const { Menu, MenuItem } = remote`), leaving only `clipboard` and `shell` on the direct `require('electron')` destructure:

```js
const { clipboard, shell } = require('electron')
const remote = require('@electron/remote')
const { Menu } = remote
```

The renderer-accessible names from `require('electron')` under `nodeIntegration: true` are limited to: `ipcRenderer`, `clipboard`, `shell`, `webFrame`, `nativeImage`, `crashReporter`, `desktopCapturer`, `contextBridge`. Everything else (`app`, `dialog`, `Menu`, `MenuItem`, `BrowserWindow`, `nativeTheme`, `screen`, `globalShortcut`, `Notification`, `powerMonitor`, etc.) must come via `@electron/remote`.
- **Phase 2.5 (main-menu.js callback fix)** is obsolete — re-verified the call site at line 449 already uses the Promise form (no callback argument). The original plan was describing a regression that has since been independently fixed.
- **Phase 2.4 (printToPDF)**: the actual options object in `formatPDF.js:18` is `{}`, not `{ printBackground: true }` as the original plan said. The Promise-form migration also needs `printout.destroy()` to run in both success and failure paths (originally it ran unconditionally after the callback's if/else).
- **Phase 2.6 (Dockerfile)** is not applicable — `electron-packager` bundles a precompiled Electron binary; Electron itself never executes inside the Docker build container, so no X11 / Chromium system libraries are needed.
- **`webFrame.setVisualZoomLevelLimits`** in both HTML files: deprecated in Electron 12, still works through Electron 24, removed in 25+. Phase 2 is unaffected; flag for the eventual 25+ migration.
- **`enableBlinkFeatures: 'OverlayScrollbars'`** in `lib/main-window.js:56`: still accepted in Electron 14 but a no-op (Chrome 93 baked overlay scrollbars in elsewhere). Leave in place.
