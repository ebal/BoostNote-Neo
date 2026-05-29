# Electron Upgrade Log

## Rules

- Upgrade one Electron major/minor step at a time.
- **All** operations (dependency install, compile, test, lint, package) run inside Docker only. Never run npm/yarn/grunt on the host.
- Delete `./dist/` before every build.
- **Export after every build** — copy the packaged `.app` to the host `./dist/` immediately (see AGENTS.md for exact commands).
- Keep git commits small and reversible.
- The Docker container provides Node 22 (Debian Bookworm). Host Node.js is incompatible.

## Known versions

| App version | Electron | Chrome | Node.js | V8 | Status |
|---|---:|---:|---:|---:|---|
| 0.16.1 | 4.2.12 | 69 | 10.11 | 6.9 | baseline (historical) |
| 0.16.2–0.16.6 | 5.0.13 | 73 | 12.0 | 7.3 | superseded |
| 0.16.7–0.17.31 | 11.5.0 | 87 | 12.18 → 22 (bookworm) | 8.7 → 10.x | superseded |
| 0.18.0–0.18.3 | 14.2.9 | 93 | 14.17 | 9.3 | superseded |
| 0.19.0+ | 42.3.0 | 138 | 22.x | 13.x | **current** |
| 0.20.0+ | 42.3.0 | 138 | 22.x | 13.x | **current** (webpack 5 + babel 7) |

## Iteration history

Per-version source diffs, file-change lists, and rollback commits live in [`CHANGELOG.md`](../../CHANGELOG.md) — the canonical record. Notable Electron / build-system jumps:

- **0.16.2** — Electron 1.x → 5.0.13. `nodeIntegration: true` + `contextIsolation: false` added.
- **0.16.7** — Electron 5 → 11.5.0, native arm64 darwin, electron-packager 12 → 15.
- **0.17.9** — Docker base node:20 → node:22 (bookworm).
- **0.18.0** — Electron 11 → 14.2.9, migrate `electron.remote` → `@electron/remote@^2.1.3` across 23 renderer files.
- **0.19.0** — Electron 14 → 42.3.0 in 4 phases (Chromium 87 → 138, Node 12 → 22). Jest 22 → 27.
- **0.20.0** — Webpack 1 → 5.107.2 + Babel 6 → 7 + acorn 5 → 8 in 7 phases. Cleared 15 open Dependabot alerts.
- **0.20.1** — Babel ES5 target regression fix; css-loader 6 export shape; mermaid 10 `import()` publicPath.

## Next upgrade candidates

See [`UpgradePlan_Post_v0.20.md`](UpgradePlan_Post_v0.20.md) for current dep-bump backlog (tier A/B/C/D).

No Electron major bump planned — 42 is current stable; revisit when Electron ships a new LTS line and `@electron/remote` follows.
