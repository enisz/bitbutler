# Ratio column filters design

## Problem

The `ratio` column shows a rounded 2-decimal value (`RatioPipe`). Unlike every other numeric
column in the grid, it has no `_raw` sibling showing the exact value the qBittorrent API returns.

`max_ratio` and `ratio_limit` already render friendly text (`Global Limit` / `No Limit` / a
numeric value) via `RatioLimitPipe`, but their filter is a plain `NumberColumnFilter` - it can't
express the `-1`/`-2` sentinel semantics the way `TimeLimitColumnFilter` now does for the
seconds/minutes limit columns (`seeding_time_limit`, `max_seeding_time`, etc.). They also lack raw
siblings, unlike those columns (`seeding_time_limit` / `seeding_time_limit_raw`).

## Scope

New columns (all in `packages/app/src/app/pages/main/grid/grid.lib.ts`):

- **`ratio_raw`** - raw sibling of `ratio`. No `valueFormatter`, `filter: NumberColumnFilter`,
  `hide: true`. Placed immediately after `ratio`.
- **`max_ratio_raw`** - raw sibling of `max_ratio`. Same shape as above. Placed immediately after
  `max_ratio`.
- **`ratio_limit_raw`** - raw sibling of `ratio_limit`. Same shape as above. Placed immediately
  after `ratio_limit`.

New filter component:

- **`RatioLimitColumnFilter`**
  (`packages/app/src/app/components/column-filters/ratio-limit-column-filter/`), wired as the
  `filter` on `max_ratio` and `ratio_limit`, replacing `NumberColumnFilter` there.

Out of scope: the `ratio` column's existing `NumberColumnFilter` is unchanged (it already filters
against the exact raw field value - the rounding is display-only). No changes to
`TorrentStoreService`, `QbPollingService`, or the IPC contract.

Both new filter/column additions follow the existing file layout: `<name>.ts`, `<name>.html`,
`<name>.scss`, `<name>.spec.ts`, extending `OperatorFilterBase<TValue>` like every other column
filter (`NumberColumnFilter`, `TimeLimitColumnFilter`, etc.).

## `RatioLimitColumnFilter`

Same shape as `TimeLimitFilterValue`, minus the `unit` field - ratio has no time unit, so no unit
selector and no scaling multiplier in `doesFilterPass`:

```ts
export type RatioLimitFilterMode = 'noLimit' | 'global' | 'custom';

export interface RatioLimitFilterValue {
  mode: RatioLimitFilterMode;
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
}
```

- Mode dropdown has 3 entries, reusing the existing `general.limit.no-limit`, `general.limit.global`,
  and `general.limit.custom` translation keys (already added for `TimeLimitColumnFilter`).
- The operator/from/to controls (identical markup to `NumberColumnFilter`) render only when
  `mode === 'custom'`.
- Default mode: `custom`. Default operator: `equals`.
- `isActive(value)`:
  - `mode === 'noLimit'` or `mode === 'global'` -> always active, same pattern as
    `TimeLimitColumnFilter`.
  - `mode === 'custom'` -> same from/to completeness rule as `NumberColumnFilter`
    (`blank`/`notBlank` always active, `between` needs both `from` and `to`, otherwise needs `from`).
- `doesFilterPass`:
  ```ts
  if (!this.isFilterActive()) return true;
  const cellValue = this.params.getValue(params.node) as number | null | undefined;
  if (this.applied.mode === 'noLimit') return cellValue === -1;
  if (this.applied.mode === 'global') return cellValue === -2;
  // custom mode: sentinel rows never match a numeric comparison
  if (cellValue === -1 || cellValue === -2) return false;
  return numberOperatorPasses(this.applied.operator, cellValue, this.applied.from, this.applied.to);
  ```
- `isValidModel`: validates `mode` is one of the 3 values, `operator` is a valid
  `NumberFilterOperator`, and `from`/`to` are `number | null`.
- Template/SCSS: `number-column-filter.html`/`.scss` with a mode `<ng-select>` prepended (copied
  from `time-limit-column-filter.html`, minus the unit dropdown), component selector/instance-id
  prefix renamed to `ratio-limit-filter`.

## `grid.lib.ts` wiring

- Insert the `ratio_raw` col def immediately after `ratio` (~line 374): `tooltipField: 'ratio'`,
  `cellClass: 'tabular-nums'`, `filter: NumberColumnFilter`, `hide: true`, no `valueFormatter`.
- Change `max_ratio` and `ratio_limit`'s `filter` from `NumberColumnFilter` to
  `RatioLimitColumnFilter`. No other changes to those two col defs.
- Insert `max_ratio_raw` immediately after `max_ratio`, and `ratio_limit_raw` immediately after
  `ratio_limit` - same shape as `ratio_raw` above, each tooltipping/filtering its own base field.
- `DEFAULT_TORRENT_LIST_GRID_SETTINGS.columnState` is untouched - the new `_raw` columns start
  hidden like every other `_raw` column.

## i18n

New `col-def` keys added to both `public/i18n/us.json` and `public/i18n/hu.json`:

- `ratio_raw`: "Ratio (raw)"
- `max_ratio_raw`: "Max Ratio (raw)"
- `ratio_limit_raw`: "Ratio Limit (raw)"

No new `general.limit.*` or `components.column-filters.label.*` keys are needed - `no-limit`,
`global`, and `custom` (added for `TimeLimitColumnFilter`) and the existing mode/operator/value/
from/to labels are reused as-is.

## Testing

New `ratio-limit-column-filter.spec.ts`, mirroring `time-limit-column-filter.spec.ts` minus the
unit-related cases: default state (mode `custom`, operator `equals`), mode switching,
`doesFilterPass` per mode (`noLimit` matches only `-1`, `global` matches only `-2`, `custom`
matches numeric comparisons but never matches `-1`/`-2`), `getModel`/`setModel` round-trip,
invalid-model fallback (bad shape, unknown mode), `apply`/`clear`, `isApplyDisabled` for `between`.

The three new `_raw` columns need no new tests - they reuse `NumberColumnFilter`, which already
has its own spec coverage.
