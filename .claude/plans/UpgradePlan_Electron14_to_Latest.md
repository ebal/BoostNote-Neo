# Upgrade Plan: Electron 14.2.9 → Latest Stable

## Goal

Reach the latest stable Electron (currently 42.3.0) — or a deliberate
LTS waypoint (32.x ships Node 20.16 in the renderer, user's stated
target). Each phase must leave a working `Boostnote.app` artifact;
multi-week migration is split into phases with manual smoke gates so
the project never sits in a broken intermediate state.

Strategy: **4 phases**, each ends at a tested commit checkpoint. If
smoke regresses, `git revert` the offending phase only.

## Current state (post 0.18.3)

| Setting | Value |
|---|---|
| Electron | 14.2.9 |
| Chromium | 93 |
| renderer Node | 14.17 |
| V8 | 9.3 |
| `@electron/remote` | 2.1.3 |
| webPreferences | `nodeIntegration: true`, `contextIsolation: false`, `nativeWindowOpen: false` |
| `enableRemoteModule` | not set (removed in 0.18.0) |
| `electron-packager` | 17.1.2 |
| renderer `webFrame.setVisualZoomLevelLimits(1, 1)` | at `lib/main.production.html:174`, `lib/main.development.html:178` |
| `app.commandLine.appendSwitch('disable-features', 'V8VmDeprecation')` | at `lib/main-app.js` (vm-warning suppression) |

## Per-major API breaks affecting Boostnote

| Major | Node | Boostnote-relevant break |
|---|---|---|
| 15 | 16.5 | `enableRemoteModule` hard-removed from webPreferences — already clean since 0.18.0. |
| 16 | 16.9 | — |
| 17 | 16.13 | `BrowserWindow#hideMenuBar` removed — Boostnote uses `setMenuBarVisibility(false)` ✓. |
| 18 | 16.13 | Node 14 dropped in build chain; we're already on Node 22 in Docker ✓. |
| 19 | 16.13 | `Tray.setHighlightMode` removed — not used. |
| 20 | 16.15 | `sandbox: true` default flip for new BrowserWindows. **Need explicit `sandbox: false` in webPreferences** to preserve `nodeIntegration: true` semantics. |
| 21 | 16.16 | `webRequest.onResponseStarted` deprecation — not used. |
| 22 | 16.17 | Final remnants of `enableRemoteModule` warnings hard-removed. |
| 23 | 18.12 | dropped Windows 7/8/8.1 — Boostnote CI doesn't target legacy Win. |
| 24 | 18.14 | minor cleanups. |
| 25 | 18.15 | **`webFrame.setVisualZoomLevelLimits` removed.** Used at `lib/main.{production,development}.html:174/178`. Migration: `webFrame.setLayoutZoomLevelLimits(0, 0)` + native `event.preventDefault()` on Cmd+/Cmd-/Cmd-Wheel paths if pinch-zoom must stay disabled. |
| 26 | 18.16 | `screen.getPrimaryDisplay()` async in some paths — Boostnote doesn't call this. |
| 27 | 18.17 | minor. |
| 28 | 18.18 | `app.allowRendererProcessReuse` removed — Boostnote doesn't set it. |
| 29 | 20.9 | renderer Node 20 — **user's stated goal milestone**. `BrowserView` deprecated → `WebContentsView` (Boostnote doesn't use BrowserView). |
| 30 | 20.11 | minor. |
| 31 | 20.14 | minor. |
| 32 | 20.16 | `process.uptime` and similar tightened. Latest LTS-quality. |
| 33 | 20.18 | `app.commandLine.appendSwitch` semantics tightened — verify our `disable-features=V8VmDeprecation` flag still works. |
| 34 | 22.x | renderer Node 22. |
| 35 | 22.x | `ipcRenderer.invoke` related cleanup — Boostnote doesn't use invoke. |
| 36–42 | 22.x | minor patches. |

**Critical edits required:**

1. `lib/main-window.js#webPreferences` — add `sandbox: false` (gate for Electron 20+).
2. `lib/main.{production,development}.html:174,178` — migrate `webFrame.setVisualZoomLevelLimits(1, 1)` to `setLayoutZoomLevelLimits(0, 0)` + JS-level zoom guards (gate for Electron 25+).
3. `package.json` — bump `electron` + `config.electron-version` per phase.
4. `lib/main-app.js` — verify `app.commandLine.appendSwitch` continues to suppress vm warning through Electron 33.

**`@electron/remote@2.1.3`** peer is `electron >= 13.0.0` — supports the entire path through 42 ✓.

**`electron-packager@17.1.2`** bundles `@electron/get@^2.0.0` (legacy). `@electron/get` is now at 5.0.0. electron-packager 17.x is sufficient through Electron 30+. For 31+ may need migration to `@electron/packager` (the new scoped package). Verify in Phase 4.

## Phased migration plan

### Phase 1 — Electron 14.2.9 → 22.3.27 (4 majors)

Single coordinated commit. Smallest "safe" intermediate landing point.
Reaches sandbox-default-true transition; we add explicit `sandbox:
false` to lock in current behavior.

**Edits:**

- `lib/main-window.js#webPreferences`: add `sandbox: false`.
- `package.json#devDependencies.electron`: `14.2.9` → `22.3.27`.
- `package.json#config.electron-version`: `14.2.9` → `22.3.27`.

**Verify:**

- `npm run compile` clean.
- `docker build .` produces a `.app` artifact.
- Launch packaged binary. Smoke:
  1. App opens; renderer mounts; no console errors related to
     enableRemoteModule.
  2. Right-click context menus (editor, preview, sidebar, notelist).
  3. File → Export → PDF (verifies `printToPDF` Promise migration
     still works on E22).
  4. Cmd+/Cmd-/Cmd-0 zoom — verify `webFrame.setVisualZoomLevelLimits`
     still functional (it's deprecated but still works through E24).
  5. All keyboard shortcuts.
  6. Mermaid, flowchart, KaTeX render (renderer dep chain).

If smoke regresses: `git revert <phase-1-commit>` and re-investigate.

### Phase 2 — Electron 22.3.27 → 26.6.10 (4 majors)

Crosses the `webFrame.setVisualZoomLevelLimits` removal cliff at E25.

**Edits:**

- `lib/main.production.html:174` + `lib/main.development.html:178`:
  ```diff
  - electron.webFrame.setVisualZoomLevelLimits(1, 1)
  + electron.webFrame.setLayoutZoomLevelLimits(0, 0)
  ```
- Add JS-level guards in the same `<script>` block to disable pinch /
  Ctrl+Wheel zoom (the layout API doesn't cover those):
  ```js
  document.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault()
  }, { passive: false })
  ```
- `package.json`: `22.3.27` → `26.6.10`.
- `config.electron-version`: same.

**Verify:**

- Compile clean.
- Smoke + dedicated test:
  - Cmd+/Cmd-/Cmd-0 still adjust app zoom (via `ZoomManager.js` →
    `webContents.setZoomLevel(...)`, unaffected by the webFrame layer).
  - Pinch-zoom / Ctrl+Wheel does NOT zoom (regression check — was
    blocked by `setVisualZoomLevelLimits(1, 1)`; now blocked by JS
    handler).
- Verify the `'V8VmDeprecation'` switch in `lib/main-app.js` still
  suppresses the renderer's vm deprecation warning. If the flag name
  changed in E25/26, swap it. Boostnote already has the
  `console.warn` filter in `lib/main.{production,development}.html` as
  defense in depth so the warning is filtered either way.

### Phase 3 — Electron 26.6.10 → 32.3.3 (6 majors)

Reaches renderer Node 20 — user's stated goal. Latest LTS-quality
Electron release line.

**Edits:**

- `package.json`: `26.6.10` → `32.3.3`.
- `config.electron-version`: same.
- Verify `@electron/remote@2.1.3` still works (peer `electron >= 13`
  satisfied through 42).

**Verify:**

- Compile clean.
- Full smoke matrix:
  1. App opens, renderer mounts.
  2. DevTools: `process.versions.node` reports `20.9.x` or later
     (confirms Node 20 in renderer).
  3. Every renderer code path that touches Node built-ins (`fs`,
     `path`, `crypto`, `child_process`, `os`, `stream`) still works —
     spot-check with note save (`@rokt33r/season` CSON write via
     dataApi), attachment drop (fs write), export (formatHTML +
     formatPDF), plugin install (PreferencesModal/PluginsTab.js).
  4. `vm` deprecation suppression: verify the cson-parser code path
     no longer emits the warning (Node 20+ may have hard-removed
     renderer-side `vm`; if so, cson-parser's `require('vm')` either
     throws or is shimmed by Electron). If it throws, this phase
     uncovers the cson-parser/vm-shim work that CLAUDE.md item #4
     warned about.

If `vm` is hard-removed at this point and cson-parser breaks: fall
back to E29-E30 (where `vm` is still functional) and replace
cson-parser with `coffee-script` direct + `vm`-free eval OR fork
cson-parser to use `new Function()`. Track as separate workstream.

### Phase 4 — Electron 32.3.3 → 42.3.0 (10 majors)

Final hop to latest stable. Largely uneventful per Electron release
notes (32 → 42 is mostly minor-feature additions and Chromium
upgrades).

**Edits:**

- `package.json`: `32.3.3` → `42.3.0`.
- `config.electron-version`: same.
- **Possibly required**: bump `electron-packager` 17.1.2 → migrate to
  `@electron/packager` (the renamed scoped package). Check at
  Phase-4 entry whether 17.1.2 still successfully fetches the
  Electron 42 binary via its bundled `@electron/get@^2.0.0`. If not,
  swap consumer in `gruntfile.js`:
  ```diff
  - const packager = require('electron-packager')
  + const packager = require('@electron/packager').default
  ```
  and bump in package.json devDeps + adjust `@electron/get` resolution.

**Verify:**

- Full docker build + smoke matrix (same as Phase 3).
- Clear ~15 Electron-specific Dependabot alerts (#85, #93, #106, #108,
  #110, #146, #151, #191–204, #208) that target patches in the
  14 → 38 range.

## Rollback strategy

Each phase ends at a single commit. Reversibility:

| Phase | Revert |
|---|---|
| 1 | `git revert <phase-1-commit>` — restores Electron 14.2.9 + drops `sandbox: false`. |
| 2 | `git revert <phase-2-commit>` — restores Electron 22.x + reverts the webFrame migration. |
| 3 | `git revert <phase-3-commit>` — restores Electron 26.x. |
| 4 | `git revert <phase-4-commit>` — restores Electron 32.x. |

If a phase exposes a structural problem (e.g., cson-parser/vm at
Phase 3), pause + open a focused workstream + commit the
prerequisite work first.

## Out of scope (deferred)

| Item | Why deferred |
|---|---|
| `contextIsolation: true` | Major refactor — 24 files + new preload + IPC handlers. Track as separate workstream after Electron migration lands. |
| Replace `@rokt33r/season` / `cson-parser` | Only do if Phase 3 reveals a hard `vm` removal. Otherwise defer. |
| `electron-packager` → `@electron/packager` | Do only if Phase 4 cannot complete with electron-packager@17. |
| `@electron/remote` → `@electron/remote@latest` | 2.1.3 satisfies the entire path through 42. No bump needed unless Phase 4 surfaces an issue. |
| Migrate `nodeIntegration: false` + preload script | Belongs with the contextIsolation refactor — separate workstream. |

## Verify loop (Docker-only per CLAUDE.md)

```bash
# Per phase, before commit:
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
# Run the phase-specific smoke matrix above.
# If clean: commit + push the phase.
# If regressed: git revert the working-tree edits + investigate.
```

## Outcome target

| Phase | Electron | renderer Node | Chromium | Status gate |
|---|---|---|---|---|
| 0 (current) | 14.2.9 | 14.17 | 93 | shipped 0.18.0 |
| 1 | 22.3.27 | 16.17 | 108 | sandbox: false locked |
| 2 | 26.6.10 | 18.16 | 116 | webFrame zoom migrated |
| 3 | 32.3.3 | 20.16 | 128 | **user's stated Node 20 goal** |
| 4 | 42.3.0 | 22.x | 138 | latest stable, all Electron CVE alerts cleared |
