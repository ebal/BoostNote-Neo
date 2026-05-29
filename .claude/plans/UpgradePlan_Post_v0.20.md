# Post-v0.20.0 Upgrade Survey

Originally drafted 2026-05-29 after webpack 5 / babel 7 / acorn 8 migration. Most low/medium-risk items have since landed; this file now tracks the **remaining backlog** plus the pinned-cliffs that should never move.

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

| Dep | Current | Latest | Notes |
|---|---|---|---|
| electron-debug | 4.1.0 | 4.1.0 | already latest |
| electron-devtools-installer | 4.0.0 | 4.0.0 | already latest |

(empty otherwise — Tier A bumps from the original survey all landed)

### Tier B — minor-breaking, focused refactor

| Dep | Current | Latest | Refactor |
|---|---|---|---|
| electron-packager | 17.1.2 | n/a | renamed to `@electron/packager@^18`. Drop-in import-path swap; verify gruntfile + Dockerfile call sites. No security urgency. |
| prettier | 2.8.8 | 3.4.2 | v3 formatting diffs (trailing commas default `all`, etc.) — touches every file. Removes the host/Docker prettier-mismatch quirk in CLAUDE.md once host + image both run v3. |
| eslint | 8.57.1 | 9.16.0 | v9 flat config (`eslint.config.js`) + ESM-only. Drop legacy `.eslintrc` + `eslint-config-standard@6`. Full plugin chain re-pin. Pre-commit hook reconfig. Coordinate with prettier 3 if bundling. |

### Tier C — major-breaking, larger refactor

| Dep | Current | Latest | Cost |
|---|---|---|---|
| chart.js | 2.9.4 | 4.4.0 | v3 split into named imports + tree-shaking; v4 axis/scale config rewrite. Touch every chart call site. |
| react | 18.3.1 | 19.0.0 | v19 strict mode + new `use()` hook + deprecated forwardRef path. Bundled ES5 deps (`react-css-modules`, `react-debounce-render`) likely incompatible — same class-constructor cliff that motivates the `targets: { ie: 11 }` babel config. **Blocked** until those deps replaced or modernized. |
| react-router-dom | 5.3.4 | 6.28.0 | v6 removed `Switch`, `Route component`, `useHistory`. Touch every route. Pairs with `connected-react-router` replacement below. |
| connected-react-router | 6.9.3 | (archived) | Replace with `redux-first-router` or manual router-redux glue. Coupled with React Router 6. |
| query-string | 6.14.1 | 9.1.1 | v7+ ESM-only. Used in `newNote.js`, `Detail/*`, `NoteList/index.js`. Either drop (use native `URLSearchParams`) or dynamic `import()`. |

### Tier D — pinned (cliffs — do not bump)

- `raphael 2.2.7` exact — 2.3.0 NaN bug (see CLAUDE.md "Active exact-pin invariants")
- `flowchart.js 1.12.0` exact — 1.12.1+ no UMD
- `codemirror-mode-elixir 1.1.1` exact — 1.1.2 path rename
- `codemirror ^5.65.0` — v6 is a full rewrite, not a bump
- `react-codemirror 1.x` — project archived, no upgrade path, coupled to CM5

## Recommended sequence

1. **prettier 3 + eslint 9 + husky 9** as one PR — big formatting churn but clears the host/Docker mismatch in one shot.
2. **electron-packager → @electron/packager** — trivial.
3. **query-string drop / URLSearchParams swap** — small surface, removes one Tier C item.
4. **chart.js 4** — deferred. Dedicated audit per chart call site.
5. **React 19 + Router 6 + connected-react-router replacement** — deferred bundle. Blocked by ES5 HOC deps; either replace `react-css-modules` / `react-debounce-render` or wait for native-ESM successors.

## Out of scope

- i18n-2 → i18next (full localization rewrite)
- CodeMirror 5 → 6 (full editor rewrite)
