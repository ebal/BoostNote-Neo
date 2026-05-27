# Dead Code Report

Survey scope: `browser/`, `lib/`, `extra_scripts/`, `index.js`, `package.json`.
Excluded: `node_modules/`, `dist/`, `compiled/`, `tests/`, `resources/`.

Verification: each finding grep-checked against the live source tree. The subagent's original list flagged `identity-obj-proxy` as dead; verification proved it is referenced in `package.json:195` (jest `moduleNameMapper`) and was removed from this report.

## High confidence — safe to delete

| Path | Reason |
|---|---|
| `browser/main/lib/Commander.js` | Default export `{bind, release, fire}`. Zero `require`/`import` references in the repo. |
| `browser/lib/markdown2.js` | Empty 0-byte file. No references. |
| `browser/main/lib/notify.js` | Default export `notify`. Zero references. |

## Medium confidence — dead wrappers (underlying modules live)

`browser/main/lib/dataApi/index.js:27-29` exposes three private aliases that are never accessed through the `dataApi` facade:

```js
_migrateFromV6Storage: require('./migrateFromV6Storage'),
_resolveStorageData:   require('./resolveStorageData'),
_resolveStorageNotes:  require('./resolveStorageNotes'),
```

- `grep -r 'dataApi\._'` → 0 hits.
- The underlying files are still imported directly by `resolveStorageData.js`, `createFolder.js`, `deleteFolder.js`, `init.js`, `reorderFolder.js`, `updateFolder.js`. Only the wrapper attributes are dead; do not delete the files.

`browser/main/lib/modal.js:76` `isModalOpen()` — exported via the default object as `isOpen`. No caller invokes `modal.isOpen()` or `isModalOpen()` anywhere. `openModal` / `closeModal` remain active.

## Unused dependencies in `package.json`

| Package | Section | Note |
|---|---|---|
| `react-transition-group` | dependencies | 0 source references in `browser/`, `lib/`, `index.js`. |
| `merge-stream` | devDependencies | 0 source references in `browser/`, `lib/`, `index.js`, `gruntfile.js`, `dev-scripts/`, `webpack*.js`. |

`identity-obj-proxy` is **not** dead — used at `package.json:195` (`"\\.(css|less|styl)$": "identity-obj-proxy"`, the jest `moduleNameMapper` entry).

## Not dead (platform-conditional)

`lib/main-menu.js:216` `const edit = { ... }` — referenced only on the macOS menu path. Keep.

## Already removed (do not re-flag)

Dev-only deps cleaned up across the 0.17.19 → 0.17.27 hardening sweep, each in its own commit. The restore recipes for these live in `CLAUDE.md` under "Removed dev-only deps (dead code)":

| Commit | Removed |
|---|---|
| `3fc09773` | `devtron` (deprecated Electron debug panel; was only in `webpack-skeleton.js#externals`) |
| `42beb236` | `redux-devtools`, `redux-devtools-dock-monitor`, `redux-devtools-log-monitor` (dev panel; `browser/main/DevTools/index.{dev,prod}.js` collapsed to single no-op stub) |
| `ea8f537d` | `standard` CLI (kept `eslint-plugin-promise@^3.4.2` as explicit devDep because it was hoisted from standard's nested copy) |
| `769fcf13` | `concurrently` (no `npm` script, no grunt task, no source ref) |
| `0d05c0af` | `react-input-autosize` (no `browser/` or `lib/` import) |
| `b600c319` | `immutable` (production dep; never imported — `browser/lib/Mutable.js` is a native `Map`/`Set` wrapper despite the name; `connected-react-router` has it as optional peer and resolves it to 4.3.8 through that range) |

The earlier `prettier.config` / `contributing.md` / `lib/main-menu.js` cleanups predate the visible git log on this branch — the referenced commit `d5665846` is no longer reachable. Do not try to recover it.

## Suggested removal commit

```
chore: remove dead code

- delete browser/main/lib/Commander.js (no references)
- delete browser/lib/markdown2.js (empty file)
- delete browser/main/lib/notify.js (no references)
- drop _migrateFromV6Storage / _resolveStorageData / _resolveStorageNotes
  wrappers from browser/main/lib/dataApi/index.js
- remove isModalOpen from browser/main/lib/modal.js
- drop unused deps: react-transition-group, merge-stream
```
