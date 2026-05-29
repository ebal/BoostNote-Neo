# Post-v0.20.0 Upgrade Survey

Audit 2026-05-29 after webpack 5 / babel 7 / acorn 8 migration stabilized. Zero open Dependabot alerts. Survey of dep ranges still behind latest; categorized by risk + payoff.

## Tier A — safe in-major patches (low risk, low payoff)

| Dep | Current | Latest | Notes |
|---|---|---|---|
| katex | 0.17.0 | 0.16.22 | 0.17 was never published as stable — downgrade pin to ^0.16.22 |
| markdown-it | 12.3.2 | 14.1.0 | API stable 12→14, mostly internal perf |
| mdurl | 2.0.0 | 2.0.0 | already latest |
| electron-debug | 4.1.0 | 4.1.0 | already latest |
| electron-devtools-installer | 4.0.0 | 4.0.0 | already latest |

## Tier B — minor-breaking with focused refactor

| Dep | Current | Latest | Refactor |
|---|---|---|---|
| mermaid | 10.9.6 | 11.4.0 | v11 API mostly compat; `mermaid.initialize()` config shape minor changes; `render()` Promise API unchanged. Test all diagram types. |
| react-redux | 8.1.3 | 9.1.2 | v9 drops UNSAFE_* warnings, requires React 18+ (we have). Hooks API unchanged. Should be drop-in. |
| redux | 4.2.1 | 5.0.1 | v5 drops UMD bundles, ESM-first; removes `createStore` legacy + `combineReducers` proxy. We use both — straightforward fix. |
| electron-packager | 17.1.2 | n/a | Renamed to `@electron/packager@^18`. Verify electron-packager 17 still works (no security urgency). |

## Tier C — major-breaking, larger refactor

| Dep | Current | Latest | Cost |
|---|---|---|---|
| chart.js | 2.9.4 | 4.4.0 | v3 split into named imports + tree-shaking; v4 axis/scale config rewrite. Touch every chart call site. |
| react | 18.3.1 | 19.0.0 | v19 strict mode + new `use()` hook + deprecated forwardRef path. Bundled ES5 deps (`react-css-modules`, `react-debounce-render`) likely incompatible — same class-constructor cliff that motivated our `targets: { ie: 11 }` babel config. **Blocked** until those deps replaced or modernized. |
| react-router-dom | 5.3.4 | 6.28.0 | v6 removed `Switch`, `Route component`, `useHistory`. Touch every route. `connected-react-router` is unmaintained — pairs with this migration. |
| connected-react-router | 6.9.3 | (archived) | Replace with `redux-first-router` or manual router-redux glue. Coupled with React Router 6. |
| eslint | 4.18.2 | 9.16.0 | v9 flat config + ESM-only. `eslint-config-standard@6` doesn't support modern eslint. Full lint chain rewrite. Pre-commit hook impact. |
| prettier | 1.19.1 | 3.4.2 | v3 formatting diffs (trailing commas, etc.) — touch every file. Disables host/Docker prettier mismatch quirk per CLAUDE.md "Lint / Prettier". |
| markdownlint | 0.11.0 | 0.37.0 | 0.34+ is ESM-only. `CodeEditor.js:31` callback-API. Requires dynamic `await import()`. |
| husky | 4.3.8 | 9.1.7 | v5+ moved hooks to `.husky/`. Pre-commit hook reconfig. |
| query-string | 6.14.1 | 9.1.1 | v7+ ESM-only. Used in `newNote.js`, Detail/*, NoteList/index.js. Either drop (use URLSearchParams) or dynamic import. |
| escape-string-regexp | 1.0.5 | 5.0.0 | v5 ESM-only. Trivial inline replacement (`s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`). |

## Tier D — pinned (CLAUDE.md cliffs documented elsewhere)

- `raphael 2.2.7` exact — 2.3.0 NaN bug
- `flowchart.js 1.12.0` exact — 1.12.1+ no UMD
- `codemirror-mode-elixir 1.1.1` exact — 1.1.2 path rename
- `uuid ^11.1.1` — already at latest (Phase 4)
- `highlight.js ^11.11.1` — already at latest (Phase 4)
- `codemirror ^5.65.0` — v6 is a complete rewrite, not a bump

## Recommended sequence

1. **Tier A first** (mermaid 11, markdown-it 14, katex downgrade). Single PR, low risk.
2. **Tier B paired** (react-redux 9 + redux 5 in one PR, no consumer code change).
3. **escape-string-regexp inline** — 5-min trivial removal.
4. **prettier 3 + eslint 9** — big formatting churn, one PR with reformat. Coordinate with husky 9 hook reconfig.
5. **markdownlint 0.37** — small surface change with dynamic import.
6. **React 19 + Router 6** — deferred. Blocked by ES5 HOC deps (`react-css-modules`, `react-debounce-render`). Either replace those deps or wait for them to ship native ESM.
7. **chart.js 4** — deferred. Affects every Charts integration; needs dedicated audit.

## Out of scope

- React Router 5 → 6 (touches every route, needs paired with connected-react-router replacement)
- i18n-2 → i18next (rewrite localization)
- CodeMirror 5 → 6 (full editor rewrite)
- `react-codemirror 1.x` → no upgrade path (project archived); coupled to CM5
