# Upgrade Plan: Electron 11 → 14

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

```bash
# In Docker (never on host):
docker run --rm boostnote-legacy npm install @electron/remote
```

This adds `@electron/remote` to `package.json` `dependencies` and updates `yarn.lock`.

### Step 1.2 — Initialize in main process

Edit `lib/main-window.js`:

```js
// Add at top of file AFTER existing requires
require('@electron/remote/main').initialize()
```

```js
// Add AFTER mainWindow creation (before mainWindow.loadURL)
require('@electron/remote/main').enable(mainWindow)
```

```js
// REMOVE from webPreferences (line ~48):
enableRemoteModule: true,
```

### Step 1.3 — Swap all renderer imports (24 files)

Every file that currently does `const { remote } = require('electron')` or `import { remote } from 'electron'` must change to `require('@electron/remote')` or `import ... from '@electron/remote'`.

**Full file list:**

| # | File | Current import | Change to |
|---|---|---|---|
| 1 | `browser/main/lib/eventEmitter.js:2` | `const { ipcRenderer, remote } = electron` | `const { remote } = require('@electron/remote')` |
| 2 | `browser/main/lib/ipcClient.js:4` | `const { remote, ipcRenderer } = require('electron')` | Split: `const { remote } = require('@electron/remote'); const { ipcRenderer } = require('electron')` |
| 3 | `browser/main/lib/ZoomManager.js:4` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 4 | `browser/main/lib/dataApi/formatPDF.js:2` | `import { remote } from 'electron'` | `import { remote } from '@electron/remote'` |
| 5 | `browser/main/lib/dataApi/formatHTML.js:5` | `import { remote } from 'electron'` | `import { remote } from '@electron/remote'` |
| 6 | `browser/main/Main.js:23` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 7 | `browser/main/NoteList/index.js:26` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 8 | `browser/main/NewNoteButton/index.js:12` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 9 | `browser/main/SideNav/index.js:16` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 10 | `browser/main/SideNav/StorageItem.js:16` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 11 | `browser/main/modals/RenameTagModal.js:13` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 12 | `browser/main/modals/PreferencesModal/StoragesTab.js:13` | `const { shell, remote } = electron` | `const { shell } = require('electron'); const { remote } = require('@electron/remote')` |
| 13 | `browser/main/modals/PreferencesModal/StorageItem.js:11` | `const { shell, remote } = require('electron')` | Split: shell from `electron`, remote from `@electron/remote` |
| 14 | `browser/main/modals/PreferencesModal/InfoTab.js:7` | `const { shell, remote } = electron` | Split as above |
| 15 | `browser/main/modals/PreferencesModal/PluginsTab.js:12` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 16 | `browser/main/Detail/SnippetNoteDetail.js:34` | `const electron = require('electron')` | Split electron/remote imports |
| 17 | `browser/components/CodeEditor.js:16` | `const { ipcRenderer, remote, clipboard } = require('electron')` | Split: remote from `@electron/remote` |
| 18 | `browser/components/MarkdownPreview.js:43` | `const dialog = remote.dialog` | Keep as-is since remote is now from `@electron/remote` |
| 19 | `browser/lib/context.js:1` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 20 | `browser/lib/contextMenuBuilder.js:4-7` | `const { remote } = require('electron')` + `remote.require('electron')` | `const { remote } = require('@electron/remote')` |
| 21 | `browser/lib/consts.js:3` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 22 | `browser/lib/i18n.js:2` | `const { remote } = require('electron')` | `const { remote } = require('@electron/remote')` |
| 23 | `browser/lib/confirmDeleteNote.js:3` | `const { remote } = electron` | `const { remote } = require('@electron/remote')` |
| 24 | `extra_scripts/codemirror/addon/hyperlink/hyperlink.js:16` | `const remote = require('electron').remote` | `const remote = require('@electron/remote')` |

### Step 1.4 — Handle `ipcClient.js` special case

`browser/main/lib/ipcClient.js:5` uses `remote.app.getPath('userData')`. After the import swap to `@electron/remote`, this continues to work — no additional changes needed.

### Step 1.5 — Test

```bash
docker run --rm boostnote-legacy npm test
```

All existing tests must pass. No behavior changes expected.

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

`browser/main/lib/dataApi/formatPDF.js:18` uses callback form, deprecated since Electron 12.

```diff
- win.webContents.printToPDF({ printBackground: true }, (err, data) => {
-   if (err) return reject(err)
-   resolve(data)
- })
+ win.webContents.printToPDF({ printBackground: true }).then(data => {
+   resolve(data)
+ }).catch(err => {
+   reject(err)
+ })
```

### Step 2.5 — Fix dialog callback in main-menu.js

`lib/main-menu.js:449` uses the callback form of `dialog.showMessageBox`, which was removed in Electron 9 (pre-existing bug). This must be fixed before upgrading:

```diff
- dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
+ dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
    type: 'info',
    buttons: ['OK'],
    message: 'Auto-update is disabled in this build',
    title: 'Boostnote'
- }, () => {})
+ }).then(() => {}).catch(() => {})
```

### Step 2.6 — Update Dockerfile if needed

Check `Dockerfile` for Electron system dependencies. Electron 14 uses Chromium 93 (vs Chromium 87 in Electron 11). Additional system packages may be needed:

```diff
  RUN apt-get update && apt-get install -y --no-install-recommends \
      libgtk-3-0 \
      libnotify4 \
      libnss3 \
      libxss1 \
      libxtst6 \
      xdg-utils \
+     libatk-bridge2.0-0 \
+     libdrm2 \
+     libgbm1
```

Test by building: `docker build -t boostnote-legacy .`

### Step 2.7 — Build and test

```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
docker run --rm boostnote-legacy npm run compile
docker run --rm boostnote-legacy npm test
```

### Step 2.8 — Smoke test the packaged app

```bash
docker run --rm boostnote-legacy npm run compile
# Export the macOS .app and launch it
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
```

Verify:
- Dialog boxes open correctly
- Context menus (right-click in editor, markdown preview, sidebar) work
- Zoom in/out works
- PDF export produces correct output
- All keyboard shortcuts work
- Preferences modal opens and saves

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
| 1 | `@electron/remote` import swap | ✅ Zero | ~30 min | While still on Electron 11 |
| 2 | Bump to Electron 14.2.9 + API fixes | 🟢 Low | ~2 hours | After Phase 1 |
| 3 | `contextIsolation: true` | 🟡 Medium-High | ~1-2 days | After Phase 2 |

## Files changed per phase

| Phase | Files |
|-------|-------|
| 1 | `package.json`, `lib/main-window.js`, **24 renderer files** (1-line import swaps) |
| 2 | `package.json`, `Dockerfile`, `lib/main-menu.js`, `formatPDF.js`, `context.js`, `CodeEditor.js`, `MarkdownPreview.js` |
| 3 | `lib/preload.js` (new), `lib/main-window.js`, `lib/ipcServer.js`, **24 renderer files** (refactor `remote.*` → `window.electronAPI.*`) |
