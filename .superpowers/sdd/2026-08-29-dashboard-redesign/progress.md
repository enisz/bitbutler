# SDD ledger — plan: docs/superpowers/plans/2026-08-29-dashboard-redesign.md

Mode: per user instruction, task-level review is SKIPPED for every task. Implementer
self-report (tests passing) is the gate. One final whole-branch review runs after Task 10.

## Pre-flight scan

Working tree at plan start had uncommitted changes to: widget-config.{html,scss,ts},
widget-picker.{html,scss}, dashboard.{html,scss,ts}, stat-tile.scss, torrent-list-widget.scss.
Verified these are NOT stray/unrelated work: they are the exact pre-plan baseline the plan's
task text was written against (dashboard.html's manage-panel block matches Task 4's "block to
delete" verbatim; widget-config.ts already has NgSelectComponent wired in, matching Task 9's
assumed baseline; widget-picker.scss/widget-config.scss are already emptied, matching Task 5's
"currently empty" note). Ruling: proceed without stashing/committing this prep separately - each
task's own `git add` scope (e.g. Task 4 adds the whole dashboard folder, Task 5 the whole
widget-picker folder, Task 9 the whole widget-config folder) will absorb it into that task's
commit naturally.

Cross-task dependency check (file/interface pairs):
- Task 1 (dashboard.model.ts, widget-selectors.ts) produces PieChartConfig/PieChartData,
  consumed by Task 5 (widget-catalog.ts), Task 7 (pie-chart-widget.ts), Task 9
  (widget-config.ts). Plan order has Task 1 first - clean.
- Task 2 (torrent-list-widget.html/scss restructure, adds `__scroll` wrapper) is consumed by
  Task 4 step 7, which inserts `<app-widget-menu>` into the already-restructured template.
  Plan order has Task 2 before Task 4 - clean.
- Task 3 (WidgetMenu component) is consumed by Task 4 (stat-tile/torrent-list-widget) and
  Task 7 (pie-chart-widget). Plan order has Task 3 before both - clean.
- Task 6 (highcharts deps) is consumed by Task 7 (pie-chart-widget.ts imports highcharts /
  highcharts-angular). Plan order has Task 6 before Task 7 - clean.
- Task 7 (PieChartWidget) is consumed by Task 8 (gridstack registration). Order clean.
- No task's own text contradicts itself (test expectations match the implementation each step
  specifies).

Scan is clean. No rulings needed beyond the working-tree note above. Proceeding to Task 1.

## Task 1: Pie-chart data model + selector

Implementer reported DONE_WITH_CONCERNS. Commit 727d35f "#324: add pie-chart data model and
selector". 16/16 tests passing (TDD RED confirmed before, GREEN after). Concern raised: widening
`WidgetTypeId`/`WidgetConfig` unions makes `widget-catalog.ts` and `dashboard.ts` fail to
typecheck (both switch exhaustively on the old union) - confirmed these are the only 3 tsc
errors project-wide, none in the 3 files this task touched.
Ruling: expected, not a defect - Task 5 rewrites `widget-catalog.ts` and Task 4 rewrites
`dashboard.ts`'s `items()` to handle `pie-chart`, both later in this same plan. The app stays
non-typechecking between Task 1 and Task 4/5 by design of the plan's task ordering; no action
needed now. Cost if wrong: none - later tasks resolve it, and the resolution is not optional
(both files are directly rewritten by name later in this plan).

Task 1: complete (commits ddcd3ee..727d35f, review skipped per user instruction)

## Task 2: Fix widget-row height + scrollbar-inside-border on torrent-list-widget

Implementer reported DONE_WITH_CONCERNS. Commit 875c47b "#324: fix fixed-height rows and
scrollbar gutter on torrent-list-widget". 6/6 tests passing (RED 1 fail/5 pass before, GREEN
6/6 after). Concern: to get a real TestBed run despite the known Task-1-flagged whole-app
typecheck breakage, the implementer temporarily patched `widget-catalog.ts`/`dashboard.ts`
in-session, then fully reverted both before committing only its 3 owned files.
Verified: `git status --short` post-completion shows no stray changes - `dashboard.ts`'s diff
matches the pre-existing working-tree baseline exactly, `widget-catalog.ts` shows no diff at
all (unchanged from HEAD). Ruling: no action needed, self-correcting behavior confirmed clean.

Task 2: complete (commits 727d35f..875c47b, review skipped per user instruction)
