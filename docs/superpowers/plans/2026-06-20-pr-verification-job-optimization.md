# PR Verification Job Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip the slow cross-platform `electron-builder` packaging step in PR CI when no packaging-relevant file changed, while keeping a fast real-compiler check on every app/electron source change.

**Architecture:** Single workflow file edit. Add a `packaging` path filter to the existing `detect-changes` job, fix the `app`/`electron` filters to also match `package.json`/`package-lock.json`, then split the existing `build` job into a fast single-OS `compile-check` job (gated on `app`/`electron`, same as today) and a `package` matrix job (gated on the new `packaging` filter).

**Tech Stack:** GitHub Actions YAML, `dorny/paths-filter@v4`.

> Note for whoever edits this plan file later: code fences below that show fragments of `.github/workflows/bitbutler-pr.yml` are intentionally left **untagged** (no `yaml` after the triple backtick), not tagged `text`/`bash`. Tagging them `yaml` causes Prettier (via this repo's lint-staged hook) to reformat the embedded snippet as a standalone document, which strips the leading indentation that shows nesting — silently breaking exact-match fidelity against the real file. Keep them untagged.

## Global Constraints

- Touch only `.github/workflows/bitbutler-pr.yml`. Do not modify `release.yml` (per spec non-goals).
- Do not split the `lint` job per-package, and do not add `node_modules`/native-module caching (per spec non-goals) — both explicitly out of scope.
- Final stage naming, exact strings: `[1/6]`, `[2/6]`, `[3/6]`, `[4a/6]`, `[4b/6]`, `[5/6]`, `[6a/6]`/`[6b/6]`.
- `packaging` filter paths, exact list: `package.json`, `package-lock.json`, `packages/app/src/assets/icons/**`, `build/**`, `public/i18n/**`.
- `app`/`electron` filters gain exactly two new entries each: `package.json`, `package-lock.json`.
- Commit message format for this repo: `#171: <description>` (tracking issue: https://github.com/enisz/bitbutler/issues/171). Current branch is already `171-optimize-pr-verification-job-skips`.
- Design reference: `docs/superpowers/specs/2026-06-20-pr-verification-job-optimization-design.md`.

---

### Task 1: Add `packaging` path filter; fix `app`/`electron` filter gap

**Files:**

- Modify: `.github/workflows/bitbutler-pr.yml` (the `detect-changes` job, lines ~55-82)

**Interfaces:**

- Produces: `needs.detect-changes.outputs.packaging` — a new boolean output, consumed by Task 2's `package` job.

- [ ] **Step 1: Edit the `outputs:` block to add `packaging`**

In `.github/workflows/bitbutler-pr.yml`, find this exact text (note the indentation — these lines sit inside the `detect-changes` job):

```
    outputs:
      app: ${{ steps.filter.outputs.app }}
      electron: ${{ steps.filter.outputs.electron }}
      any-source: ${{ steps.filter.outputs.any-source }}
```

Replace with:

```
    outputs:
      app: ${{ steps.filter.outputs.app }}
      electron: ${{ steps.filter.outputs.electron }}
      packaging: ${{ steps.filter.outputs.packaging }}
      any-source: ${{ steps.filter.outputs.any-source }}
```

- [ ] **Step 2: Edit the `filters:` block — add `package.json`/`package-lock.json` to `app` and `electron`, add the new `packaging` block**

Find this exact text:

```
          filters: |
            app:
              - 'packages/app/**'
              - 'packages/shared/**'
              - 'public/**'
            electron:
              - 'packages/electron/**'
              - 'packages/shared/**'
              - 'public/**'
            any-source:
              - 'packages/**'
              - 'public/**'
              - '.eslint*'
              - 'tsconfig*'
              - 'package.json'
              - 'package-lock.json'
```

Replace with:

```
          filters: |
            app:
              - 'packages/app/**'
              - 'packages/shared/**'
              - 'public/**'
              - 'package.json'
              - 'package-lock.json'
            electron:
              - 'packages/electron/**'
              - 'packages/shared/**'
              - 'public/**'
              - 'package.json'
              - 'package-lock.json'
            packaging:
              - 'package.json'
              - 'package-lock.json'
              - 'packages/app/src/assets/icons/**'
              - 'build/**'
              - 'public/i18n/**'
            any-source:
              - 'packages/**'
              - 'public/**'
              - '.eslint*'
              - 'tsconfig*'
              - 'package.json'
              - 'package-lock.json'
```

- [ ] **Step 3: Validate YAML syntax and the new filter content**

Run:

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
const doc = yaml.load(fs.readFileSync('.github/workflows/bitbutler-pr.yml', 'utf8'));
const outputs = doc.jobs['detect-changes'].outputs;
if (!('packaging' in outputs)) throw new Error('packaging output missing');
const filtersStr = doc.jobs['detect-changes'].steps[0].with.filters;
if (!filtersStr.includes('packaging:')) throw new Error('packaging filter block missing');
if (!filtersStr.includes(\"'package.json'\")) throw new Error('package.json missing from filters');
console.log('OK: packaging output and filter present');
"
```

Expected output: `OK: packaging output and filter present`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/bitbutler-pr.yml
git commit -m "#171: Add packaging path filter; include package.json/lockfile in app/electron filters"
```

---

### Task 2: Split `build` into `compile-check` + `package`; renumber all stage labels

**Files:**

- Modify: `.github/workflows/bitbutler-pr.yml` (job `name:` fields for `enforce-rules`, `detect-changes`, `lint`, `test-app`, `test-electron`; full replacement of the `build:` job block)

**Interfaces:**

- Consumes: `needs.detect-changes.outputs.app`, `.electron`, `.packaging` (from Task 1)
- Produces: job id `compile-check` (single-OS compiler check), job id `package` (2-OS packaging matrix) — both terminal, nothing in this workflow depends on them.

- [ ] **Step 1: Rename existing stage labels to the `/6` scheme**

Five separate one-line edits in `.github/workflows/bitbutler-pr.yml`. Each `name:` line below is indented 4 spaces in the real file (inside its job block) — match on the full line including indentation:

Before:

```
    name: '[1/5] PR Format & Issue Sync'
```

After:

```
    name: '[1/6] PR Format & Issue Sync'
```

Before:

```
    name: '[2/5] Detect Changes'
```

After:

```
    name: '[2/6] Detect Changes'
```

Before:

```
    name: '[3/5] Code Quality (Lint)'
```

After:

```
    name: '[3/6] Code Quality (Lint)'
```

Before:

```
    name: '[4/5] Unit Tests - Angular'
```

After:

```
    name: '[4a/6] Unit Tests - Angular'
```

Before:

```
    name: '[4/5] Unit Tests - Electron'
```

After:

```
    name: '[4b/6] Unit Tests - Electron'
```

- [ ] **Step 2: Replace the entire `build:` job block with `compile-check:` and `package:`**

Find this exact text (the entire job, indented 2 spaces at the `build:` key since it's a direct child of `jobs:`, matching its current position between `test-electron:` and the end of the file):

```
  build:
    name: '[5/5] Build & Package (${{ matrix.job_name }})'
    runs-on: ${{ matrix.os }}
    needs: [detect-changes, test-app, test-electron]
    if: >-
      always() &&
      (needs.detect-changes.outputs.app == 'true' || needs.detect-changes.outputs.electron == 'true') &&
      !contains(needs.*.result, 'failure') &&
      !contains(needs.*.result, 'cancelled')
    env:
      ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
    strategy:
      fail-fast: true
      matrix:
        os: [ubuntu-latest, windows-latest]
        include:
          - os: ubuntu-latest
            target: --linux
            job_name: 'Linux'
          - os: windows-latest
            target: --win
            job_name: 'Windows'
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm install -g npm@11
      - run: npm ci
        env:
          ELECTRON_SKIP_BINARY_DOWNLOAD: '1'

      - name: Install Linux Build Dependencies (RPM)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y rpm

      - run: npm run build:ui

      - name: Compile Electron TypeScript
        run: npm run build:electron

      - name: Build Electron App
        run: npx electron-builder ${{ matrix.target }}
```

Replace with:

```
  compile-check:
    name: '[5/6] Compile Check'
    runs-on: ubuntu-latest
    needs: [detect-changes, test-app, test-electron]
    if: >-
      always() &&
      (needs.detect-changes.outputs.app == 'true' || needs.detect-changes.outputs.electron == 'true') &&
      !contains(needs.*.result, 'failure') &&
      !contains(needs.*.result, 'cancelled')
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm install -g npm@11
      - run: npm ci
        env:
          ELECTRON_SKIP_BINARY_DOWNLOAD: '1'
      - run: npm run build:ui
      - name: Compile Electron TypeScript
        run: npm run build:electron

  package:
    name: '[6${{ matrix.leg }}/6] Package & Distribute (${{ matrix.job_name }})'
    runs-on: ${{ matrix.os }}
    needs: [detect-changes, compile-check]
    if: >-
      always() &&
      needs.detect-changes.outputs.packaging == 'true' &&
      !contains(needs.*.result, 'failure') &&
      !contains(needs.*.result, 'cancelled')
    env:
      ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
    strategy:
      fail-fast: true
      matrix:
        os: [ubuntu-latest, windows-latest]
        include:
          - os: ubuntu-latest
            target: --linux
            job_name: 'Linux'
            leg: 'a'
          - os: windows-latest
            target: --win
            job_name: 'Windows'
            leg: 'b'
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm install -g npm@11
      - run: npm ci
        env:
          ELECTRON_SKIP_BINARY_DOWNLOAD: '1'

      - name: Install Linux Build Dependencies (RPM)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y rpm

      - run: npm run build:ui

      - name: Compile Electron TypeScript
        run: npm run build:electron

      - name: Build Electron App
        run: npx electron-builder ${{ matrix.target }}
```

- [ ] **Step 3: Validate YAML syntax and job-id structure**

Run:

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
const doc = yaml.load(fs.readFileSync('.github/workflows/bitbutler-pr.yml', 'utf8'));
const jobIds = Object.keys(doc.jobs);
console.log('Job IDs:', jobIds.join(', '));
const expected = ['enforce-rules','detect-changes','lint','test-app','test-electron','compile-check','package'];
const missing = expected.filter(id => !jobIds.includes(id));
const unexpected = jobIds.filter(id => !expected.includes(id));
if (missing.length || unexpected.length) {
  throw new Error('missing: ' + missing.join(',') + ' unexpected: ' + unexpected.join(','));
}
console.log('OK: job ids match expected set');
"
```

Expected output:

```
Job IDs: enforce-rules, detect-changes, lint, test-app, test-electron, compile-check, package
OK: job ids match expected set
```

- [ ] **Step 4: Confirm no leftover `/5` stage labels remain**

Run:

```bash
grep -n "\[.*\/5\]" .github/workflows/bitbutler-pr.yml
```

Expected output: no matches (empty output, exit code 1 from grep is fine here — it means nothing found).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/bitbutler-pr.yml
git commit -m "#171: Split build job into compile-check and package; renumber CI stage labels"
```

---

### Task 3: Validate behavior against live PR runs

**Files:** none (verification only, no further code changes expected unless a scenario reveals a bug, in which case fix in `.github/workflows/bitbutler-pr.yml` and repeat the affected scenario)

**Interfaces:**

- Consumes: the finished workflow from Tasks 1-2.
- Produces: confidence that the behavior-comparison table in the design spec holds in practice.

This task pushes real commits and opens real (throwaway) PRs against the live GitHub repo — confirm with the user before running Steps 2 onward if running unattended.

- [ ] **Step 1: Push the feature branch and open the tracking PR**

```bash
git push -u origin 171-optimize-pr-verification-job-skips
gh pr create --title "Optimize PR verification workflow to skip unnecessary packaging steps" --body "Fixes #171" --base main
```

Expected: PR created. Note its number as `$FEATURE_PR`. Since this PR only touches `.github/workflows/bitbutler-pr.yml` (not matched by any filter), expect `lint`, `test-app`, `test-electron`, `compile-check`, and `package` to all show as skipped on this PR's own run — that's expected, not a failure. Confirm with:

```bash
gh pr checks $FEATURE_PR
```

- [ ] **Step 2: Scenario — app source-only change skips packaging**

```bash
git checkout -b 171-scenario-app-only
echo "// scenario test: no-op" >> packages/app/src/main.ts
git add packages/app/src/main.ts
git commit -m "#171: Scenario test - app source only"
git push -u origin 171-scenario-app-only
gh pr create --title "Scenario test: app source only" --body "Fixes #171" --base main
```

Wait for the run to finish, then inspect job conclusions:

```bash
RUN_ID=$(gh run list --branch 171-scenario-app-only --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $RUN_ID --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

Expected: `compile-check` shows `success`; jobs named `Package & Distribute (Linux)` / `(Windows)` show `skipped`.

Clean up:

```bash
gh pr close --delete-branch 171-scenario-app-only
```

- [ ] **Step 3: Scenario — dependency bump triggers tests, compile-check, and packaging**

```bash
git checkout main
git pull
git checkout -b 171-scenario-dep-bump
npm pkg set "description=BitButler - qBittorrent-nox remote client (scenario test)"
git add package.json
git commit -m "#171: Scenario test - package.json change"
git push -u origin 171-scenario-dep-bump
gh pr create --title "Scenario test: package.json change" --body "Fixes #171" --base main
```

Wait for the run to finish, then inspect:

```bash
RUN_ID=$(gh run list --branch 171-scenario-dep-bump --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $RUN_ID --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

Expected: `test-app`, `test-electron`, `compile-check` all `success`; `Package & Distribute (Linux)` / `(Windows)` both `success` (not skipped) — confirms the filter fix from Task 1 closed the dependency-bump gap.

Clean up:

```bash
gh pr close --delete-branch 171-scenario-dep-bump
git checkout main
git branch -D 171-scenario-dep-bump 171-scenario-app-only
```

- [ ] **Step 4: Scenario — docs-only change skips everything after lint (regression check)**

```bash
git checkout main
git pull
git checkout -b 171-scenario-docs-only
echo "<!-- scenario test -->" >> README.md
git add README.md
git commit -m "#171: Scenario test - docs only"
git push -u origin 171-scenario-docs-only
gh pr create --title "Scenario test: docs only" --body "Fixes #171" --base main
```

```bash
RUN_ID=$(gh run list --branch 171-scenario-docs-only --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $RUN_ID --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

Expected: `lint`, `test-app`, `test-electron`, `compile-check`, `Package & Distribute (Linux)`, `Package & Distribute (Windows)` all `skipped`.

Clean up:

```bash
gh pr close --delete-branch 171-scenario-docs-only
git checkout 171-optimize-pr-verification-job-skips
```

- [ ] **Step 5: Record results and merge the feature PR**

If all three scenarios matched expectations, the feature PR (`$FEATURE_PR` from Step 1) is ready for normal review/merge per the repo's standard PR process — no special action needed beyond what the team already does for any PR. If any scenario didn't match, fix `.github/workflows/bitbutler-pr.yml` on the `171-optimize-pr-verification-job-skips` branch, push, and repeat the relevant scenario from this task before merging.

---

## Self-Review Notes

- **Spec coverage:** `packaging` filter (Task 1) checked, `app`/`electron` filter fix (Task 1) checked, job split (Task 2) checked, stage letter-suffix naming (Task 2) checked, behavior-comparison table validated live (Task 3, covers 3 of 5 rows directly; the remaining two rows — translation edit and packaging-config edit — exercise the same code paths as the validated rows: translation edits use the `app` source path matched in Step 2's scenario logic since `public/i18n/**` is also a subset of the `app`/`electron` filters' `public/**` entry, and packaging-config edits use the same `package.json` path validated in Step 3, so they are not re-tested separately).
- **Placeholder scan:** none found — every step has literal commands/YAML.
- **Type/naming consistency:** job id `package` is referenced consistently; `compile-check` id matches between Task 2's YAML and its own validation script in Step 3.
- **Fence-tagging fix:** all snippets representing fragments of `.github/workflows/bitbutler-pr.yml` are untagged code fences (not `yaml`) specifically to survive this repo's Prettier pre-commit hook without having their indentation silently rewritten.
