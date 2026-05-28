# Upgrade Plan — BoostNote-Legacy v0.17.31

## Current State

| Area | Version / Status |
|---|---|
| Electron | 11.5.0 (Chromium 87, Node 12) |
| Webpack | 1.15.0 — frozen (too risky to bump) |
| Babel | 6.x — frozen with Webpack 1 |
| React | 16.14.0 (shared external, not bundled) |
| Redux | 4.2.1 ✅ already current |
| `@electron/remote` | ✅ migrated (24 renderer files, v2.1.3) |
| Tests | Jest 22 works; AVA 0.x **broken** on Node 22 |
| Docker | node:22-bookworm |
| CVE fixes | ~30 resolved via yarn resolutions; 64 Dependabot flags are false positives (lockfile already fixed) |
| Lint | 7 pre-existing prettier errors (host-vs-Docker version mismatch) |

## Audit Findings

### Dead code / unused deps
| Item | Found in | Issue |
|---|---|---|
| `react-transition-group` | `package.json` deps | Never imported anywhere |
| `merge-stream` | `package.json` devDeps | Never imported anywhere |
| `fs-jetpack` | `webpack-skeleton.js:41` external | Not in package.json, never required |
| AVA 0.x | `package.json` deps + scripts | **Broken** on Node 22 — 14 test files can't run |

### Deprecated APIs in source
| File | Line | API | Modern replacement |
|---|---|---|---|
| `formatPDF.js` | 18 | `printToPDF({}, callback)` | `printToPDF({}).then()` |
| 6 files | various | `UNSAFE_componentWillReceiveProps` / `UNSAFE_componentWillUpdate` | `componentDidUpdate()` or constructor |

### Pre-existing known issues (documented, not introduced)
- Jest picks up test files inside `dist/Boostnote-darwin-*/` → fail with environment mismatch
- `attachmentManagement` Jest test fails with `fs-extra`/`graceful-fs` incompatibility
- `normalizeEditorFontFamily` test fails with CSS quoting mismatch
- `createNote`/`createNoteFromUrl` tests fail with "Target folder doesn't exist"
- 7 prettier errors in Docker (version disagreement with host)

---

## Tier 1 — Zero-risk cleanup

Changes with no runtime impact, fully reversible, trivial to verify.

### 1. Remove unused `react-transition-group` dependency

**File:** `package.json`
**Change:** Delete `"react-transition-group": "^2.9.0"` from `dependencies`
**Verify:** `npm run compile` (webpack build clean) + `npm run lint`

### 2. Remove unused `merge-stream` devDependency

**File:** `package.json`
**Change:** Delete `"merge-stream": "^1.0.1"` from `devDependencies`
**Verify:** `npm run compile` + `npm run lint`

### 3. Remove dead `fs-jetpack` webpack external

**File:** `webpack-skeleton.js:41`
**Change:** Delete line `'fs-jetpack',`
**Verify:** `npm run compile` clean (no missing-module errors)

### 4. Migrate AVA tests → Jest + drop AVA

**Why:** `ava@0.25.0` is incompatible with Node 22. `npm test` fails at the `ava` step. 14 test files are orphaned.

**Changes:**

- Rename 14 files from `*-test.js` → `*.test.js` (Jest pattern)
- Update `package.json`:
  - `scripts.test`: `"cross-env NODE_ENV=test jest"`
  - Delete `scripts.ava` and `scripts.jest`
  - Delete `"ava": "^0.25.0"` from `dependencies`
  - Delete `"ava"` config block
- Update `CLAUDE.md` / `AGENTS.md` to reflect jest-only test runner

**AVA test files to migrate (14):**
```
tests/date-formatter-test.js
tests/dataApi/deleteNote-test.js
tests/dataApi/deleteSnippet-test.js
tests/dataApi/exportFolder-test.js
tests/dataApi/exportStorage-test.js
tests/dataApi/migrateFromV6Storage-test.js
tests/dataApi/moveNote-test.js
tests/dataApi/removeStorage-test.js
tests/dataApi/renameStorage-test.js
tests/dataApi/reorderFolder-test.js
tests/dataApi/toggleStorage-test.js
tests/dataApi/updateFolder-test.js
tests/dataApi/updateNote-test.js
tests/dataApi/updateSnippet-test.js
```

**Verify:** `docker run --rm boostnote-legacy npm test` → all 14 migrated tests pass, no AVA-related failures.

**Rollback:** `git revert <commit>`

### After Tier 1

`npm test` actually runs clean (Jest only). `npm run compile` is ~400 bytes lighter. Codebase has 3 fewer maintenance burden items.

---

## Tier 2 — Preventative (low risk, no runtime change)

### 5. Refactor 6 `UNSAFE_*` lifecycle methods

| File | Line | Method | Refactor target |
|---|---|---|---|
| `browser/main/NoteList/index.js` | 127 | `UNSAFE_componentWillReceiveProps` | `componentDidUpdate(prevProps)` |
| `browser/main/Detail/MarkdownNoteDetail.js` | 83 | `UNSAFE_componentWillReceiveProps` | `componentDidUpdate(prevProps)` |
| `browser/main/Detail/SnippetNoteDetail.js` | 80 | `UNSAFE_componentWillReceiveProps` | `componentDidUpdate(prevProps)` |
| `browser/components/MarkdownEditor.js` | 49 | `UNSAFE_componentWillReceiveProps` | `componentDidUpdate(prevProps)` or `getDerivedStateFromProps` |
| `browser/components/SnippetTab.js` | 18 | `UNSAFE_componentWillUpdate` | `componentDidUpdate(prevProps, prevState)` |
| `browser/components/ColorPicker.js` | 22 | `UNSAFE_componentWillReceiveProps` | `componentDidUpdate(prevProps)` or static `getDerivedStateFromProps` |

**Risk:** Low. Each refactor is per-component, isolated, and testable. Rollback is per-commit.

**Why:** These methods are removed in React 17+ concurrent mode. Refactoring now unblocks React 18+ bumps later.

### 6. Convert `printToPDF` callback → Promise

**File:** `browser/main/lib/dataApi/formatPDF.js:18`
**Change:**
```diff
- printout.webContents.printToPDF({}, (err, data) => {
-   if (err) return reject(err)
-   resolve(data)
- })
+ const data = await printout.webContents.printToPDF({})
+ resolve(data)
```

**Risk:** Low. `printToPDF()` returns Promise in Electron 12+. On Electron 11 both forms work.

**Why:** This is the last callback-form API in the codebase. Required for Electron 14 Phase 2.

### 7. Bump React 16.14.0 → 17.0.2

**Files:** `package.json` (version), update external `<script>` refs if pinned to CDN

**Risk:** Very low. React 17 had zero breaking changes. The event delegation change (React 17 attaches to root instead of document) has no effect here because BoostNote does not mix React and non-React UI.

**Why:** React 17 is the last version supported by Webpack 1's `var React` external pattern. 18+ requires ESM or specific UMD build.

---

## Tier 3 — Electron 14 readiness (Phase 1 completion)

### 8. Drop `enableRemoteModule: true`

**File:** `lib/main-window.js`
**Change:** Remove `enableRemoteModule: true` from `webPreferences`
**Risk:** Moderate — must verify no code path still uses old `require('electron').remote`. Audit says 0 files do this.
**Verify:** Launch app, test all remote-dependent features (file dialogs, context menus, clipboard, window controls)

### 9. Verify `@electron/remote@^2.1.3` on Electron 11

Current `package.json` has `"@electron/remote": "^2.1.3"` which targets Electron 14+. May need to pin to `"^1.2.2"` for Electron 11 compat.

**Test:** `docker build --target deps` + `node -e "require('@electron/remote')"` inside container
**Fallback:** Revert to `^1.2.2` if v2 fails on Electron 11

---

## Tier 4 — Electron 11 → 14.2.9 (full upgrade)

See `.claude/plans/UPGRADE.md` for detailed two-commit plan.

**Commit A** (Electron 11 → 11, infra only):
- Drop `enableRemoteModule`
- Pin `@electron/remote` correctly
- `printToPDF` Promise conversion (from Tier 2)

**Commit B** (Electron 11.5.0 → 14.2.9):
- `package.json`: `"electron": "14.2.9"`, `"config.electron-version": "14.2.9"`
- `lib/main-window.js`: 3 `menu.popup({window: ...})` object-form fixes
- `lib/main-menu.js`: `dialog.showMessageBox` → `dialog.showMessageBoxSync` (line 449)
- `formatPDF.js:18`: Already fixed in Tier 2
- `yarn.lock`: regenerated

---

## Not recommended for "safe/minimal"

| Change | Reason blocked |
|---|---|
| Webpack 1 → anything | Loader API changed; all loaders (babel, stylus, css, file) would need upgrading simultaneously |
| Babel 6 → 7 | Preset/plugin names changed; Webpack 1 `babel-loader` may not support it |
| acorn 5 → 6 | Webpack 1 minifier (`uglifyjs-webpack-plugin`) depends on acorn 5 |
| `contextIsolation: true` | Requires full preload bridge for 24 `@electron/remote` dependencies; separate multi-week project |
| Fix `createNote`/`attachmentManagement` Jest tests | Pre-existing environment issues with `fs-extra`/`graceful-fs` on Node 22 |
| Mermaid 9 → 10+ | v10+ uses dynamic `import()` which Webpack 1 cannot resolve |
| uuid 8 → 12+ | v13+ is pure ESM, no `main` field; Webpack 1 cannot resolve |

---

## Rollback strategy

Each Tier is one commit. Revert strategy:
- **Tier 1:** `git revert <tier1-commit>` — removes dead deps and restores AVA
- **Tier 2:** Per-component reverts for lifecycle refactors; single-commit revert for React bump
- **Tier 3:** `git revert` removes `enableRemoteModule` change and pins `@electron/remote` back
- **Tier 4:** `git revert <commit-b>` to return to Electron 11; `git revert <commit-a>` to restore `enableRemoteModule`

All commits are independent and do not depend on each other. Tier 1 can be done today.
