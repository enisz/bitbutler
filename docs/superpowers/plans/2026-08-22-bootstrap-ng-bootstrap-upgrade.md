# bootstrap / @ng-bootstrap/ng-bootstrap Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump `bootstrap` from `5.3.6` to `5.3.8` and `@ng-bootstrap/ng-bootstrap` from `19.0.1` to `21.0.0` with no behavior change - every modal, tooltip, popover, dropdown, collapse, datepicker, typeahead, and accordion instance keeps rendering and behaving exactly as before.

**Architecture:** No architectural change - this is a plain dependency bump (no codemod exists for either package). Research confirmed the only breaking change between these versions (`NgbAccordion`'s change-detection strategy moving from `Eager` to `OnPush`) doesn't affect this codebase's single accordion usage, since its host component is already `OnPush` and fully signal-driven. The work is: bump, verify nothing broke, then a manual QA pass across every ng-bootstrap directive type in use (most of this surface has no automated DOM-level test coverage).

**Tech Stack:** Angular 22 (zoneless), `bootstrap`, `@ng-bootstrap/ng-bootstrap`, `@popperjs/core` (already compatible, no change), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-bootstrap-ng-bootstrap-upgrade-design.md`

## Global Constraints

- Target versions: `bootstrap@^5.3.8`, `@ng-bootstrap/ng-bootstrap@^21.0.0` (root `package.json` - this repo hoists all deps to the workspace root; `packages/app/package.json` lists neither directly).
- `@popperjs/core` stays at `^2.11.8` - already satisfies ng-bootstrap v21's peer requirement, do not touch it.
- Do not touch `better-sqlite3` or `electron` - tracked separately under #270.
- Do not adopt ng-bootstrap v20's per-component secondary entry points - explicit no-op decision (see spec, "Out of scope").
- `npm run lint` must stay at zero warnings (`max-warnings=0`) after every task.
- Commit format: `#288: <short description>`.

---

### Task 1: Bump dependencies, verify baseline

**Files:**

- Modify: `package.json:218,228`

**Interfaces:**

- Produces: `bootstrap@^5.3.8` and `@ng-bootstrap/ng-bootstrap@^21.0.0` installed in `node_modules`, with an updated `package-lock.json` - every later task builds on this.

- [ ] **Step 1: Bump the versions**

In `package.json`, change:

```json
    "@ng-bootstrap/ng-bootstrap": "^19.0.1",
```

to:

```json
    "@ng-bootstrap/ng-bootstrap": "^21.0.0",
```

and change:

```json
    "bootstrap": "^5.3.6",
```

to:

```json
    "bootstrap": "^5.3.8",
```

- [ ] **Step 2: Install and update the lockfile**

Run: `npm install`

Expected: resolves cleanly with no peer-dependency warnings (Angular `22.1.3` already satisfies ng-bootstrap v21's `^22.0.0` peer requirement, `@popperjs/core@^2.11.8` already satisfies its peer requirement). `package-lock.json` updates to reflect the new resolved versions.

- [ ] **Step 3: Run lint, build, and tests**

Run: `npm run lint && npm run build && npm test`

Expected: all three pass, including `update-available.spec.ts` (the one component with automated coverage over the codebase's single `NgbAccordion` usage). If anything fails on a type error (an ng-bootstrap API surface change), fix it now, before starting Task 2 - keep this task scoped to "the bump alone builds and passes."

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "#288: bump bootstrap to 5.3.8 and @ng-bootstrap/ng-bootstrap to 21.0.0"
```

---

### Task 2: Manual QA across every ng-bootstrap directive type

**Files:** none (verification only, using the `run` skill / dev server).

**Interfaces:**

- Consumes: the v5.3.8/v21.0.0 install from Task 1.
- Produces: a pass/fail confirmation for every ng-bootstrap component type used in the app, in both light and dark themes.

- [ ] **Step 1: Start the app**

Run: `npm start` (Angular dev server + Electron) and wait for the Electron window to open.

- [ ] **Step 2: Modals**

Open a representative modal (e.g. Settings, or Add Torrent). Confirm it opens with its animation, the backdrop themes correctly in both light and dark, header/body/footer render as before, and it closes correctly (Escape, close button, and backdrop click if enabled). Spot-check one more modal that has custom `.modal-*` overrides (Torrent Details, given `torrent-details.scss:1,44`).

- [ ] **Step 3: Tooltips**

Hover an element that shows an `NgbTooltip` (e.g. a truncated grid cell or an icon button). Confirm placement, arrow, and theming (light/dark) match pre-upgrade behavior. Check the login page's tooltip override too (`login.scss:110`).

- [ ] **Step 4: Popovers**

Trigger the `bb-popover` component (`bb-popover.ts`). Confirm placement, arrow, header/body theming.

- [ ] **Step 5: Dropdowns**

Open an `NgbDropdownModule`-based dropdown trigger. Confirm it opens, positions correctly, and themes correctly.

- [ ] **Step 6: Collapse**

Trigger an `NgbCollapse` usage. Confirm expand/collapse animates smoothly with no visual glitch.

- [ ] **Step 7: Datepicker**

Open the datepicker-range column filter (on a date column like `added_on` in the main grid). Confirm the calendar renders, localized month/day labels are correct (via the custom `NgbDatepickerI18n`), and selecting a date range filters the grid correctly.

- [ ] **Step 8: Typeahead**

Type into an `NgbTypeahead`-backed input. Confirm the suggestion dropdown renders, themes correctly (`ngb-typeahead-window.dropdown-menu` overrides at `styles.scss:689,727`), and selecting a suggestion works.

- [ ] **Step 9: Accordion**

Open the Update Available modal (trigger an update check, or temporarily stub `UpdaterService`/the update-check response to force it open). Confirm:

- The accordion expands/collapses on header click.
- `[closeOthers]="true"` still closes the previously-open release when a new one opens.
- The release matching `activeReleaseId()` (the one currently being installed, if any) stays `disabled` and doesn't toggle.
- `.accordion-*` theming (`update-available.scss:67-101`, `styles.scss:1418-1429`) still applies correctly in both themes.

- [ ] **Step 10: Record and fix any regressions found**

If any of Steps 2-9 surfaces a regression, fix it now (this task does not end until all steps pass), then re-run the affected step.

---

### Task 3: Final cleanup before PR

**Files:**

- Delete: `docs/superpowers/` (the `specs/2026-08-22-bootstrap-ng-bootstrap-upgrade-design.md` and `plans/2026-08-22-bootstrap-ng-bootstrap-upgrade.md` files created for this work)

**Interfaces:** none - this is the last task.

- [ ] **Step 1: Remove the spec and plan docs**

Per CLAUDE.md, `docs/superpowers` specs/plans must not be merged to main - remove them in their own commit once implementation is done, before opening the PR.

```bash
git rm -r docs/superpowers
git commit -m "#288: removed spec and plan"
```

- [ ] **Step 2: Final whole-branch review**

Per CLAUDE.md's plan-execution convention, do one review of the full branch diff now (not per-task) before opening the PR - e.g. via the `code-review` skill.
