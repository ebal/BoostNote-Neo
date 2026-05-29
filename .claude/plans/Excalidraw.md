# Excalidraw Integration Plan — BoostNote-Neo

## Overview

Support Excalidraw-style diagrams (hand-drawn whiteboard drawings) in BoostNote notes. Two modes:

1. **Attached `.excalidraw` files** — user draws externally, drops file into note → renders SVG inline
2. **Fenced block ` ```excalidraw `** (future) — draw/edit directly in the note editor

## Constraints

- Webpack 5 + Babel 7 — modern ESM bundles fine. Excalidraw can be bundled directly via `import` or kept as a `<script>` external for bundle-size reasons (see Open questions).
- Electron 42.3.0 / Chromium 138 / Node 22.x — no runtime ceiling; any current Excalidraw release works.
- React 18.3.1 is already present (shared as runtime external, not bundled) — Excalidraw can share it (peer-supports React 17/18; v19 not yet).
- Docker-only build: all deps go via `package.json` + yarn resolutions.
- `@excalidraw/excalidraw` v0.18.1: **1.1 MB** minified (344 KB gzipped).
- ESM-only — no official UMD build; either bundle through webpack 5 or serve via CDN (esm.run / unpkg / jsdelivr).

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
| 2 | `webpack-skeleton.js` | Either add `@excalidraw/excalidraw` to `externals` (CDN load, smaller bundle) **or** bundle directly via `import` (webpack 5 handles the ESM-only entry). Decide per Open questions below. |
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

- [ ] **CDN, self-host, or bundle?** Bundling via webpack 5 import adds ~1.1 MB to `compiled/main.js`; CDN load requires internet on first render but keeps the bundle smaller; self-host (copy production bundle into the .app) is offline-safe but still adds to install size.
- [ ] **Which Excalidraw version?** Latest stable on the 0.x line (no runtime gate post-Electron-42); pin via yarn resolution.
- [ ] **Font handling:** Excalidraw's default Virgil font is loaded from CDN — bundle or hot-link?
- [ ] **Attachment flow for `.excalidraw`:** Store JSON raw (large) or minified? Excalidraw apps use pretty-printed JSON.

## Out of scope (Phase 1)

- In-app interactive Excalidraw editor (Phase 3)
- Two-way sync between Excalidraw editor and markdown source
- `.excalidraw` library support (stencils)
- Real-time collaboration
