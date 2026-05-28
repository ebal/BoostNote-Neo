# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Common Changelog](https://common-changelog.org) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.18.1] - 2026-05-28

### Changed

- **Upgrade React 16.14.0 → 17.0.2** ([`200a9fe1`](../../commit/200a9fe1)). Zero breaking changes; React 17 event delegation change (root-scope instead of `document`) has no effect here because BoostNote does not mix React with non-React UI.
- Bump `electron-packager` `^15.4.0 → ^17.1.2` (drops Node 12 support, matches Electron 14 runtime) ([`db4360cb`](../../commit/db4360cb)).
- Bump 4 more in-major patches/minors ([`ad5cb1e1`](../../commit/ad5cb1e1)). Runtime: `markdown-it-emoji ^1.1.1 → ^1.4.0`, `unique-slug 2.0.0 → 2.0.2`. Dev/test: `dom-storage ^2.0.2 → ^2.1.0`. Build-only resolution: `tmp ^0.2.6 → ^0.2.7`.
- Drop unused `merge-stream` devDependency and `fs-jetpack` webpack external ([`8d636047`](../../commit/8d636047)).
- Apply 3 deferred follow-ups from the Electron 14 upgrade: `menu.popup` object form at 3 call sites, `printToPDF` Promise form, `nativeWindowOpen: false` in `webPreferences` to suppress Electron 15 deprecation warning ([`8d15b699`](../../commit/8d15b699)).

## [0.18.0] - 2026-05-27

### Changed

- **Upgrade Electron 11.5.0 → 14.2.9** (Chromium 87 → 93, Node 12 → 14.17, V8 9.3) ([`f147135f`](../../commit/f147135f)). Clears GHSA-3p22-ghq8-v749 (Bluetooth permission CVE, not exploitable in this codebase) and lifts the runtime ceiling that was blocking other dep work (Excalidraw 0.18.x, Mermaid tier B/C, etc.). Shipped as a single coordinated commit — the original two-commit split (swap to `@electron/remote` while still on Electron 11, then bump runtime) is no longer viable because `@electron/remote@1.x` looks up the post-Electron-12 `electron_common_v8_util` binding which doesn't exist on Electron 11, and `@electron/remote@1.x` is then itself rejected by Electron ≥14 at main-process `initialize()`. See `.claude/plans/UpgradePlan_Electron11_to_Electron14.md` for the full investigation.
- Migrate built-in `electron.remote` to `@electron/remote@^2.1.3` across 23 renderer source files + 2 HTML inline scripts ([`f147135f`](../../commit/f147135f)). Drop the `{ remote }` destructure — @electron/remote 2.x exposes `app`, `dialog`, `Menu`, `MenuItem`, `BrowserWindow`, etc. directly on the module export.
- Add `'@electron/remote'` to `webpack-skeleton.js#externals` to bypass webpack 1's `process` shim (module 12, the browser-style `process/browser` polyfill that masks Node's real `process.contextId` / `process._linkedBinding` and breaks the renderer-side context-id lookup) ([`f147135f`](../../commit/f147135f)).
- `lib/main-window.js`: drop `enableRemoteModule: true`, add `require('@electron/remote/main').initialize()` at module load and `.enable(mainWindow.webContents)` per `BrowserWindow` after creation (the latter is mandatory in @electron/remote 2.x, which removed the auto-enable-all-windows behavior of 1.x) ([`f147135f`](../../commit/f147135f)).
- Bump 13 in-major dependency patches/minors across 4 risk tiers ([`b65b3004`](../../commit/b65b3004), [`6d808a4d`](../../commit/6d808a4d)). Runtime: `katex ^0.16.47 → ^0.17.0`, `@rokt33r/season ^5.3.0 → ^5.3.1`, `@rokt33r/markdown-it-math ^4.0.1 → ^4.0.2`, `query-string ^6.13.8 → ^6.14.1`, `nib ^1.1.0 → ^1.2.0`, `react-css-modules ^4.7.9 → ^4.7.11`. Main-process: `node-ipc ^8.1.0 → ^8.10.3`. Dev-only: `electron-debug ^3.2.0 → ^4.1.0`, `electron-devtools-installer ^3.2.0 → ^4.0.0`, `jest-localstorage-mock ^2.2.0 → ^2.4.26`, `mock-require ^3.0.1 → ^3.0.3`, `browser-env ^3.2.5 → ^3.3.0`, `merge-stream ^1.0.0 → ^1.0.1`, `signale ^1.2.1 → ^1.4.0`, `color ^3.0.0 → ^3.2.1`.
- Delete shadow `const { remote } = electron` re-import at `browser/main/NoteList/index.js:1029` and swap `const { shell } = electron` at `:1054` to direct `require('electron')`; drop the now-unused `/* global electron */` eslint comment ([`f147135f`](../../commit/f147135f)).
- Pull `Menu` from `@electron/remote` in `browser/lib/contextMenuBuilder.js` — `Menu`/`MenuItem` are main-process-only modules and not exposed via the renderer's `require('electron')` even with `nodeIntegration: true` ([`f147135f`](../../commit/f147135f)).

### Fixed

- Force `minimatch` to `^3.1.4` via yarn resolutions (CVE-2022-3517 — ReDoS in `braceExpand` via attacker-controlled brace patterns) ([`719b8fe4`](../../commit/719b8fe4)). Empirical test confirmed `glob@3.2.11` uses only `minimatch.Minimatch` + `.set` + `GLOBSTAR` (stable across 0.3 → 3.x), so stylus's build pipeline still compiles cleanly. Collapses three previously-coexisting entries (`minimatch@0.3.0` under stylus's glob chain, `minimatch@3.1.5` under `electron-packager > @electron/asar`, `minimatch@10.2.5` under `@types/minimatch`) to a single hoisted `minimatch@3.1.5`.

### Documentation

- Move plan docs under `.claude/plans/`. Add `Excalidraw.md` (Excalidraw integration plan) and `UpgradePlan_Electron11_to_Electron14.md` (heavily re-investigated during this upgrade — captures the 1.x-on-Electron-11 incompatibility, the `enableRemoteModule` gate on 1.x, the @electron/remote 2.x export shape, the webpack 1 process-shim trap, and the `Menu`/`MenuItem` renderer-vs-main-process distinction) ([`f147135f`](../../commit/f147135f)).
- Update `CLAUDE.md`: remove the deferred Electron 11 → 14 entry from "Skipped CVE bumps"; mark the `minimatch` skip note as applied with the empirical re-test result ([`f147135f`](../../commit/f147135f), [`719b8fe4`](../../commit/719b8fe4)).

### Known follow-ups (deferred)

- `printToPDF({}, cb)` callback form was removed in Electron 12 — PDF export must migrate to the Promise form in `browser/main/lib/dataApi/formatPDF.js:18`.
- `menu.popup(remote.getCurrentWindow())` positional form is deprecated — migrate to object form `menu.popup({ window: remote.getCurrentWindow() })` at three sites: `browser/lib/context.js:9`, `browser/components/CodeEditor.js:110`, `browser/components/MarkdownPreview.js:136`.
- `nativeWindowOpen` default flips `false → true` in Electron 15 — set explicitly in `webPreferences` to suppress the deprecation warning before Electron 15.
- `vm` module deprecation warning in the renderer (transitive consumer, not yet identified).
- `contextIsolation: true` (Phase 3 of the upgrade plan) — separate ~1–2 day refactor.

## [0.17.31] - 2026-05-27

### Added

- Render GitHub-style `> [!NOTE]` / `> [!WARNING]` / `> [!TIP]` / `> [!CAUTION]` alert blockquotes ([`05fb53e9`](../../commit/05fb53e9)).

### Fixed

- Prevent `<details>` from being auto-closed by `sanitize-html` across `html_block` tokens (content rendered outside element, breaking collapse) ([`abf79e43`](../../commit/abf79e43)).
- Correct `naughtyIFrame` hostname lookup (`.index` → `.indexOf`) ([`6fdfb997`](../../commit/6fdfb997)).
- Expand alert CSS inline so light theme colors actually emit ([`29cc5fc0`](../../commit/29cc5fc0)).

### Changed

- Drop `sanitize-html` from dependencies (no longer used) ([`39218129`](../../commit/39218129)).
- Add regression test for `<details>` collapse behavior ([`39218129`](../../commit/39218129)).

## [0.17.30] - 2026-05-26

### Added

- Render ` ```plantuml` fence blocks as PlantUML SVG via server ([`672a85f6`](../../commit/672a85f6)).
- Accept ` ```flow` as alias for ` ```flowchart` fence tag ([`6c4addaf`](../../commit/6c4addaf)).

### Fixed

- Decode HTML entities in plantuml fence content before encoding ([`87a8773e`](../../commit/87a8773e)).
- Guard against Infinity/NaN in mermaid + svg-resize math ([`af9dab77`](../../commit/af9dab77)).
- Pin `raphael` to exact 2.2.7 (regression from bulk bump) ([`acf9a224`](../../commit/acf9a224)).
- Drop `mousewheel`/`DOMMouseScroll` from CodeMirror passive patch in Dockerfile ([`e18708dc`](../../commit/e18708dc)).
- Fix `sanitizeInline` closing-tag handler reading wrong capture group ([`1476af95`](../../commit/1476af95)).

## [0.17.29] - 2026-05-26

### Fixed

- Fix multiple inefficient regular expressions flagged by CodeQL (alerts 14, 15, 16, 24, 28, 32, 36, 39, 41, 43) ([`86a50f09`](../../commit/86a50f09), [`1e41221f`](../../commit/1e41221f), [`084ab2f6`](../../commit/084ab2f6), [`77654c43`](../../commit/77654c43), [`9d40325d`](../../commit/9d40325d), [`277002c0`](../../commit/277002c0), [`14fe3cfa`](../../commit/14fe3cfa), [`434ef376`](../../commit/434ef376), [`9dc6766f`](../../commit/9dc6766f), [`66158735`](../../commit/66158735)).
- Fix bad HTML filtering regexp flagged by CodeQL (alert 20) ([`d6d405ac`](../../commit/d6d405ac)).
- Fix incomplete multi-character sanitization flagged by CodeQL (alert 31) ([`cfa98036`](../../commit/cfa98036)).

### Changed

- Add screenshots and screenshots.md with descriptions ([`5fc6cf16`](../../commit/5fc6cf16)).
- Refresh CLAUDE.md with dependency policy, verify loop, and security backlog ([`0b87495a`](../../commit/0b87495a)).

## [0.17.24] - 2026-05-24

### Fixed

- Force `sockjs` to ^0.3.20 via yarn resolutions (CVE-2020-7693 — DoS on the HMR dev server via malformed `Upgrade: websocket` header) ([`15f5ccbc`](../../commit/15f5ccbc)).
- Force `serve-static` to ^1.16.0 via yarn resolutions (CVE-2024-43800 — template injection / XSS in the redirect HTML body, dev-server only) ([`b15c4047`](../../commit/b15c4047)).
- Force `tmp` to ^0.2.4 via yarn resolutions (GHSA-52f5-9888-hmc6 — arbitrary temp file/directory write via symlink `dir` parameter; affects the `asar` build helpers and inquirer's `external-editor`) ([`01ae1a67`](../../commit/01ae1a67)).
- Force `node-fetch` to ^2.6.7 via yarn resolutions (CVE-2022-0235 redirect info disclosure + CVE-2020-15168 unbounded body DoS; dev/build-only via `isomorphic-fetch`) ([`ba35d819`](../../commit/ba35d819)).
- Force `tough-cookie` to ^4.1.3 via yarn resolutions (CVE-2023-26136 prototype pollution; build-only path via `jsdom` 9 / `request`) ([`ca7a8342`](../../commit/ca7a8342)).

### Changed

- Bump `mermaid` to `~9.1.7` (tier-A target — last 9.x release before the v9.2 monorepo / lazy-load `import()` rewrite that Webpack 1 cannot resolve; 8.x is EOL with several DOMPurify-related XSS advisories) ([`1c34485f`](../../commit/1c34485f)).
- Force `moment` to ^2.30.1 via yarn resolutions (collapses the legacy `^2.10.2` pin pulled in by `chart.js@2.9.4`; patches CVE-2017-18214 ReDoS + CVE-2022-24785 path traversal) ([`40c9efc7`](../../commit/40c9efc7)).

## [0.17.23] - 2026-05-23

### Fixed

- Force `cookie` to ^0.7.0 via yarn resolutions (CVE-2024-47764 — cookie name injection / prototype pollution; dev-only HMR path via `webpack-dev-server` → `express`) ([`f2998c52`](../../commit/f2998c52)).

### Changed

- Bump `highlight.js` to ^10.4.1 (9.x reached end-of-life and is no longer receiving security updates; v10 keeps the `highlightAuto(code, subset)` signature and `res.language` field unchanged. Verified every entry in `browser/lib/CMLanguageList.js` resolves via `hljs.getLanguage(name)` in v10.7.3.) ([`5bc774c0`](../../commit/5bc774c0)).

## [0.17.22] - 2026-05-23

### Fixed

- Fix multiple inefficient regular expressions flagged by CodeQL ([`93fe76ff`](../../commit/93fe76ff), [`bf831ee8`](../../commit/bf831ee8), [`e8fd5085`](../../commit/e8fd5085)).
- Add missing workflow permissions to satisfy CodeQL security analysis ([`651967fb`](../../commit/651967fb)).
- Fix incomplete string escaping in regex preventing ReDoS vulnerability ([`b8f67e84`](../../commit/b8f67e84)).
- Escape pipe characters in fetched URL titles to fix incomplete sanitization vulnerability ([`286c6e8e`](../../commit/286c6e8e)).

### Changed

- Force transitive dependency versions via yarn resolutions: lodash ^4.17.21, json-schema ^0.4.0, qs ^6.5.3, minimist ^1.2.8, y18n ^3.2.2, word-wrap ^1.2.4, json5 ^1.0.2 ([`cbafd647`](../../commit/cbafd647), [`74385f9c`](../../commit/74385f9c), [`0268afd8`](../../commit/0268afd8), [`e1c85cdb`](../../commit/e1c85cdb), [`e5800111`](../../commit/e5800111), [`898377c9`](../../commit/898377c9), [`eb5ab69e`](../../commit/eb5ab69e)).
- Bump `ini` from 1.3.5 to 1.3.8 ([`52b2d4bf`](../../commit/52b2d4bf)).
- Update escapeMarkdownPipe test expectations for backslash-aware escapes ([`b10ba783`](../../commit/b10ba783)).

## [0.17.21] - 2026-05-22

### Fixed

- Use passive event listeners for mousewheel and touch events; strip sourcemaps from production build; remove dead files ([`a663bb7f`](../../commit/a663bb7f)).

### Changed

- Bump `fsevents` from 1.2.4 to 1.2.13 ([`935079e9`](../../commit/935079e9)).
- Bump `uuid` from 3.4.0 to 14.0.0 ([`e3e6da9a`](../../commit/e3e6da9a)).
- Bump `http-proxy` from 1.17.0 to 1.18.1 ([`b4b8348d`](../../commit/b4b8348d)).

## [0.17.20] - 2026-05-21

### Fixed

- Produce `.tar.gz` for macOS and `.zip` for Linux to match extension conventions ([`9b70e27b`](../../commit/9b70e27b)).

### Changed

- Remove `ISSUE_TEMPLATE.md` from repository ([`49a793a7`](../../commit/49a793a7)).
- Update AGENTS.md, UPGRADE.md, CHANGELOG, CODEBASE_ANALYSIS, and license documentation ([`a9d448b6`](../../commit/a9d448b6)).

## [0.17.19] - 2026-05-21

### Fixed

- Patch CodeMirror and react-sortable-hoc to register `touchstart`/`touchmove` listeners as passive, eliminating Chrome [Violation] warnings that block smooth scrolling in the editor ([`4b0d0e72`](../../commit/4b0d0e72)).
- Remove GitHub issue tracker link from Help/About dialog ([`76715b83`](../../commit/76715b83)).

### Changed

- Replace build-macos-dmgs CI workflow with generic build-boostnote-app workflow ([`0612c9ff`](../../commit/0612c9ff)).
- Remove `FUNDING.yml`, `.snapcraft/`, and `.vscode/` directories from repository ([`3893a1eb`](../../commit/3893a1eb)).
- Add comprehensive codebase analysis document ([`b4c17ef6`](../../commit/b4c17ef6)).
- Update badge URLs to point to ebal/BoostNote-Legacy fork ([`2ae17196`](../../commit/2ae17196)).

## [0.17.18] - 2026-05-18

### Added

- Update app icon and logo to differentiate from previous versions ([`f2ea7fa0`](../../commit/f2ea7fa0)).

## [0.17.16] - 2026-05-14

### Removed

- Remove dead `appdmg.json` (DMG creation config), `resources/dmg.icns` (DMG icon), and `resources/boostnote-install.png` (DMG background) — replaced by `.zip` artifact workflow.

### Changed

- Strip dead files from git history via `git-filter-repo` — reduces `.git` size from 23 MB to 18 MB (22 %).
- Fix prettier formatting regression in gruntfile osx task sequence after removing `create-osx-installer`.

## [0.17.15] - 2026-05-14

### Changed

- Rename `readme.md` to `README.md` for case-correct filename on case-sensitive filesystems.
- Update version-bump skill references from `readme.md` to `README.md`.

## [0.17.14] - 2026-05-14

### Removed

- Remove out-of-date `snap/` directory (snapcraft config, desktop entry) — no snap builds maintained.
- Remove unused `FAQ.md` and `TASKS.md` (former session scratchpad).
- Remove `docs/` directory — build/debug guides in 8 languages (2-4% old), no code references.
- Remove 20 non-English locale files — only `en` is registered in `Languages.js`; files were dead.
- Remove stale `.vscode` entry from `.gitignore` — no `.vscode/` directory exists.
- Remove stale `docs/code_style.md` references from `contributing.md`.

## [0.17.13] - 2026-05-14

### Changed

- Remove broken `appdmg`/`.dmg` macOS publishing artifacts; replace with cross-platform `.zip` archives of `.app` bundles.
- Remove `create-dmgs` CI job; simplify workflow to single `build-apps` job exporting all artifacts.

## [0.17.12] - 2026-05-14

### Added

- Add Linux x86_64 tar.gz to Docker build and CI workflow ([`e7bf382c`](../../commit/e7bf382c)).

### Changed

- Pin GHA runner from `ubuntu-latest` to `ubuntu-24.04` for deterministic builds ([`e7bf382c`](../../commit/e7bf382c)).
- Bump GHA actions to Node 24 versions (checkout@v6, setup-qemu@v4, setup-buildx@v4, upload-artifact@v7) ([`e7bf382c`](../../commit/e7bf382c)).
- Fix linux pack target icon from `.icns` to `.png` in gruntfile ([`e7bf382c`](../../commit/e7bf382c)).

### Fixed

- Fix GitHub Actions workflow typo in getting version ([`fb55df08`](../../commit/fb55df08)).

## [0.17.10] - 2026-05-13

### Changed

- Cleanup dead config, fix CoffeeScript string, normalize line endings ([`04e36acc`](../../commit/04e36acc)).
- Fix GitHub Actions workflow to build macOS DMGs ([`693ee354`](../../commit/693ee354)).

### Fixed

- Remove duplicate step ID in build-macos-dmgs workflow ([`d8d36a4d`](../../commit/d8d36a4d)).

## [0.17.9] - 2026-05-11

### Added

- Add GitHub Actions workflow to build macOS DMGs on tag push ([`ce7872aa`](../../commit/ce7872aa)).

### Changed

- Upgrade Docker base image from `node:14-bullseye` to `node:22-bookworm` ([`9e566c3d`](../../commit/9e566c3d), [`9b4e1908`](../../commit/9b4e1908)).
- Bump `cross-env` ^5.2.0 → ^7.0.3 and `concurrently` ^5.3.0 → ^9.1.2 ([`9b4e1908`](../../commit/9b4e1908)).

### Fixed

- Fix test compatibility with Node 22 by replacing `global.navigator` assignment with `Object.defineProperty` getter in 18 test files ([`9b4e1908`](../../commit/9b4e1908)).

## [0.17.8] - 2026-05-10

### Fixed

- Add layout styles for Preferences modal Info tab and Snippet tab to fix content positioning ([`aea7dfd5`](../../commit/aea7dfd5)).

## [0.17.7] - 2026-05-10

### Fixed

- Strip hash fragment from `file://` URIs in context menu builder to prevent `fs.lstatSync` lookup failure on local files with anchors ([`0060dbdf`](../../commit/0060dbdf)).

## [0.17.6] - 2026-05-10

### Fixed

- Guard `spawnUpdate` against null dereference and replace hardcoded `styleSheets` index with a named reference ([`21950811`](../../commit/21950811)).
- Fix `storageNoteMap` key construction, `folderNoteSet` initialization order, and remove spurious backspace key events from tag/note title editors ([`ad275f69`](../../commit/ad275f69)).

## [0.17.5] - 2026-05-10

### Fixed

- Remove dead "File → Update" menu item and auto-update IPC stubs (`update-check`, `update-app-confirm`, `update-cancel`, `update-download-confirm`) that were no-ops ([`fed0e582`](../../commit/fed0e582)).

## [0.17.4] - 2026-05-10

### Fixed

- Fix `TypeError: this.setState is not a function` when pressing Escape in Settings modal by binding `ModalBase.close` in the constructor ([`a3f68cc4`](../../commit/a3f68cc4)).

### Changed

- Update version-bump agent skill to automatically create annotated git tag on version bump ([`56ef200a`](../../commit/56ef200a)).

## [0.17.3] - 2026-05-10

### Fixed

- Fix DevTools CSS source map warnings by removing `?sourceMap` from stylus loader in production webpack config; style-loader was emitting `sourceMappingURL` comments for files that were never generated ([`9d9a5090`](../../commit/9d9a5090)).

### Changed

- Add `build-test-verify` agent skill for Docker-based build, test, and export workflow ([`9d9a5090`](../../commit/9d9a5090)).

## [0.17.2] - 2026-05-10

### Fixed

- Fix font selection in Settings: apply `fontFamily` directly to CodeMirror wrapper element via `getWrapperElement().style.fontFamily` to circumvent CodeMirror's CSS `monospace` override ([`ea1d9289`](../../commit/ea1d9289)).
- Fix CSS quoting in `normalizeEditorFontFamily`: wrap multi-word font names (e.g. `'JetBrains Mono'`) in quotes so CSS parses them as single font family ([`ea1d9289`](../../commit/ea1d9289)).
- Fix crash in Settings when changing any option: guard `this.refs.uiLanguage` which is undefined when language select is hidden (only English) ([`191157ba`](../../commit/191157ba)).

### Removed

- Remove "Custom…" option from Editor Font Family dropdown; font dropdown now lists only concrete fonts ([`ea1d9289`](../../commit/ea1d9289)).

## [0.17.1] - 2026-05-10

### Fixed

- Resolve 3 prettier formatting errors in `UiTab.js` (editor font dropdown introduced in 0.17.0) to restore zero-lint-warning baseline ([`6d8103d4`](../../commit/6d8103d4)).

## [0.17.0] - 2026-05-10

### Removed

- Remove all non-English interface languages from Settings → Interface → Language. Only English remains. Language dropdown is hidden when only one language is available ([`91600e35`](../../commit/91600e35)).
- Delete 19 locale entries from `Languages.js` — all languages except English stripped from the UI selector.

## [0.16.9] - 2026-05-10

### Added

- Add Greek (el_GR) Hunspell dictionary for spellcheck support — new `dictionaries/el_GR/` with affix rules and 828k+ word list from LibreOffice ([`el_GR.aff`](../../dictionaries/el_GR/el_GR.aff), [`el_GR.dic`](../../dictionaries/el_GR/el_GR.dic)).
- Add `version-bump` agent skill (`.agents/skills/version-bump/SKILL.md`) for automated release workflow — updates package.json, CHANGELOG.md, readme.md, and optionally UPGRADE.md.

### Changed

- Rewrite `readme.md` — removed stale upstream links and defunct Travis badge; added current build commands (Docker-only), architecture diagram, tech stack table, and changelog.
- Streamline `contributing.md` to English only with Docker-only policy instructions.
- Clean up `ISSUE_TEMPLATE.md` — removed dead IssueHunt sponsorship link, added Docker build note.

## [0.16.8] - 2026-05-10

### Changed

- Unify `Dockerfile` to support both amd64 (Intel) and arm64 (Apple Silicon) builds via `BUILDARCH` build arg. Base image updated from `node:8.17` to `node:14-bullseye` (matching `Dockerfile.arm64`). Removed separate `Dockerfile.arm64` ([`0ceff414`](../../commit/0ceff414)).
- Merge `arm64` and `intel` branches into `main`; delete both branches locally and on remote.

## [0.16.7] - 2026-05-08

### Added

- Native Apple Silicon (`darwin/arm64`) build target via `Dockerfile.arm64` using `node:14-bullseye` base image.
- `grunt pack:osx-arm64` task — packages Electron 11.5.0 arm64 binary via electron-packager v15.

### Changed

- **arm64 branch**: Upgrade Electron 5.0.13 → 11.5.0 to enable native arm64 darwin binary support.
- **arm64 branch**: Upgrade electron-packager 12 → 15.4.0 (arm64 darwin support added in v15.2.0).
- **arm64 branch**: Upgrade grunt 0.4.5 → 1.6.1 (Node 14 compatibility).
- **arm64 branch**: Upgrade electron-debug 2 → 3.2.0, electron-devtools-installer 2 → 3.2.0.
- Enable `enableRemoteModule: true` in BrowserWindow webPreferences (required in Electron 11).
- Migrate all `dialog.showMessageBox`/`showOpenDialog`/`showSaveDialog` call sites to Electron 11 async/sync API: sync with return value → `showMessageBoxSync`; callback form → Promise (12 files updated).
- Update gruntfile.js electron-packager v15 option names: `version`→`electronVersion`, `app-version`→`appVersion`, `app-bundle-id`→`appBundleId`, `app-category-type`→`appCategoryType`, `version-string`→`win32metadata`; removed deprecated `darwinDarkModeSupport`.

## [0.16.6] - 2026-05-08

### Removed

- Remove `RealtimeNotification` component — fetched BoostIO marketing banners from GitHub at runtime; deleted `RealtimeNotification.js` / `.styl`.
- Remove `Crowdfunding` preferences tab — dead IssueHunt links; deleted `Crowdfunding.js` / `.styl` and tab entry from `PreferencesModal`.
- Remove all auto-update UI remnants: `updateApp()` / `downloadUpdate()` functions and `ipcRenderer.on` update handlers from `browser/main/index.js`; `updateApp()` method and update button from `StatusBar`; `update` eventEmitter listener from `Main.js`; `status` reducer (`UPDATE_AVAILABLE`, `updateReady`) from `store.js`; `autoUpdateEnabled` config key from `ConfigManager.js` and `InfoTab.js`.
- Remove newsletter subscription form from `InfoTab.js` — POSTed to dead `boostmails.boostio.co` endpoint.
- Remove dead Help menu entries (`Boostnote official site`, `Wiki`, `Changelog`) from `lib/main-menu.js`.

### Changed

- Simplify `InfoTab.js` (Preferences → About): removed all external-service state, methods, and forms; now shows app icon, version, GitHub link, and license only.
- Replace welcome note content in `Main.js` with minimal local text (keyboard shortcuts table; no external links).

## [0.16.5] - 2026-05-08

### Removed

- Remove all analytics telemetry: `AwsMobileAnalyticsConfig` module deleted; all `recordDynamicCustomEvent` and `initAwsMobileAnalytics` call sites removed from `newNote.js`, `Main.js`, `CreateFolderModal.js`, `InfoTab.js`, `TagSelect.js`, `SnippetNoteDetail.js`, `MarkdownNoteDetail.js`, `NoteList/index.js`.
- Remove `aws-sdk` and `aws-sdk-mobile-analytics` npm dependencies; yarn.lock updated.
- Remove Analytics settings section from Preferences → About tab (`InfoTab.js`): `amaEnabled` state, checkbox UI, and Save button removed.

## [0.16.4] - 2026-05-08

### Fixed

- Replace `ReactDOM.render()` return-value pattern with `React.createRef()` in `modal.js` ([`7520e750`](../../commit/7520e750)). `ModalBase.close()` now uses `this.setState()` instead of a circular module-level reference.

### Changed

- Rename deprecated `componentWillReceiveProps` / `componentWillUpdate` to `UNSAFE_*` in `ColorPicker`, `SnippetTab`, `SnippetNoteDetail`, `NoteList` ([`7520e750`](../../commit/7520e750)).
- Add `/* global _ */` to `formatHTML.js` — lodash is a runtime global loaded via `<script>` tag, not a bundle import ([`7520e750`](../../commit/7520e750)).
- Disable auto-update: removed `electron-gh-releases` dependency and all updater code from `main-app.js`; manual Update menu item responds with "Auto-update is disabled in this build" ([`e2a9d364`](../../commit/e2a9d364)).
- Show git commit hash in Help → About dialog (`Version: 0.16.4 (abcd1234)`). Requires `--build-arg GIT_COMMIT=$(git rev-parse --short HEAD)` at Docker build time ([`94ea5189`](../../commit/94ea5189)).

## [0.16.3] - 2026-05-08

### Fixed

- Restore checkbox rendering in markdown preview after markdown-it upgrade to 12.x ([`da3b290e`](../../commit/da3b290e)). The `state.parentType` API changed between markdown-it 6 and 12; detection now uses token-stack inspection instead.
- Preserve `yarn.lock` resolved by `yarn install` across `COPY . .` in Docker build ([`a5015282`](../../commit/a5015282)).

### Changed

- Upgrade runtime and test dependencies to latest compatible versions ([`a0d3dc4f`](../../commit/a0d3dc4f), [`ff5cc55e`](../../commit/ff5cc55e)). Pins `fs-extra@^5`, `electron-packager@^12` and `cross-env@^5` due to engine constraints in the Webpack 1 / Node 8 build environment.
- Update KaTeX snapshot for 0.16.x HTML output (`mathdefault` → `mathnormal`, rounded decimal values) ([`da3b290e`](../../commit/da3b290e)).
- Replace deprecated `ReactDOM.findDOMNode` with `React.createRef()` in `FolderItem` color-picker ([`da3b290e`](../../commit/da3b290e)).
- Document Webpack 1 `process` shim constraint in `AGENTS.md` ([`ac5aa149`](../../commit/ac5aa149)).

### Removed

- Remove **For Team (BoostHub)** menu entry and all related code ([`2538915c`](../../commit/2538915c)).

## [0.16.2] - 2026-05-08

### Fixed

- Enable `nodeIntegration` and set `contextIsolation: false` in `BrowserWindow` for Electron 5 compatibility ([`caef2e81`](../../commit/caef2e81)).

### Changed

- Upgrade Electron from 1.x to **5.0.13** (Node.js 12.0.0, Chromium 73) ([`31b87e96`](../../commit/31b87e96)).
- Rewrite `Dockerfile` with multi-stage build (`base` → `deps` → `build`) for reproducible lockfile handling ([`31b87e96`](../../commit/31b87e96)).
- Rewrite `yarn.lock` resolved URLs from Taobao registry to npmjs.org ([`a0d3dc4f`](../../commit/a0d3dc4f)).

## [0.16.1] - 2020-09-04

### Fixed

- Fix unwanted deletion of attachments ([`03495fed`](../../commit/03495fed)).
- Fix Cancel button in update dialog ([`910b8f1b`](../../commit/910b8f1b)).
- Fix Analytics save bug ([`790419ac`](../../commit/790419ac)).
- Fix AutoUpdate not being auto-saved ([`66681dbc`](../../commit/66681dbc)).
- Avoid conflicting styles between inline code and code blocks ([`8706886c`](../../commit/8706886c)).

### Added

- Add update menu item with download confirmation dialog ([`25c97930`](../../commit/25c97930), [`b74f54ec`](../../commit/b74f54ec)).

[0.17.19]: ../../compare/v0.17.18...v0.17.19
[0.17.18]: ../../compare/v0.17.17...v0.17.18
[0.17.16]: ../../compare/v0.17.15...v0.17.16
[0.17.15]: ../../compare/v0.17.14...v0.17.15
[0.17.14]: ../../compare/v0.17.13...v0.17.14
[0.17.13]: ../../compare/v0.17.12...v0.17.13
[0.17.12]: ../../compare/v0.17.10...v0.17.12
[0.17.10]: ../../compare/v0.17.9...v0.17.10
[0.18.1]: ../../compare/v0.18.0...v0.18.1
[0.18.0]: ../../compare/v0.17.31...v0.18.0
[0.17.31]: ../../compare/v0.17.30...v0.17.31
[0.17.30]: ../../compare/v0.17.29...v0.17.30
[0.17.29]: ../../compare/v0.17.28...v0.17.29
[0.17.28]: ../../compare/v0.17.27...v0.17.28
[0.17.27]: ../../compare/v0.17.26...v0.17.27
[0.17.26]: ../../compare/v0.17.25...v0.17.26
[0.17.25]: ../../compare/v0.17.24...v0.17.25
[0.17.24]: ../../compare/v0.17.23...v0.17.24
[0.17.23]: ../../compare/v0.17.22...v0.17.23
[0.17.22]: ../../compare/v0.17.21...v0.17.22
[0.17.21]: ../../compare/v0.17.20...v0.17.21
[0.17.20]: ../../compare/v0.17.19...v0.17.20
[0.17.9]: ../../compare/v0.17.8...v0.17.9
[0.17.8]: ../../compare/v0.17.7...v0.17.8
[0.17.7]: ../../compare/v0.17.6...v0.17.7
[0.17.6]: ../../compare/v0.17.5...v0.17.6
[0.17.5]: ../../compare/v0.17.4...v0.17.5
[0.17.4]: ../../compare/v0.17.3...v0.17.4
[0.17.3]: ../../compare/v0.17.2...v0.17.3
[0.17.0]: ../../compare/v0.16.9...v0.17.0
[0.16.9]: ../../compare/v0.16.8...v0.16.9
[0.16.4]: ../../compare/v0.16.3...v0.16.4
[0.16.3]: ../../compare/v0.16.2...v0.16.3
[0.16.2]: ../../compare/v0.16.1...v0.16.2
[0.16.1]: ../../compare/v0.16.0...v0.16.1
