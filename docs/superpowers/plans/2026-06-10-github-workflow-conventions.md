# GitHub Workflow Conventions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the conventions from `docs/superpowers/specs/2026-06-10-github-workflow-conventions.md` - drop the `[TYPE]:` issue title prefix, exclude maintenance/chore PRs from release notes, and document the new squash-merge and `gh issue create --label` conventions in `CLAUDE.md`.

**Architecture:** Four independent config/docs edits, each self-contained: (1) strip the `title:` field from all five issue form templates, (2) add `exclude-labels` and drop the now-empty Maintenance category in `release-drafter.yml`, (3) update the "Commit & PR conventions" section of `CLAUDE.md`, (4) update the "Git workflow" section of `CLAUDE.md` with the `gh issue create --label` gotcha. No application code changes. This work is tracked as issue #139 (`maintenance` label) on branch `139-simplify-issue-pr-conventions`; each task commits with the `#139: short description` format, ending in a PR - this doubles as the first real test of the new conventions.

**Tech Stack:** GitHub issue forms (YAML), Release Drafter config (YAML), Markdown (CLAUDE.md), Prettier (formatting verification).

---

### Task 1: Remove `[TYPE]:` title prefixes from issue templates

**Files:**

- Modify: `.github/ISSUE_TEMPLATE/01_bug_report.yml`
- Modify: `.github/ISSUE_TEMPLATE/02_enhancement.yml`
- Modify: `.github/ISSUE_TEMPLATE/03_feature_request.yml`
- Modify: `.github/ISSUE_TEMPLATE/04_maintenance.yml`
- Modify: `.github/ISSUE_TEMPLATE/99_other.yml`

- [ ] **Step 1: Remove the `title:` line from `01_bug_report.yml`**

Current content:

```yaml
name: 🪲 Bug Report
description: Report a reproducible bug
title: '[BUG]: '
labels: ['bug']
```

New content (delete the `title:` line, everything else unchanged):

```yaml
name: 🪲 Bug Report
description: Report a reproducible bug
labels: ['bug']
```

- [ ] **Step 2: Remove the `title:` line from `02_enhancement.yml`**

Current content:

```yaml
name: 📈 Enhancement
description: Suggest an improvement to an existing feature
title: '[ENHANCEMENT]: '
labels: ['enhancement']
```

New content:

```yaml
name: 📈 Enhancement
description: Suggest an improvement to an existing feature
labels: ['enhancement']
```

- [ ] **Step 3: Remove the `title:` line from `03_feature_request.yml`**

Current content:

```yaml
name: 🚀 Feature Request
description: Suggest an idea for BitButler
title: '[FEATURE]: '
labels: ['feature']
```

New content:

```yaml
name: 🚀 Feature Request
description: Suggest an idea for BitButler
labels: ['feature']
```

- [ ] **Step 4: Remove the `title:` line from `04_maintenance.yml`**

Current content:

```yaml
name: 🧰 Maintenance
description: Refactors, cleanups, or technical debt.
title: '[MAINTENANCE]: '
labels: ['maintenance']
```

New content:

```yaml
name: 🧰 Maintenance
description: Refactors, cleanups, or technical debt.
labels: ['maintenance']
```

- [ ] **Step 5: Remove the `title:` line from `99_other.yml`**

Current content:

```yaml
name: 🤔 Something Else
description: Anything that doesn't belong to any of the above.
title: '[OTHER]: '
labels: ['chore']
```

New content:

```yaml
name: 🤔 Something Else
description: Anything that doesn't belong to any of the above.
labels: ['chore']
```

- [ ] **Step 6: Verify formatting**

Run:

```bash
npx prettier --check .github/ISSUE_TEMPLATE/*.yml
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 7: Commit**

```bash
git add .github/ISSUE_TEMPLATE/01_bug_report.yml .github/ISSUE_TEMPLATE/02_enhancement.yml .github/ISSUE_TEMPLATE/03_feature_request.yml .github/ISSUE_TEMPLATE/04_maintenance.yml .github/ISSUE_TEMPLATE/99_other.yml
git commit -m "#139: drop [TYPE] prefix from issue title templates"
```

---

### Task 2: Exclude maintenance/chore from Release Drafter changelog

**Files:**

- Modify: `.github/release-drafter.yml`

- [ ] **Step 1: Add `exclude-labels` after `disable-autolabeler`**

Current content (top of file):

```yaml
name-template: 'BitButler v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'

branches:
  - main
disable-autolabeler: true

version-resolver:
```

New content:

```yaml
name-template: 'BitButler v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'

branches:
  - main
disable-autolabeler: true

exclude-labels:
  - 'maintenance'
  - 'chore'

version-resolver:
```

- [ ] **Step 2: Remove the now-empty `🧰 Maintenance` category**

Current content:

```yaml
categories:
  - title: '🚀 Features'
    labels: ['feature']
  - title: '📈 Enhancements'
    labels: ['enhancement']
  - title: '🪲 Bug Fixes'
    labels: ['bug']
  - title: '🧰 Maintenance'
    labels: ['maintenance']
  - title: '📦 Other Changes'
    labels: []
```

New content:

```yaml
categories:
  - title: '🚀 Features'
    labels: ['feature']
  - title: '📈 Enhancements'
    labels: ['enhancement']
  - title: '🪲 Bug Fixes'
    labels: ['bug']
  - title: '📦 Other Changes'
    labels: []
```

- [ ] **Step 3: Verify formatting**

Run:

```bash
npx prettier --check .github/release-drafter.yml
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 4: Commit**

```bash
git add .github/release-drafter.yml
git commit -m "#139: exclude maintenance and chore PRs from release notes"
```

---

### Task 3: Document the new conventions in CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "Commit & PR conventions" section**

Current content:

```markdown
## Commit & PR conventions

- Commit format: `#IssueID: short description` (e.g. `#22: add file tree checkboxes`)
- PR description must include `Fixes #IssueID` to auto-close the issue on merge.
- PR title must be a clean description only - do not include the issue ID in the title.
- Labels are applied automatically by a GitHub workflow - do not add them manually.
- CI runs lint → tests → cross-platform builds on every PR.
```

New content:

```markdown
## Commit & PR conventions

- Commit format: `#IssueID: short description` (e.g. `#22: add file tree checkboxes`) - applies to commits within a feature branch.
- PR description must include `Fixes #IssueID` to auto-close the issue on merge.
- PR title must be a clean description only - do not include the issue ID in the title.
- Issue titles are clean descriptions only - no `[TYPE]:` prefix; the label (applied automatically by the issue template) conveys the type.
- When squash-merging a PR, accept GitHub's default commit message (`<PR title> (#<PR number>)`) - do not manually prepend the issue ID.
- Labels are applied automatically by a GitHub workflow - do not add them manually.
- `maintenance` and `chore` labeled PRs are excluded from the release-notes changelog (and the in-app "What's new" modal) via release-drafter `exclude-labels`.
- CI runs lint → tests → cross-platform builds on every PR.
```

- [ ] **Step 2: Verify formatting**

Run:

```bash
npx prettier --check CLAUDE.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "#139: document updated issue/PR/squash-merge conventions"
```

---

### Task 4: Document the `gh issue create --label` gotcha in CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "Issue templates" bullet in "## Git workflow"**

Current content:

```markdown
## Git workflow

- **Feature branches:** Use the pattern `<issue-id>-<dash-separated-summary>` (e.g. `100-manage-labels-and-categories`).
- **Issue templates:** When opening new issues, use the appropriate template from `.github/ISSUE_TEMPLATE/`.
- **PR template:** ALWAYS read `.github/pull_request_template.md` before running `gh pr create` and use it as the exact structure for `--body`. Do not invent a different format.
```

New content:

```markdown
## Git workflow

- **Feature branches:** Use the pattern `<issue-id>-<dash-separated-summary>` (e.g. `100-manage-labels-and-categories`).
- **Issue templates:** When opening new issues, use the appropriate template from `.github/ISSUE_TEMPLATE/`. `gh issue create` does NOT auto-apply a template's `labels:` field in non-interactive mode - pass `--label <label>` explicitly matching the chosen template (e.g. `--label maintenance` for `04_maintenance.yml`, `--label bug` for `01_bug_report.yml`, etc.).
- **PR template:** ALWAYS read `.github/pull_request_template.md` before running `gh pr create` and use it as the exact structure for `--body`. Do not invent a different format.
```

- [ ] **Step 2: Verify formatting**

Run:

```bash
npx prettier --check CLAUDE.md
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "#139: document gh issue create --label gotcha in git workflow"
```

---

## Manual verification (post-merge, not part of this plan's commits)

These two checks confirm the new config behaves as intended once the next real
issue/PR/release flows through. They have side effects on the shared GitHub
repo, so run them deliberately rather than automatically:

1. **Issue template:** Open "New Issue" on GitHub and pick any template -
   confirm the title field starts empty (no `[BUG]:`/`[FEATURE]:`/etc. prefix)
   while the correct label is still pre-applied.
2. **Release Drafter:** After the next PR merges to `main` (or via
   `gh workflow run release-drafter.yml`), check the draft release body at
   `gh release view --json body --jq .body <next-tag>` (or the GitHub
   Releases UI) - a `maintenance`- or `chore`-labeled PR merged in that batch
   should not appear anywhere in the body, and there should be no
   `🧰 Maintenance` heading.
