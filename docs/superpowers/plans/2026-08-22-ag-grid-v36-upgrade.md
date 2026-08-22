# ag-grid v36 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump `ag-grid-angular` and `@ag-grid-community/locale` from `35.3.0` to `36.1.0` with no behavior change - every grid instance keeps rendering, scrolling, filtering, and theming exactly as before.

**Architecture:** No architectural change - this is a dependency bump plus running the official codemod. Research confirmed the three DOM/behavior risk areas the issue flagged (internal class renames, custom scrollbar CSS, `cellDataType: 'date'` filter values) either don't apply to this codebase or only touch stable public classes, so the work is: bump, codemod, verify nothing broke, then a manual QA pass across every grid instance (none of this surface has automated DOM-level test coverage).

**Tech Stack:** Angular 22 (zoneless), `ag-grid-angular` / `ag-grid-community` / `@ag-grid-community/locale`, `@ag-grid-devtools/cli` (codemod, dev dependency only, not installed), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-ag-grid-v36-upgrade-design.md`

## Global Constraints

- Target versions: `ag-grid-angular@^36.1.0`, `@ag-grid-community/locale@^36.1.0` (root `package.json` - this repo hoists all deps to the workspace root; `packages/app/package.json` lists no ag-grid packages directly).
- `ag-grid-community` is a transitive dependency of `ag-grid-angular` - do not add a direct `package.json` entry for it; it resolves automatically via `npm install`.
- Do not call `enableDevValidations()` - explicit no-op decision (see spec, Breaking Changes item 4).
- Do not touch `better-sqlite3`, `electron`, or `bootstrap`/`ng-bootstrap` - tracked separately under #270.
- Do not add a custom scrollbar CSS experiment - the issue referenced one but it does not exist in this codebase (see spec, Breaking Changes item 2).
- `npm run lint` must stay at zero warnings (`max-warnings=0`) after every task.
- Commit format: `#275: <short description>`.

---

### Task 1: Bump ag-grid dependencies, run the official codemod, verify baseline

**Files:**

- Modify: `package.json:205,224`
- Codemod may modify: any `*.ts`/`*.html` file using a v36-migrated ag-grid API (exact files unknown until the codemod runs)

**Interfaces:**

- Produces: `ag-grid-angular@^36.1.0`, `@ag-grid-community/locale@^36.1.0`, and a transitively-updated `ag-grid-community@36.x` installed in `node_modules`, with an updated `package-lock.json` - every later task builds on this.

- [ ] **Step 1: Bump the versions**

In `package.json`, change:

```json
    "@ag-grid-community/locale": "^35.2.1",
```

to:

```json
    "@ag-grid-community/locale": "^36.1.0",
```

and change:

```json
    "ag-grid-angular": "^35.0.0",
```

to:

```json
    "ag-grid-angular": "^36.1.0",
```

- [ ] **Step 2: Install and update the lockfile**

Run: `npm install`

Expected: resolves cleanly. `ag-grid-community` updates transitively to a `36.x` version satisfying `ag-grid-angular@^36.1.0`'s peer/dependency requirement. `package-lock.json` updates to reflect the new resolved version tree.

- [ ] **Step 3: Run the official migration codemod**

Run: `npx @ag-grid-devtools/cli@latest migrate --from=35 --to=36`

Expected: the tool scans the repo and either reports "no changes needed" or rewrites specific files. If it modifies anything, open each changed file and read the diff before proceeding - note what it changed for the commit message in Step 5.

- [ ] **Step 4: Run lint, build, and tests to check for pure version-bump breakage**

Run: `npm run lint && npm run build && npm test`

Expected: all three pass. If `build` or `test` fails on a type error (e.g. a renamed `GridOptions`/`ColDef` property the codemod didn't catch), fix the type-level issue now, before starting Task 2 - keep this task scoped to "the bump + codemod alone builds and passes."

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "#275: bump ag-grid-angular and @ag-grid-community/locale to 36.1.0"
```

If the codemod in Step 3 changed any other files, `git add` those too and mention what changed in the commit message (or split into a second `#275:` commit if it touches unrelated files).

---

### Task 2: Manual QA - main torrent grid

**Files:** none (verification only, using the `run` skill / dev server).

**Interfaces:**

- Consumes: the v36 install from Task 1.
- Produces: a pass/fail confirmation for the app's primary grid instance, covering the CSS overrides and popup-portal mechanism that have no automated coverage.

- [ ] **Step 1: Start the app**

Run: `npm start` (Angular dev server + Electron) and wait for the Electron window to open. Navigate to the main torrent grid page (add a server connection if needed to see rows).

- [ ] **Step 2: Verify rendering and the seven `.ag-*` CSS overrides**

In both a light and a dark theme (use the in-app theme switcher):

- Grid wrapper has no rounded corners (`.ag-root-wrapper { border-radius: 0 }` from `grid.scss:1`).
- Column header text is uppercase with visible letter-spacing (`grid.scss:5`).
- Clicking a row selects it and shows the accent-colored left box-shadow (`grid.scss:10`).
- Header has a visible bottom border (`styles.scss:159-162`).
- Hovering a row shows the hover background color (`styles.scss:164-167`).
- In dark theme, clicking a cell shows a focus outline (`styles.scss:169-172`).
- Pause a torrent and confirm its row renders at reduced opacity (`styles.scss:1056-1058`, `.bb-row-paused`).

- [ ] **Step 3: Verify scrolling, sorting, resizing**

Scroll the grid vertically and (if enough columns are visible) horizontally - confirm smooth native scrolling with header/pinned columns staying in sync. Sort a column ascending/descending. Drag-resize a column. Confirm no visual glitches (gaps, misaligned header/body, flickering).

- [ ] **Step 4: Verify the column-filter popup portal mechanism**

Open the filter for a duration, number, size, text, time-limit, boolean, or ratio-limit column (all use `[appendTo]="popupPortalSelector"` from `operator-filter-base.ts`). Interact with the filter's embedded `ng-select` (open its dropdown, select a value). Confirm the filter popup does **not** close while doing this - only the `ag-custom-component-popup` portal mechanism keeps this working, and it isn't covered by any automated test.

- [ ] **Step 5: Verify the four date-range filters**

Open the filter for each of `added_on`, `last_activity`, `seen_complete`, and `completion_on`. Pick a date range and confirm rows filter correctly (this exercises `DatepickerRangeFilter`'s custom row-data comparison, independent of ag-grid's built-in date filter model, but still worth a real-data sanity check post-upgrade).

- [ ] **Step 6: Verify the grid context menu and inline cell editing**

Right-click a cell and confirm the context menu opens. Start editing an editable cell and confirm it commits/cancels correctly and that background polling pauses while editing (per `grid.spec.ts` coverage) and resumes after.

- [ ] **Step 7: Record and fix any regressions found**

If any of Steps 2-6 surfaces a regression, fix it now (this task does not end until all steps pass), then re-run the affected step.

---

### Task 3: Manual QA - remaining grid instances

**Files:** none (verification only).

**Interfaces:**

- Consumes: the v36 install from Task 1.
- Produces: a pass/fail confirmation for every other ag-grid instance in the app, which gates opening the PR alongside Task 2.

- [ ] **Step 1: Add Torrent folder picker**

Open the Add Torrent modal, choose a folder scan that populates the folder-picker grid (`folder-picker.ts`). Confirm it renders, sorts, and selects rows correctly. This instance calls `ModuleRegistry.registerModules([AllCommunityModule])` a second time (`folder-picker.ts:75`, defensive for unit tests) - confirm no console error about duplicate module registration when opened in the real app.

- [ ] **Step 2: Import Torrents modal**

Open the Import Torrents modal and load a batch of torrents into its grid (`import-torrents.ts`, `importGridOptions`/`getImportColDefs()`). Confirm rendering, sorting, and any row-selection/action columns work.

- [ ] **Step 3: Torrent Details - Peers tab**

Open Torrent Details on a torrent with active peers, switch to the Peers tab (`peers.ts`). Confirm the grid renders and updates as peer data refreshes.

- [ ] **Step 4: Torrent Details - Trackers tab**

Switch to the Trackers tab (`trackers.ts`). Confirm the grid renders correctly.

- [ ] **Step 5: Record and fix any regressions found**

If any step surfaces a regression, fix it now, then re-run the affected step.

---

### Task 4: Final cleanup before PR

**Files:**

- Delete: `docs/superpowers/` (the `specs/2026-08-22-ag-grid-v36-upgrade-design.md` and `plans/2026-08-22-ag-grid-v36-upgrade.md` files created for this work)

**Interfaces:** none - this is the last task.

- [ ] **Step 1: Remove the spec and plan docs**

Per CLAUDE.md, `docs/superpowers` specs/plans must not be merged to main - remove them in their own commit once implementation is done, before opening the PR.

```bash
git rm -r docs/superpowers
git commit -m "#275: removed spec and plan"
```

- [ ] **Step 2: Final whole-branch review**

Per CLAUDE.md's plan-execution convention, do one review of the full branch diff now (not per-task) before opening the PR - e.g. via the `code-review` skill or `pr-review-toolkit:review-pr`.
