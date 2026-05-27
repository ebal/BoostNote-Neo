# Excalidraw Integration Plan — BoostNote-Legacy

## Overview

Support Excalidraw-style diagrams (hand-drawn whiteboard drawings) in BoostNote notes. Two modes:

1. **Attached `.excalidraw` files** — user draws externally, drops file into note → renders SVG inline
2. **Fenced block ` ```excalidraw `** (future) — draw/edit directly in the note editor

## Constraints

- Webpack 1 cannot bundle modern ESM — Excalidraw must be a **script external**
- Electron 11 / Chromium 87 — modern enough, sandboxed iframe for preview. (Planned bump to Electron 14.2.9 / Chrome 93 — see `UpgradePlan_Electron11_to_Electron14.md` — would relax this constraint and unlock Excalidraw 0.18.x.)
- React is already present (shared, not bundled) — Excalidraw can share it
- Docker-only build: all deps go via `package.json` + yarn resolutions
- `@excalidraw/excalidraw` v0.18.1: **1.1 MB** minified (344 KB gzipped)
- Only ships ESM — no official UMD build; need to serve from CDN (esm.run / unpkg / jsdelivr) or self-host the production bundle

## Recommended Approach (Phase 1)

**Attach `.excalidraw` files → auto-render SVG inline.** User draws in Excalidraw externally, drops the `.excalidraw` file into BoostNote, and notes reference it via standard image markdown.

### User workflow

```
1. Draw diagram at excalidraw.com  →  Save as drawing.excalidraw
2. Drag/drop drawing.excalidraw into BoostNote
3. Note contains:  ![](::storage/<noteKey>/drawing.excalidraw)
4. Preview detects `.excalidraw` extension → loads JSON → renders SVG
5. SVG replaces the `<img>` tag inline in the preview iframe
```

## File-by-file changes

### Phase 1 — Attached `.excalidraw` rendering

| # | File | Change |
|---|------|--------|
| 1 | `package.json` | Add resolutions to pin `@excalidraw/excalidraw` version; add CDN URL to externals config |
| 2 | `webpack-skeleton.js` | Add `@excalidraw/excalidraw` to `externals` (loaded from CDN, not bundled) |
| 3 | `browser/main/lib/dataApi/attachmentManagement.js` | Add `.excalidraw` extension to `ATTACHMENTS_EXTENSIONS` or equivalent allowlist; handle `.excalidraw` in `copyAttachment()` so the file is stored as a note attachment |
| 4 | `browser/main/lib/dataApi/subTool/attachmentUrlFixer.js` (or `fixLocalURLS`) | After replacing `:storage/...` with file paths, detect `.excalidraw` extension in resolved URLs; instead of `<img src="file:///...">`, load the JSON, render via `exportToSvg()`, and inject `<div class="excalidraw-render">svg</div>` |
| 5 | `browser/components/markdown.styl` | Add `.excalidraw-render` styles (max-width, responsive) |
| 6 | `browser/lib/excalidrawRender.js` (NEW) | Module wrapping `exportToSvg()` from `@excalidraw/excalidraw`. Function `renderExcalidraw(jsonString, theme)` → returns SVG string. Handles parsing, error display, dark/light theme |
| 7 | `browser/components/MarkdownPreview.js` | Query any `.excalidraw-render` elements; theme-aware re-render on theme change (same pattern as mermaid) |

### Phase 2 — ` ```excalidraw ` fenced block (post-Phase-1)

| # | File | Change |
|---|------|--------|
| 8 | `browser/lib/markdown.js` | Register `excalidraw` fence renderer in `markdown-it-fence`: renders `<div class="excalidraw" data-height="..."></div>` with raw JSON content inside |
| 9 | `browser/lib/markdown-it-fence.js` | No changes needed — just add an entry to the `renderers` object |
| 10 | `browser/components/MarkdownPreview.js` | Query `.excalidraw` elements, parse JSON content, call `exportToSvg()`, replace content with SVG |
| 11 | `browser/main/lib/dataApi/formatHTML.js` | Add `addExcalidraw()` export handler: includes Excalidraw script + inline rendering script in exported HTML |

### Phase 3 — Interactive editor (future, complex)

| # | File | Change |
|---|------|--------|
| 12 | `browser/components/ExcalidrawEditor.js` (NEW) | Full Excalidraw widget component (React). Props: `initialData`, `onChange`. Mounts in a modal or replaces the note editor pane |
| 13 | State sync | On diagram save, serialize Excalidraw elements array back to markdown source. Requires two-way binding with the editor buffer |
| 14 | `browser/main/lib/ConfigManager.js` | Config for Excalidraw-specific options (theme, default canvas size) |

## Key implementation details

### SVG render pipeline (Phase 1)

```
markdown:  ![](::storage/<key>/diagram.excalidraw)
         ↓ markdown-it  (html: true)
<img src="::storage/<key>/diagram.excalidraw">
         ↓ attachmentManagement.fixLocalURLS()
<img src="file:///...diagram.excalidraw">
         ↓ excalidrawRender.js (hooks into fixLocalURLS or post-render fix)
  detect .excalidraw extension
  read file via fs / preloaded content
  JSON.parse → elements array
  exportToSvg({ elements, appState })
         ↓ in preview iframe
<div class="excalidraw-render">
  <svg>...</svg>
  <a class="excalidraw-edit-link" href="..." target="_blank">Edit in Excalidraw</a>
</div>
```

### Loading Excalidraw from CDN

In HTML template(s) or `formatHTML.js`:

```html
<script src="https://esm.run/@excalidraw/excalidraw@0.18.1"></script>
<!-- or self-host the dist/prod/ bundle -->
```

Set `window.EXCALIDRAW_ASSET_PATH` to the font CDN path for self-hosted fonts.

### Error handling

If the JSON is invalid or `exportToSvg()` throws:

```html
<div class="excalidraw-error">
  <p>Excalidraw render error: {message}</p>
  <a href="https://excalidraw.com/#json={base64(data)}">Open in Excalidraw</a>
</div>
```

### Theme detection

Pass `appState: { theme: isDark ? 'dark' : 'light' }` to `exportToSvg()` for automatic dark/light SVG output. Detect dark theme the same way Mermaid does (via `uiThemes.some(t => t.name === theme && t.isDark)`).

## Open questions

- [ ] **CDN or self-host?** Self-hosting adds ~1.1 MB to the app bundle; CDN requires internet on first render
- [ ] **Which Excalidraw version?** Latest (0.18.x) may drop Electron 11 compat — may need to pin older (0.15.x or 0.17.x). Resolution: pin older while still on Electron 11; re-evaluate after the Electron 14 bump in `UpgradePlan_Electron11_to_Electron14.md` lands (Chrome 93 lifts the runtime ceiling).
- [ ] **Font handling:** Excalidraw's default Virgil font is loaded from CDN — need to decide if we bundle or hot-link
- [ ] **Attachment flow for `.excalidraw`:** Should the JSON be stored raw (large) or minified? Excalidraw apps use pretty-printed JSON

## Out of scope (Phase 1)

- In-app interactive Excalidraw editor (Phase 3)
- Two-way sync between Excalidraw editor and markdown source
- `.excalidraw` library support (stencils)
- Real-time collaboration
