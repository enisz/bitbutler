# Task 2 Report: Fix widget-row height + scrollbar-inside-border on `torrent-list-widget`

## Status: DONE_WITH_CONCERNS

## What was implemented

Exactly the 6 steps in the brief, scoped to the three named files:

1. `torrent-list-widget.spec.ts` - added the pinning assertion (`.torrent-list-widget__scroll`
   truthy + `table` carries the `torrent-list-widget__table` class) to the existing "should render
   one row per data.rows entry" test.
2. `torrent-list-widget.html` - full-file replacement per the brief: wraps the table in
   `.torrent-list-widget > .torrent-list-widget__scroll > table.torrent-list-widget__table`.
3. `torrent-list-widget.scss` - full-file replacement per the brief: `.torrent-list-widget` is now
   the bordered/rounded/`overflow: hidden` card; `&__scroll` owns `overflow-y: auto` plus a
   `padding-right` gutter; `&__table` has no height rule (intrinsic row height, no more stretch/shrink).

All code copied verbatim from the brief - no deviation.

## TDD evidence

### RED

Command: `npm test --workspace=@bitbutler/app -- --include "**/torrent-list-widget.spec.ts"` (see
"Test command and whole-app build" note below), run after Step 1 (test written) and before Step
3/4 (template/styles restructured):

```
 ✓ formattedValue > should format ratio with two decimals
 ✓ formattedValue > should format dlspeed and upspeed as bytes/sec
 ✓ formattedValue > should format progress as a whole percentage
 ✓ formattedValue > should pass name and state through unchanged
 ✓ formattedValue > should show a dash for an empty category
 × should render one row per data.rows entry with the configured columns
   AssertionError: expected null to be truthy
   at torrent-list-widget.spec.ts:62:24 (scrollHost)

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

Matches the brief's expected failure exactly (`.torrent-list-widget__scroll` not found).

### GREEN

Same command, run after Steps 3-4:

```
 ✓ formattedValue > should format ratio with two decimals
 ✓ formattedValue > should format dlspeed and upspeed as bytes/sec
 ✓ formattedValue > should format progress as a whole percentage
 ✓ formattedValue > should pass name and state through unchanged
 ✓ formattedValue > should show a dash for an empty category
 ✓ should render one row per data.rows entry with the configured columns

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

Re-ran once more after the commit (post lint-staged/prettier auto-reformat of the HTML
indentation) for a final clean confirmation - same result, 6/6 passing.

## Files changed

- `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html`
- `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss`
- `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts`

Commit: `875c47b` - `#324: fix fixed-height rows and scrollbar gutter on torrent-list-widget`

## Self-review

- **Completeness:** All 6 steps done. `git show --stat HEAD` confirms only the three named files
  in the commit (3 files changed, 62 insertions, 20 deletions).
- **Quality:** SCSS/HTML match the brief byte-for-byte (verified via `git diff` before staging).
  Comments (`:host` sizing rationale, overflow-hidden clipping rationale, scroll gutter rationale,
  no-height-on-table rationale) all present as given.
- **Discipline:** Did not add `<app-widget-menu>` (Task 4's job). Did not touch `widget-catalog.ts`
  or `dashboard.ts` in the final committed state (see concern below for how they were used
  transiently, then fully reverted, purely to run real tests). `git status` before `git add`
  showed only the three target files as candidates; nothing else was staged.
- **Testing:** The new assertion is a real regression pin - it fails on the old markup (RED
  confirmed) and passes only once both the wrapper div and the table's `__table` class exist
  (GREEN confirmed). Test output is pristine (6/6, no warnings, no skipped tests).

## Concerns

1. **The whole-app `ng test` build is currently broken for reasons entirely unrelated to this
   task**, which complicated verification. This is the same issue Task 1's implementer already
   flagged and the SDD ledger (`progress.md`) already ruled "expected, not a defect, resolved by
   Task 4/5": `widget-catalog.ts`'s `WIDGET_CATALOG: Record<WidgetTypeId, WidgetCatalogMeta>` is
   missing a `'pie-chart'` entry, and `dashboard.ts`'s `dataFor`/`dataCache` types are still
   `StatTileData | TorrentListData` (not widened to include `PieChartData`), both stemming from
   Task 1's `WidgetTypeId`/`WidgetConfig` union widening. Since the Angular vitest builder
   type-checks the whole project as one program regardless of `--include` filtering, this blocks
   *any* `ng test` run right now, not just this widget's.
   - To get a genuine RED/GREEN run through the **real** `ng test` (Angular TestBed, real
     `templateUrl`/`styleUrl` resolution - a bare `vitest run` bypass wouldn't set up the Angular
     testing environment at all, unlike Task 1's plain-function spec), I temporarily patched
     `dashboard.ts` (widened the `StatTileData | TorrentListData` union to include `PieChartData`
     in 2 spots) and `widget-catalog.ts` (added a throwaway `'pie-chart'` catalog entry with a
     `defaultConfig: { groupBy: 'state' }`) purely as local, uncommitted, in-session scaffolding -
     ran the real test suite for RED and again for GREEN and again post-commit, then fully
     reverted both files each time. Verified via `git diff`/`git status` after each revert that
     both files ended up in exactly their prior state (`widget-catalog.ts` shows zero diff -
     matches committed HEAD; `dashboard.ts` shows only its pre-existing, unrelated uncommitted
     prep diff, with no `PieChartData` residue) before staging/committing only the three
     torrent-list-widget files.
   - Flagging this explicitly since it's a second, independent confirmation (after Task 1's) that
     the whole-app build stays red between now and whichever task lands `widget-catalog.ts`
     (Task 5 per the plan) and `dashboard.ts`'s `items()` rewrite (Task 4) - worth keeping in mind
     for Task 3's implementer too, in case it also needs a component-level (TestBed-requiring) test.
