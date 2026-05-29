---
name: build-test-verify
description: >
  Handles the full build, test, and verify workflow for BoostNote-Neo using
  Docker containers. Builds for both Intel (amd64) and Apple Silicon (arm64),
  runs tests, lint, and exports .app bundles to ./dist/.
  Trigger: "build, test and verify", "build and test", "build for both platforms",
  "export app", "build test verify".
---

# Build, Test & Verify Workflow

All commands run inside Docker — no npm/yarn/electron on the host.

## Steps

### 1. Clean `./dist/`

Remove any previous exports:

```bash
rm -rf ./dist/*
```

Create `./dist/` if removed:

```bash
mkdir -p ./dist
```

### 2. Get commit hash

```bash
COMMIT=$(git rev-parse --short HEAD)
```

### 3. Parallel Docker builds

Kick off both builds simultaneously in one message:

- **Intel (amd64):** `docker build --build-arg GIT_COMMIT=$COMMIT -t boostnote-neo .`
- **arm64:** `docker build --platform linux/arm64 --build-arg GIT_COMMIT=$COMMIT --build-arg BUILDARCH=arm64 -t boostnote-neo-arm64 .`

Set `timeout: 600000` (10 min) for each build call. If a build fails, report and stop — do not proceed to tests.

### 4. Parallel tests + lint

After both builds succeed, run in parallel:

- `docker run --rm boostnote-neo npm test`
- `docker run --rm boostnote-neo-arm64 npm test`
- `docker run --rm boostnote-neo npm run lint`

Set `timeout: 300000` (5 min) for each test call, `120000` (2 min) for lint.

### 5. Export .app bundles

```bash
docker cp $(docker create --rm boostnote-neo):/app/dist/Boostnote-darwin-x64 ./dist/
docker cp $(docker create --rm boostnote-neo-arm64):/app/dist/Boostnote-darwin-arm64 ./dist/
```

### 6. Verify exports

```bash
ls -la ./dist/
```

Confirm both `Boostnote-darwin-x64` and `Boostnote-darwin-arm64` exist and have non-zero size.

### 7. Report

Provide a concise summary with:

| Step | Outcome |
|---|---|
| Clean ./dist/ | OK / FAIL |
| Build Intel | OK / FAIL |
| Build arm64 | OK / FAIL |
| Test Intel | N pass, N fail, N skip |
| Test arm64 | N pass, N fail, N skip |
| Lint | N errors (note pre-existing) |
| Export Intel | OK / FAIL |
| Export arm64 | OK / FAIL |

Call out pre-existing failures per AGENTS.md (dist/ test pickups, test-data issues, fs-extra graceful-fs, prettier lint) and confirm no **new** failures were introduced.

## Rules

- Keep a `todowrite` list tracking each step's status throughout the workflow.
- Steps 3-4 use parallel tool calls within a single message.
- If `./dist/` was already clean (empty or absent), note it in the report.
- Do NOT run npm/yarn/electron/grunt on the host under any circumstances.
- Do NOT fix pre-existing test/lint failures — only report them.
