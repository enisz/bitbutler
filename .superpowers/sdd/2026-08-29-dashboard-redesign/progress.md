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

## Cross-machine resume note

Session resumed on a new machine at commit 2211f44, a WIP handoff commit
that bundles: SDD workspace artifacts (progress.md, task-1/2/3-brief.md,
task-1/2-report.md), the already-complete Task 3 implementation + i18n
keys (code was fully written pre-handoff, only its own test/lint pass and
report were pending), and pre-existing uncommitted baseline-prep diffs for
Tasks 4/5/9 (widget-config.*, widget-picker.*, dashboard.html/scss/ts,
stat-tile.scss) that were already ruled clean in the pre-flight scan above.
Ruling: accept 2211f44 as-is (already pushed to origin) rather than
unpicking it - Task 3's own commit boundary is folded into this one, but
its file scope is unambiguous from the brief. No action needed; each later
task's own `git add` scope still only touches its own files going forward.

## Task 3: Shared WidgetMenu component

Dispatched a fresh implementer to finish verification only (code + i18n
were already written and committed in 2211f44 by the pre-handoff session).
Implementer reported DONE: 4/4 widget-menu.spec.ts tests passing via the
same temporary-patch-then-revert maneuver Task 2 used to get a real TestBed
run past the known Task-1-flagged whole-app typecheck breakage (patched
dashboard.ts/widget-catalog.ts locally, ran tests, fully reverted - verified
clean via git diff/status). No new commit needed. Report:
task-3-report.md.

Task reviewer (spec + quality): ✅ Spec compliant, byte-for-byte match to
brief. Task quality: Approved. Minor findings (deferred, not blocking):
(1) dropdown toggle/menu clicks don't call stopPropagation() - worth
checking when Task 4/5 embed this inside a draggable Gridstack widget, in
case clicks bubble into drag-start handling; (2) no test asserts the
toggle button's aria-label resolves to the translated string (low risk).

Task 3: complete (commits folded into 2211f44, review clean, 2 minor deferred)

## Task 4: Wire WidgetMenu into the dashboard; remove the manage panel

Implementer reported DONE. Commit 651fa88 "#324: replace the manage panel
with per-widget WidgetMenu". TDD RED (3 failing for the right reason) then
GREEN, 38/38 across dashboard/stat-tile/torrent-list-widget/widget-menu.
Investigated Task 3's deferred stopPropagation concern proactively: confirmed
via GridStack's own dd-draggable.js (skipMouseDown selector excludes all
<button> elements from drag-initiation) and WidgetMenu's dropdown portaling
to <body> that it's a non-issue - no stopPropagation added.

Task reviewer (spec + quality): ✅ Spec compliant, independently verified
(not just trusting the report) - confirmed widget-catalog.ts/dashboard.ts's
pie-chart-adjacent spots untouched, lint/format clean on all 9 changed
files, GridStack bubbling claim fully verified against vendored library
source. Task quality: Approved. One minor noted (not a defect): `catalog`
field in dashboard.ts is temporarily unused within this task's own diff,
inert until Task 5 wires the offcanvas picker - explicitly sanctioned by
the brief's own text.

Task 4: complete (commits 2211f44..651fa88, review clean, 1 minor deferred)

## Pre-Task-5 plan-gap check

Grepped the whole plan for every `StatTileData`/`dataFor`/`dataCache` mention
before dispatching Task 5. Finding: no task in the plan (checked Tasks 5
through 10 explicitly, including Task 8 "Register pie-chart end-to-end")
ever widens `dashboard.ts`'s `dataCache` Map value type or `dataFor()`'s
declared return type from `StatTileData | TorrentListData` to include
`PieChartData` - even though Task 1 already made `resolveWidgetData` return
that 3-way union, and `dataFor` calls `resolveWidgetData` and returns its
result directly. This is 2 of the 3 tsc errors Task 1's implementer
originally flagged (confirmed still present, unchanged, after Task 4).
Task 5's brief only fixes the 3rd (widget-catalog.ts's missing 'pie-chart'
Record entry) - it does not touch dataFor/dataCache. Left as specified,
the whole-app build would stay non-typechecking even after all 10 tasks
land.
Ruling: fold a 2-line, purely-additive type widening (`dataCache`'s Map
value type and `dataFor`'s return type both become
`StatTileData | TorrentListData | PieChartData`) into Task 5's dispatch,
since Task 5 already touches `dashboard.ts` and is the task the earlier
ledger entry (Task 1's ruling) implied would jointly restore
whole-app typechecking together with Task 4. Cost if wrong: trivial - pure
type annotation widening with no behavior change, required by some task
regardless of when it lands, and cheaper to add now than to surface as a
Critical finding in the final whole-branch review.

## Task 5: Widget picker offcanvas + catalog icon/description metadata

Implementer reported DONE. Commit 3f9aac9 "#324: move widget picker to an
offcanvas; add catalog icon/description metadata". 3/3 touched spec files
green (widget-catalog 5/5, widget-picker 3/3, dashboard 33/33), full app
suite 2409/2409 passing. Also applied the controller ruling above (dataFor/
dataCache PieChartData widening) in the same commit. Confirmed whole-app
`npm run build` succeeds cleanly - the app fully typechecks again. One
incidental fix noted: widget-picker.html needed an eslint --fix formatting
pass (whitespace only) to satisfy max-warnings=0.

Task reviewer (spec + quality): ✅ Spec compliant, all 9 brief files plus
the ruling's dashboard.ts widening verified present and correctly scoped.
Independently re-ran `npm run build --workspace=@bitbutler/app` (not just
trusting the report) - confirmed clean. Task quality: Approved. Zero
findings, including Minor.

Task 5: complete (commits 651fa88..3f9aac9, review clean)

## Task 6: Add the Highcharts dependency

Implementer reported DONE. Commit 61f00c7 "#324: add highcharts and
highcharts-angular dependencies". highcharts@12.6.0 / highcharts-angular@5.4.1
installed, both satisfy the brief's semver ranges, no unmet/peer warnings.

Task reviewer: ✅ Spec compliant, lockfile diff clean (36 insertions, just
the two packages + tslib transitive dep, no unrelated churn). Task quality:
Approved. Zero findings.

Task 6: complete (commits 3f9aac9..61f00c7, review clean)

## Task 7: PieChartWidget component

Implementer reported BLOCKED on first attempt: the brief's Step 4 code
imports `HighchartsChartModule` from `highcharts-angular` and binds
`[Highcharts]="Highcharts"` on `<highcharts-chart>` - neither exists in the
installed highcharts-angular@5.4.1 (Task 6 pinned `^5.4.1`, which dropped
`HighchartsChartModule` for a DI-based `provideHighcharts()` + standalone
`HighchartsChartComponent`/`HighchartsChartDirective`, no `Highcharts`
input at all). Independently verified against
node_modules/highcharts-angular/public_api.d.ts,
lib/highcharts-chart.component.d.ts (inputs are only `constructorType`,
`oneToOne`, `options`, `update` - no `Highcharts`), and the package's own
README's v5.0.0+ usage docs. Confirmed via plan-wide grep: no task ever
adds `provideHighcharts()` to `app.config.ts` either - this is a genuine
plan defect (the plan's Task 7 code was written against an older
highcharts-angular major), not implementer error.
Ruling: (1) add `provideHighcharts()` to
`packages/app/src/app/app.config.ts`'s providers array (import from
`highcharts-angular`) - this file isn't in any task's file list, so
scope it into Task 7's commit since Task 7 is the first and only task
that needs it; (2) in pie-chart-widget.ts, import `HighchartsChartComponent`
instead of `HighchartsChartModule`, keep `import * as Highcharts from
'highcharts'` only for typing (`Highcharts.Options`/`SeriesPieOptions`),
drop `readonly Highcharts = Highcharts` and the template's
`[Highcharts]="Highcharts"` binding (component resolves the Highcharts
instance via DI now); keep everything else (buildOptions() logic, the 3
tests, WidgetMenu wiring) exactly as specified since only the
module-wiring API surface changed, not the chart-building logic. Cost if
wrong: low - confirmed directly against the installed package's own
.d.ts files and README, not guessed from memory; re-dispatched to the
same implementer with this exact correction.

Implementer applied the ruling, independently re-verified it against the
installed package, and found one additional wrinkle on its own: the
spec's `fixture.detectChanges()` actually constructs the real
`<highcharts-chart>` child, throwing `NG0201: No provider found for
HIGHCHARTS_LOADER` - fixed by adding a never-resolving
`provideHighcharts({ instance: () => new Promise(() => {}) })` stub to
the spec's own TestBed providers (scoped per-file, no test-pollution
risk). Commit ad94bb5 "#324: add PieChartWidget" (7 files, includes
app.config.ts per the ruling). 3/3 widget tests pass, full app suite
2412/2412, lint clean, whole-app build succeeds with highcharts
lazy-chunked.

Task reviewer (spec + quality): ✅ Spec compliant, independently
re-verified the v5.4.1 API facts against the installed .d.ts files
(not just trusting the ruling or the report), re-ran the 3 widget tests
and the whole-app build itself - both confirmed clean. Task quality:
Approved. Zero Critical/Important findings; 2 minor notes, both already
correctly handled (test-provider stub is well-scoped and commented;
Task 8 async-first-paint flag is a legitimate forward note, not a
defect here).

Task 7: complete (commits 61f00c7..ad94bb5, review clean)

## Task 8: Register pie-chart end-to-end on the dashboard

Implementer reported DONE_WITH_CONCERNS. Commit 4461d42 "#324: register
PieChartWidget with the dashboard grid". Full suite 2413/2413 passing (no
true RED/GREEN pair possible for the new test, as the brief itself
anticipated - gridstack's registry has no unit-test seam). Only concern:
Step 4's interactive/visual verification (add pie chart via UI, confirm
donut renders/recolors/reconfigures) could not be performed - no GUI/
display access in this headless environment. Lint clean, production build
succeeds with dashboard chunk present, Electron main/preload TS watch
compiles clean.

Task reviewer (spec + quality): ✅ Spec compliant, diff is exactly the
minimal 2-file registration the brief calls for. Task quality: Approved.
Zero findings. Reviewer explicitly agreed the missing interactive
verification is an accepted environment limitation, not a defect.

**Outstanding: Step 4's interactive/visual check (add a pie-chart widget,
confirm donut renders + recolors on theme switch + updates on reconfigure)
has never been performed by anyone in this SDD run - flag to the human
before merge/ship.**

Task 8: complete (commits ad94bb5..4461d42, review clean, 1 outstanding
manual-verification item flagged above)

## Task 9: WidgetConfigModal groupBy branch for pie-chart

Implementer reported DONE. Commit f217189 "#324: add pie-chart groupBy
config to WidgetConfigModal". 8/8 widget-config tests (2 new), full app
suite 2415/2415, lint/prettier clean. Noted the same known npm/ng-test
arg-parsing quirk from Tasks 1/2/9 (worked around identically, expected).

Task reviewer (spec + quality): ✅ Spec compliant, exact structural mirror
of the stat-tile branch, torrent-list body verified byte-for-byte
unchanged, i18n correctly placed in both locales. Task quality: Approved.
One Important finding raised for visibility only (near-duplicate ng-select
markup between stat-tile/pie-chart branches) - explicitly plan-mandated
per the brief's own verbatim code, not an implementer defect, no fix
required within this task's scope.

Task 9: complete (commits 4461d42..f217189, review clean, 1 plan-mandated
duplication noted for visibility)

## Task 10: Final verification pass

Verification-only task, no code changes needed (no diff produced - HEAD
stays at f217189). Reported DONE_WITH_CONCERNS: `npm run lint` clean
(0 warnings/errors), `npm test` clean (app 165 files/2415 tests, electron
21 files/342 tests), `npm run build --workspace=@bitbutler/app` clean
(highcharts correctly lazy-chunked). Electron main/preload tsc also
compiles clean. No task-reviewer dispatch needed (no diff to review).

Same environment limitation as Task 8: no GUI/display access, so the
9-item interactive checklist (edit-mode toggle, widget-menu placement,
offcanvas picker, torrent-list scrollbar/row-stretch fix, pie-chart
render/recolor/reconfigure) was NOT verified interactively by anyone in
this SDD run. Step 5 (removing the spec/plan docs) correctly skipped per
the brief's own instruction - pending user confirmation the feature is
done and ready for PR.

**Outstanding for the human before merge/PR: the full 9-item manual
checklist in Task 10's brief (superset of Task 8's single pie-chart
check) has never been run interactively.**

Task 10: complete (no commits - verification only, all automated checks
clean, 1 outstanding manual-verification item flagged above)

## Final whole-branch review (Opus, range ddcd3ee..f217189 - this plan's
own controlled commits, not the whole 324-dashboard-page branch back to
main, which carries unrelated pre-existing history out of this run's
scope)

Verdict: Ready to merge - With fixes. Zero Critical. 5 Important, 9 Minor.
Reviewer independently verified both prior controller rulings (Task 5's
dataFor widening, Task 7's highcharts-angular API fix) were correct calls,
confirmed i18n fully consistent across all 9 commits, confirmed theme
token discipline holds across all 16 family/mode combinations, confirmed
no IPC/attack-surface changes, and confirmed the Task 4 stopPropagation
non-issue at the GridStack source.

Adjudication of the 5 Important findings:
1. **Highcharts is proprietary-licensed (Highsoft Standard License), not
   OSI - BitButler is MIT.** A genuine third plan gap (spec's dependency
   check only verified the Angular peer-range, never checked licensing).
   Ruling: this is a business/legal decision, not mine to make - ESCALATED
   to the human, not auto-fixed. Do not swap the charting library
   unilaterally. Cost if left unaddressed: real - commercial/redistribution
   use requires a paid Highsoft license; flagged prominently to the user.
2. **Deleting the last widget likely leaves it stuck on the grid**
   (dashboard.ts - GridStack's `updateOptions` only calls `load()` when
   `children.length` is truthy, so an empty array never triggers removal).
   Pre-existing bug, but now user-facing via the plan's own change (manage
   panel removed, ellipsis Delete is the only path). Ruling: real
   correctness bug on this plan's own headline interaction - INCLUDED in
   the fix wave.
3. **PieChartWidget's `buildOptions()` forces a full Highcharts redraw +
   double `getComputedStyle()` on every poll tick**, since it returns a
   fresh object every call and gridstack's `deserialize`/`setInput` re-sets
   `data` every `load()`. Ruling: real, but the architecturally-clean fix
   (making `dataFor()`'s selectors referentially stable) touches shared,
   risky, all-widget-types code with no dedicated review loop of its own.
   Scoped a SAFE, contained fix instead: memoize `buildOptions()`'s result
   inside PieChartWidget only (return the same object reference when
   data+theme are unchanged, relying on Angular's own template-binding
   reference-equality skip) - INCLUDED in the fix wave, scoped to this one
   file only.
4. **No test asserts the WidgetMenu integration seam** in any of the 3
   widget specs (renders when editMode, configure/remove reach
   onConfigure/onRemove) - a real, cheap-to-close gap. INCLUDED in the fix
   wave (one assertion per widget spec).
5. **Tracked SDD workspace files under gitignored `.superpowers/` and
   leftover previous-plan docs** (`docs/superpowers/{specs,plans}/
   2026-08-29-dashboard-page*.md`) still present. Ruling: per CLAUDE.md's
   "Specs & plans" section and this plan's own Task 10 Step 5, this
   cleanup happens in its own commit ONLY once the user confirms the
   feature is done and ready for PR - NOT auto-fixed now. Flagged as
   pending pre-PR cleanup, expanded to cover the leftover previous-plan
   files too (not just this plan's own 2 files).

Minor findings: #6 (dead `catalog` field), #9 (stale `as any` casts), #10
(non-null-assertion callback inputs - safety) INCLUDED in the fix wave as
cheap/safe. #8 (delete 2 empty unused SCSS files + their styleUrl refs)
INCLUDED. #11 (dedupe 2 getComputedStyle calls) folded into the #3 fix
since it's the same file. Parked, not fixed: #7 (widget-card SCSS
triplication - real but a refactor-scope decision, deferred), #12
(tooltip clipping - needs the outstanding manual/visual pass to confirm
first), #13 (empty-pie blank-card UX - consistent with existing
stat-tile/torrent-list pattern, not a regression), #14 (dataCache never
evicts - pre-existing, bounded, unrelated to this branch).

Dispatching ONE fix subagent with this complete list (FIX_BASE f217189),
then one scoped re-review, per process (no second fix wave).

## Human decision: Important finding #1 (Highcharts license)

Presented to the user via AskUserQuestion. User confirmed understanding
(MIT = free/permissive even for commercial use; Highsoft's license is the
opposite, free tier excludes commercial use - bundling it under an MIT
project puts downstream commercial users in violation without their
knowledge) and chose: swap to Chart.js (MIT-licensed, closest equivalent).

Ruling: this supersedes Task 6 and Task 7's original Highcharts-based
implementation. Once the in-flight final-review fix wave completes and is
re-reviewed, redo Task 6 (deps: chart.js + an Angular wrapper, likely
ng2-charts, both MIT - verify current versions/Angular-22-zoneless
compatibility before committing, same rigor as the original Highcharts
install) and Task 7 (rewrite PieChartWidget against Chart.js's API) as a
new, ad hoc implement+review cycle - not from the plan's original
Highcharts-specific brief text, which is now obsolete for these two tasks.
Cost if wrong: contained - the charting logic was already isolated to
`pie-chart-widget.ts`/`.html`/`.scss` plus the `highcharts`/
`highcharts-angular` package.json entries and `app.config.ts`'s
`provideHighcharts()` call, confirmed by the final reviewer as "the only
chart-library-aware code in the branch."

## Final fix wave (commit dc13c49) + scoped re-review

All 6 dispatched findings ADDRESSED per the scoped re-reviewer: delete-
last-widget grid fix (verified against GridstackComponent's real `.grid`
getter, 2 new tests), PieChartWidget buildOptions() memoization + deduped
getComputedStyle (4 new tests), WidgetMenu integration tests added to all
3 widget specs (verified ngbDropdown items are unconditionally in the DOM
once visible() is true, so direct .click() assertions are valid), dead
`catalog` field removed (confirmed genuinely unused), stale `as any` casts
removed, empty scss files + styleUrl refs removed, onConfigure/onRemove
made optional with template optional-chaining. Full suite 2424/2424, lint
clean, build clean.

Re-reviewer found ONE new Important-severity regression introduced by the
fix itself: `pie-chart-widget.ts`'s new memoization cache key
(`JSON.stringify({ data, family, mode })`) omits the active translation
language. For `groupBy: 'state'` pie charts, slice names are translated
imperatively inside `buildOptions()` (a cache miss only re-translates);
unlike `StatTile`'s template-pipe label (which resubscribes to
`onLangChange`), a runtime language switch with otherwise-unchanged data
would leave the pie chart's legend/labels stuck in the old language until
the underlying data next changes.

Ruling: per process, no second fix wave. This finding is PARKED, not
separately fixed - real, but not build-breaking/data-loss/security, and
nothing further downstream in this plan builds on it (this is the last
review before finishing the branch). Explicitly folded into the incoming
Chart.js rewrite instead (see below): the Chart.js version's own equivalent
caching, if any, must include the active translation language
(`translate.currentLang` or equivalent) in its cache key from the start,
closing this exact gap as part of replacing the file rather than patching
Highcharts-specific code about to be deleted. Cost if wrong: low - the
whole file is being rewritten regardless of this finding; the ruling only
requires remembering to carry the language dependency into the rewrite,
which is now recorded here.

Final whole-branch review (post-fix): all originally-reported findings
resolved (6/6) or explicitly ruled/parked (Important #1 Highcharts license
- escalated to human, Important #5 SDD/docs cleanup - deferred pending
user pre-PR confirmation, 4 Minor - parked, 1 new Important - parked into
the Chart.js rewrite below). No further automated fix wave.

## Chart.js swap (superseding Task 6/7's Highcharts implementation)

User chose to swap to Chart.js after the license explanation. Implementer
(fresh dispatch, no plan brief - controller-authored spec) delivered:
chart.js@4.5.1 + ng2-charts@10.0.0 (both MIT, independently confirmed via
node_modules package.json), highcharts/highcharts-angular fully removed,
PieChartWidget rewritten (doughnut chart, cutout 60%, same public API/
selector/inputs, same WidgetMenu wiring, same theme-token colors/legend).
Caught and fixed a bundle-splitting regression itself (naive
`provideCharts()` in app.config.ts would have leaked Chart.js into the
main bundle - fixed via `Chart.register()` at module scope inside the lazy
widget file instead, independently re-verified by the reviewer against the
real build output). Also correctly folded in the parked language-cache-key
fix from the prior finding. Commit ea9fdc9 "#324: replace highcharts with
chart.js (MIT license)". 2425/2425 tests, lint/build clean.

Task reviewer: ✅ Spec compliant. Independently verified licenses, bundle-
chunking (grepped built main-*.js - Chart.js absent except a harmless
string literal; present in the lazy dashboard chunk), and specifically
investigated whether the "transparent chart background" requirement was
genuinely met despite an inert `backgroundColor: 'transparent'` config key
- traced Chart.js v4's actual draw/clear paths and confirmed the
requirement IS genuinely satisfied (no canvas-wide fill path reachable for
a doughnut chart with no registered scale). Task quality: Approved. One
Important finding: the language-cache-key fix is correct but the language
signal isn't wired the same way as ~10 other components in this codebase
(`toSignal(translateService.onLangChange)`) - reads `translate.currentLang`
as a plain property instead, so a language switch is picked up indirectly
(piggybacking on the next theme/polling-driven CD trigger) rather than
immediately. Two Minor notes (inert config key kept for continuity;
harmless double buildConfig() call per CD pass).

Resumed the same implementer with the Important finding (fix required)
plus the two Minors (optional). Commit d406e1e "#324: make PieChartWidget's
language reactivity signal-driven" - wired `toSignal(translate.onLangChange)`
matching the codebase's established pattern (login.ts/status.ts), read
inside buildConfig() via the same reactive-consumer context as the theme
signals. Also cleaned up the double-buildConfig()-per-CD-pass minor via
`@let config = buildConfig();`. 2426/2426 tests, lint/build clean.

Scoped re-review: ADDRESSED, verified the signal read is genuinely tracked
(not inert), the new test exercises the real zoneless-CD reactivity path
(fires a real TranslateService.use(), awaits whenStable() with no manual
detectChanges/buildConfig call - confirmed this test module runs
zoneless), and confirmed the implementer's fails-without/passes-with claim
is consistent with the actual mechanism. No new breakage. No open
findings remain.

## Chart.js swap: COMPLETE, clean (commits dc13c49..d406e1e)

This closes out all work for the dashboard-redesign plan, including the
post-final-review license-driven charting library swap. No further
automated fix rounds needed.
