# Dead Code Report

Re-audit 2026-05-28 against current main (post 0.18.3). Survey scope:
`browser/`, `lib/`, `extra_scripts/`, `tests/helpers/`, `index.js`,
`package.json`. Excluded: `node_modules/`, `dist/`, `compiled/`,
`resources/`.

Verification: each finding grep-checked against the live source tree.

## High confidence — safe to delete

| Path | Reason |
|---|---|
| `tests/helpers/setup-browser-env.js` | Was AVA's `require` array entry. After the AVA → Jest migration (`dd91f210`) jest no longer loads it — zero consumers in `tests/`, `browser/`, or `package.json#jest.setupFiles`. The browser DOM globals it set up are now provided by jest-environment-jsdom by default. |
| `tests/helpers/setup-electron-mock.js` | Was AVA's `require` array entry. Replaced by `__mocks__/@electron/remote.js` (jest auto-mock). Zero consumers post AVA → Jest migration. |

## Medium confidence — dead exports / wrappers (underlying modules live)

`browser/main/lib/dataApi/index.js:27-29` exposes three private aliases
that are never accessed through the `dataApi` facade:

```js
_migrateFromV6Storage: require('./migrateFromV6Storage'),
_resolveStorageData:   require('./resolveStorageData'),
_resolveStorageNotes:  require('./resolveStorageNotes'),
```

- `grep -rn 'dataApi\\._'` → 0 hits across `browser/` and `lib/`.
- The underlying files are still imported directly by
  `resolveStorageData.js`, `createFolder.js`, `deleteFolder.js`,
  `init.js`, `reorderFolder.js`, `updateFolder.js`. Only the wrapper
  attributes are dead; do not delete the underlying files.

`browser/main/lib/modal.js:76` `isModalOpen()` — exported via the
default object at `:83` as `isOpen`. No caller invokes
`modal.isOpen()` or `isModalOpen()` anywhere. `openModal` /
`closeModal` remain active. The internal helper can be removed
together with the `isOpen` export key.

## Unused dependencies in `package.json`

| Package | Section | Removal note |
|---|---|---|
| `browser-env` | devDependencies | Only consumed by `tests/helpers/setup-browser-env.js` (dead). Cascade-drop when that helper is deleted. |
| `mock-require` | devDependencies | Only consumed by `tests/helpers/setup-electron-mock.js` (dead). Cascade-drop when that helper is deleted. |

## Not dead (platform-conditional or jest-config indirection)

- `lib/main-menu.js` macOS-only `edit` menu block — referenced only on
  the macOS menu path. Keep.
- `identity-obj-proxy` (devDep) — referenced in `package.json#jest.moduleNameMapper`
  for CSS / less / stylus module stubbing. Keep.
- `jest-localstorage-mock` (devDep) — referenced in
  `package.json#jest.setupFiles`. Keep.
- `tests/jest.js` — referenced in `package.json#jest.setupFiles`. Keep.
- `jsdom@^9` (direct devDep) — every migrated dataApi test file at
  `tests/dataApi/*.test.js:3-4` uses
  `require('jsdom').jsdom('<body></body>')` (legacy v9 API).
  jest-environment-jsdom@22 internally uses jsdom@11.x; the direct
  devDep is only consumed by the manual `global.document` setup in
  the migrated test files. Migrating these tests to jest's
  `@jest-environment jsdom` directive would drop the jsdom@9 dep but
  needs a multi-file refactor — track separately.

## Already removed in earlier sweeps (do not re-flag)

| Commit | Removed |
|---|---|
| `3fc09773` | `devtron` (deprecated Electron debug panel) |
| `42beb236` | `redux-devtools`, `redux-devtools-dock-monitor`, `redux-devtools-log-monitor` |
| `ea8f537d` | `standard` CLI (kept `eslint-plugin-promise@^3.4.2` as explicit devDep) |
| `769fcf13` | `concurrently` |
| `0d05c0af` | `react-input-autosize` |
| `b600c319` | `immutable` (production dep; `browser/lib/Mutable.js` is the native Map/Set wrapper despite the name) |
| `8d636047` | `merge-stream` (devDep) + `fs-jetpack` webpack external |
| `dd91f210` | `ava` (devDep) + 14 orphaned `*-test.js` files migrated to jest |
| (earlier) | `browser/main/lib/Commander.js`, `browser/lib/markdown2.js`, `browser/main/lib/notify.js` — confirmed absent from current tree |

The earlier `prettier.config` / `contributing.md` / `lib/main-menu.js`
cleanups predate the visible git log on this branch — restore recipes,
where they still exist, live in CLAUDE.md under "Removed dev-only deps
(dead code)".

`react-transition-group` was flagged dead in the prior report's
"unused deps" section but proved to be a runtime peer of
`react-image-carousel@2.0.18` (used at
`browser/components/MarkdownPreview.js:38`). Empirically validated
during the dead-dep sweep — removing it broke the webpack build. Kept
in dependencies; this entry corrects the false positive.

## Suggested removal commit

```
chore: remove dead code

- delete tests/helpers/setup-browser-env.js (post AVA→Jest, zero consumers)
- delete tests/helpers/setup-electron-mock.js (replaced by __mocks__/@electron/remote.js)
- drop _migrateFromV6Storage / _resolveStorageData / _resolveStorageNotes
  wrappers from browser/main/lib/dataApi/index.js
- drop isModalOpen + isOpen export from browser/main/lib/modal.js
- drop browser-env devDep (cascaded from setup-browser-env removal)
- drop mock-require devDep (cascaded from setup-electron-mock removal)
```
