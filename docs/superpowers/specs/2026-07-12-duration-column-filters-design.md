# Duration column filters design

## Problem

Several torrent grid columns hold seconds- or minutes-based durations (`eta`, `seeding_time`, `time_active`, `seeding_time_limit`, `max_seeding_time`, `max_inactive_seeding_time`, `inactive_seeding_time_limit`). The human-readable (formatted) variant of each of these columns currently has no filter at all. The `*_raw` variants (which show the underlying number) already use `NumberColumnFilter` and are out of scope for this change.

We want unit-aware filters for the formatted columns, following the existing `SizeColumnFilter` pattern (operator + value + unit), so a user can filter e.g. "seeding time > 3 days" instead of typing a raw seconds value.

Two of the fields are semantically different:

- `eta`, `seeding_time`, `time_active` are plain seconds.
- `seeding_time_limit`, `max_seeding_time`, `max_inactive_seeding_time`, `inactive_seeding_time_limit` are minutes, and use two sentinel values from the qBittorrent API: `-1` ("no limit") and `-2` ("use the global limit"). These are already surfaced to the user via `TimeLimitPipe` in the cell text.

This design introduces two new filter components to match.

## Scope

New filters (both under `packages/app/src/app/components/column-filters/`):

- **`DurationColumnFilter`** - applied to `eta`, `seeding_time`, `time_active`.
- **`TimeLimitColumnFilter`** - applied to `seeding_time_limit`, `max_seeding_time`, `max_inactive_seeding_time`, `inactive_seeding_time_limit`.

Out of scope: the `*_raw` columns for all of the above fields keep their current `NumberColumnFilter` unchanged.

Both filters extend `OperatorFilterBase<TValue>`, same as every other column filter in this codebase (`SizeColumnFilter`, `NumberColumnFilter`, `BooleanColumnFilter`, etc.), and follow the same file layout: `<name>.ts`, `<name>.html`, `<name>.scss`, `<name>.spec.ts`.

## Shared time-unit utility

A new `packages/app/src/app/components/column-filters/time-unit.utils.ts`, sibling to the existing `operator-filter.utils.ts`, centralizes the unit vocabulary both filters need:

```ts
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export const TIME_UNIT_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2629800, // 365.25 days / 12, matching HumanizeDurationPipe's year length
  years: 31557600, // 365.25 days
};

export const TIME_UNIT_LABEL_KEYS: Record<TimeUnit, string> = {
  seconds: 'components.column-filters.time-unit.seconds',
  minutes: 'components.column-filters.time-unit.minutes',
  hours: 'components.column-filters.time-unit.hours',
  days: 'components.column-filters.time-unit.days',
  weeks: 'components.column-filters.time-unit.weeks',
  months: 'components.column-filters.time-unit.months',
  years: 'components.column-filters.time-unit.years',
};
```

`TIME_UNIT_SECONDS` always converts a unit to **seconds**. `TimeLimitColumnFilter` (whose cell values are minutes) divides by 60 when scaling, rather than maintaining a second multiplier table.

## `DurationColumnFilter`

Value shape and behavior mirror `SizeColumnFilter` exactly, swapping the size unit for a time unit:

```ts
export interface DurationFilterValue {
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
  unit: TimeUnit;
}
```

- Unit dropdown offers all 7 `TimeUnit` values. Default unit: `minutes`. Default operator: `equals`.
- `isActive`, `isInputDisabled`, `isApplyDisabled`, `valuesEqual`, `isValidModel`, `apply`/`clear` behavior: identical logic to `SizeColumnFilter`, just typed against `DurationFilterValue`.
- `doesFilterPass`: scales `from`/`to` by `TIME_UNIT_SECONDS[unit]` and compares against the raw seconds cell value via the existing `numberOperatorPasses` helper - same structure as `SizeColumnFilter.doesFilterPass`.
- Template/SCSS: copy of `size-column-filter.html`/`.scss` with the unit list swapped and the component selector/instance-id prefix renamed to `duration-filter`.

## `TimeLimitColumnFilter`

Adds a **mode** selector on top of the same operator/value/unit shape, to represent the qBittorrent sentinel values explicitly instead of exposing `-1`/`-2` as raw numbers:

```ts
export type TimeLimitFilterMode = 'noLimit' | 'global' | 'custom';

export interface TimeLimitFilterValue {
  mode: TimeLimitFilterMode;
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
  unit: TimeUnit; // 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' (no 'seconds')
}
```

- Mode dropdown has 3 entries, labeled with the existing `general.limit.no-limit` and `general.limit.global` translation keys (already used by `TimeLimitPipe` for the same sentinel values) plus a new `general.limit.custom` key.
- The operator/unit/from/to controls (identical markup to `DurationColumnFilter`) render only when `mode === 'custom'`.
- Default mode: `custom`. Default operator: `equals`. Default unit: `hours`.
- `isActive(value)`:
  - `mode === 'noLimit'` or `mode === 'global'` -> always active (no further input required), same pattern as the `blank`/`notBlank` operators elsewhere.
  - `mode === 'custom'` -> same from/to completeness rule as `DurationColumnFilter`.
- `doesFilterPass`:
  ```ts
  if (!this.isFilterActive()) return true;
  const cellValue = this.params.getValue(params.node) as number | null | undefined;
  if (this.applied.mode === 'noLimit') return cellValue === -1;
  if (this.applied.mode === 'global') return cellValue === -2;
  // custom mode: sentinel rows never match a numeric comparison
  if (cellValue === -1 || cellValue === -2) return false;
  const multiplier = TIME_UNIT_SECONDS[this.applied.unit] / 60;
  const from = this.applied.from != null ? this.applied.from * multiplier : null;
  const to = this.applied.to != null ? this.applied.to * multiplier : null;
  return numberOperatorPasses(this.applied.operator, cellValue, from, to);
  ```
- `isValidModel`: validates `mode` is one of the 3 values, `operator` is a valid `NumberFilterOperator`, `from`/`to` are `number | null`, and `unit` is one of the 6 allowed values.

## `grid.lib.ts` wiring

Add `filter: DurationColumnFilter` to the `eta`, `seeding_time`, `time_active` column defs, and `filter: TimeLimitColumnFilter` to `seeding_time_limit`, `max_seeding_time`, `max_inactive_seeding_time`, `inactive_seeding_time_limit`. These columns currently have no `filter` key at all, so this is a net-new capability, not a replacement. The corresponding `*_raw` column defs are untouched.

## i18n

New keys added to both `public/i18n/us.json` and `public/i18n/hu.json`:

- `general.limit.custom` ("Custom")
- `components.column-filters.time-unit.seconds` ("Seconds")
- `components.column-filters.time-unit.minutes` ("Minutes")
- `components.column-filters.time-unit.hours` ("Hours")
- `components.column-filters.time-unit.days` ("Days")
- `components.column-filters.time-unit.weeks` ("Weeks")
- `components.column-filters.time-unit.months` ("Months")
- `components.column-filters.time-unit.years` ("Years")

## Testing

New spec files mirroring `size-column-filter.spec.ts`:

- `duration-column-filter.spec.ts`: default state (inactive, default unit `minutes`), all 7 units exposed, unit scaling in `doesFilterPass` (including `seconds`/`weeks`/`months`/`years` edge cases), `getModel`/`setModel` round-trip, invalid-model fallback (bad shape, unknown unit), `apply`/`clear`, `isApplyDisabled` for `between`.
- `time-limit-column-filter.spec.ts`: default state (mode `custom`, unit `hours`), mode switching, `doesFilterPass` for each mode - `noLimit` matches only `-1` and nothing else, `global` matches only `-2`, `custom` matches scaled numeric comparisons but never matches `-1`/`-2` - `getModel`/`setModel` round-trip including `mode`, invalid-model fallback, `apply`/`clear`, `isApplyDisabled`.

No changes are needed to `TorrentStoreService`, `QbPollingService`, or any IPC contract - this is purely a grid/filter UI addition.
