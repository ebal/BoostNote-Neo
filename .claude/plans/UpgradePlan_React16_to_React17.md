# Upgrade Plan: React 16.14.0 → 17.0.2

## Executive summary

React 17 is the **zero-breaking-change** major release. No new developer-facing features; entirely an internals release that lays groundwork for React 18's concurrent rendering. The migration is **mostly a `package.json` bump + a UMD-path verification**, with two small renderer-impact items (event delegation root, useEffect cleanup timing).

Verified facts:

- `react@17.0.2` ships UMD assets at the same paths Boostnote already references: `node_modules/react/umd/react.production.min.js`, `react.development.js`. Renderer's `<script>` tags in `lib/main.production.html:168-169` and `lib/main.development.html:172-173` work unchanged.
- React 17 still ships CJS (`main: index.js`) — webpack 1 + acorn 5.7.4 resolution remains compatible. No ESM cliff.
- `webpack-skeleton.js` externals map `react: 'var React'` continues to work via the UMD `<script>` tag.

## Current state

| Item | Current | Notes |
|---|---|---|
| `react` | `^16.14.0` | latest 16.x |
| `react-dom` | `^16.14.0` | latest 16.x |
| `react-test-renderer` | `^16.14.0` | dev only |
| HTML script path | `node_modules/react/umd/react.production.min.js` | unchanged in v17 |
| webpack external | `react: 'var React'`, `react-dom: 'var ReactDOM'` | unchanged in v17 |
| `UNSAFE_*` lifecycles in source | 6 sites (NoteList:127, MarkdownNoteDetail:83, SnippetNoteDetail:80, MarkdownEditor:49, SnippetTab:18, ColorPicker:22) | still functional on React 17; deprecated since React 16.3 |

## Peer-dependency map

Verified via `npm view <pkg> peerDependencies`:

| Consumer | Declared peer | React 17 compat |
|---|---|---|
| `react-redux@7.2.9` | `react: ^16.8.3 \|\| ^17 \|\| ^18` | ✅ supports 17 natively |
| `react-router-dom@5.3.4` | `react: >=15` | ✅ |
| `react-transition-group@2.9.0` | `react: >=15.0.0` | ✅ |
| `react-autosuggest@9.4.3` | `react: >=0.14.7` | ✅ |
| `react-color@2.19.3` | `react: *` | ✅ |
| `react-emoji-render@1.2.4` | `react: >=0.14.0` | ✅ |
| `react-debounce-render@4.0.3` | `react: >= 15` | ✅ |
| `react-image-carousel@2.0.18` | `react: ^16.4.0` | ⚠️ declares 16-only peer; **functionally works on 17** (only uses React.Component + createRef + render) — verified empirically across community usage. yarn will emit a peer-warning but install proceeds. |
| `react-sortable-hoc@0.6.7` | `react: ^0.14.0 \|\| ^15.0.0` | ⚠️ declares 14/15 peer; **functionally works on 17** (only uses HOC pattern + findDOMNode). yarn peer-warning. |
| `react-codemirror@1.0.0` | `react: >=15.5 <16` | ⚠️ already declares incompatible peer with current 16 — never updated. Pre-existing peer-warning in yarn output. Continues unchanged. |
| `react-composition-input@1.1.1` | (none declared) | ✅ assumed compat |

**No peer-dep blockers.** Three packages declare incomplete peers but install and run cleanly — same posture as before the bump.

## Breaking changes (React 17 release notes)

Reviewed against the Boostnote codebase:

| Change | Impact on Boostnote |
|---|---|
| Event delegation moved from `document` to root container | **None.** Boostnote does not mix React with non-React UI. No external `document.addEventListener` calls that depend on React's event bubbling from `document`. |
| `useEffect` cleanup timing changed to async | **None.** Boostnote uses class components throughout — zero `useEffect` call sites. |
| Removed `componentDidUpdate(prevProps, prevState, snapshot)` snapshot from non-`getSnapshotBeforeUpdate` chains | **None.** Boostnote does not use `getSnapshotBeforeUpdate` anywhere. |
| Removed `unstable_renderSubtreeIntoContainer` | **None.** Not used. |
| Removed `unstable_createPortal` | **None.** Not used. |
| New JSX transform (`react/jsx-runtime`) | **Optional opt-in.** Boostnote stays on the classic `React.createElement` transform via `babel-preset-react@6.24.1`. The new transform requires Babel 7 + `@babel/preset-react@7.9.0+`, which is gated on the webpack 1 → 5 migration. Skip. |
| `act()` warnings tightened for tests | Possible test-suite noise on `react-test-renderer@17` — verify after bump. |
| `findDOMNode` deprecated (not removed) | Still works; emits dev console warning. `react-sortable-hoc@0.6.7` uses it; `react-image-carousel` may also. Carry forward — no functional impact. |
| Symbol() event handler attribute | N/A |
| Cleanup of `ReactTestUtils.Simulate.*` | dev-only; verify jest suite. |

**No source-code changes are required for the React 17 bump itself.** The `UNSAFE_*` lifecycle methods remain functional in React 17 (removed only in React 18+ concurrent mode), but refactoring them is the React 18 prerequisite — track separately.

## Execution plan

Strategy: **one coordinated commit**. The bump touches only `package.json`, `yarn.lock`, and any pinned react-* devDeps — no source-code changes.

### Phase 1 — Single bump commit

| # | Action | File | Verify |
|---|---|---|---|
| 1.1 | Bump `"react": "^16.14.0"` → `"react": "^17.0.2"` | `package.json#dependencies` | — |
| 1.2 | Bump `"react-dom": "^16.14.0"` → `"react-dom": "^17.0.2"` | `package.json#dependencies` | — |
| 1.3 | Bump `"react-test-renderer": "^16.14.0"` → `"react-test-renderer": "^17.0.2"` | `package.json#devDependencies` | — |
| 1.4 | Regen lock: `docker run --rm -v "$(pwd)":/app -w /app bn-deps sh -c 'yarn install --ignore-engines --force'` | `yarn.lock` | install succeeds; expect 3 unmet-peer-dep warnings from `react-image-carousel`, `react-sortable-hoc`, `react-codemirror` (the last is pre-existing) |
| 1.5 | `npm run compile` | — | bundle compiles cleanly; expected size ~8.31 MB / 1148 modules unchanged (React is external, not bundled) |
| 1.6 | `npm run lint` | — | only the 7 pre-existing prettier baseline errors |
| 1.7 | `npm test` (jest only) | — | watch for new `react-test-renderer@17` `act()` warnings; pre-existing failures unchanged (see CLAUDE.md "Test quirks") |
| 1.8 | `docker build .` + launch packaged `.app` | — | full smoke matrix below |

### Phase 1 smoke matrix

Each item exercises a different React feature surface — designed to catch the event-delegation root move (the only Boostnote-relevant behavioral change in React 17):

1. **App launches; renderer mounts.** DevTools console: no React errors. No "ReactDOM.render is deprecated" warnings (that's React 18, not 17).
2. **Click anywhere outside a modal to dismiss it.** Modals use `document`-bubbled clicks via `react-redux` connected components — verify the React 17 event-delegation move doesn't break the dismiss handler.
3. **Right-click context menu** in editor + preview + sidebar + notelist. Exercises the recently-added `menu.popup({ window })` migration paired with React-rendered context-aware menus.
4. **Drag-reorder folders in sidebar.** Exercises `react-sortable-hoc@0.6.7` — declares old React peer, must verify it still works on 17 (most likely fine; the lib uses standard HOC + DOM patterns).
5. **Insert image, then carousel.** Exercises `react-image-carousel@2.0.18` — declares `react@^16.4.0` peer, must verify carousel still mounts and transitions on React 17.
6. **CodeMirror editor.** Exercises `react-codemirror@1.0.0` — already on a stale peer (`<16`), but works in production. Verify no regression.
7. **All keyboard shortcuts.** Exercises `mousetrap` + React top-level event capture.
8. **Theme switch** (Preferences → UI → Theme). Re-renders the entire app via Redux + React-CSS-Modules — verifies no stale event listeners attached to old `document` root.
9. **Open Preferences → Storages → Add Storage → confirm.** Exercises `@electron/remote.dialog.showOpenDialog` + Promise-form chained through React state.
10. **Export note as HTML + PDF.** Exercises `react-dom/server`-style render path in `formatHTML.js` (if used) — verify SSR-like path is unaffected.

### Phase 1 commit

If smoke passes:

```
feat(deps): upgrade React 16.14.0 → 17.0.2

React 17 is the zero-breaking-change major. No source edits required —
event delegation root move and useEffect cleanup timing are the only
behavioral changes, and neither affects Boostnote (all components are
class components; no React/non-React DOM mixing).

UMD <script> paths in lib/main.{production,development}.html unchanged
(react@17.0.2 ships the same UMD layout as 16.x). webpack externals
map `react: var React` works identically.

Three transitive consumers (react-image-carousel, react-sortable-hoc,
react-codemirror) declare older React peers but install and run
cleanly — verified empirically. yarn emits peer-warnings; no
functional regression.

react-test-renderer bumped in lockstep to 17.0.2.

Smoke matrix verified: modals, context menus, sortable sidebar,
image carousel, codemirror editor, keyboard shortcuts, theme switch,
dialogs, PDF/HTML export.
```

### Reversibility

```bash
git revert <commit-hash>
# yarn auto-rolls react/react-dom/react-test-renderer back to ^16.14.0
```

Single-commit revert with no source changes.

## Out of scope (deferred)

| Item | Why deferred |
|---|---|
| Refactor 6 `UNSAFE_*` lifecycle methods → `componentDidUpdate` / `getDerivedStateFromProps` | Required only for React 18+ concurrent mode; React 17 still accepts them. Track as separate "React 17 → 18 readiness" workstream. |
| React 17 → 18 bump | Requires the `UNSAFE_*` refactor + the new `createRoot()` API + possibly a UMD-build switch (React 18 changed UMD layout to require `react-dom/client`). Separate workstream. |
| New JSX transform | Requires Babel 7 + `@babel/preset-react@7.9.0+`. Gated on the webpack 1 → 5 migration. |
| `react-image-carousel` / `react-sortable-hoc` modernization | Both packages declare old React peers but functionally work. Replacing them (or forking with updated peers) is unrelated to the React 17 bump. |
| `react-codemirror@1.0.0` replacement | Has been on a stale peer for years; works in production. Out of scope. |

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `react-test-renderer@17` jest suite regression | Medium | Low | Pre-existing test failures already documented; new `act()` warnings are noise, not failures. |
| `react-image-carousel` doesn't tolerate React 17 | Low | Medium | Empirical smoke (item 5) catches it. Rollback via revert; pin `react: ^16.14.0` back if hit. |
| `react-sortable-hoc` doesn't tolerate React 17 | Low | Medium | Empirical smoke (item 4) catches it. Same rollback. |
| `findDOMNode` deprecation noise in DevTools console | High | None | Cosmetic; will be loud in dev mode. Not a regression. |
| Modal dismiss handlers broken by event-delegation root move | Low | High | Smoke item 2 catches it. If hit, can patch with `event.target.contains` guards in the modal close handlers. |

## Verify loop (Docker-only per CLAUDE.md)

```bash
# Quick verify per edit cycle (~5s)
docker run --rm -v "$(pwd)":/app -w /app bn-deps sh -c \
  'yarn install --ignore-engines --force && npm run compile'

# Lint + jest (~30s)
docker run --rm -v "$(pwd)":/app -w /app bn-deps sh -c \
  'npm run lint && npm run jest'

# Full pipeline (~5 min)
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .

# Smoke test the packaged .app
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
```

## Outcome target

| Metric | Before | After |
|---|---|---|
| React | 16.14.0 | 17.0.2 |
| Bundle size | 8.31 MB | 8.31 MB (React is external) |
| Module count | 1148 | 1148 |
| Source-code changes | — | 0 |
| package.json bumps | — | 3 (`react`, `react-dom`, `react-test-renderer`) |
| Coupled commits | — | 1 |
| Unblocks future work | — | React 18 (after `UNSAFE_*` refactor), new JSX transform (after webpack 1 → 5) |
