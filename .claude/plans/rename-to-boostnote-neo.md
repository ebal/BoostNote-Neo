# Rename BoostNote-Legacy → BoostNote-Neo

## Scope

Rename the project from "BoostNote-Legacy" to "BoostNote-Neo" across all user-visible names, documentation, build artifacts, and internal identifiers.

## Naming Convention

| Context | Old | New |
|---------|-----|-----|
| GitHub repo name | `BoostNote-Legacy` | `BoostNote-Neo` |
| Display title | `BoostNote-Legacy` | `BoostNote-Neo` |
| Product name (Electron) | `Boostnote` | `Boostnote Neo` |
| Docker image tag | `boostnote-legacy` | `boostnote-neo` |
| Artifact prefix | `Boostnote-` | `Boostnote-` (unchanged — Electron packager output) |
| Workflow name | `build-boostnote-app.yml` | `build-boostnote-app.yml` (unchanged — internal) |
| Data file `boostnote.json` | `boostnote.json` | **NO CHANGE** — backward compat |
| Config file `.boostnoterc` | `.boostnoterc` | **NO CHANGE** — backward compat |

## Changes by File

### 1. package.json
- `"name": "boost"` → `"name": "boostnote-neo"`
- `"productName": "Boostnote"` → `"productName": "Boostnote Neo"`
- `"description": "Boostnote"` → `"description": "A modernized fork of Boostnote Legacy"`
- `"url": "git+https://github.com/BoostIO/Boostnote.git"` → `"git+https://github.com/A93162639/BoostNote-Neo.git"`
- `"url": "https://github.com/BoostIO/Boostnote/issues"` → `"https://github.com/A93162639/BoostNote-Neo/issues"`
- `"homepage": "https://boostnote.io"` → `"https://github.com/A93162639/BoostNote-Neo"`
- `"boostnote"` keyword → `"boostnote-neo"`

### 2. README.md
- Title: `BoostNote-Legacy` → `BoostNote-Neo`
- Badge URLs: `ebal/BoostNote-Legacy` → `A93162639/BoostNote-Neo`
- Description text: update to describe Neo
- Docker commands: `boostnote-legacy` → `boostnote-neo`
- Artifact paths remain `Boostnote-darwin-*` / `Boostnote-linux-*` (Electron packager output, tied to productName)

### 3. AGENTS.md
- Title: `BoostNote-Legacy` → `BoostNote-Neo`
- Docker command table: `boostnote-legacy` → `boostnote-neo`

### 4. CLAUDE.md
- Docker command table: `boostnote-legacy` → `boostnote-neo`
- All artifact path references: `boostnote-legacy` → `boostnote-neo`

### 5. Dockerfile
- Header comment: `BoostNote-Legacy` → `BoostNote-Neo`
- Comment examples: `boostnote-legacy` → `boostnote-neo`
- Container names in comments: update

### 6. .github/workflows/build-boostnote-app.yml
- Docker tags: `boostnote-legacy` → `boostnote-neo`, `boostnote-legacy-arm64` → `boostnote-neo-arm64`, `boostnote-legacy-linux` → `boostnote-neo-linux`
- Container names: `boostnote-x64` → `boostnote-neo-x64`, etc.
- Artifact names: `boostnote-darwin-x64` → `boostnote-neo-darwin-x64`, etc.
- Release title: `Boostnote v*` → `Boostnote Neo v*`

### 7. lib/main-menu.js
- All `Boostnote` menu labels → `Boostnote Neo`
- `About Boostnote` → `About Boostnote Neo`
- `Hide Boostnote` → `Hide Boostnote Neo`
- `Quit Boostnote` → `Quit Boostnote Neo`
- `BOOSTNOTE_MARKDOWN_CHEAT_SHEET.md` → `BOOSTNOTE_NEO_MARKDOWN_CHEAT_SHEET.md`
- About dialog: `BoostNote` → `Boostnote Neo`

### 8. lib/main.development.html / lib/main.production.html
- `<title>Boostnote</title>` → `<title>Boostnote Neo</title>`

### 9. gruntfile.js
- `name: 'Boostnote'` → `name: 'Boostnote Neo'` (packager name)
- Windows metadata: `FileDescription`, `OriginalFilename`, `ProductName`, `InternalName` → `Boostnote Neo`

### 10. browser/main/modals/PreferencesModal/InfoTab.js
- `Boostnote Legacy {appVersion}` → `Boostnote Neo {appVersion}`

### 11. browser/main/modals/PreferencesModal/index.js
- `Your preferences for Boostnote` → `Your preferences for Boostnote Neo`

### 12. browser/main/modals/PreferencesModal/StorageItem.js
- `Unlinking removes this linked storage from Boostnote.` → `...from Boostnote Neo.`

### 13. browser/main/modals/PreferencesModal/HotkeyTab.js
- `Show/Hide Boostnote` → `Show/Hide Boostnote Neo`

### 14. browser/main/modals/PreferencesModal/UiTab.js
- `Please restart boostnote after you change the keymap` → `...Boostnote Neo...`

### 15. browser/main/SideNav/StorageItem.js
- `This work will just detatches a storage from Boostnote.` → `...Boostnote Neo.`

### 16. browser/main/Main.js
- Default storage dir: `'Boostnote'` → `'Boostnote Neo'`
- Welcome content: `Enjoy Boostnote!` → `Enjoy Boostnote Neo!`
- Welcome title: `Welcome to Boostnote!` → `Welcome to Boostnote Neo!`
- Welcome body text: update all `Boostnote` refs

### 17. browser/main/lib/ConfigManager.js
- `Boostnote resets the invalid configuration.` → `Boostnote Neo resets...`

### 18. browser/lib/RcParser.js
- **NO CHANGE** — `.boostnoterc` is a config file convention, changing breaks existing configs

### 19. browser/lib/wakatime-plugin.js
- `--plugin Boostnote-wakatime` → `--plugin BoostnoteNeo-wakatime`

### 20. lib/ipcServer.js & browser/main/lib/ipcClient.js
- `boostnote.service` → `boostnote-neo.service`

### 21. browser/main/lib/dataApi/*.js
- **NO CHANGE** to `boostnote.json` references — this is a data format contract
- Only change user-visible error messages that mention "Boostnote"

### 22. locales/en.json
- `Please restart boostnote after you change the keymap` → `...Boostnote Neo...`

### 23. dev-scripts/dev.js
- `compiler.hooks.done.tap('boostnote-dev', ...)` → `'boostnote-neo-dev'`

### 24. CHANGELOG.md
- Add a new entry at the top for the rename
- Historical entries referencing "Boostnote" can stay as-is (they describe past events)
- Only update the badge URL line: `ebal/BoostNote-Legacy` → `A93162639/BoostNote-Neo`

### 25. Screenshots (optional)
- `Screenshots/BoostNote_Markdown.png` etc. — rename to `BoostNote_Neo_Markdown.png`
- Update references in README.md and screenshots.md

### 26. File renames (optional)
- `.boostnoterc.sample` → leave as-is (config convention)
- `resources/boostnote-install@2x.png` → leave (dead resource, not used in builds)
- `resources/boostnote-install.gif` → leave (dead resource)

### 27. Test files
- `tests/fixtures/markdowns.js` — update `Welcome to Boostnote!` and `BoostIO/Boostnote` refs
- `tests/lib/__snapshots__/markdown.test.js.snap` — will need snapshot update after fixture changes
- `tests/lib/snapshots/markdown-test.js.md` — same
- `tests/lib/rc-parser.test.js` — leave `.boostnoterc.*` fixture names as-is
- `tests/dataApi/*.test.js` — leave `boostnote.json` refs as-is (data format)
- `tests/lib/html-text-helper.test.js` — `boostnote.io` URLs can stay (external URLs)

## Execution Order

1. **package.json** — productName, description, URLs, keyword
2. **Source code** — all user-visible strings (menus, dialogs, UI text, error messages)
3. **Build config** — Dockerfile, workflow, gruntfile
4. **Documentation** — README, CHANGELOG, AGENTS.md, CLAUDE.md
5. **Tests** — update fixtures, regenerate snapshots
6. **Git** — commit all changes

## What NOT to Rename

- `boostnote.json` — data format contract, breaking change
- `.boostnoterc` — config file convention
- Historical CHANGELOG entries — they describe the past
- External URLs (`boostnote.io`, GitHub issue links in old code comments)
- Screenshot filenames (optional, low priority)
- Dead resource files in `resources/`
