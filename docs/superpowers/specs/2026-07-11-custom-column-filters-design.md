# Custom column filters for text, number, size, and multi-select fields

Fixes #216

## Overview

Replace the built-in `agTextColumnFilter`/`agNumberColumnFilter` on the torrent grid with custom filter components that match the app's existing UI conventions (operator dropdown + value input + Apply/Clear buttons, same interaction language as `DatepickerRangeFilter`), and close a gap where formatted size columns (`size`, `downloaded`, `uploaded`, speeds, limits) have no filter at all today.

Four new filter types:

- **Text filter** - operator + free-text value.
- **Number filter** - operator + numeric value(s).
- **Size filter** - number filter plus a unit selector, for byte-valued columns.
- **Set filter** - a searchable checkbox list of distinct values, for `state`, `category`, and `tags`.

This is a UI/column-filter change only. It does not touch `FilterService`'s sidebar filters (`states`/`categories`/`tags`/`trackers`/`savePaths` Sets) - those remain the app-wide quick filters in the left sidebar (`Status` component), driven by `isExternalFilterPresent`/`doesExternalFilterPass`. The new column filters are standard AG Grid column filters (populate the `columns` part of `GridFilterState`, persisted the same way `DatepickerRangeFilter`'s model already is) and get ANDed with the sidebar filters automatically by AG Grid. No changes are needed to make the two coexist.

Regex matching for the text filter (`Matches regex` / `Does not match regex` operators) is a deliberate future follow-up, not part of this spec.

## File layout

New folder: `packages/app/src/app/components/column-filters/`

- `text-column-filter/` - `.ts`/`.html`/`.scss`/`.spec.ts`
- `number-column-filter/` - `.ts`/`.html`/`.scss`/`.spec.ts`
- `size-column-filter/` - `.ts`/`.html`/`.scss`/`.spec.ts`
- `set-column-filter/` - `.ts`/`.html`/`.scss`/`.spec.ts`
- `operator-filter.utils.ts` - pure, framework-free operator enums and comparison functions shared by the text/number/size filters.
- `operator-filter-base.ts` - abstract base class shared by the text/number/size filters, handling the draft/applied value lifecycle common to all three (see below).
- `datepicker-range-filter/` - the existing component, **moved here unchanged** (file move only, no code or behavior changes) so all AG Grid custom filter components live in one place. Its only external reference, the import in `grid.lib.ts`, gets updated to the new path.

The set filter does not extend `operator-filter-base.ts` - it has no operator dropdown and a different apply lifecycle (a list of toggled checkboxes rather than an operator + value pair), so it implements `IFilterAngularComp` directly, the same way `DatepickerRangeFilter` does.

## Shared base: `operator-filter-base.ts`

An abstract class implementing the parts of `IFilterAngularComp` that are identical across the text/number/size filters:

- `agInit(params)` - stores `params`.
- Draft state (what's currently typed/selected in the popup, not yet applied) vs. applied state (what's actually driving `doesFilterPass`), matching the `fromDate`/`appliedFrom` pattern in `DatepickerRangeFilter`.
- `apply()` - copies draft to applied, calls `params.filterChangedCallback()`.
- `clear()` - resets both draft and applied, calls `params.filterChangedCallback()`.
- `isApplyDisabled()` - true when draft equals applied (nothing to apply).
- `isFilterActive()` - true when the applied state represents an active filter.
- `getModel()`/`setModel()` - delegate to abstract methods each subclass implements for its own model shape, so grid-state save/restore (`GridStateService`) works the same way it already does for `DatepickerRangeFilter`.

Each subclass supplies its own template, operator list, and `doesFilterPass()` (using the shared pure comparison functions below).

## `operator-filter.utils.ts`

Pure functions, no Angular/AG Grid dependency, directly unit-testable:

```ts
type StringOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

type NumberOperator =
  | 'equals'
  | 'notEqual'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank';

function stringOperatorPasses(
  operator: StringOperator,
  cellValue: string | null | undefined,
  filterValue: string,
): boolean;
function numberOperatorPasses(
  operator: NumberOperator,
  cellValue: number | null | undefined,
  from: number | null,
  to: number | null,
): boolean;
```

Matching rules:

- String comparisons are case-insensitive (consistent with the sidebar's existing `search` filter in `FilterService`, which lowercases both sides).
- `blank` means the cell value is `null`, `undefined`, or (for strings) an empty/whitespace-only string.
- `between` is inclusive on both ends (consistent with `DatepickerRangeFilter`'s date range).
- Blank/Not blank ignore `filterValue`/`from`/`to` entirely, both in the comparison function and in the UI (inputs are disabled when one of these operators is selected).

## Component: Text filter (`text-column-filter`)

Operators: Contains, Does not contain, Equals, Does not equal, Begins with, Ends with, Blank, Not blank.

Layout: `ng-select` (operator) on the top row, a text input below it (disabled when the operator is Blank or Not blank), then an Apply/Clear button row. The two buttons sit side by side in a flex row (`d-flex gap-2`, each `flex-fill` so they split the available width evenly), each with the icon on the trailing side (`bb-btn-content [position]="'end'"`, `btn-split` class) - the same button treatment `DatepickerRangeFilter` and `Status`'s "Clear all" button already use.

Model: `{ operator: StringOperator; value: string }`.

## Component: Number filter (`number-column-filter`)

Operators: Equals, Does not equal, Greater than, Greater than or equal to, Less than, Less than or equal to, Between, Blank, Not blank.

Layout: same as the text filter, except `Between` swaps the single value input for two inputs (From/To). Both disabled for Blank/Not blank.

Model: `{ operator: NumberOperator; from: number | null; to: number | null }` (`to` only meaningful for `between`).

## Component: Size filter (`size-column-filter`)

Same operator set and layout as the number filter, plus a unit `ng-select` (B, KB, MB, GB, TB - matching the labels `formatBytes()`/`filesize` already produces with the `jedec` standard used elsewhere in the app). Typed values are scaled to raw bytes (KB = ×1024, MB = ×1024², etc.) before being handed to `numberOperatorPasses()`, so it reuses the exact same comparison logic as the plain number filter.

Model: `{ operator: NumberOperator; from: number | null; to: number | null; unit: 'B' | 'KB' | 'MB' | 'GB' | 'TB' }`. Storing the unit alongside the raw typed values (rather than normalizing to bytes at save time) means reopening the filter shows exactly what was typed, not a recalculated value.

## Component: Set filter (`set-column-filter`)

For `state`, `state_hr`, `category`, and `tags` columns.

Layout: a text input at the top to narrow the checkbox list (reusing the same `bb-filter-input`/`bb-filter-clear` markup and behavior already used in `filter-group.html`), then a scrollable list of checkboxes, each with a trailing count badge, then the same flex-row Apply/Clear button pair described for the text filter. Checkbox toggles update draft state only; Apply commits it and triggers `filterChangedCallback()`, Clear resets both draft and applied - this is a deliberate consistency choice so all four new filter types share one interaction language, even though the sidebar's equivalent single-select lists apply instantly.

`doesFilterPass()`: passes if no values are selected (filter inactive) or the cell's value is in the selected set. For `tags` (a comma-joined field), it passes if any of the cell's parsed tags is in the selected set - the same "any overlap" semantics `FilterService`'s existing tag matching already uses.

Model: `{ values: string[] }` (a `Set` serialized to an array so it round-trips through `GridStateService`'s persisted, JSON-serializable filter model).

### Distinct value source

`category`/`tags` counts are already computed inline in `Status` (`categoriesWithCounts`, `tagsWithCounts` in `status.ts`), and `state` counts already exist as `TorrentStoreService.countsByState`. Rather than duplicating that computation inside the new filter component, this hoists it into `TorrentStoreService` as shared computed signals:

- `categoriesWithCounts` - moved from `status.ts`, unioning known category names (`categoriesMap`) with counts from current torrent data, so a category with zero torrents still shows up (needed for the "manage categories" flow).
- `tagsWithCounts` - moved from `status.ts`, same union pattern with `tagsSet`.
- `statesWithCounts` (new) - built from the existing `countsByState`. Checkbox labels are the raw `TorrentState` string itself (e.g. `downloading`, `pausedUP`) - **not** the `torrent.state.<value>` translation keys, which turn out to be full descriptive sentences ("Torrent is downloading and data is being transferred.") used as tooltip text elsewhere, not short labels. Using the raw value matches what the `state` column already displays and avoids introducing new translation keys for this.

Both `Status` and `SetColumnFilter` consume these from `TorrentStoreService` instead of computing them separately. This mirrors AG Grid's own Set Filter convention: the list reflects values currently present in the loaded data, not a hardcoded enum, and grows/shrinks as torrents are added or removed - the same behavior the sidebar already has today.

## Column wiring (`grid.lib.ts`)

- **Text filter** replaces `filter: 'agTextColumnFilter'` on: `name`, `hash`, `tracker`, `save_path`, `download_path`, `content_path`, `magnet_uri`, `infohash_v1`, `infohash_v2`.
- **Number filter** replaces `filter: 'agNumberColumnFilter'` on all remaining plain/`_raw` numeric columns: `progress_percentage`, `progress_raw`, `size_raw`, `total_size_raw`, `completed_raw`, `amount_left_raw`, `downloaded_raw`, `downloaded_session_raw`, `uploaded_raw`, `uploaded_session_raw`, `dlspeed_raw`, `upspeed_raw`, `ratio`, `eta_raw`, `trackers_count`, `dl_limit_raw`, `up_limit_raw`, `max_ratio`, `ratio_limit`, `seeding_time_raw`, `time_active_raw`, `num_seeds`, `num_leechs`, `num_complete`, `num_incomplete`, `priority`, `max_seeding_time_raw`, `max_inactive_seeding_time_raw`, `inactive_seeding_time_limit_raw`.
- **Size filter** is added (new `filter:` property, none exists today) on the byte-valued, human-formatted columns: `size`, `total_size`, `completed`, `amount_left`, `downloaded`, `downloaded_session`, `uploaded`, `uploaded_session`, `dlspeed`, `upspeed`, `dl_limit`, `up_limit`.
- **Set filter** replaces `filter: 'agTextColumnFilter'` on: `state`, `state_hr`, `category`, `tags`.
- `tracker` and `save_path` stay on the text filter (not the set filter) - they're free text where "contains" is more useful than a checkbox list, and the sidebar already provides quick single-value access to their distinct lists. Extending the set filter to them is an explicit non-goal for this spec.
- All four new filter types set `floatingFilter: false`, matching `DatepickerRangeFilter` - only the full popup UI, no compact floating-row equivalent.

`added_on`, `last_activity`, `seen_complete`, `completion_on` keep their existing `DatepickerRangeFilter` wiring, untouched except for the import path following the file move.

## Testing

- `operator-filter.utils.ts`: direct unit tests covering the operator × edge-case matrix (null/undefined/empty-string cells, `between` boundary inclusivity, blank/not-blank ignoring supplied values).
- Each component gets a `.spec.ts` following the existing `datepicker-range-filter.spec.ts` pattern: `agInit`/`getModel`/`setModel` round-trip, Apply/Clear enabling/disabling, `doesFilterPass` for representative cases per operator.
- `TorrentStoreService`: unit tests for the new/moved `categoriesWithCounts`, `tagsWithCounts`, `statesWithCounts` computed signals (zero-count categories/tags included, counts match data).

## Out of scope

- Regex operators for the text filter (`Matches regex` / `Does not match regex`) - future follow-up.
- Extending the set/checkbox filter to `tracker` or `save_path` columns.
- Any change to `FilterService`'s sidebar filters or `Status` component's single-select UI/behavior beyond the count-computation hoist described above.
