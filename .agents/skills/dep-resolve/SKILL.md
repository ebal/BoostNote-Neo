---
name: dep-resolve
description: >
  Automates CVE patch resolution for transitive npm dependencies via yarn
  resolutions. Given a vulnerable dependency name and target patched version,
  investigates the dependency tree, checks for breaking changes and the
  Webpack 1 ESM cliff, applies the resolution to package.json (chronological
  insertion at end of the resolutions block), regenerates yarn.lock via the
  bn-deps quick-verify image, runs the compile smoke, optionally runs the
  full docker build for build-time deps, updates CLAUDE.md, and commits.
  Trigger: "resolve CVE", "patch dep", "force dep X to Y", "investigate dep".
---

# Dependency CVE Resolution Workflow

## Constraints (read first)

- **Docker-only policy.** Never run `npm` / `yarn` / `electron` / `grunt` / `node` on the host. Allowed host commands: `git`, `docker`, `codesign`.
- **yarn is canonical**, not npm. The lockfile is `yarn.lock`. `npm install` is wrong — it would generate `package-lock.json` and never touch `yarn.lock`.
- **Webpack 1 ESM cliff.** Packages that ship pure ESM (`"type": "module"` with no `main` field) cannot be resolved by webpack 1. Known blocked majors: `uuid 12+`, `mermaid 10+`, `json5 2+`, `highlight.js 11+`. Always inspect the target's `package.json` for `main` before accepting a major bump.

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

Tag the consumer chain into one of CLAUDE.md's three groups. This determines doc placement and verify depth:

- **Renderer / runtime-touching** — bundled into `compiled/main.js` or loaded via `webpack-skeleton.js#externals` at Electron runtime. Highest stakes. Examples: `lodash`, `moment`, `highlight.js`, `dot-prop`, `decode-uri-component` (via `query-string`).
- **Build-time only (loader / packager chain)** — used by webpack loaders, electron-packager, electron download, etc. Never enters the shipped binary. Examples: `json5`, `node-fetch`, `tough-cookie`, `got` (via `@electron/get`), `ws` (via `jsdom` test helpers).
- **Dev-server (HMR) only** — used by `webpack-dev-server@1.16.5` middleware or `babel-preset-react-hmre`. Constant-folded out of the production compile. Examples: `cookie`, `serve-static`, `sockjs`, `url-parse`.

### 3. Check breaking-change surface

- **Patch bump within same minor** (`0.2.0` → `0.2.2`) — safe, accept.
- **Minor bump within `^` range** — safe unless changelog calls out a behavior change in the surface actually called by the consumer.
- **Major bump** — read release notes between current and target. For renderer-touching deps, audit every call site in `browser/` and `lib/`. For build-only, the worst case is build break, which `docker build .` catches.
- **Pure ESM cliff** — `curl -s https://registry.npmjs.org/<dep>/<target> | jq '.main, .type, .exports'`. If `main` is absent or `type: "module"` without a CJS export, webpack 1 will not resolve it. Cannot bump.

### 4. Pick range syntax

Match the existing project convention — do NOT blindly default to `^`:

- `^X.Y.Z` — default for most deps (caret = same major).
- `~X.Y.Z` — tilde when capping at a minor (e.g. `mermaid ~9.1.7` to stay below v9.2's lazy-load rewrite).
- Bare `X.Y.Z` — exact pin (e.g. `unique-slug 2.0.0`) only when an exact match is required.

For companion deps that fix a sub-tree (e.g. `sanitize-html/postcss` selectively), use the selective form `"<parent>/<child>": "^X.Y.Z"` instead of a global resolution.

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
- `--ignore-engines` — silences peer-dep noise from the Webpack 1 / Babel 6 stack.
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

### 8. Update CLAUDE.md

Add an entry to the matching group in the `## Dependency policy` section (see step 2). For each entry record:

- The consumer chain (e.g. `query-string` → `decode-uri-component`).
- The CVE id(s) patched and a one-line reachability note (which sink, why exploitable or unreachable).
- The verification performed (compile, full docker build, smoke render, etc.).

If the dep is on the `## Outstanding security work (next priorities)` list, remove it there and renumber.

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
- Update CLAUDE.md in the same commit.
- Use `bn-deps` for quick-verify, not the full `boostnote-neo` image (5 min build vs 5 s compile).
- Rebuild `bn-deps` (`docker build --target deps -t bn-deps .`) after introducing a selective `"parent/child"` resolution, or any time a spot-check shows the nested package version disagrees with `yarn.lock`. The image's baked `node_modules` snapshot does not re-link nested directories under `--force` alone — this was the stale-image trap that surfaced after `sanitize-html/postcss ^7.0.39` was introduced.
- Never run host `npm` / `yarn`. Docker-only policy is hard.
- Do NOT push the commit.
