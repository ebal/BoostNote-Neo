# Fix Node.js 20 Deprecation Warning in GitHub Actions

## Problem

The GitHub Actions workflow at `.github/workflows/build-boostnote-app.yml` uses `softprops/action-gh-release@v2`, which runs on Node.js 20. Node.js 20 actions are deprecated and will be forced to run with Node.js 24 by default starting June 2nd, 2026, and removed entirely on September 16th, 2026.

## Analysis

All other actions in the workflow already support Node.js 24 natively:
- `actions/checkout@v6` — Node 24 (since v5)
- `docker/setup-buildx-action@v4` — Node 24 (since v4.0.0)
- `docker/setup-qemu-action@v4` — Node 24 (since v4.0.0)
- `actions/upload-artifact@v7` — Node 24 (since v6)
- `actions/download-artifact@v7` — Node 24 (since v7)

The only action still on Node.js 20 is `softprops/action-gh-release@v2`.

## Solution

Upgrade `softprops/action-gh-release` from `v2` to `v3` in the `create-release` job.

- **v3.0.0** was released April 12, 2026 with native Node 24 support
- The API/inputs are unchanged — this is a runtime-only upgrade
- This eliminates the deprecation warning without needing the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var

## Change

**File:** `.github/workflows/build-boostnote-app.yml`, line 154

```yaml
# Before:
      - name: Create Release
        uses: softprops/action-gh-release@v2

# After:
      - name: Create Release
        uses: softprops/action-gh-release@v3
```

## Optional Cleanup

Remove `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` from the three build jobs (lines 33, 66, 104) since all actions are now natively Node 24. This env var was a workaround; it's no longer needed.

## Verification

After the change, run the workflow (triggered by a tag push or `workflow_dispatch`) and confirm no Node.js 20 deprecation warnings appear in the GitHub Actions logs.
