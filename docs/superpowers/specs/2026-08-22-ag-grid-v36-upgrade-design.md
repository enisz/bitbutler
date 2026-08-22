# ag-grid v36 Upgrade - Design

**Issue:** #275 (linked under #270)
**Branch:** `275-upgrade-ag-grid-angular-to-v36` (branched off `main` - no peer blocker, per the issue)

## Goal

Bump `ag-grid-angular` (and `@ag-grid-community/locale`) from `35.3.0` to
`36.1.0`, keeping every grid instance in the app rendering, scrolling,
filtering, and theming exactly as before.

## Background

Resolved current versions (all `35.3.0`), all declared only in the root
`package.json` (this is a hoisted-dependency monorepo - `packages/app/package.json`
lists no ag-grid packages, only `@bitbutler/shared`):

- `ag-grid-angular` - `package.json:224` (`"^35.0.0"`)
- `@ag-grid-community/locale` - `package.json:205` (`"^35.2.1"`)
- `ag-grid-community` - transitive dependency of `ag-grid-angular` (not listed
  directly), resolves automatically when `ag-grid-angular` is bumped.

v36's headline change: the grid's internal DOM was restructured from 9+
separate scroll containers into a single natively-scrolling container,
removing the JS-driven scroll sync between header/body/pinned columns.

## Breaking changes relevant to this codebase

Researched against the actual codebase (not assumed from the changelog) - three
of the four risk areas the issue called out turn out to be non-issues here:

1. **DOM restructuring / internal class renames** - grepping
   `packages/app/src` for every scroll-container class named in the v36 migration
   guide (`ag-body-viewport`, `ag-pinned-left-cols-container`,
   `ag-pinned-right-cols-container`, `ag-header-container`, `ag-header-viewport`,
   `ag-floating-top`, `ag-floating-bottom`, `ag-center-cols-viewport`,
   `ag-center-cols-container`, `ag-body-horizontal-scroll`) returns **zero
   hits**. Our own `.ag-*` selectors only touch stable, documented public
   classes, none of which are part of the restructured scroll-container set:
   - `packages/app/src/app/pages/main/grid/grid.scss:1` - `.ag-root-wrapper` (cosmetic `border-radius: 0`)
   - `packages/app/src/app/pages/main/grid/grid.scss:5` - `.ag-header-cell-text` (uppercase + letter-spacing)
   - `packages/app/src/app/pages/main/grid/grid.scss:10` - `.ag-row-selected` (accent box-shadow)
   - `packages/app/src/styles.scss:159-162` - `.ag-header` (border-bottom, scoped under `.bb-ag-light`/`.bb-ag-dark`)
   - `packages/app/src/styles.scss:164-167` - `.ag-row-hover` (background-color)
   - `packages/app/src/styles.scss:169-172` - `.ag-cell-focus` (outline, dark theme only)
   - `packages/app/src/styles.scss:1056-1058` - `.ag-row.bb-row-paused` (opacity)

   No `.ts` file does `querySelector`/`closest`/`classList` work against any
   `ag-`-prefixed class. Risk here is low, but these seven selectors still need
   a manual visual re-check (Task 3) since they are unverified by any automated
   test.

2. **Custom scrollbar CSS experiment** - the issue asks to "manually verify
   the custom scrollbar CSS experiment still applies cleanly against the new
   single-container DOM structure." **No such experiment exists.** The only
   `scrollbar`-related CSS in `packages/app/src` is
   `packages/app/src/app/pages/main/server-state/server-state.scss:1-38`,
   which styles `::-webkit-scrollbar` on `.bb-bottom-bar` - an unrelated
   status bar at the bottom of the main page, not any ag-grid instance. This
   checklist item from the issue does not apply; it's downgraded to a plain
   visual check of the grid's native scrollbar during manual QA (nothing to
   "keep working," just confirm it looks reasonable post-upgrade).

3. **`cellDataType: 'date'` date-only filter values** - zero hits for
   `cellDataType` anywhere in `packages/app/src`. Date columns
   (`added_on`, `last_activity`, `seen_complete`, `completion_on` - all defined in
   `packages/app/src/app/pages/main/grid/grid.lib.ts:458-466,734-771`) use a
   fully custom filter, `DatepickerRangeFilter`
   (`packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.ts`),
   implementing `IFilterAngularComp` directly. Its `doesFilterPass()`
   (lines 80-96) and `getModel()`/`setModel()` (lines 97-105) do their own
   row-data comparison against raw `NgbDate` objects normalized to
   local-midnight epoch millis (`.getTime()` on `new Date(y, m, d)`, no
   `.setHours()` calls) - it never touches ag-grid's built-in date filter
   model. The v36 date-only-filter-model change is not applicable to this
   codebase. No change needed; covered by the filter's own extensive spec
   suite (`datepicker-range-filter.spec.ts`, ~85 `it()` blocks), not by this
   upgrade.

4. **`ValidationModule` no longer bundled into `AllCommunityModule`** - no
   hits for `ValidationModule` or `enableDevValidations` anywhere in the repo.
   `ModuleRegistry.registerModules([AllCommunityModule])` is called in two
   places - `packages/app/src/main.ts:2,6` (real app bootstrap) and
   `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts:75`
   (defensive re-registration for unit tests, since `main.ts` never runs under
   the test runner - see the explanatory comment at lines 70-74). Since we
   never relied on `ValidationModule`'s dev-time console diagnostics, there is
   nothing to restore - **decision: do not call `enableDevValidations()`**.
   This is a deliberate no-op, not an oversight; noted here so it isn't
   re-litigated later.

## What changes in this codebase

### 1. Dependency bump

- `package.json:224` - `"ag-grid-angular": "^35.0.0"` -> `"^36.1.0"`
- `package.json:205` - `"@ag-grid-community/locale": "^35.2.1"` -> `"^36.1.0"`
- `ag-grid-community` bumps automatically via `npm install` (transitive, no
  direct `package.json` entry to edit).

### 2. Official codemod

Run `npx @ag-grid-devtools/cli@latest migrate --from=35 --to=36` per the
issue, to catch any mechanical breakage the manual research above missed
(e.g. renamed/removed API options in `GridOptions`/`ColDef` that aren't
DOM-class-related and wouldn't show up in a class-name grep). Review and
commit whatever it changes.

### 3. Manual QA (no automated coverage exists for this surface)

Per the research, none of the existing specs render the grid in a real DOM
or assert on scroll-container structure - they mock `GridApi` at the logic
level. This means the v36 DOM restructuring, the seven `.ag-*` CSS overrides
above, and the `ag-custom-component-popup` portal mechanism below are only
verifiable manually. Every ag-grid instance in the app needs a visual pass:

- Main torrent grid - `packages/app/src/app/pages/main/grid/grid.ts` /
  `grid.lib.ts` (`getGridColDefs()` at line 52, `getGridOptions()` at line 1066) / `grid.html`, themed via `GRID_LIGHT_THEME`/`GRID_DARK_THEME` in
  `packages/app/src/app/app.const.ts:35-43` (Theming API,
  `themeQuartz.withPart(...).withParams(...)`) and shared
  `GRID_SHARED_OPTIONS` (`app.const.ts:47+`).
- Add Torrent folder picker -
  `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`
- Import Torrents modal -
  `packages/app/src/app/modals/import-torrents/import-torrents.ts`
  (`importGridOptions` at line 273, `getImportColDefs()` at line 331)
- Torrent Details modal, Peers tab -
  `packages/app/src/app/modals/torrent-details/peers/peers.ts`
  (`getGridOptions()` at line 169, `getColDefs()` at line 227)
- Torrent Details modal, Trackers tab -
  `packages/app/src/app/modals/torrent-details/trackers/trackers.ts`
  (`getGridOptions()` at line 163, `getColDefs()` at line 228)

Specifically verify the column-filter popup portal mechanism in
`packages/app/src/app/components/column-filters/operator-filter-base.ts`
(lines 1-83): it creates a `div#{instanceId}-popup-portal.ag-custom-component-popup`
appended to `document.body` in `agInit()` (lines 35-44, removed in
`ngOnDestroy()` at line 48), relying on ag-grid's `PopupService` recognizing
the `ag-custom-component-popup` class to avoid closing the filter popup on
an "outside" click that's actually inside the embedded ng-select dropdown.
This is the one place in the codebase that couples directly to an
ag-grid-recognized class name (as opposed to a purely cosmetic style hook),
used by 11 template bindings across
`duration-column-filter`, `number-column-filter`, `size-column-filter`,
`text-column-filter`, `time-limit-column-filter`, `boolean-column-filter`,
and `ratio-limit-column-filter`. This is a distinct mechanism from `ag-grid`'s
own `ColDef`-level popup parent option and is not documented as changed by
v36, but it has no automated test coverage, so must be exercised manually.

## Testing strategy

- `npm run lint`, `npm run build`, `npm test` immediately after the version
  bump + codemod, before any manual QA, to catch pure version-bump breakage
  and anything the codemod changed but didn't fully migrate.
- Manual QA in a running dev build (`npm start`) across every grid instance
  listed above, in both light and dark themes:
  - Grid renders, scrolls (row and column direction), sorts, and resizes
    columns normally.
  - The seven `.ag-*` CSS overrides still visually apply (rounded corners
    removed on the wrapper, uppercase header text, accent-colored selected
    row, header border, row hover background, dark-theme cell focus outline,
    paused-row opacity).
  - Every column filter type opens and applies correctly, especially the four
    date-range filters (`added_on`, `last_activity`, `seen_complete`,
    `completion_on`) and any filter using the embedded-ng-select popup portal
    (duration/number/size/text/time-limit/boolean/ratio-limit) - confirm the
    filter popup does **not** close when interacting with its embedded
    ng-select.
  - Grid context menu (right-click a cell) still opens correctly.
  - Cell inline editing still starts/stops correctly and pauses polling as
    before (`grid.spec.ts` covers this at the mock level; confirm visually
    too).

## Out of scope

- Any change to `better-sqlite3`, `electron`, or `bootstrap`/`ng-bootstrap`
  (tracked separately under #270).
- `ValidationModule` / `enableDevValidations()` - explicit no-op decision, see
  Breaking Changes item 4.
- Any change to the custom scrollbar CSS the issue mentions - it does not
  exist in this codebase (see Breaking Changes item 2).
- **Calculated columns** (`calculatedExpression`) and **automatic column
  generation** (`autoGenerateColumnDefs`), per the issue - our grids have
  fixed, well-known schemas, so neither buys us anything.
- Documentation site updates - per CLAUDE.md, docs updates happen once the
  feature/PR has stabilized; this is an internal dependency bump with no
  user-facing behavior change, so none is expected, to be reconfirmed once
  implementation is done.
