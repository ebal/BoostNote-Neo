---
name: dep-resolve
description: >
  Automates CVE patch resolution for transitive npm dependencies via yarn
  resolutions. Given a vulnerable dependency name and target patched version,
  investigates the dependency tree, checks for breaking changes, applies the
  resolution to package.json (alphabetical insertion), regenerates yarn.lock
  via Docker, and commits with a standardized message.
  Trigger: "resolve CVE", "patch dep", "force dep X to Y", "investigate dep".
---

# Dependency CVE Resolution Workflow

## Steps

### 1. Read current version and dependency tree

Find the dependency in `yarn.lock`:

```bash
docker run --rm boostnote-legacy yarn why <dep-name>
```

Record:
- Current resolved version (from `yarn.lock` / `yarn why` output)
- Parent packages (top-level or transitive) that pull it in
- Whether already has a resolution in `package.json` → `resolutions`

### 2. Determine runtime vs build-only

Check if the parent is:
- **Direct dependency** → `package.json` `dependencies` or `devDependencies`
- **Transitive** → resolve the full chain via `yarn why`

If a transitive parent is in `devDependencies` only (webpack loaders, test tools, etc.), the CVE is build/dev-only — note this in the commit message.

### 3. Check breaking-change surface

For semver-compatible bumps (`^0.2.0` → `0.2.1`), accept unless evidence of API change.

For major bumps, diff the GitHub release notes / changelog between current and target.

Criteria for safe:
- Same major.minor, only patch bump → always safe
- Minor bump within `^` range → safe unless library explicitly warns
- Major bump → require explicit user confirmation

### 4. Add yarn resolution

Read `package.json` → `resolutions` section. Insert new entry in **alphabetical order** among existing keys:

```json
"<dep-name>": "^<target-version>",
```

Follow existing project convention — all versions use `^` semver prefix.

### 5. Regenerate yarn.lock

```bash
docker run --rm boostnote-legacy npm install
```

This updates `yarn.lock` to reflect the new resolved version.

### 6. Commit

Stage only `package.json` and `yarn.lock`. Commit with:

```
chore(deps): force <dep-name> to ^<target-version> via yarn resolutions (<CVE-id>)
```

Do NOT push — leave for PR workflow.

## Rules

- Always verify the dep actually exists in `yarn.lock` before adding a resolution.
- Check `resolutions` section first — if already present, inform the user and abort.
- Always sort alphabetically when inserting into `resolutions`.
- Always regenerate `yarn.lock` — stale lockfile causes `docker build` failures.
- Use `docker run --rm boostnote-legacy` (not host npm/yarn) per Docker-only policy.
- Do NOT push the commit.
