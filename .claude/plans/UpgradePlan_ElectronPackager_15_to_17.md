# Upgrade Plan: `electron-packager` 15.4.0 → 17.1.2

## Executive summary

`electron-packager` 15 → 17 spans two majors. The **only renderer-impact change** is callback → Promise API conversion in `gruntfile.js` (4 call sites). Everything else is engine bumps + dep refresh that webpack 1 / babel 6 don't touch because `electron-packager` runs at build time only — it never reaches the renderer bundle.

Verified facts:

- `electron-packager@17.1.2` engines: `node >= 14.17.5`. Docker base is `node:22-bookworm` → satisfies.
- Callback signature `packager(opts, function(err, appPath) {...})` was **removed in v16.0.0**. v17 only supports `packager(opts).then(appPaths => …)` / `await packager(opts)`.
- Build-time only — never ships in `.app` artifact. CVE attack surface is the Docker build container only.
- `@electron/asar`, `@electron/get`, `@electron/notarize`, `@electron/osx-sign`, `@electron/universal`, `extract-zip`, `fs-extra`, `parse-author`, `plist`, `rcedit`, `resolve`, `semver`, `yargs-parser` all bumped transitively. None pinned by Boostnote.

## Current state

| Item | Current | Notes |
|---|---|---|
| `electron-packager` | `^15.4.0` | resolved to whatever yarn picked in 15.x line |
| Call sites | 4 in `gruntfile.js` lines 102, 117, 133, 147 | all use the **removed callback form** |
| Other consumers | none | only `gruntfile.js` requires it; no other entry references it |
| Build command | `grunt build:<platform>` invokes `packager(opts, cb)` | Docker `RUN grunt build` step in Dockerfile |
| Output | `dist/Boostnote-darwin-x64/`, `dist/Boostnote-darwin-arm64/`, `dist/Boostnote-linux-x64/` | unchanged |

## Breaking changes by major

### 15.x → 16.0.0 (released 2022-01)

| Change | Impact on Boostnote |
|---|---|
| **Callback API removed** — `packager(opts, cb)` no longer accepted | 🔴 Required edit. All 4 call sites in `gruntfile.js` must migrate to `packager(opts).then().catch()`. |
| Engines: `node >= 12.13.0` (was `>= 10`) | ✅ Docker has 22. |
| Default `download.mirror` URL updated | ✅ — Boostnote does not override `download.mirror`. |
| `electron-prebuilt-compile` support removed | ✅ — Boostnote uses regular `electron` devDep. |
| `prune: true` default unchanged | ✅ — Boostnote explicitly sets `prune: true` (gruntfile.js:81). |
| `derefSymlinks: true` default unchanged | ✅ — Boostnote does not set this option. |

### 16.x → 17.0.0 (released 2023-04)

| Change | Impact on Boostnote |
|---|---|
| Engines: `node >= 14.17.5` (was `>= 12.13.0`) | ✅ Docker has 22. |
| `@electron/notarize@1.x` peer (replaces deprecated `electron-notarize`) | ✅ — Boostnote does not set `osxNotarize` options; notarize is opt-in. |
| `@electron/osx-sign@1.x` peer (replaces deprecated `electron-osx-sign`) | ✅ — Boostnote does not set `osxSign` in gruntfile (CodeSigning is handled separately via host `codesign` per CLAUDE.md). |
| `osx-sign` API: `keychain` option moved | ✅ — Boostnote doesn't use this. |
| `darwinDarkModeSupport` option default removed | ✅ — Boostnote doesn't set it. |
| Type definitions exported (TypeScript users) | N/A — Boostnote is JavaScript. |
| `quiet: true` option default flipped to `false` | ⚠️ — verbose logging during pack; no functional impact, only CI log noise. |

**Net source-code impact**: 4 callback-to-Promise migrations in `gruntfile.js`. Nothing else.

## Execution plan

Strategy: **one coordinated commit**. Bump + 4 callsite edits land together because the lockfile bump alone breaks the build (callback form rejected by v16+).

### Phase 1 — Migrate callsites + bump

| # | Action | File | Verify |
|---|---|---|---|
| 1.1 | Migrate 4 `packager(opts, function(err, appPath) {...})` calls to `.then(appPaths => done()).catch(err => { grunt.log.writeln(err); done(err) })` | `gruntfile.js:102`, `:117`, `:133`, `:147` | — |
| 1.2 | Bump `"electron-packager": "^15.4.0"` → `"^17.1.2"` | `package.json#devDependencies` | — |
| 1.3 | Regen lock: `docker run --rm -v "$(pwd)":/app -w /app bn-deps sh -c 'yarn install --ignore-engines --force'` | `yarn.lock` | install succeeds; expect new transitive entries for `@electron/notarize@1.x`, `@electron/osx-sign@1.x`, `@electron/asar@3.x`, `fs-extra@11.x` (build-time only; does NOT touch renderer) |
| 1.4 | `npm run compile` | — | webpack bundle unchanged (electron-packager doesn't reach renderer) — 8.31 MB / 1148 modules |
| 1.5 | `docker build .` end-to-end | — | full pack pipeline: `grunt build:osx` + `grunt build:osx-arm64` + `grunt build:linux` all succeed via the new Promise form. Verify `dist/Boostnote-darwin-x64/Boostnote.app`, `dist/Boostnote-darwin-arm64/Boostnote.app`, `dist/Boostnote-linux-x64/` are produced. |
| 1.6 | Export and launch packaged `.app` on macOS | — | full smoke matrix below |

### Code migration template (apply 4×)

Each of the 4 sites (gruntfile.js:102, 117, 133, 147) follows the same shape:

```diff
-        packager(opts, function(err, appPath) {
-          if (err) {
-            grunt.log.writeln(err)
-            done(err)
-            return
-          }
-          done()
-        })
+        packager(opts)
+          .then(function(appPaths) {
+            grunt.log.writeln('packaged: ' + appPaths.join(', '))
+            done()
+          })
+          .catch(function(err) {
+            grunt.log.writeln(err)
+            done(err)
+          })
         break
```

Notes:

- `packager()` now resolves with **an array** of output paths (`string[]`), not a single `string`. The Promise form was always this way (v15 callback also got `appPath` as a string when `--all` flag was off, but the Promise form has always returned `string[]`).
- `done(err)` semantics preserved — `done(false)` would also work but `done(err)` carries the error message to grunt's output.
- No `async/await` — keep `.then/.catch` to match the existing function-expression style in `gruntfile.js` and avoid touching the surrounding `grunt.registerTask` callback signature.

### Phase 1 smoke matrix

The Docker build IS the primary smoke — if `docker build .` completes, all 4 callsites worked. Post-build verification on the packaged `.app`:

1. **`docker build .` exit code 0.** Captures `grunt build:osx` + `:osx-arm64` + `:linux` success — confirms the 4 callsite migrations work and `@electron/get` successfully fetched `electron-v14.2.9-{darwin,linux}-{x64,arm64}.zip` via the new transitive chain.
2. **`Boostnote.app` opens.** Verifies `electron-packager` produced a valid `.app` structure — `Info.plist`, `Boostnote.app/Contents/Resources/app/`, `Boostnote.app/Contents/MacOS/Boostnote` binary.
3. **About dialog shows correct GIT_COMMIT.** Verifies the `commit-hash.txt` injection still works through the `prune` step (electron-packager 17 keeps the `prune: true` behavior).
4. **No "Boostnote.app is damaged" / Gatekeeper popup on a fresh open.** Verifies `appBundleId: 'com.maisin.boost'` and `appVersion` from `package.json` were applied — `@electron/osx-sign@1.x` peer didn't break the bundle structure even without explicit `osxSign`.
5. **Native menu (File, Edit, etc.) populates.** Verifies the renderer bundle was included correctly under `Resources/app/compiled/main.js` (electron-packager copies it from the build stage; bug in `ignore` regex would break this).
6. **arm64 build via separate Docker invocation produces `dist/Boostnote-darwin-arm64/Boostnote.app`.** Verifies `arch: 'arm64'` + `platform: 'darwin'` still wire up correctly through the Promise form.
7. **Linux build produces `dist/Boostnote-linux-x64/Boostnote`.** Verifies `platform: 'linux'` + `electron-v14.2.9-linux-x64.zip` fetch path.

### Phase 1 commit

If smoke passes:

```
chore(build): upgrade electron-packager 15.4.0 → 17.1.2

electron-packager 16.0.0 removed the callback signature
`packager(opts, cb)` in favor of Promise-only API. All 4 call sites in
gruntfile.js (the only consumer) migrated to `packager(opts).then().catch()`.

Engine requirements: node >= 14.17.5 (v17 floor). Docker base node:22
satisfies easily.

Transitive bumps:
- @electron/notarize@1.x (replaces deprecated electron-notarize)
- @electron/osx-sign@1.x (replaces deprecated electron-osx-sign)
- @electron/asar@3.x
- @electron/get@2.x
- @electron/universal@1.x
- fs-extra@11.x (build-time only; renderer fs-extra still pinned at ^5.0.0)
- extract-zip@2.x, plist@3.x, rcedit@3.x, yargs-parser@21.x

Build-time only: electron-packager is never bundled into the .app
artifact; webpack-1 cliff and renderer constraints are not affected.

Bundle compiles unchanged at 8.31 MB / 1148 modules.

Pack pipeline verified end-to-end via `docker build .`:
- dist/Boostnote-darwin-x64/Boostnote.app produced ✓
- dist/Boostnote-darwin-arm64/Boostnote.app produced (separate
  `docker build --platform linux/arm64`) ✓
- dist/Boostnote-linux-x64/ produced ✓

Smoke: app launches, About dialog shows GIT_COMMIT, native menu
populates, no Gatekeeper "damaged" warning on fresh open.
```

### Reversibility

```bash
git revert <commit-hash>
# yarn rolls electron-packager back to ^15.4.0
# gruntfile.js callsites restored to callback form
```

Single-commit revert. No state outside `package.json` / `yarn.lock` / `gruntfile.js`.

## Cross-cutting concerns

### Dockerfile interaction

Per CLAUDE.md, `RUN sed -i` patches at lines 64, 68, 74 modify `node_modules/codemirror/lib/codemirror.js` etc. before pack. These run **after** `yarn install` and **before** `grunt build`. The order is preserved — electron-packager 17 does not change the timing of patches. Verify:

```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
docker run --rm boostnote-legacy grep -c "passive: true" node_modules/codemirror/lib/codemirror.js
# expect: 1
```

### `ignore` regex pattern

The `ignore` regex at gruntfile.js:84 prevents electron-packager from copying `node_modules/ace-builds/`, `browser/`, `secret/`, `.babelrc`, `.gitignore`, `.gitmodules`, `gruntfile.js`, `readme.md`, `webpack*`, and `node_modules/grunt/` into the `.app`. The regex syntax is `RegExp`, not a glob — electron-packager 17 preserves this contract. No edit needed.

### `appVersion` + `electronVersion`

Both still read from `package.json` via `grunt.config.get('pkg.version')` and `grunt.config.get('pkg.config.electron-version')`. electron-packager 17 reads `electronVersion` identically to 15.x. After the v0.18.x release the config carries `"electron-version": "14.2.9"` — `@electron/get@2.x` will fetch the matching binary.

### CodeSigning

`secret/auth_code.json` parsing in gruntfile.js:9 stays unchanged. electron-packager 17 does not require `osxSign` to be set (it's optional). Boostnote's CodeSigning is handled by the host `codesign` step post-pack per CLAUDE.md, not inside electron-packager's `osxSign` option — no electron-packager 17 osx-sign breakage.

## Verify loop (Docker-only per CLAUDE.md)

```bash
# Edit gruntfile.js + package.json, then:

# Quick re-pack (~3-5 min total for full pipeline)
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .

# Or, if iterating just the gruntfile and want fast feedback,
# step through inside the deps image:
docker run --rm -v "$(pwd)":/app -w /app bn-deps sh -c '
  yarn install --ignore-engines --force &&
  npm run compile &&
  ./node_modules/.bin/grunt build:osx
'

# Export & launch
docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
open ./dist/Boostnote-darwin-x64/Boostnote.app
```

## Out of scope

| Item | Why deferred |
|---|---|
| Switch to `@electron-forge/cli` | Forge 6+ is a much larger packaging migration; Boostnote's current `grunt build` + `electron-packager` pattern is fine and well-tested. |
| Enable `osxNotarize` | Requires Apple Developer credentials in CI and a TeamID. Out of scope for the legacy app distribution model. |
| Enable `osxSign` via electron-packager | Boostnote's existing host-side `codesign` step works and is documented. Don't move it. |
| Add `--prune=false` to keep dev deps in the bundle | Current `prune: true` is correct — no reason to ship dev deps. |
| Migrate to ES modules in `gruntfile.js` | Gruntfile is CJS by convention. No benefit. |

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@electron/osx-sign@1.x` peer rejects unsigned build | Low | Medium | Boostnote's `gruntfile.js` does not pass `osxSign` option — `@electron/osx-sign` is loaded but never invoked. Verify by `docker build .` — if the build completes without "missing identity" errors, fine. |
| `@electron/get@2.x` fails to fetch `electron-v14.2.9-darwin-arm64.zip` due to a new checksum format | Low | High | Empirical: `@electron/get@2.x` has been the de-facto fetcher since Electron 14's release. Should work. If it doesn't, fall back to setting `download.mirror` to a known-good mirror. |
| `.app` structure changed in v17 in a way that breaks the host `codesign` step | Low | High | Inspect packaged `.app` structure under `Contents/`; should be identical to v15 output. If anything moved, update `codesign` invocation (out of scope of this commit). |
| `prune: true` in v17 is more aggressive and drops a runtime dep | Low | Medium | The `node_modules/` left in the packaged `.app` should match Boostnote's runtime deps. Smoke item 5 (native menu populates) catches gross omissions. If a renderer-runtime dep gets pruned that shouldn't be, add explicit `"dependencies": { … }` entry. |
| Verbose logging during build (`quiet: true` default flipped) | High | None | Cosmetic CI log noise. Optionally pass `quiet: true` in `opts` to silence. |

## Outcome target

| Metric | Before | After |
|---|---|---|
| `electron-packager` | 15.4.0 | 17.1.2 |
| Build pipeline | callback form | Promise form |
| `gruntfile.js` callsites edited | — | 4 |
| `package.json` bumps | — | 1 (electron-packager) |
| Runtime bundle delta | — | 0 (build-time only) |
| Coupled commits | — | 1 |
| CVE alerts cleared | — | several transitives (notarize, osx-sign, asar, get) advance to maintained majors |
| Unblocks future work | — | none directly; positions for eventual `electron-forge` evaluation if needed |
