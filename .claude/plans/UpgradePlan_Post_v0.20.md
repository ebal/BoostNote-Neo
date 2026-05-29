# Post-v0.20.0 Upgrade Survey

Originally drafted 2026-05-29 after webpack 5 / babel 7 / acorn 8 migration. Most low/medium-risk items have since landed; this file now tracks the **remaining backlog** plus the pinned-cliffs that should never move.

Build toolchain bumps (babel, loaders, webpack-cli, uuid, jest) added 2026-05-29 —
see **[Tier A](#tier-a--safe-in-major)** through **[Tier C](#tier-c--major-breaking-larger-refactor)** below.

Open Dependabot alerts: **0**.

## Done since the original survey

- `katex` → `^0.16.22` (Tier A — commit `6d1f38d1`)
- `markdown-it` 12.3.2 → `^14.1.1` (Tier A + GHSA #226 — commit `6d1f38d1`, `feb40a04`)
- `mermaid` 10.9.6 → `^11.4.0` (Tier B — commit `b63481f2`)
- `redux` 4.2.1 → `^5.0.1` (Tier B — commit `b63481f2`)
- `react-redux` 8.1.3 → `^9.2.0` (Tier B — commit `b63481f2`)
- `escape-string-regexp` removed, replaced with inline regex (commit `b761f30d`)
- `markdownlint` 0.11.0 → `^0.37.4` via dynamic `import()` (commit `3d51c7b0`)
- `husky` 4.3.8 → `^9.1.7` (commit `17d4790f`)
- `prettier` 1.19.1 → `^2.8.8` + `babel-eslint` parser (commit `dc4017b4`) — partial; v3 still deferred
- `eslint` 4.18.2 → `^8.57.1` + plugin chain modernized (commit `f01782de`) — partial; v9 flat config still deferred
- `semver` GHSA #165 patched via selective resolution (commit `feb40a04`)

## Remaining backlog

### Tier A — safe in-major

| Dep | Current | Target | Notes |
|---|---|---|---|
| webpack | ^5.90.0 | ^5.107.2 | patch/minor within v5 |
| @babel/core | ^7.20.0 | ^7.29.7 | same-major (v7) |
| @babel/preset-env | ^7.20.0 | ^7.29.7 | ditto |
| @babel/preset-react | ^7.20.0 | ^7.29.7 | ditto |
| @babel/register | ^7.22.0 | ^7.29.7 | ditto |
| @babel/eslint-parser | ^7.25.9 | ^7.29.7 | ditto |
| react-redux | ^9.2.0 | ^9.3.0 | minor bump |
| stylus | ^0.62.0 | ^0.64.0 | minor bump |
| cross-env | ^10.1.0 | — | already latest |
| prop-types | ^15.8.1 | — | already latest |
| electron-debug | ^4.1.0 | — | already latest; verify Electron 42 compat or replace (see Tier C) |
| electron-devtools-installer | ^4.0.0 | — | already latest |

### Tier B — minor-breaking, focused refactor

| Dep | Current | Target | Notes |
|---|---|---|---|
| babel-loader | ^8.3.0 | ^10.1.1 | v9/v10 dropped older Node. Webpack 5 OK. Verify ES5 output preserved. |
| css-loader | ^6.10.0 | ^7.1.4 | CSS modules export convention changed. Test `[name]__[local]___[path]` pattern in both webpack configs. |
| style-loader | ^3.3.4 | ^4.0.0 | injection timing changed. Verify global styles. |
| stylus-loader | ^7.1.3 | ^8.1.3 | API options shape may differ. Verify `stylusOptions`. |
| webpack-cli | ^4.10.0 | ^7.0.3 | CLI flags changed in v5+. Check `gruntfile.js` webpack call site. |
| terser-webpack-plugin | (transitive) | ^5.6.1 | add explicit devDep for pinned version |
| uuid | ^11.1.1 | ^14.0.0 | codebase only uses `v4()` — stable across major bumps |
| electron-packager | 17.1.2 | n/a | renamed to `@electron/packager@^18`. Drop-in import-path swap; verify gruntfile + Dockerfile call sites. No security urgency. |
| prettier | 2.8.8 | 3.4.2 | v3 formatting diffs (trailing commas default `all`, etc.) — touches every file. Removes the host/Docker prettier-mismatch quirk in CLAUDE.md once host + image both run v3. |
| eslint | 8.57.1 | 9.16.0 | v9 flat config (`eslint.config.js`) + ESM-only. Drop legacy `.eslintrc` + `eslint-config-standard@6`. Full plugin chain re-pin. Pre-commit hook reconfig. Coordinate with prettier 3 if bundling. |

### Tier C — major-breaking, larger refactor

| Dep | Current | Target | Notes |
|---|---|---|---|
| jest | ^27.5.1 | ^29.7.0 | snapshot format changed; `done` falsy-error; timer mocks default `modern`; `testURL` removed. Regenerate all snapshots. |
| babel-jest | ^27.5.1 | ^29.7.0 | paired with jest |
| jest-environment-jsdom | ^27.5.1 | ^29.7.0 | paired with jest |
| chart.js | 2.9.4 | 4.4.0 | v3/v4 named imports, scale config rewrite. Touch every chart call site. |
| react | 18.3.1 | 19.0.0 | v19 strict mode + new `use()` hook + deprecated forwardRef path. Bundled ES5 deps (`react-css-modules`, `react-debounce-render`) likely incompatible — same class-constructor cliff that motivates the `targets: { ie: 11 }` babel config. **Blocked** until those deps replaced or modernized. |
| react-router-dom | 5.3.4 | 6.28.0 | v6 removed `Switch`, `Route component`, `useHistory`. Touch every route. Pairs with `connected-react-router` replacement below. |
| connected-react-router | 6.9.3 | (archived) | replace with `redux-first-router` or manual router-redux glue. Coupled with React Router 6. |
| query-string | 6.14.1 | 9.1.1 | v7+ ESM-only. Used in `newNote.js`, `Detail/*`, `NoteList/index.js`. Either drop (use native `URLSearchParams`) or dynamic `import()`. |

**Also in Tier C:**

- **json-loader removal** — webpack 5 natively handles JSON. Delete the rule from both `webpack.config.js` and `webpack-production.config.js`. Remove `json-loader` from devDependencies.
- **electron-debug** — `^4.1.0` unmaintained since 2020. Verify Electron 42 compat or replace with inline `process.env.NODE_ENV === 'development'` guard.

### Tier D — pinned (cliffs — do not bump)

- `raphael 2.2.7` exact — 2.3.0 NaN bug (see CLAUDE.md "Active exact-pin invariants")
- `flowchart.js 1.12.0` exact — 1.12.1+ no UMD
- `codemirror-mode-elixir 1.1.1` exact — 1.1.2 path rename
- `codemirror ^5.65.0` — v6 is a full rewrite, not a bump
- `react-codemirror 1.x` — project archived, no upgrade path, coupled to CM5
- `react-sortable-hoc ^0.6.7` — ancient, pinned for React 18 compat
- `react-router-dom ^5.3.4` — pinned until Tier C migration to v6
- `connected-react-router ^6.9.3` — paired with router 5

## Recommended sequence

### Phase 1 — Build toolchain (Tier A + B, lowest risk)

1. **webpack + babel + loaders + uuid** — bump all Tier A + Tier B build deps in one shot. `babel-loader` v10, `css-loader` v7, `style-loader` v4, `stylus-loader` v8, `webpack-cli` v7, `uuid` v14, add `terser-webpack-plugin` explicitly.
2. **json-loader removal** — delete rule + dep while touching webpack configs.
3. **electron-debug** — verify or replace.

**Verify:** compile, lint, test.

### Phase 2 — Jest 27 → 29 (Tier C)

4. **jest + babel-jest + jest-environment-jsdom 27→29** — snapshot regen, timer mock audit.

**Verify:** test, update snapshots, review snapshot diffs.

### Phase 3 — Formatting + lint overhaul (Tier B, deferred)

5. **prettier 3 + eslint 9** — big formatting churn but clears the host/Docker mismatch in one shot. Coordinate with husky 9 (already current).
6. **electron-packager → @electron/packager** — trivial drop-in.

### Phase 4 — Major refactors (Tier C, deferred bundle)

7. **query-string drop / URLSearchParams swap** — small surface, removes one Tier C item.
8. **chart.js 4** — deferred. Dedicated audit per chart call site.
9. **React 19 + Router 6 + connected-react-router replacement** — deferred bundle. Blocked by ES5 HOC deps; either replace `react-css-modules` / `react-debounce-render` or wait for native-ESM successors.

## Out of scope

- i18n-2 → i18next (full localization rewrite)
- CodeMirror 5 → 6 (full editor rewrite)
