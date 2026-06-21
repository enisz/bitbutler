# Toast Casing/Punctuation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every toast title that is structurally correct (title already
states the outcome, message already carries the variable detail) but
inconsistently cased or punctuated into the headline-style Title Case
convention defined in `docs/superpowers/specs/2026-06-21-toast-consistency-design.md`.

**Architecture:** This is a content-only fix. Every call site in scope passes
an i18n **key** to `translateService.instant(key)` and forwards the result
straight into `ToastService` - none of them hardcode an English fallback
string in the `.ts` file. So every fix in this plan is a value-only edit
inside `public/i18n/us.json`; no production TypeScript changes, and no
`.spec.ts` changes, are needed. This was confirmed by reading every call site
listed below and grepping every corresponding spec file for the old English
strings (no matches) - see Global Constraints.

**Tech Stack:** Angular 20 (`@ngx-translate/core`), `us.json` flat-nested
JSON i18n resource, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Scope is exactly the "casing/punctuation-only fixes" table and the
  `general.ts` paragraph in the design spec - do not touch any "structural
  fixes" entries (those belong to a separate plan).
- Headline-style Title Case: capitalize major words; lowercase short
  articles/prepositions/conjunctions (`a`, `to`, `of`, `the`, ...) unless they
  are the first word. No trailing punctuation (no `.`, `!`).
- No production `.ts` file in this plan needs editing. Confirmed: every call
  site below does `this.translateService.instant('<key>')` and passes the
  return value directly as the toast title argument - there is no literal
  English string anywhere in the `.ts` files for these keys.
- No `.spec.ts` file in this plan needs editing. Confirmed: `npm`'s global
  test config (`packages/app/src/test-providers.ts`) registers
  `provideTranslateService()` with no loader, so `TranslateService.instant(key)`
  returns the raw key unchanged in every spec unless a spec provides its own
  mock. Greps for every old English string in `packages/app/src` (both the
  6-file table strings and the 12 `general.ts` strings) returned zero matches
  in any spec file, and the one spec with a file-local `TranslateService`
  mock that touches this scope (`login.spec.ts`) stubs `instant` to always
  return `''` and never asserts on the toast title argument.
- `hu.json` is out of scope (per spec Non-goals) - do not touch it.
- Each task's only required verification is "the existing test suite for the
  touched files still passes" (regression check) - there is no new behavior
  to drive with a failing test first, since no logic changes.
- Run `npm test --workspace=packages/app` after each task. Pre-commit hooks
  (Husky + lint-staged) auto-format `*.json` files with Prettier on commit -
  do not hand-format `us.json` beyond keeping valid JSON.
- Commit format: `#178: <short description>` (continuing the existing
  `178-revise-toast-hardcoded-english-messages` branch convention).

---

### Task 1: Fix casing/punctuation in the 6 standalone toast titles

**Files:**

- Modify: `public/i18n/us.json:4` (`app.success.finished-downloading`)
- Modify: `public/i18n/us.json:256` (`pages.torrent-details.rename-torrent.error.failed-to-rename` - actual nesting per file, see step 1)
- Modify: `public/i18n/us.json:292` (`...set-torrent-location.error.failed-to-relocate`)
- Modify: `public/i18n/us.json:952` (`pages.login.error.connection-failed`)
- Modify: `public/i18n/us.json:1083` (`pages.main.grid.context-menu.toast.export-failed-title`)
- Modify: `public/i18n/us.json:1603` (`services.torrent-command-handler.error.delete-failed-title`)
- Test (regression only, no edits): `packages/app/src/app/app.spec.ts`,
  `packages/app/src/app/components/modals/rename-torrent/rename-torrent.spec.ts`,
  `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.spec.ts`,
  `packages/app/src/app/pages/login/login.spec.ts`,
  `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`,
  `packages/app/src/app/services/torrent-command-handler.service.spec.ts`

**Interfaces:**

- Consumes: nothing new - these keys are already read via
  `this.translateService.instant('<key>')` at each call site
  (`app.ts:93`, `rename-torrent.ts:60`, `set-torrent-location.ts:82-84`,
  `login.ts:256`, `grid-context-menu.service.ts:750-752`,
  `torrent-command-handler.service.ts:136`).
- Produces: nothing new - only the English string value under each existing
  key changes. No key names change.

- [ ] **Step 1: Edit `us.json:4` - `app.success.finished-downloading`**

```json
  "app": {
    "success": {
      "finished-downloading": "Download Finished"
    }
  },
```

(was `"Download Finished!"` - drop the trailing `!`)

- [ ] **Step 2: Edit `us.json:256` - rename-torrent's `failed-to-rename`**

```json
        "error": {
          "failed-to-rename": "Failed to Rename Torrent"
        }
```

(was `"Failed to rename torrent"` - Title Case)

- [ ] **Step 3: Edit `us.json:292` - set-torrent-location's `failed-to-relocate`**

```json
        "error": {
          "failed-to-relocate": "Failed to Relocate Torrent"
        }
```

(was `"Failed to relocate torrent!"` - Title Case, drop trailing `!`)

- [ ] **Step 4: Edit `us.json:952` - login's `connection-failed`**

```json
      "error": {
        "connection-failed": "Connection Failed",
        "update-server-failed": "Failed to update the host {{name}}!"
      },
```

(was `"Connection failed."` - Title Case, drop trailing `.`; leave the
sibling `update-server-failed` key untouched, it's out of scope)

- [ ] **Step 5: Edit `us.json:1083` - grid context menu's `export-failed-title`**

```json
          "toast": {
            "export-failed-title": "Export Failed",
            "export-failed-count": "Failed to export {{failed}} of {{total}} torrent(s)."
          }
```

(was `"Export failed"` - Title Case; leave sibling `export-failed-count`
untouched, it's a message key not a title key)

- [ ] **Step 6: Edit `us.json:1603` - torrent-command-handler's `delete-failed-title`**

```json
    "torrent-command-handler": {
      "error": {
        "delete-failed-title": "Failed to Delete Torrent(s)"
      }
    },
```

(was `"Failed to delete torrent(s)"` - Title Case; note "(s)" stays
lowercase/parenthesized as-is, only "Failed", "Delete", "Torrent" capitalize)

- [ ] **Step 7: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS (all existing suites green, including the six spec files
listed above - none of them assert on these keys' English values)

- [ ] **Step 8: Commit**

```bash
git add public/i18n/us.json
git commit -m "#178: fix casing and punctuation in 6 toast titles"
```

---

### Task 2: Fix casing/punctuation in `general.ts`'s 12 `*-failed` toast titles

**Files:**

- Modify: `public/i18n/us.json:487-508`
  (`components.modals.torrent-details.general.toast.*-failed` and
  `local-path-failed`)
- Test (regression only, no edits):
  `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: nothing new - each key is already read via
  `this.translateService.instant('<key>')` at
  `general.ts:266,284,306,328,350,383,408,433,452,481,513,534` and passed as
  the toast title argument.
- Produces: nothing new - only the English string value under each existing
  key changes. No key names change. The sibling in-progress keys
  (`resuming`, `pausing`, `force-resuming`, `clearing-*`, `reannouncing`,
  `removing-*`) are messages for transient toasts, not titles - exempt per
  the transient-toast rule, and not touched by this task.

- [ ] **Step 1: Edit `us.json:486-509` - all 12 `*-failed` title values**

```json
          "toast": {
            "resuming": "Resuming the torrent…",
            "resume-failed": "Failed to Resume Torrent",
            "pausing": "Pausing the torrent…",
            "pause-failed": "Failed to Pause Torrent",
            "force-resuming": "Force resuming the torrent…",
            "force-resume-failed": "Failed to Force Resume Torrent",
            "clearing-download-limit": "Clearing the download limit…",
            "clear-download-limit-failed": "Failed to Clear Download Limit",
            "clearing-upload-limit": "Clearing the upload limit…",
            "clear-upload-limit-failed": "Failed to Clear Upload Limit",
            "clearing-ratio-limit": "Clearing the ratio limit…",
            "clear-ratio-limit-failed": "Failed to Clear Ratio Limit",
            "clearing-seeding-time-limit": "Clearing the seeding time limit…",
            "clear-seeding-time-limit-failed": "Failed to Clear Seeding Time Limit",
            "clearing-inactive-seeding-time-limit": "Clearing the inactive seeding time limit…",
            "clear-inactive-seeding-time-limit-failed": "Failed to Clear Inactive Seeding Time Limit",
            "reannouncing": "Reannouncing to trackers…",
            "reannounce-failed": "Failed to Reannounce Torrent",
            "removing-category": "Removing the category…",
            "remove-category-failed": "Failed to Remove Category",
            "removing-all-tags": "Removing all tags…",
            "remove-all-tags-failed": "Failed to Remove All Tags",
            "local-path-failed": "Failed to Resolve Local Path",
            "copied-to-clipboard": "Copied {{field}} to clipboard."
          }
```

(only the 12 `*-failed`/`local-path-failed` values change, to Title Case
with no trailing punctuation; the `…`-suffixed in-progress messages and
`copied-to-clipboard` are unchanged, shown above only for surrounding
context/uniqueness)

- [ ] **Step 2: Run the regression suite**

Run: `npm test --workspace=packages/app`
Expected: PASS (`general.spec.ts` is green - it does not assert on these
keys' English values)

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json
git commit -m "#178: fix casing and punctuation in general tab failed-action toast titles"
```

---

## Self-Review

**1. Spec coverage:** Every row of the spec's "Casing/punctuation-only
fixes" table (6 rows) has a step in Task 1. Every key named in the spec's
`general.ts` paragraph (12 keys, including `local-path-failed`) has a step
in Task 2. The spec's "Already-correct titles, no change needed" list
(`services.qb.error.request-failed-title`,
`services.qb.warning.connection-retry-title`,
`services.update-command-handler.error.check-failed-title`) is correctly
excluded - no task touches them. No gaps.

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" patterns. Every
step shows the literal before/after JSON. The "no test changes needed"
claim is backed by the grep evidence in Global Constraints, not asserted
without support.

**3. Type consistency:** N/A - no new functions, types, or signatures are
introduced; this plan only changes string literals inside a JSON resource
file. Key names are verified unchanged in every step.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-toast-casing-fixes.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
