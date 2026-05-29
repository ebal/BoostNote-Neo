---
name: dep-resolve
description: >
  Automates CVE patch resolution for transitive npm dependencies via yarn
  resolutions. Given a vulnerable dependency name and target patched version,
  investigates the dependency tree, checks for breaking changes, applies the
  resolution to package.json (chronological insertion at end of the
  resolutions block), regenerates yarn.lock via the bn-deps quick-verify
  image, runs the compile smoke, optionally runs the full docker build for
  build-time deps, updates CLAUDE.md when warranted, and commits.
  Trigger: "resolve CVE", "patch dep", "force dep X to Y", "investigate dep".
---

# Dependency CVE Resolution Workflow

## Constraints (read first)

- **Docker-only policy.** Never run `npm` / `yarn` / `electron` / `grunt` / `node` on the host. Allowed host commands: `git`, `docker`, `codesign`.
- **yarn is canonical**, not npm. The lockfile is `yarn.lock`. `npm install` is wrong — it would generate `package-lock.json` and never touch `yarn.lock`.
- **Toolchain (post-v0.20.0):** webpack 5 + babel 7 + acorn 8. The legacy ESM / acorn cliffs that blocked uuid 10+, mermaid 10+, highlight.js 11+, json5 2+ are gone — every previously-blocked major has since landed. Still inspect the target's `package.json` `main` / `type` / `exports` fields before a major bump, since pure-ESM packages that only ship `.mjs` may still require `resolve.extensions` adjustments in `webpack-skeleton.js` (see the `markdown-it/lib/token.mjs` case in CLAUDE.md).
- **Hard exact-pin invariants** — see CLAUDE.md "Active exact-pin invariants" (`raphael 2.2.7`, `flowchart.js 1.12.0`, `codemirror-mode-elixir 1.1.1`). Re-adding `^` to any of these breaks the build at next `yarn install --force`.

## Steps

### 1. Locate current version + map consumers

Fast path — grep `yarn.lock` directly (no docker round-trip needed):

```bash
grep -nE "^<dep-name>@" yarn.lock
awk '/^[a-zA-Z@]/{pkg=$0} /^    "?<dep-name> /{print pkg" -> "$0}' yarn.lock
```

Trace the consumer chain upward to a top-level entry in `package.json` (`dependencies` or `devDependencies`). Record:

- Current resolved version(s) — there may be multiple if different consumers pin different majors.
- The chain of parents (transitive path).
- Whether a resolution already exists in `package.json` → `resolutions` (bumping an existing entry is allowed; do not abort).

### 2. Classify scope

Determines verify depth + commit-message scope tag:

- **Renderer / runtime-touching** — bundled into `compiled/main.js` or loaded via `webpack-skeleton.js#externals` at Electron runtime. Highest stakes. Examples: `lodash`, `moment`, `highlight.js`, `dompurify`, `markdown-it`, `mermaid`, `codemirror`.
- **Build-time only (loader / packager chain)** — used by webpack loaders, electron-packager, `@electron/get`, etc. Never enters the shipped binary. Examples: `json5`, `node-fetch`, `tough-cookie`, `got`, `tar`.
- **Dev-server (HMR) only** — used by `webpack-dev-server@5` middleware. Constant-folded out of the production compile. Examples: `cookie`, `serve-static`, `sockjs`.

### 3. Check breaking-change surface

- **Patch bump within same minor** (`0.2.0` → `0.2.2`) — safe, accept.
- **Minor bump within `^` range** — safe unless changelog calls out a behavior change in the surface actually called by the consumer.
- **Major bump** — read release notes between current and target. For renderer-touching deps, audit every call site in `browser/` and `lib/`. For build-only, the worst case is build break, which `docker build .` catches.
- **ESM-only shape check** — `curl -s https://registry.npmjs.org/<dep>/<target> | jq '.main, .type, .exports'`. Webpack 5 handles ESM natively, but a target that ships only `.mjs` may still need `resolve.extensions` updated (see `markdown-it/lib/token.mjs` in CLAUDE.md "Outstanding security work" §1).

### 4. Pick range syntax

Match the existing project convention — do NOT blindly default to `^`:

- `^X.Y.Z` — default for most deps (caret = same major).
- `~X.Y.Z` — tilde when capping at a minor (used when an intra-major release is known to regress).
- Bare `X.Y.Z` — exact pin only when required (`raphael`, `flowchart.js`, `codemirror-mode-elixir` — see CLAUDE.md "Active exact-pin invariants").

For companion deps that fix a sub-tree, use the selective form `"<parent>/<child>": "^X.Y.Z"` instead of a global resolution (example: `"markdownlint/markdown-it": "14.1.1"` in CLAUDE.md §1).

### 5. Add resolution to `package.json`

Append at the **end** of the `resolutions` block. Project convention is insertion-ordered (chronological), not alphabetical — keep the audit history readable.

```json
"<dep-name>": "^<target-version>"
```

### 6. Regenerate yarn.lock + smoke

Use the quick-verify loop from CLAUDE.md. This is the only correct command — every flag matters:

```bash
docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps \
  sh -c 'yarn install --ignore-engines --force && npm run compile'
```

- `-v "$(pwd)":/app` — bind-mount host repo so `yarn.lock` is rewritten on the host filesystem. Without this the lock change is lost when the container exits.
- `-v /app/node_modules` — anonymous volume preserves the container's pre-installed `node_modules`, so yarn doesn't reinstall the world.
- `--force` — defeats CLAUDE.md's "stale-deps trap": yarn may otherwise decide the lockfile is satisfied and skip the rewrite, leaving the new resolution inert.
- `--ignore-engines` — silences peer-dep noise from the few remaining deps with strict Node-version peers.
- `npm run compile` — fastest reliable signal (~5s) that the dep change has not broken the webpack bundle.

Confirm afterwards: `grep -nE "^<dep-name>@" yarn.lock` should show the patched version. For deps that resolve under a nested `node_modules/<parent>/node_modules/` path (selective resolutions like `"sanitize-html/postcss"`), also spot-check the file on disk:

```bash
docker run --rm -v "$(pwd)":/app -v /app/node_modules -w /app bn-deps \
  sh -c 'cat node_modules/<parent>/node_modules/<dep>/package.json' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name'), d.get('version'))"
```

If the printed version disagrees with `yarn.lock`, the **bn-deps image is stale**. The image bakes `node_modules` in at build time, and the anonymous volume preserves that baked tree across runs. `yarn install --force` rewrites the lockfile but does not always re-link nested directories under a selective resolution — the nested path can keep whatever version the image was first built with.

When this happens (or any time a selective `"parent/child"` resolution is newly introduced), rebuild the image:

```bash
docker build --target deps -t bn-deps .
```

then rerun the quick-verify command above. Same applies if the `bn-deps` image does not yet exist on the host.

### 7. Full docker build (only for build-time deps that touch packager)

For deps that affect `electron-packager` or `@electron/get` (e.g. `got`, `sha.js`, `tar`), run the full build to exercise the path:

```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-neo .
```

Skip for renderer-only or HMR-only deps — compile smoke is sufficient.

### 8. Update CLAUDE.md (only when warranted)

CLAUDE.md "Dependency policy" was trimmed in v0.20.x — per-resolution forensics no longer live there (the lockfile is the source of truth). Only update CLAUDE.md when the change adds or modifies a **long-lived invariant**:

- A new entry under "Active exact-pin invariants" (caret-forbidden pin).
- A change to "Active exact-pin invariants" (lifting a pin, retargeting a pin).
- A net-new structural quirk that a future maintainer would otherwise rediscover (e.g. selective resolution that needs `resolve.extensions` update).
- If the dep is on the `## Outstanding security work` list, remove it there and renumber.

Routine `resolutions` entries do NOT need CLAUDE.md updates — the commit message + CHANGELOG carry the why.

### 9. Commit

Stage only `package.json`, `yarn.lock`, and `CLAUDE.md`. Use the house commit-message style:

```
chore(deps): force <dep-name> to ^<target-version> via yarn resolutions (<CVE-id>)
```

The body should restate: consumer chain, scope (renderer/build/HMR), CVE and reachability, verification command and result. Pre-commit hook prints `Can't find yarn in PATH` → `Skipping pre-commit hook` — this is expected per the Docker-only policy.

Do NOT push.

## Rules

- Verify the dep exists in `yarn.lock` before adding a resolution.
- An existing entry in `resolutions` is a bump candidate, not a stop sign — do not abort.
- Insert chronologically at the end of `resolutions`, not alphabetically.
- Match existing range syntax (`^` / `~` / bare) rather than defaulting to `^`.
- Always regenerate `yarn.lock` with the full quick-verify command including bind mount and `--force`. A package.json-only commit is incomplete and leaves the patch inert (see commit `2d0c1f5a` for the cautionary example).
- Always run `npm run compile` after install — it is the fastest break detector.
- For build-time deps that exercise electron-packager, also run the full `docker build .`.
- Update CLAUDE.md in the same commit only when the change is a long-lived invariant (see step 8). Routine resolutions: skip.
- Use `bn-deps` for quick-verify, not the full `boostnote-neo` image (5 min build vs 5 s compile).
- Rebuild `bn-deps` (`docker build --target deps -t bn-deps .`) after introducing a selective `"parent/child"` resolution, or any time a spot-check shows the nested package version disagrees with `yarn.lock`. The image's baked `node_modules` snapshot does not re-link nested directories under `--force` alone — this was the stale-image trap that surfaced after `sanitize-html/postcss ^7.0.39` was introduced.
- Never run host `npm` / `yarn`. Docker-only policy is hard.
- Do NOT push the commit.
