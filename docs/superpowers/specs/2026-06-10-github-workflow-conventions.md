# GitHub Workflow Conventions: Issue/PR Naming & Release Notes

**Date:** 2026-06-10

## Summary

Simplify issue, PR, and commit-title conventions to remove redundancy between
the `[TYPE]:` issue title prefix and the issue's label, and to remove the
manual `#IssueID:` editing step at squash-merge time. Also tighten the
release notes (Release Drafter output, which is rendered verbatim in the
Electron app's "Update available" modal) so internal/maintenance work doesn't
clutter the user-facing changelog.

All changes apply **going forward only**. The 67 existing closed issues keep
their `[TYPE]:` prefixes as historical record; no bulk renames.

---

## Goals

- Issue titles are clean descriptions; the type is conveyed by the label
  (already shown as a colored badge in issue lists), not duplicated as a text
  prefix.
- Squash-merging a PR requires zero manual edits - GitHub's default commit
  message (`<PR title> (#<PR number>)`) is accepted as-is.
- The in-app "What's new" modal (and the GitHub release page) only shows
  user-facing changes: Features, Enhancements, Bug Fixes. Maintenance/chore
  work is excluded from that list entirely.
- `Fixes #IssueID` remains the sole mechanism for issue↔PR traceability
  (GitHub auto-links and closes the issue on merge).

## Out of scope

- Renaming any of the 67 existing closed issues or their PRs.
- Changes to `.github/pull_request_template.md` (the `Fixes #` requirement
  stays).
- Changes to `.github/workflows/bitbutler-pr.yml` (label-sync from issue to
  PR stays - it's now also what drives `exclude-labels`).
- Changes to `.husky/commit-msg` - it only validates locally-created commits
  (in-branch `#IssueID: description` commits), never the server-side
  squash-merge commit. Its `Merge*` / `Release v*` bypass cases remain
  necessary and unrelated to this change.
- Changes to the Electron update-checker (`checkForUpdate()`) or the
  `update-available` modal's `cleanedBody()` - the `## What's Changed`
  heading and markdown rendering are unaffected.
- Restructuring the Feature vs. Enhancement label distinction.

---

## Naming conventions (reference table)

| Item                | Convention                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue title         | Clean description, no `[TYPE]:` prefix. Type comes from the label the issue template applies (`bug`, `enhancement`, `feature`, `maintenance`, `chore`). |
| PR title            | Clean description, no issue ID (unchanged).                                                                                                             |
| In-branch commits   | `#IssueID: short description` (unchanged - e.g. `#22: add file tree checkboxes`).                                                                       |
| Squash-merge commit | GitHub default, unedited: `<PR title> (#<PR number>)`. No manual `#IssueID:` prefix.                                                                    |
| PR description      | Must include `Fixes #IssueID` (unchanged).                                                                                                              |

---

## Changes

### 1. Issue templates (`.github/ISSUE_TEMPLATE/*.yml`)

Remove the `title:` field from all five templates so the title input starts
empty for a clean description:

- `01_bug_report.yml` - remove `title: '[BUG]: '`
- `02_enhancement.yml` - remove `title: '[ENHANCEMENT]: '`
- `03_feature_request.yml` - remove `title: '[FEATURE]: '`
- `04_maintenance.yml` - remove `title: '[MAINTENANCE]: '`
- `99_other.yml` - remove `title: '[OTHER]: '`

The `labels:` field in each template is unchanged (`bug`, `enhancement`,
`feature`, `maintenance`, `chore` respectively).

### 2. Release Drafter (`.github/release-drafter.yml`)

- Add a top-level `exclude-labels` list containing `maintenance` and `chore`.
  Release Drafter drops any PR carrying either label from the working set
  _before_ categorization - such a PR cannot end up in any category,
  including the `📦 Other Changes` catch-all.
- Remove the `🧰 Maintenance` category (its only label, `maintenance`, is now
  excluded, so the category would always be empty).
- `📦 Other Changes` (`labels: []`) stays as a safety net for any PR whose
  linked issue carries none of `feature` / `enhancement` / `bug` /
  `maintenance` / `chore`.
- `change-template`, `version-resolver`, and the overall `template`
  (`## What's Changed\n\n$CHANGES`) are unchanged.

Resulting file:

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
  major:
    labels: ['major']
  minor:
    labels: ['minor']
  patch:
    labels: ['patch']
  default: patch

categories:
  - title: '🚀 Features'
    labels: ['feature']
  - title: '📈 Enhancements'
    labels: ['enhancement']
  - title: '🪲 Bug Fixes'
    labels: ['bug']
  - title: '📦 Other Changes'
    labels: []

change-template: '- [#$NUMBER](https://github.com/enisz/bitbutler/pull/$NUMBER): $TITLE'

template: |
  ## What's Changed

  $CHANGES
```

### 3. `CLAUDE.md` - `## Commit & PR conventions`

Update the section to:

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

(All other CLAUDE.md sections - Git workflow, Writing style, Architecture,
etc. - are unchanged.)
