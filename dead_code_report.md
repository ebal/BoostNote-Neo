# Dead Code Report

Survey scope: `browser/`, `lib/`, `extra_scripts/`, `index.js`, `package.json`.
Excluded: `node_modules/`, `dist/`, `compiled/`, `tests/`, `resources/`.

Verification: each finding grep-checked against the live source tree. The subagent's original list flagged `identity-obj-proxy` as dead; verification proved it is referenced in `package.json:206` (jest `moduleNameMapper`) and was removed from this report.

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
| `react-transition-group` | dependencies | 0 source references. |
| `react-input-autosize` | dependencies | 0 source references. |
| `merge-stream` | devDependencies | 0 source references. |

`identity-obj-proxy` is **not** dead — used at `package.json:206` (`"\\.(css|less|styl)$": "identity-obj-proxy"`).

## Not dead (platform-conditional)

`lib/main-menu.js:216` `const edit = { ... }` — referenced only on the macOS menu path. Keep.

## Already removed this session

Tracked in commit `d5665846`:

- `prettier.config`
- `contributing.md`
- Some `lib/main-menu.js` entries

Do not re-flag these.

## Suggested removal commit

```
chore: remove dead code

- delete browser/main/lib/Commander.js (no references)
- delete browser/lib/markdown2.js (empty file)
- delete browser/main/lib/notify.js (no references)
- drop _migrateFromV6Storage / _resolveStorageData / _resolveStorageNotes
  wrappers from browser/main/lib/dataApi/index.js
- remove isModalOpen from browser/main/lib/modal.js
- drop unused deps: react-transition-group, react-input-autosize, merge-stream
```
