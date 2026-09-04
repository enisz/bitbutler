# Generalized Breakdown & Stat-Tile Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pie chart's hardcoded `groupBy: 'state' | 'category'` with a generic, field-driven breakdown; add a new `bar-chart` widget sharing the same breakdown logic; and generalize `stat-tile` past its fixed 10-metric list with a live server-metric catalog plus a "count of torrents by field value" mode.

**Architecture:** A new curated `breakdown-field-catalog.ts` classifies 9 `Torrent` fields as categorical (grouped by distinct value, capped to the top 7 + "Other") or numeric (grouped into fixed, curated buckets). One shared counting module in `widget-selectors.ts` backs `pie-chart`, the new `bar-chart`, and stat-tile's new torrent-count mode. `stat-tile`'s metric list moves from a hand-duplicated array into a single `server-metric-catalog.ts`.

**Tech Stack:** Angular 22 (zoneless, signals), Chart.js via `ng2-charts`, `ng-select`, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-05-dashboard-generalized-widgets-design.md`

## Global Constraints

- Breakdown slices/buckets are torrent **counts only** - no sum/average aggregate (spec Non-goals).
- No time-series/line widget in this plan (spec Non-goals).
- The categorical high-cardinality cap is a fixed constant (7 + "Other"), not user-configurable.
- `PieChartConfig` keeps its `groupBy` property name (not renamed to `field`) so already-saved dashboards keep loading with no migration code.
- A `StatTileConfig`/`StatTileData` torrent-count variant is additive (no `source` field on old data) so existing saved `{ metric }` configs keep working with no migration code.
- Breakdown bucket `key` ids must never contain a literal `.` - they get interpolated into `ngx-translate` dot-path keys (e.g. `breakdown.ratio.bucket.${key}`), and a dot inside `key` would be parsed as a nested path segment instead of a flat key.
- Use `-` (hyphen) instead of `—` (em dash) in all commit messages and any prose this plan produces.
- Commit format: `#324: short description`.

---

## Task 1: Generalize pie-chart config/data types

**Files:**

- Modify: `packages/app/src/app/models/dashboard.model.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.ts`

**Interfaces:**

- Produces: `BreakdownField` (union type), `BreakdownSlice { key: string; labelKey?: string; value: number }`, `PieChartField` (union type, 4 values), `PieChartConfig { groupBy: PieChartField }`, `PieChartData { groupBy: PieChartField; slices: BreakdownSlice[] }`, `BarChartConfig { field: BreakdownField }`, `BarChartData { field: BreakdownField; slices: BreakdownSlice[] }`, `WidgetTypeId` including `'bar-chart'`.
- This task does not implement bar-chart's selector/component/catalog entry yet - only the types. No new runtime behavior; the existing test suite must pass unchanged.

This is a pure rename-and-widen refactor (no behavior change), so there's no new failing test to write first - instead, run the existing suite before and after to prove nothing broke.

- [ ] **Step 1: Run the existing test suite and note it's green**

Run: `npm test --workspace=@bitbutler/app -- --run dashboard`
Expected: all `pages/dashboard/**` and `modals/widget-config/**` specs PASS.

- [ ] **Step 2: Edit `dashboard.model.ts`**

Replace the `PieChartGroupBy`/`PieChartConfig`/`PieChartSlice`/`PieChartData` block and the `WidgetTypeId` line:

```ts
export type WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart' | 'bar-chart';
```

```ts
// 9 curated Torrent fields meaningful to break down by - see breakdown-field-catalog.ts for
// which are categorical (grouped by distinct value) vs numeric (grouped into fixed buckets).
export type BreakdownField =
  | 'state'
  | 'category'
  | 'tracker'
  | 'save_path'
  | 'tags'
  | 'ratio'
  | 'progress'
  | 'size'
  | 'eta';

export interface BreakdownSlice {
  key: string;
  /** Translation key for a bucket/curated slice (e.g. a 'state' bucket, a numeric-field bucket, or the capped 'other' slice). Absent when `key` is already display-ready raw data (a raw category/tracker/save_path/tag value). */
  labelKey?: string;
  value: number;
}

// The single-valued subset of BreakdownField - a torrent has exactly one value for each, so a
// pie chart's "slices sum to the whole" reading holds. 'tags' (multi-valued) and the numeric
// fields (a histogram, not a proportion-of-whole) are pie-ineligible - see BarChartConfig for
// those.
export type PieChartField = 'state' | 'category' | 'tracker' | 'save_path';

export interface PieChartConfig {
  groupBy: PieChartField;
}

export interface PieChartData {
  groupBy: PieChartField;
  slices: BreakdownSlice[];
}

export interface BarChartConfig {
  field: BreakdownField;
}

export interface BarChartData {
  field: BreakdownField;
  slices: BreakdownSlice[];
}
```

Update the `WidgetConfig` union:

```ts
export type WidgetConfig = StatTileConfig | TorrentListConfig | PieChartConfig | BarChartConfig;
```

Delete the old `PieChartGroupBy`/old `PieChartSlice`/old `PieChartData` definitions entirely (replaced above, not left alongside).

- [ ] **Step 3: Update `widget-selectors.ts` imports**

Change the import line to use the new names (the function bodies are untouched in this task):

```ts
import {
  BreakdownSlice,
  DashboardSnapshot,
  DashboardWidgetInstance,
  PieChartConfig,
  PieChartData,
  StatTileConfig,
  StatTileData,
  TorrentListConfig,
  TorrentListData,
} from '../../models/dashboard.model';
```

Rename every local use of `PieChartSlice` to `BreakdownSlice` (the `selectPieChartData` function's `const slices: PieChartSlice[] = ...` lines, both branches).

- [ ] **Step 4: Update `widget-selectors.spec.ts` type-only reference**

No literal object shapes change (`{ groupBy: 'state' }` etc. are unaffected by the type rename), so this file needs no edits - confirm by re-reading it, don't guess.

- [ ] **Step 5: Update `widget-config.ts`**

Change the import and the field's type annotation:

```ts
import {
  BarChartConfig,
  PieChartConfig,
  PieChartField,
  StatTileConfig,
  StatTileMetric,
  TorrentListConfig,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';
```

```ts
readonly groupByOptions: PieChartField[] = ['state', 'category'];
```

(Deliberately still only 2 options here - widening the modal's actual choices to `tracker`/`save_path` happens in Task 9, once `selectBreakdownCounts` exists to back them. This step only fixes the type name so the file compiles.)

Update the `updatePieChartGroupBy` signature's parameter type from `PieChartGroupBy` to `PieChartField` (same name change, no logic change).

- [ ] **Step 6: Run the full suite again**

Run: `npm test --workspace=@bitbutler/app -- --run dashboard`
Expected: still all PASS, with zero new failures - this step is a refactor, not new behavior.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/models/dashboard.model.ts packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/modals/widget-config/widget-config.ts
git commit -m "$(cat <<'EOF'
#324: widen pie-chart config to BreakdownField, add bar-chart types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 2: `breakdown-field-catalog.ts` - field/bucket catalog

**Files:**

- Create: `packages/app/src/app/pages/dashboard/breakdown-field-catalog.ts`
- Test: `packages/app/src/app/pages/dashboard/breakdown-field-catalog.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `BreakdownField` from `../../models/dashboard.model` (Task 1).
- Produces: `BreakdownBucket { key: string; labelKey: string; test: (value: number) => boolean }`, `BreakdownFieldMeta { field: BreakdownField; labelKey: string; kind: 'categorical' | 'numeric'; multiValued?: boolean; buckets?: BreakdownBucket[] }`, `BREAKDOWN_FIELD_CATALOG: BreakdownFieldMeta[]`, `BREAKDOWN_FIELD_META_BY_FIELD: Record<BreakdownField, BreakdownFieldMeta>`, `PIE_STATE_BUCKETS: Record<TorrentState, string>`, `PIE_STATE_BUCKET_ORDER: string[]` (moved here from `widget-selectors.ts`, consumed by Task 3).

- [ ] **Step 1: Write the failing spec**

```ts
import { BREAKDOWN_FIELD_CATALOG, BREAKDOWN_FIELD_META_BY_FIELD } from './breakdown-field-catalog';

describe('BREAKDOWN_FIELD_CATALOG', () => {
  it('should have exactly these 9 fields', () => {
    expect(BREAKDOWN_FIELD_CATALOG.map((m) => m.field).sort()).toEqual(
      [
        'category',
        'eta',
        'progress',
        'ratio',
        'save_path',
        'size',
        'state',
        'tags',
        'tracker',
      ].sort(),
    );
  });

  it('should mark state/category/tracker/save_path/tags as categorical', () => {
    for (const field of ['state', 'category', 'tracker', 'save_path', 'tags'] as const) {
      expect(BREAKDOWN_FIELD_META_BY_FIELD[field].kind).toBe('categorical');
    }
  });

  it('should mark only tags as multi-valued', () => {
    expect(BREAKDOWN_FIELD_META_BY_FIELD['tags'].multiValued).toBe(true);
    expect(BREAKDOWN_FIELD_META_BY_FIELD['category'].multiValued).toBeFalsy();
  });

  it('should mark ratio/progress/size/eta as numeric with buckets', () => {
    for (const field of ['ratio', 'progress', 'size', 'eta'] as const) {
      const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
      expect(meta.kind).toBe('numeric');
      expect(meta.buckets!.length).toBeGreaterThan(0);
    }
  });

  it('should reuse the main grid column labels for every field label', () => {
    expect(BREAKDOWN_FIELD_META_BY_FIELD['category'].labelKey).toBe(
      'pages.main.grid.grid-lib.col-def.category',
    );
    expect(BREAKDOWN_FIELD_META_BY_FIELD['ratio'].labelKey).toBe(
      'pages.main.grid.grid-lib.col-def.ratio',
    );
  });

  function bucketKeyFor(field: 'ratio' | 'progress' | 'size' | 'eta', value: number): string {
    const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
    return meta.buckets!.find((b) => b.test(value))!.key;
  }

  it('should bucket ratio at each boundary', () => {
    expect(bucketKeyFor('ratio', 0)).toBe('lt-0-1');
    expect(bucketKeyFor('ratio', 0.099)).toBe('lt-0-1');
    expect(bucketKeyFor('ratio', 0.1)).toBe('0-1-to-0-5');
    expect(bucketKeyFor('ratio', 0.499)).toBe('0-1-to-0-5');
    expect(bucketKeyFor('ratio', 0.5)).toBe('0-5-to-1');
    expect(bucketKeyFor('ratio', 0.999)).toBe('0-5-to-1');
    expect(bucketKeyFor('ratio', 1)).toBe('1-to-2');
    expect(bucketKeyFor('ratio', 1.999)).toBe('1-to-2');
    expect(bucketKeyFor('ratio', 2)).toBe('gte-2');
    expect(bucketKeyFor('ratio', 50)).toBe('gte-2');
  });

  it('should bucket progress (raw 0-1 decimal) at each boundary', () => {
    expect(bucketKeyFor('progress', 0)).toBe('0-25');
    expect(bucketKeyFor('progress', 0.249)).toBe('0-25');
    expect(bucketKeyFor('progress', 0.25)).toBe('25-50');
    expect(bucketKeyFor('progress', 0.5)).toBe('50-75');
    expect(bucketKeyFor('progress', 0.75)).toBe('75-99');
    expect(bucketKeyFor('progress', 0.999)).toBe('75-99');
    expect(bucketKeyFor('progress', 1)).toBe('100');
  });

  it('should bucket size (bytes, GiB) at each boundary', () => {
    const GIB = 1024 ** 3;
    expect(bucketKeyFor('size', GIB - 1)).toBe('lt-1gib');
    expect(bucketKeyFor('size', GIB)).toBe('1-5gib');
    expect(bucketKeyFor('size', 5 * GIB)).toBe('5-20gib');
    expect(bucketKeyFor('size', 20 * GIB)).toBe('20-100gib');
    expect(bucketKeyFor('size', 100 * GIB)).toBe('gte-100gib');
  });

  it('should bucket eta, treating the qBittorrent 8640000 sentinel as unknown before any range check', () => {
    expect(bucketKeyFor('eta', 8_640_000)).toBe('unknown');
    expect(bucketKeyFor('eta', 99_999_999)).toBe('unknown');
    expect(bucketKeyFor('eta', 0)).toBe('lt-1h');
    expect(bucketKeyFor('eta', 3599)).toBe('lt-1h');
    expect(bucketKeyFor('eta', 3600)).toBe('1h-6h');
    expect(bucketKeyFor('eta', 21_600)).toBe('6h-24h');
    expect(bucketKeyFor('eta', 86_400)).toBe('1d-7d');
    expect(bucketKeyFor('eta', 604_800)).toBe('gte-7d');
    expect(bucketKeyFor('eta', 8_639_999)).toBe('gte-7d');
  });

  it('should never use a "." inside a bucket key (it would break ngx-translate dot-path lookup)', () => {
    for (const meta of BREAKDOWN_FIELD_CATALOG) {
      for (const bucket of meta.buckets ?? []) {
        expect(bucket.key).not.toContain('.');
      }
    }
  });
});
```

- [ ] **Step 2: Run the spec, confirm it fails**

Run: `npm test --workspace=@bitbutler/app -- --run breakdown-field-catalog`
Expected: FAIL - `Cannot find module './breakdown-field-catalog'`.

- [ ] **Step 3: Implement `breakdown-field-catalog.ts`**

```ts
import { BreakdownField } from '../../models/dashboard.model';
import { TorrentState } from '../../models/torrent.model';

export interface BreakdownBucket {
  key: string;
  labelKey: string;
  /** First bucket in the array whose test passes wins - order matters. */
  test: (value: number) => boolean;
}

export interface BreakdownFieldMeta {
  field: BreakdownField;
  labelKey: string;
  kind: 'categorical' | 'numeric';
  /** Only true for 'tags' - a comma-separated field where one torrent can land in multiple slices. */
  multiValued?: boolean;
  /** Only set for kind: 'numeric'. */
  buckets?: BreakdownBucket[];
}

function fieldLabelKey(field: BreakdownField): string {
  return `pages.main.grid.grid-lib.col-def.${field}`;
}

function categoricalMeta(field: BreakdownField, multiValued = false): BreakdownFieldMeta {
  return { field, labelKey: fieldLabelKey(field), kind: 'categorical', multiValued };
}

function bucket(
  field: BreakdownField,
  key: string,
  test: (value: number) => boolean,
): BreakdownBucket {
  return { key, labelKey: `pages.dashboard.widgets.breakdown.${field}.bucket.${key}`, test };
}

function numericMeta(field: BreakdownField, buckets: BreakdownBucket[]): BreakdownFieldMeta {
  return { field, labelKey: fieldLabelKey(field), kind: 'numeric', buckets };
}

const GIB = 1024 ** 3;

const RATIO_BUCKETS: BreakdownBucket[] = [
  bucket('ratio', 'lt-0-1', (v) => v < 0.1),
  bucket('ratio', '0-1-to-0-5', (v) => v < 0.5),
  bucket('ratio', '0-5-to-1', (v) => v < 1),
  bucket('ratio', '1-to-2', (v) => v < 2),
  bucket('ratio', 'gte-2', () => true),
];

const PROGRESS_BUCKETS: BreakdownBucket[] = [
  bucket('progress', '0-25', (v) => v < 0.25),
  bucket('progress', '25-50', (v) => v < 0.5),
  bucket('progress', '50-75', (v) => v < 0.75),
  bucket('progress', '75-99', (v) => v < 1),
  bucket('progress', '100', () => true),
];

const SIZE_BUCKETS: BreakdownBucket[] = [
  bucket('size', 'lt-1gib', (v) => v < GIB),
  bucket('size', '1-5gib', (v) => v < 5 * GIB),
  bucket('size', '5-20gib', (v) => v < 20 * GIB),
  bucket('size', '20-100gib', (v) => v < 100 * GIB),
  bucket('size', 'gte-100gib', () => true),
];

const ETA_BUCKETS: BreakdownBucket[] = [
  // qBittorrent returns 8640000 (100 days) as a sentinel meaning "no estimate" (stalled/no
  // peers), not a real duration - this must be checked first, or every unknown-ETA torrent
  // would be miscounted as ">=7d".
  bucket('eta', 'unknown', (v) => v >= 8_640_000),
  bucket('eta', 'lt-1h', (v) => v < 3600),
  bucket('eta', '1h-6h', (v) => v < 21_600),
  bucket('eta', '6h-24h', (v) => v < 86_400),
  bucket('eta', '1d-7d', (v) => v < 604_800),
  bucket('eta', 'gte-7d', () => true),
];

export const BREAKDOWN_FIELD_CATALOG: BreakdownFieldMeta[] = [
  categoricalMeta('state'),
  categoricalMeta('category'),
  categoricalMeta('tracker'),
  categoricalMeta('save_path'),
  categoricalMeta('tags', true),
  numericMeta('ratio', RATIO_BUCKETS),
  numericMeta('progress', PROGRESS_BUCKETS),
  numericMeta('size', SIZE_BUCKETS),
  numericMeta('eta', ETA_BUCKETS),
];

export const BREAKDOWN_FIELD_META_BY_FIELD: Record<BreakdownField, BreakdownFieldMeta> =
  Object.fromEntries(BREAKDOWN_FIELD_CATALOG.map((m) => [m.field, m])) as Record<
    BreakdownField,
    BreakdownFieldMeta
  >;

// Moved from widget-selectors.ts (unchanged) - every TorrentState maps to exactly one bucket,
// unlike ACTIVE_STATES/the sidebar's `groups` map in status.ts, whose groups deliberately overlap
// for independent filter checkboxes. A breakdown's slices must sum to the full torrent count.
export type PieStateBucket =
  | 'downloading'
  | 'completed'
  | 'inactive'
  | 'stopped'
  | 'checking'
  | 'errored'
  | 'other';

export const PIE_STATE_BUCKETS: Record<TorrentState, PieStateBucket> = {
  downloading: 'downloading',
  forcedDL: 'downloading',
  metaDL: 'downloading',
  allocating: 'downloading',
  uploading: 'completed',
  forcedUP: 'completed',
  queuedDL: 'inactive',
  queuedUP: 'inactive',
  stalledDL: 'inactive',
  stalledUP: 'inactive',
  pausedDL: 'stopped',
  stoppedDL: 'stopped',
  pausedUP: 'stopped',
  stoppedUP: 'stopped',
  checkingDL: 'checking',
  checkingUP: 'checking',
  checkingResumeData: 'checking',
  moving: 'checking',
  error: 'errored',
  missingFiles: 'errored',
  unknown: 'other',
};

export const PIE_STATE_BUCKET_ORDER: PieStateBucket[] = [
  'downloading',
  'completed',
  'inactive',
  'stopped',
  'checking',
  'errored',
  'other',
];
```

- [ ] **Step 4: Run the spec, confirm it passes**

Run: `npm test --workspace=@bitbutler/app -- --run breakdown-field-catalog`
Expected: PASS.

- [ ] **Step 5: Add the numeric bucket i18n keys**

In `packages/app/public/i18n/us.json`, inside `pages.dashboard.widgets` (sibling of the existing `stat-tile`/`pie-chart` keys), add a new `breakdown` block:

```json
"breakdown": {
  "ratio": {
    "bucket": {
      "lt-0-1": "< 0.1",
      "0-1-to-0-5": "0.1 - 0.5",
      "0-5-to-1": "0.5 - 1",
      "1-to-2": "1 - 2",
      "gte-2": ">= 2"
    }
  },
  "progress": {
    "bucket": {
      "0-25": "0% - 25%",
      "25-50": "25% - 50%",
      "50-75": "50% - 75%",
      "75-99": "75% - 99%",
      "100": "100%"
    }
  },
  "size": {
    "bucket": {
      "lt-1gib": "< 1 GiB",
      "1-5gib": "1 - 5 GiB",
      "5-20gib": "5 - 20 GiB",
      "20-100gib": "20 - 100 GiB",
      "gte-100gib": ">= 100 GiB"
    }
  },
  "eta": {
    "bucket": {
      "unknown": "Unknown",
      "lt-1h": "< 1h",
      "1h-6h": "1h - 6h",
      "6h-24h": "6h - 24h",
      "1d-7d": "1d - 7d",
      "gte-7d": ">= 7d"
    }
  }
}
```

In `packages/app/public/i18n/hu.json`, the same shape, translated:

```json
"breakdown": {
  "ratio": {
    "bucket": {
      "lt-0-1": "< 0,1",
      "0-1-to-0-5": "0,1 - 0,5",
      "0-5-to-1": "0,5 - 1",
      "1-to-2": "1 - 2",
      "gte-2": ">= 2"
    }
  },
  "progress": {
    "bucket": {
      "0-25": "0% - 25%",
      "25-50": "25% - 50%",
      "50-75": "50% - 75%",
      "75-99": "75% - 99%",
      "100": "100%"
    }
  },
  "size": {
    "bucket": {
      "lt-1gib": "< 1 GiB",
      "1-5gib": "1 - 5 GiB",
      "5-20gib": "5 - 20 GiB",
      "20-100gib": "20 - 100 GiB",
      "gte-100gib": ">= 100 GiB"
    }
  },
  "eta": {
    "bucket": {
      "unknown": "Ismeretlen",
      "lt-1h": "< 1 óra",
      "1h-6h": "1 - 6 óra",
      "6h-24h": "6 - 24 óra",
      "1d-7d": "1 - 7 nap",
      "gte-7d": ">= 7 nap"
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/breakdown-field-catalog.ts packages/app/src/app/pages/dashboard/breakdown-field-catalog.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#324: add breakdown field/bucket catalog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 3: `selectBreakdownCounts` / `countBreakdownValue` / `listBreakdownValues`

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `BREAKDOWN_FIELD_CATALOG`, `BREAKDOWN_FIELD_META_BY_FIELD`, `PIE_STATE_BUCKETS`, `PIE_STATE_BUCKET_ORDER` from `./breakdown-field-catalog` (Task 2); `BreakdownField`, `BreakdownSlice`, `PieChartConfig`, `BarChartConfig`, `BarChartData` from `../../models/dashboard.model` (Task 1).
- Produces: `selectBreakdownCounts(torrents: Torrent[], field: BreakdownField): BreakdownSlice[]`, `countBreakdownValue(torrents: Torrent[], field: BreakdownField, key: string): number`, `listBreakdownValues(torrents: Torrent[], field: BreakdownField): BreakdownSlice[]`, `selectBarChartData(snapshot: DashboardSnapshot, config: BarChartConfig): BarChartData` - all consumed directly by Task 9/10 (config modal) and Task 5 (bar-chart widget); `resolveWidgetData` gains a `'bar-chart'` case.

- [ ] **Step 1: Write the failing tests**

Replace the existing `describe('selectPieChartData', ...)` block in `widget-selectors.spec.ts` (its `labelKey` strings change - state bucket labels move from the `pie-chart.bucket.*` namespace to the field-agnostic `breakdown.state.bucket.*` namespace now that the same buckets back both pie and bar) and add new blocks:

```ts
import {
  DashboardSnapshot,
  DashboardWidgetInstance,
  PieChartConfig,
} from '../../models/dashboard.model';
import { Torrent } from '../../models/torrent.model';
import {
  countBreakdownValue,
  listBreakdownValues,
  resolveWidgetData,
  selectBarChartData,
  selectBreakdownCounts,
  selectPieChartData,
  selectStatTileData,
  selectTorrentListData,
} from './widget-selectors';
```

```ts
describe('selectPieChartData', () => {
  it('should partition torrents into non-overlapping state buckets, omitting empty buckets', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ state: 'downloading' }),
        makeTorrent({ state: 'forcedDL' }),
        makeTorrent({ state: 'uploading' }),
        makeTorrent({ state: 'error' }),
      ],
      serverState: null,
    };

    const result = selectPieChartData(snapshot, { groupBy: 'state' });

    expect(result.groupBy).toBe('state');
    expect(result.slices).toEqual([
      {
        key: 'downloading',
        labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.downloading',
        value: 2,
      },
      {
        key: 'completed',
        labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.completed',
        value: 1,
      },
      {
        key: 'errored',
        labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.errored',
        value: 1,
      },
    ]);
  });

  it('should return no slices for an empty torrent list', () => {
    const result = selectPieChartData({ torrents: [], serverState: null }, { groupBy: 'state' });
    expect(result.slices).toEqual([]);
  });

  it('should group by raw category, using "-" for an empty category', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ category: 'linux' }),
        makeTorrent({ category: 'linux' }),
        makeTorrent({ category: '' }),
      ],
      serverState: null,
    };

    const result = selectPieChartData(snapshot, { groupBy: 'category' });

    expect(result.groupBy).toBe('category');
    expect(result.slices).toEqual([
      { key: 'linux', value: 2 },
      { key: '-', value: 1 },
    ]);
  });
});

describe('selectBreakdownCounts', () => {
  it('should cap a high-cardinality categorical field to the top 7 + "Other"', () => {
    const torrents: Torrent[] = [];
    // 9 distinct categories, counts 9,8,...,1
    for (let i = 0; i < 9; i++) {
      const count = 9 - i;
      for (let j = 0; j < count; j++) {
        torrents.push(makeTorrent({ hash: `${i}-${j}`, category: `cat-${i}` }));
      }
    }

    const result = selectBreakdownCounts(torrents, 'category');

    expect(result).toHaveLength(8); // top 7 + Other
    expect(result[0]).toEqual({ key: 'cat-0', value: 9 });
    expect(result[6]).toEqual({ key: 'cat-6', value: 3 });
    // cat-7 (2) + cat-8 (1) folded into Other
    expect(result[7]).toEqual({
      key: 'other',
      labelKey: 'pages.dashboard.widgets.breakdown.other',
      value: 3,
    });
  });

  it('should not add an "Other" slice when there are 7 or fewer distinct values', () => {
    const torrents = [makeTorrent({ category: 'a' }), makeTorrent({ category: 'b' })];
    const result = selectBreakdownCounts(torrents, 'category');
    expect(result.map((s) => s.key)).toEqual(['a', 'b']);
  });

  it('should count a multi-valued tags field once per tag, with no untagged slice', () => {
    const torrents = [
      makeTorrent({ tags: 'linux,iso' }),
      makeTorrent({ tags: 'linux' }),
      makeTorrent({ tags: '' }),
    ];
    const result = selectBreakdownCounts(torrents, 'tags');
    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'linux', value: 2 },
        { key: 'iso', value: 1 },
      ]),
    );
    expect(result.find((s) => s.key === '')).toBeUndefined();
  });

  it('should render every numeric bucket in order, including zero-count buckets', () => {
    const torrents = [makeTorrent({ ratio: 0.05 }), makeTorrent({ ratio: 3 })];
    const result = selectBreakdownCounts(torrents, 'ratio');
    expect(result).toEqual([
      {
        key: 'lt-0-1',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
        value: 1,
      },
      {
        key: '0-1-to-0-5',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.0-1-to-0-5',
        value: 0,
      },
      {
        key: '0-5-to-1',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.0-5-to-1',
        value: 0,
      },
      {
        key: '1-to-2',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.1-to-2',
        value: 0,
      },
      { key: 'gte-2', labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.gte-2', value: 1 },
    ]);
  });
});

describe('countBreakdownValue', () => {
  it('should count the exact value even when it would be folded into "Other" on a capped display', () => {
    const torrents: Torrent[] = [];
    for (let i = 0; i < 9; i++) {
      torrents.push(makeTorrent({ hash: `${i}`, category: `cat-${i}` }));
    }
    // Every category has count 1, so the 8th and 9th alphabetically-last ones (by insertion,
    // after the desc-count sort keeps original relative order for ties) fold into Other.
    expect(countBreakdownValue(torrents, 'category', 'cat-8')).toBe(1);
  });

  it('should count a numeric bucket key directly', () => {
    const torrents = [makeTorrent({ ratio: 0.05 }), makeTorrent({ ratio: 0.05 })];
    expect(countBreakdownValue(torrents, 'ratio', 'lt-0-1')).toBe(2);
  });

  it('should return 0 for a key with no matching torrents', () => {
    expect(countBreakdownValue([], 'category', 'anything')).toBe(0);
  });
});

describe('listBreakdownValues', () => {
  it('should list every distinct categorical value uncapped, with no "Other" folding', () => {
    const torrents: Torrent[] = [];
    for (let i = 0; i < 9; i++) torrents.push(makeTorrent({ hash: `${i}`, category: `cat-${i}` }));
    const result = listBreakdownValues(torrents, 'category');
    expect(result).toHaveLength(9);
    expect(result.find((s) => s.key === 'other')).toBeUndefined();
  });

  it('should list all numeric buckets, same as selectBreakdownCounts', () => {
    expect(listBreakdownValues([], 'ratio')).toEqual(selectBreakdownCounts([], 'ratio'));
  });
});

describe('selectBarChartData', () => {
  it('should wrap selectBreakdownCounts for the configured field', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ category: 'linux' })],
      serverState: null,
    };
    const result = selectBarChartData(snapshot, { field: 'category' });
    expect(result).toEqual({ field: 'category', slices: [{ key: 'linux', value: 1 }] });
  });
});
```

Add to the existing `describe('resolveWidgetData', ...)` block:

```ts
it('should dispatch to selectBarChartData for a bar-chart instance', () => {
  const instance: DashboardWidgetInstance = {
    instanceId: 'i4',
    widgetTypeId: 'bar-chart',
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    config: { field: 'category' },
  };
  const snapshot: DashboardSnapshot = {
    torrents: [makeTorrent({ category: 'linux' })],
    serverState: null,
  };

  expect(resolveWidgetData(instance, snapshot)).toEqual({
    field: 'category',
    slices: [{ key: 'linux', value: 1 }],
  });
});
```

Also update `pie-chart-widget.spec.ts`'s two tests that reference the old labelKey string (`'pages.dashboard.widgets.pie-chart.bucket.downloading'` -> `'pages.dashboard.widgets.breakdown.state.bucket.downloading'`) - the ones in `it('should build one doughnut segment...')` and the `describe('language-change reactivity', ...)` block. Update the `TestBed.inject(TranslateService).setTranslation(...)` calls in the same file's `beforeEach` and inside those two `it`s from `{ pages: { dashboard: { widgets: { 'pie-chart': { bucket: { downloading: '...' } } } } } }` to `{ pages: { dashboard: { widgets: { breakdown: { state: { bucket: { downloading: '...' } } } } } } }`.

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npm test --workspace=@bitbutler/app -- --run widget-selectors pie-chart-widget`
Expected: FAIL - `selectBreakdownCounts`/`countBreakdownValue`/`listBreakdownValues`/`selectBarChartData` not exported; old-labelKey assertions mismatch.

- [ ] **Step 3: Implement the selector layer**

In `widget-selectors.ts`, replace the `ACTIVE_STATES`/`PieStateBucket`/`PIE_STATE_BUCKETS`/`PIE_STATE_BUCKET_ORDER` block and `selectPieChartData` with:

```ts
import {
  BarChartConfig,
  BarChartData,
  BreakdownField,
  BreakdownSlice,
  DashboardSnapshot,
  DashboardWidgetInstance,
  PieChartConfig,
  PieChartData,
  StatTileConfig,
  StatTileData,
  TorrentListConfig,
  TorrentListData,
} from '../../models/dashboard.model';
import { Torrent, TorrentState } from '../../models/torrent.model';
import {
  BREAKDOWN_FIELD_META_BY_FIELD,
  PIE_STATE_BUCKETS,
  PIE_STATE_BUCKET_ORDER,
} from './breakdown-field-catalog';

function compareTorrentFieldValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''));
}

// Mirrors the "active" filter group semantics used by the main grid's status sidebar
// (see Status component's `groups.active`) - duplicated here as a small, self-contained
// constant rather than importing a private field from an unrelated component.
const ACTIVE_STATES = new Set<TorrentState>([
  'downloading',
  'uploading',
  'forcedDL',
  'forcedUP',
  'metaDL',
  'moving',
  'allocating',
]);

const CATEGORICAL_CAP = 7;

function rawCategoricalCounts(torrents: Torrent[], field: BreakdownField): Map<string, number> {
  const counts = new Map<string, number>();

  if (field === 'state') {
    for (const t of torrents) {
      const bucket = PIE_STATE_BUCKETS[t.state];
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return counts;
  }

  if (field === 'tags') {
    for (const t of torrents) {
      for (const tag of t.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }

  for (const t of torrents) {
    const key = (t[field] as string) || '-';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rawNumericBucketCounts(torrents: Torrent[], field: BreakdownField): Map<string, number> {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
  const counts = new Map<string, number>();
  for (const t of torrents) {
    const value = t[field] as number;
    const bucket = meta.buckets!.find((b) => b.test(value))!;
    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  }
  return counts;
}

// Chart display for categorical fields: 'state' keeps its curated 7-bucket order (never capped -
// it's already <=7 by construction); other categorical fields are sorted by count desc and capped
// to the top CATEGORICAL_CAP + a synthetic 'other' slice. Numeric fields render every defined
// bucket in its fixed order, including zero-count ones - a histogram's shape is part of the
// point, unlike a pie chart where an empty slice is just noise.
export function selectBreakdownCounts(
  torrents: Torrent[],
  field: BreakdownField,
): BreakdownSlice[] {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];

  if (meta.kind === 'numeric') {
    const counts = rawNumericBucketCounts(torrents, field);
    return meta.buckets!.map((b) => ({
      key: b.key,
      labelKey: b.labelKey,
      value: counts.get(b.key) ?? 0,
    }));
  }

  const counts = rawCategoricalCounts(torrents, field);

  if (field === 'state') {
    return PIE_STATE_BUCKET_ORDER.filter((bucket) => (counts.get(bucket) ?? 0) > 0).map(
      (bucket) => ({
        key: bucket,
        labelKey: `pages.dashboard.widgets.breakdown.state.bucket.${bucket}`,
        value: counts.get(bucket)!,
      }),
    );
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, CATEGORICAL_CAP);
  const rest = sorted.slice(CATEGORICAL_CAP);
  const slices: BreakdownSlice[] = top.map(([key, value]) => ({ key, value }));
  const otherTotal = rest.reduce((sum, [, value]) => sum + value, 0);
  if (otherTotal > 0) {
    slices.push({
      key: 'other',
      labelKey: 'pages.dashboard.widgets.breakdown.other',
      value: otherTotal,
    });
  }
  return slices;
}

// Uncapped, exact count for one specific key/bucket - used directly by stat-tile's torrent-count
// mode, so a stat-tile stays correct even when its configured value would've been folded into
// "Other" on a pie/bar widget breaking down the same field.
export function countBreakdownValue(
  torrents: Torrent[],
  field: BreakdownField,
  key: string,
): number {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
  if (meta.kind === 'numeric') return rawNumericBucketCounts(torrents, field).get(key) ?? 0;
  return rawCategoricalCounts(torrents, field).get(key) ?? 0;
}

// Every selectable value for a field, uncapped, with no "Other" folding - used by the config
// modal's live value picker (§WidgetConfigModal) so a user can never pick the synthetic "Other"
// bucket as a stat-tile's target. 'state' and numeric fields are already uncapped, so they just
// delegate to selectBreakdownCounts.
export function listBreakdownValues(torrents: Torrent[], field: BreakdownField): BreakdownSlice[] {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
  if (meta.kind === 'numeric' || field === 'state') return selectBreakdownCounts(torrents, field);

  const counts = rawCategoricalCounts(torrents, field);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
}
```

Replace `selectPieChartData` with:

```ts
export function selectPieChartData(
  snapshot: DashboardSnapshot,
  config: PieChartConfig,
): PieChartData {
  return {
    groupBy: config.groupBy,
    slices: selectBreakdownCounts(snapshot.torrents, config.groupBy),
  };
}

export function selectBarChartData(
  snapshot: DashboardSnapshot,
  config: BarChartConfig,
): BarChartData {
  return { field: config.field, slices: selectBreakdownCounts(snapshot.torrents, config.field) };
}
```

Update `resolveWidgetData`'s switch to add the `bar-chart` case and its return type:

```ts
export function resolveWidgetData(
  instance: DashboardWidgetInstance,
  snapshot: DashboardSnapshot,
): StatTileData | TorrentListData | PieChartData | BarChartData {
  switch (instance.widgetTypeId) {
    case 'stat-tile':
      return selectStatTileData(snapshot, instance.config as StatTileConfig);
    case 'torrent-list':
      return selectTorrentListData(snapshot, instance.config as TorrentListConfig);
    case 'pie-chart':
      return selectPieChartData(snapshot, instance.config as PieChartConfig);
    case 'bar-chart':
      return selectBarChartData(snapshot, instance.config as BarChartConfig);
  }
}
```

(Leave `selectStatTileData` and `selectTorrentListData` exactly as they are in this task - `selectStatTileData` changes in Task 8.)

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npm test --workspace=@bitbutler/app -- --run widget-selectors pie-chart-widget`
Expected: PASS.

- [ ] **Step 5: Update the state-bucket i18n keys**

In both `packages/app/public/i18n/us.json` and `hu.json`, move the existing `pages.dashboard.widgets.pie-chart.bucket` object to `pages.dashboard.widgets.breakdown.state.bucket` (same 7 keys/values, just relocated under the new `breakdown` block added in Task 2), and add a sibling `"other": "Other"` (`"Egyéb"` in hu.json) directly under `pages.dashboard.widgets.breakdown`. Leave `pages.dashboard.widgets.pie-chart.group-by` alone for now (removed in Task 9, once the modal stops using it).

- [ ] **Step 6: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/pages/dashboard/widget-selectors.spec.ts packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#324: add shared breakdown counting used by pie/bar/stat-tile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 4: Extract `chart-widget-utils.ts` from `pie-chart-widget.ts`

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widgets/chart-widget-utils.ts`
- Test: `packages/app/src/app/pages/dashboard/widgets/chart-widget-utils.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.ts`

**Interfaces:**

- Produces: `themeColors(styles: CSSStyleDeclaration): string[]`, `bodyColor(styles: CSSStyleDeclaration): string`, `memoizeBySignature<TResult>(): { get: (signature: string) => TResult | undefined; set: (signature: string, value: TResult) => void }` - a tiny signature-keyed one-slot cache, consumed by Task 5's `BarChartWidget` as well as the refactored `PieChartWidget`.

This is a pure refactor - `pie-chart-widget.spec.ts` (already updated in Task 3) must keep passing unchanged, proving no behavior moved.

- [ ] **Step 1: Write the failing spec for the new utility module**

```ts
import { memoizeBySignature } from './chart-widget-utils';

describe('memoizeBySignature', () => {
  it('should return undefined for a signature never set', () => {
    const cache = memoizeBySignature<number>();
    expect(cache.get('a')).toBeUndefined();
  });

  it('should return the stored value for a matching signature', () => {
    const cache = memoizeBySignature<{ n: number }>();
    const value = { n: 1 };
    cache.set('a', value);
    expect(cache.get('a')).toBe(value);
  });

  it('should return undefined once a different signature is set (single-slot cache)', () => {
    const cache = memoizeBySignature<number>();
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });
});
```

(`themeColors`/`bodyColor` are trivial `getPropertyValue` wrappers with no independent branching to unit-test beyond what `pie-chart-widget.spec.ts` already exercises through `buildConfig()` - no separate spec needed for them.)

- [ ] **Step 2: Run the spec, confirm it fails**

Run: `npm test --workspace=@bitbutler/app -- --run chart-widget-utils`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `chart-widget-utils.ts`**

```ts
export const CHART_COLOR_TOKENS = [
  '--bs-primary',
  '--bs-secondary',
  '--bs-success',
  '--bs-danger',
  '--bs-warning',
  '--bs-info',
];

export function themeColors(styles: CSSStyleDeclaration): string[] {
  return CHART_COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
}

export function bodyColor(styles: CSSStyleDeclaration): string {
  return styles.getPropertyValue('--bs-body-color').trim();
}

// A single-slot, signature-keyed cache: setting a new signature discards whatever was cached for
// any other signature. Used by chart widgets whose `data` @Input is reset on every gridstack
// load()/live-polling tick even when nothing visibly changed - returning the SAME cached object
// reference for an unchanged signature stops ng2-charts' ngOnChanges-driven redraw from firing.
export function memoizeBySignature<TResult>(): {
  get: (signature: string) => TResult | undefined;
  set: (signature: string, value: TResult) => void;
} {
  let cachedSignature: string | null = null;
  let cachedValue: TResult | null = null;

  return {
    get: (signature: string) =>
      cachedSignature === signature ? (cachedValue as TResult) : undefined,
    set: (signature: string, value: TResult) => {
      cachedSignature = signature;
      cachedValue = value;
    },
  };
}
```

- [ ] **Step 4: Run the spec, confirm it passes**

Run: `npm test --workspace=@bitbutler/app -- --run chart-widget-utils`
Expected: PASS.

- [ ] **Step 5: Refactor `pie-chart-widget.ts` to use the shared helper**

Replace the `COLOR_TOKENS` constant, `themeColors`/`bodyColor` private methods, and the `cachedSignature`/`cachedConfig` fields with the shared module:

```ts
import { bodyColor, memoizeBySignature, themeColors } from '../chart-widget-utils';
```

```ts
export class PieChartWidget extends BaseWidget {
  @Input() data!: PieChartData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  readonly chartType = 'doughnut' as const;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly languageChanged = toSignal(this.translate.onLangChange);
  private readonly cache = memoizeBySignature<PieChartRenderConfig>();

  buildConfig(): PieChartRenderConfig {
    const family = this.themeService.family();
    const mode = this.themeService.effectiveMode();
    this.languageChanged();
    const lang = this.translate.currentLang;
    const signature = JSON.stringify({ data: this.data, family, mode, lang });

    const cached = this.cache.get(signature);
    if (cached) return cached;

    const styles = getComputedStyle(document.documentElement);
    const colors = themeColors(styles);
    const textColor = bodyColor(styles);

    const labels = this.data.slices.map((slice) =>
      slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
    );
    const values = this.data.slices.map((slice) => slice.value);
    const backgroundColor = this.data.slices.map((_, i) => colors[i % colors.length]);

    const config: PieChartRenderConfig = {
      data: { labels, datasets: [{ data: values, backgroundColor }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        backgroundColor: 'transparent',
        plugins: { legend: { labels: { color: textColor } } },
      },
    };

    this.cache.set(signature, config);
    return config;
  }
}
```

(Keep the existing class-level comments explaining _why_ `languageChanged`/the signature/the cache exist - they document non-obvious behavior that doesn't change here, only its storage moved. Keep the `PieChartRenderConfig` interface and the `Chart.register(...)` call at module scope exactly as they are.)

- [ ] **Step 6: Run `pie-chart-widget.spec.ts`, confirm it still passes unchanged**

Run: `npm test --workspace=@bitbutler/app -- --run pie-chart-widget`
Expected: PASS - identical assertions to before this task, proving the refactor is behavior-preserving.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/chart-widget-utils.ts packages/app/src/app/pages/dashboard/widgets/chart-widget-utils.spec.ts packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.ts
git commit -m "$(cat <<'EOF'
#324: extract shared chart theme/memoization helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 5: `bar-chart-widget` component

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widgets/bar-chart-widget/bar-chart-widget.ts`
- Create: `packages/app/src/app/pages/dashboard/widgets/bar-chart-widget/bar-chart-widget.html`
- Create: `packages/app/src/app/pages/dashboard/widgets/bar-chart-widget/bar-chart-widget.scss`
- Test: `packages/app/src/app/pages/dashboard/widgets/bar-chart-widget/bar-chart-widget.spec.ts`

**Interfaces:**

- Consumes: `BarChartData` (Task 1), `themeColors`/`bodyColor`/`memoizeBySignature` from `../chart-widget-utils` (Task 4), `WidgetMenu` (existing).
- Produces: `BarChartWidget` component, `componentSelector: 'app-bar-chart-widget'` (consumed by Task 6's catalog entry and Task 7's `registerComponents`).

- [ ] **Step 1: Write the failing spec**

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ThemeFamily, ThemeService } from '../../../../services/theme.service';
import { BarChartWidget } from './bar-chart-widget';

describe('BarChartWidget', () => {
  let fixture: ComponentFixture<BarChartWidget>;
  let component: BarChartWidget;
  let themeServiceMock: {
    family: ReturnType<typeof signal<ThemeFamily>>;
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  };

  beforeEach(async () => {
    themeServiceMock = {
      family: signal<ThemeFamily>('bitbutler'),
      effectiveMode: signal<'light' | 'dark'>('light'),
    };

    await TestBed.configureTestingModule({
      imports: [BarChartWidget],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(BarChartWidget);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        dashboard: {
          widgets: { breakdown: { ratio: { bucket: { 'lt-0-1': '< 0.1' } } } },
        },
      },
    });
    TestBed.inject(TranslateService).use('en');
  });

  it('should build one bar per slice, translating bucket labelKeys', () => {
    component.data = {
      field: 'ratio',
      slices: [
        {
          key: 'lt-0-1',
          labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
          value: 4,
        },
      ],
    };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.data.labels).toEqual(['< 0.1']);
    expect(config.data.datasets[0].data).toEqual([4]);
  });

  it('should use the raw key as the bar label when there is no labelKey', () => {
    component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.data.labels).toEqual(['linux']);
  });

  it('should leave the chart background transparent so the card surface shows through', () => {
    component.data = { field: 'category', slices: [] };
    fixture.detectChanges();

    const config = component.buildConfig();
    expect(config.options.backgroundColor).toBe('transparent');
  });

  describe('memoization', () => {
    it('should return the same object reference on a second call with content-equal data', () => {
      component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
      const second = component.buildConfig();

      expect(second).toBe(first);
    });

    it('should return a new object reference when the data actually changes', () => {
      component.data = { field: 'category', slices: [{ key: 'linux', value: 5 }] };
      fixture.detectChanges();
      const first = component.buildConfig();

      component.data = { field: 'category', slices: [{ key: 'linux', value: 6 }] };
      const second = component.buildConfig();

      expect(second).not.toBe(first);
    });
  });

  describe('widget menu integration', () => {
    it('should show the widget menu and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = { field: 'category', slices: [] };
      component.onConfigure = vi.fn();
      component.onRemove = vi.fn();
      fixture.detectChanges();

      const menu = fixture.nativeElement.querySelector('.widget-menu');
      expect(menu).toBeTruthy();

      menu.querySelector('[data-test="widget-menu-configure"]').click();
      expect(component.onConfigure).toHaveBeenCalled();

      menu.querySelector('[data-test="widget-menu-remove"]').click();
      expect(component.onRemove).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the spec, confirm it fails**

Run: `npm test --workspace=@bitbutler/app -- --run bar-chart-widget`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the component**

`bar-chart-widget.ts`:

```ts
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { BaseWidget } from 'gridstack/dist/angular';
import { BaseChartDirective } from 'ng2-charts';
import { BarChartData } from '../../../../models/dashboard.model';
import { ThemeService } from '../../../../services/theme.service';
import { bodyColor, memoizeBySignature, themeColors } from '../chart-widget-utils';
import { WidgetMenu } from '../widget-menu/widget-menu';

// Registered here (module scope) for the same reason as pie-chart-widget.ts: keeps 'chart.js' out
// of the eagerly-bundled main chunk, only pulled in when this lazy-loaded widget actually renders.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

interface BarChartRenderConfig {
  data: ChartData<'bar', number[], string>;
  options: ChartOptions<'bar'>;
}

@Component({
  selector: 'app-bar-chart-widget',
  standalone: true,
  imports: [BaseChartDirective, WidgetMenu],
  templateUrl: './bar-chart-widget.html',
  styleUrl: './bar-chart-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartWidget extends BaseWidget {
  @Input() data!: BarChartData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  readonly chartType = 'bar' as const;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly languageChanged = toSignal(this.translate.onLangChange);
  private readonly cache = memoizeBySignature<BarChartRenderConfig>();

  buildConfig(): BarChartRenderConfig {
    const family = this.themeService.family();
    const mode = this.themeService.effectiveMode();
    this.languageChanged();
    const lang = this.translate.currentLang;
    const signature = JSON.stringify({ data: this.data, family, mode, lang });

    const cached = this.cache.get(signature);
    if (cached) return cached;

    const styles = getComputedStyle(document.documentElement);
    const colors = themeColors(styles);
    const textColor = bodyColor(styles);

    const labels = this.data.slices.map((slice) =>
      slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
    );
    const values = this.data.slices.map((slice) => slice.value);
    const backgroundColor = this.data.slices.map((_, i) => colors[i % colors.length]);

    const config: BarChartRenderConfig = {
      data: { labels, datasets: [{ data: values, backgroundColor }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, beginAtZero: true },
        },
        plugins: { legend: { display: false } },
      },
    };

    this.cache.set(signature, config);
    return config;
  }
}
```

`bar-chart-widget.html` (mirrors `pie-chart-widget.html`):

```html
<div class="bar-chart-widget">
  <app-widget-menu (configure)="onConfigure?.()" (remove)="onRemove?.()" />
  @let config = buildConfig();
  <div class="bar-chart-widget__chart">
    <canvas
      baseChart
      class="bar-chart-widget__canvas"
      [type]="chartType"
      [data]="config.data"
      [options]="config.options"
    ></canvas>
  </div>
</div>
```

`bar-chart-widget.scss` (identical structure to `pie-chart-widget.scss`, renamed class):

```scss
:host {
  display: block;
  height: 100%;
  width: 100%;
}

.bar-chart-widget {
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  padding: 0.5rem;
  background-color: var(--bs-card-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);

  &__chart {
    position: relative;
    height: 100%;
    width: 100%;
  }

  &__canvas {
    display: block;
  }
}
```

- [ ] **Step 4: Run the spec, confirm it passes**

Run: `npm test --workspace=@bitbutler/app -- --run bar-chart-widget`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/bar-chart-widget
git commit -m "$(cat <<'EOF'
#324: add bar-chart widget component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 6: `widget-catalog.ts` bar-chart entry + dashboard mapping test

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/widget-catalog.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-catalog.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `BarChartConfig` (Task 1), `'app-bar-chart-widget'` selector (Task 5).
- Produces: `WIDGET_CATALOG['bar-chart']`, consumed by Task 7 (`dashboard.ts` registration) and Task 9 (config modal field select).

- [ ] **Step 1: Write the failing tests**

In `widget-catalog.spec.ts`, update the entry-count assertion and add a dedicated case:

```ts
it('should have an entry for every WidgetTypeId', () => {
  expect(Object.keys(WIDGET_CATALOG).sort()).toEqual([
    'bar-chart',
    'pie-chart',
    'stat-tile',
    'torrent-list',
  ]);
});

it('should map bar-chart to the BarChartWidget component selector with a sensible default config', () => {
  expect(WIDGET_CATALOG['bar-chart'].componentSelector).toBe('app-bar-chart-widget');
  expect(WIDGET_CATALOG['bar-chart'].defaultConfig).toEqual({ field: 'state' });
  expect(WIDGET_CATALOG['bar-chart'].chartType).toBe('column');
});
```

In `dashboard.spec.ts`, add a test mirroring the existing pie-chart mapping test (found near line 249):

```ts
it('should map a bar-chart instance to the app-bar-chart-widget component', async () => {
  dashboardSettingsMock.load = vi.fn().mockResolvedValue({
    widgets: [
      {
        instanceId: 'w3',
        widgetTypeId: 'bar-chart',
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        config: { field: 'state' },
      },
    ],
  });
  await createComponent();

  expect(component.items()[0].component).toBe('app-bar-chart-widget');
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npm test --workspace=@bitbutler/app -- --run widget-catalog dashboard.spec`
Expected: FAIL - no `bar-chart` entry in `WIDGET_CATALOG` yet.

- [ ] **Step 3: Implement the catalog entry**

```ts
import { faChartColumn, faChartPie, faHashtag, faTable } from '@fortawesome/free-solid-svg-icons';
import {
  BarChartConfig,
  PieChartConfig,
  StatTileConfig,
  TorrentListConfig,
  WidgetChartType,
  WidgetConfig,
  WidgetTypeId,
} from '../../models/dashboard.model';
```

Add, alongside the existing three entries:

```ts
'bar-chart': {
  id: 'bar-chart',
  labelKey: 'pages.dashboard.catalog.bar-chart',
  chartType: 'column',
  category: 'transfers',
  icon: faChartColumn,
  componentSelector: 'app-bar-chart-widget',
  defaultConfig: { field: 'state' } satisfies BarChartConfig,
  defaultSize: { w: 4, h: 4 },
},
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npm test --workspace=@bitbutler/app -- --run widget-catalog dashboard.spec`
Expected: PASS.

- [ ] **Step 5: Add the catalog label i18n key**

`us.json`, inside `pages.dashboard.catalog`: add `"bar-chart": "Bar Chart"`.
`hu.json`, same location: add `"bar-chart": "Oszlopdiagram"`.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widget-catalog.ts packages/app/src/app/pages/dashboard/widget-catalog.spec.ts packages/app/src/app/pages/dashboard/dashboard.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#324: register bar-chart in the widget catalog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 7: Wire `BarChartWidget` into the dashboard's gridstack registry

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`

**Interfaces:**

- Consumes: `BarChartWidget` (Task 5).

This step has no isolated unit test surface of its own (`GridstackComponent.registerComponents` is a side-effecting call into a third-party library, and the mapping it enables is already covered by Task 6's `dashboard.spec.ts` test, which only checks `items()`'s declarative output, not that gridstack can actually construct the component). Verified by a full build + manual run instead.

- [ ] **Step 1: Add the import and registration**

```ts
import { BarChartWidget } from './widgets/bar-chart-widget/bar-chart-widget';
```

```ts
GridstackComponent.registerComponents([
  StatTile,
  TorrentListWidget,
  PieChartWidget,
  BarChartWidget,
]);
```

- [ ] **Step 2: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all PASS.

- [ ] **Step 3: Run a production build to catch any compile-time issue the test suite wouldn't**

Run: `npm run build --workspace=@bitbutler/app`
Expected: builds cleanly.

- [ ] **Step 4: Manual check**

Run `npm start`, open the dashboard, click "Add widget", pick "Bar Chart", accept the default "State" field, confirm it renders a bar per non-empty state bucket matching your current torrents. Open its Configure menu and confirm the modal opens without errors (its field list still only offers `state` until Task 9 - selecting/saving is fine even before that).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/dashboard/dashboard.ts
git commit -m "$(cat <<'EOF'
#324: register BarChartWidget with gridstack

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 8: Generalize stat-tile - `server-metric-catalog.ts` + torrent-count mode

**Files:**

- Create: `packages/app/src/app/pages/dashboard/server-metric-catalog.ts`
- Test: `packages/app/src/app/pages/dashboard/server-metric-catalog.spec.ts`
- Modify: `packages/app/src/app/models/dashboard.model.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.html`
- Modify: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.spec.ts`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `countBreakdownValue`/`listBreakdownValues` (Task 3), `BreakdownField`/`BreakdownSlice` (Task 1).
- Produces: `ServerMetricId` (renames `StatTileMetric`), `ServerMetricMeta { id; labelKey; displayKind }`, `SERVER_METRIC_CATALOG`, `SERVER_METRIC_META_BY_ID`; `StatTileConfig` becomes a union with a `{ source: 'torrent-count'; field; value }` variant; `StatTileData` becomes a union with a `TorrentCountStatTileData extends BreakdownSlice` variant - both consumed by Task 10 (config modal UI).

- [ ] **Step 1: Write the failing catalog spec**

```ts
import { SERVER_METRIC_CATALOG, SERVER_METRIC_META_BY_ID } from './server-metric-catalog';

describe('SERVER_METRIC_CATALOG', () => {
  it('should have exactly these 14 metrics', () => {
    expect(SERVER_METRIC_CATALOG.map((m) => m.id).sort()).toEqual(
      [
        'download_speed',
        'upload_speed',
        'active_count',
        'global_ratio',
        'session_ratio',
        'global_downloaded',
        'session_downloaded',
        'global_uploaded',
        'session_uploaded',
        'free_disk_space',
        'dht_nodes',
        'total_peer_connections',
        'download_limit',
        'upload_limit',
      ].sort(),
    );
  });

  it('should classify each metric with the correct display kind', () => {
    expect(SERVER_METRIC_META_BY_ID['download_speed'].displayKind).toBe('speed');
    expect(SERVER_METRIC_META_BY_ID['upload_limit'].displayKind).toBe('speed');
    expect(SERVER_METRIC_META_BY_ID['free_disk_space'].displayKind).toBe('bytes');
    expect(SERVER_METRIC_META_BY_ID['global_ratio'].displayKind).toBe('ratio');
    expect(SERVER_METRIC_META_BY_ID['active_count'].displayKind).toBe('count');
    expect(SERVER_METRIC_META_BY_ID['dht_nodes'].displayKind).toBe('count');
    expect(SERVER_METRIC_META_BY_ID['total_peer_connections'].displayKind).toBe('count');
  });

  it('should give every metric a labelKey under pages.dashboard.widgets.stat-tile.metric', () => {
    for (const meta of SERVER_METRIC_CATALOG) {
      expect(meta.labelKey).toBe(`pages.dashboard.widgets.stat-tile.metric.${meta.id}`);
    }
  });
});
```

- [ ] **Step 2: Run the spec, confirm it fails**

Run: `npm test --workspace=@bitbutler/app -- --run server-metric-catalog`
Expected: FAIL - module not found.

- [ ] **Step 3: Update `dashboard.model.ts`**

Replace `StatTileMetric`/`StatTileConfig`/`StatTileData`:

```ts
export type ServerMetricId =
  | 'download_speed'
  | 'upload_speed'
  | 'active_count'
  | 'global_ratio'
  | 'session_ratio'
  | 'global_downloaded'
  | 'session_downloaded'
  | 'global_uploaded'
  | 'session_uploaded'
  | 'free_disk_space'
  | 'dht_nodes'
  | 'total_peer_connections'
  | 'download_limit'
  | 'upload_limit';

export type StatTileConfig =
  | { metric: ServerMetricId }
  | { source: 'torrent-count'; field: BreakdownField; value: string };

export type StatTileData =
  | { metric: ServerMetricId; value: number; total?: number }
  | (BreakdownSlice & { source: 'torrent-count'; field: BreakdownField });
```

(`BreakdownSlice` is already imported/exported in this file from Task 1 - no new import needed.)

- [ ] **Step 4: Implement `server-metric-catalog.ts`**

```ts
import { ServerMetricId } from '../../models/dashboard.model';

export interface ServerMetricMeta {
  id: ServerMetricId;
  labelKey: string;
  displayKind: 'speed' | 'bytes' | 'ratio' | 'count';
}

function metric(
  id: ServerMetricId,
  displayKind: ServerMetricMeta['displayKind'],
): ServerMetricMeta {
  return { id, labelKey: `pages.dashboard.widgets.stat-tile.metric.${id}`, displayKind };
}

export const SERVER_METRIC_CATALOG: ServerMetricMeta[] = [
  metric('download_speed', 'speed'),
  metric('upload_speed', 'speed'),
  metric('active_count', 'count'),
  metric('global_ratio', 'ratio'),
  metric('session_ratio', 'ratio'),
  metric('global_downloaded', 'bytes'),
  metric('session_downloaded', 'bytes'),
  metric('global_uploaded', 'bytes'),
  metric('session_uploaded', 'bytes'),
  metric('free_disk_space', 'bytes'),
  metric('dht_nodes', 'count'),
  metric('total_peer_connections', 'count'),
  metric('download_limit', 'speed'),
  metric('upload_limit', 'speed'),
];

export const SERVER_METRIC_META_BY_ID: Record<ServerMetricId, ServerMetricMeta> =
  Object.fromEntries(SERVER_METRIC_CATALOG.map((m) => [m.id, m])) as Record<
    ServerMetricId,
    ServerMetricMeta
  >;
```

- [ ] **Step 5: Run the catalog spec, confirm it passes**

Run: `npm test --workspace=@bitbutler/app -- --run server-metric-catalog`
Expected: PASS.

- [ ] **Step 6: Write the failing `selectStatTileData` tests**

Add to `widget-selectors.spec.ts`'s `describe('selectStatTileData', ...)` block:

```ts
it('should read dht_nodes from server_state', () => {
  const snapshot: DashboardSnapshot = { torrents: [], serverState: { dht_nodes: 12 } as any };
  expect(selectStatTileData(snapshot, { metric: 'dht_nodes' })).toEqual({
    metric: 'dht_nodes',
    value: 12,
  });
});

it('should read total_peer_connections from server_state', () => {
  const snapshot: DashboardSnapshot = {
    torrents: [],
    serverState: { total_peer_connections: 7 } as any,
  };
  expect(selectStatTileData(snapshot, { metric: 'total_peer_connections' })).toEqual({
    metric: 'total_peer_connections',
    value: 7,
  });
});

it('should read download_limit from dl_rate_limit', () => {
  const snapshot: DashboardSnapshot = { torrents: [], serverState: { dl_rate_limit: 500 } as any };
  expect(selectStatTileData(snapshot, { metric: 'download_limit' })).toEqual({
    metric: 'download_limit',
    value: 500,
  });
});

it('should read upload_limit from up_rate_limit', () => {
  const snapshot: DashboardSnapshot = { torrents: [], serverState: { up_rate_limit: 250 } as any };
  expect(selectStatTileData(snapshot, { metric: 'upload_limit' })).toEqual({
    metric: 'upload_limit',
    value: 250,
  });
});

it('should count torrents matching a torrent-count field/value config', () => {
  const snapshot: DashboardSnapshot = {
    torrents: [makeTorrent({ category: 'linux' }), makeTorrent({ category: 'linux' })],
    serverState: null,
  };
  expect(
    selectStatTileData(snapshot, { source: 'torrent-count', field: 'category', value: 'linux' }),
  ).toEqual({
    source: 'torrent-count',
    field: 'category',
    key: 'linux',
    labelKey: undefined,
    value: 2,
  });
});

it('should attach a labelKey for a torrent-count config pointed at a bucketed value', () => {
  const snapshot: DashboardSnapshot = {
    torrents: [makeTorrent({ ratio: 0.05 })],
    serverState: null,
  };
  expect(
    selectStatTileData(snapshot, { source: 'torrent-count', field: 'ratio', value: 'lt-0-1' }),
  ).toEqual({
    source: 'torrent-count',
    field: 'ratio',
    key: 'lt-0-1',
    labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
    value: 1,
  });
});

it('should count 0 for a torrent-count config whose value no longer exists in the data', () => {
  const snapshot: DashboardSnapshot = { torrents: [], serverState: null };
  expect(
    selectStatTileData(snapshot, { source: 'torrent-count', field: 'category', value: 'gone' }),
  ).toEqual({
    source: 'torrent-count',
    field: 'category',
    key: 'gone',
    labelKey: undefined,
    value: 0,
  });
});
```

- [ ] **Step 7: Run, confirm the new tests fail**

Run: `npm test --workspace=@bitbutler/app -- --run widget-selectors`
Expected: FAIL - `dht_nodes`/`total_peer_connections`/`download_limit`/`upload_limit`/`source` cases not handled.

- [ ] **Step 8: Implement the `selectStatTileData` changes**

No new import is needed - `countBreakdownValue`/`listBreakdownValues` already live in this same file from Task 3.

Add the torrent-count branch before the existing `switch`, and the 4 new `case`s inside it:

```ts
export function selectStatTileData(
  snapshot: DashboardSnapshot,
  config: StatTileConfig,
): StatTileData {
  const { torrents, serverState } = snapshot;

  if ('source' in config) {
    const matched = listBreakdownValues(torrents, config.field).find((s) => s.key === config.value);
    return {
      source: 'torrent-count',
      field: config.field,
      key: config.value,
      labelKey: matched?.labelKey,
      value: countBreakdownValue(torrents, config.field, config.value),
    };
  }

  switch (config.metric) {
    case 'download_speed':
      return { metric: config.metric, value: serverState?.dl_info_speed ?? 0 };
    case 'upload_speed':
      return { metric: config.metric, value: serverState?.up_info_speed ?? 0 };
    case 'free_disk_space':
      return { metric: config.metric, value: serverState?.free_space_on_disk ?? 0 };
    case 'global_ratio':
      return {
        metric: config.metric,
        value: parseFloat(String(serverState?.global_ratio ?? '0')) || 0,
      };
    case 'session_ratio': {
      const dl = serverState?.dl_info_data ?? 0;
      const ul = serverState?.up_info_data ?? 0;
      return { metric: config.metric, value: dl > 0 ? ul / dl : 0 };
    }
    case 'global_downloaded':
      return { metric: config.metric, value: serverState?.alltime_dl ?? 0 };
    case 'session_downloaded':
      return { metric: config.metric, value: serverState?.dl_info_data ?? 0 };
    case 'global_uploaded':
      return { metric: config.metric, value: serverState?.alltime_ul ?? 0 };
    case 'session_uploaded':
      return { metric: config.metric, value: serverState?.up_info_data ?? 0 };
    case 'dht_nodes':
      return { metric: config.metric, value: (serverState?.['dht_nodes'] as number) ?? 0 };
    case 'total_peer_connections':
      return { metric: config.metric, value: serverState?.total_peer_connections ?? 0 };
    case 'download_limit':
      return { metric: config.metric, value: serverState?.dl_rate_limit ?? 0 };
    case 'upload_limit':
      return { metric: config.metric, value: serverState?.up_rate_limit ?? 0 };
    case 'active_count': {
      let active = 0;
      for (const t of torrents) if (ACTIVE_STATES.has(t.state)) active++;
      return { metric: config.metric, value: active, total: torrents.length };
    }
  }
}
```

(`dht_nodes` reads via bracket notation because `QbServerState` only declares it through its index signature, exactly as the existing `server-state.ts` component already does - see the spec's §6 note.)

- [ ] **Step 9: Run, confirm all `selectStatTileData` tests pass**

Run: `npm test --workspace=@bitbutler/app -- --run widget-selectors`
Expected: PASS.

- [ ] **Step 10: Update `stat-tile.ts`**

```ts
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { BreakdownField, ServerMetricId, StatTileData } from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
import { SERVER_METRIC_META_BY_ID } from '../../server-metric-catalog';
import { WidgetMenu } from '../widget-menu/widget-menu';

@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [TranslatePipe, FilesizePipe, RatioPipe, WidgetMenu],
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatTile extends BaseWidget {
  @Input() data!: StatTileData;
  @Input() onConfigure?: () => void;
  @Input() onRemove?: () => void;

  get isTorrentCount(): boolean {
    return 'source' in this.data;
  }

  get metricLabelKey(): string {
    return `pages.dashboard.widgets.stat-tile.metric.${(this.data as { metric: ServerMetricId }).metric}`;
  }

  get torrentCountFieldLabelKey(): string {
    return `pages.main.grid.grid-lib.col-def.${(this.data as { field: BreakdownField }).field}`;
  }

  get torrentCountValueLabelKey(): string | undefined {
    return (this.data as { labelKey?: string }).labelKey;
  }

  get torrentCountValueKey(): string {
    return (this.data as { key: string }).key;
  }

  get total(): number | undefined {
    return 'source' in this.data ? undefined : this.data.total;
  }

  get displayKind(): 'bytes' | 'speed' | 'ratio' | 'count' {
    if ('source' in this.data) return 'count';
    return SERVER_METRIC_META_BY_ID[this.data.metric].displayKind;
  }
}
```

- [ ] **Step 11: Update `stat-tile.html`**

```html
<div class="stat-tile">
  <app-widget-menu (configure)="onConfigure?.()" (remove)="onRemove?.()" />
  <div class="stat-tile__label">
    @if (isTorrentCount) { {{ torrentCountFieldLabelKey | translate }}: @if
    (torrentCountValueLabelKey) { {{ torrentCountValueLabelKey | translate }} } @else { {{
    torrentCountValueKey }} } } @else { {{ metricLabelKey | translate }} }
  </div>
  <div class="stat-tile__value">
    @switch (displayKind) { @case ('speed') { {{ data.value | fileSize }}/s } @case ('bytes') { {{
    data.value | fileSize }} } @case ('ratio') { {{ data.value | ratio }} } @case ('count') { {{
    data.value }} @if (total !== undefined) {
    <span class="stat-tile__total">of {{ total }}</span>
    } } }
  </div>
</div>
```

- [ ] **Step 12: Write the failing stat-tile component tests**

Add to `stat-tile.spec.ts`:

```ts
it('should format the 4 new server metrics via the catalog', () => {
  component.data = { metric: 'dht_nodes', value: 12 };
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('12');

  component.data = { metric: 'download_limit', value: 500 };
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('/s');
});

it('should render a torrent-count tile using the field label and the raw key when there is no labelKey', () => {
  component.data = {
    source: 'torrent-count',
    field: 'category',
    key: 'linux',
    labelKey: undefined,
    value: 7,
  };
  TestBed.inject(TranslateService).setTranslation('en', {
    pages: { main: { grid: { 'grid-lib': { 'col-def': { category: 'Category' } } } } },
  });
  TestBed.inject(TranslateService).use('en');
  fixture.detectChanges();

  const text = fixture.nativeElement.textContent as string;
  expect(text).toContain('Category');
  expect(text).toContain('linux');
  expect(text).toContain('7');
  expect(text).not.toContain('of'); // no total suffix for torrent-count mode
});

it('should render a torrent-count tile using the translated bucket label when one is present', () => {
  component.data = {
    source: 'torrent-count',
    field: 'ratio',
    key: 'lt-0-1',
    labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
    value: 3,
  };
  TestBed.inject(TranslateService).setTranslation('en', {
    pages: {
      main: { grid: { 'grid-lib': { 'col-def': { ratio: 'Ratio' } } } },
      dashboard: { widgets: { breakdown: { ratio: { bucket: { 'lt-0-1': '< 0.1' } } } } },
    },
  });
  TestBed.inject(TranslateService).use('en');
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('< 0.1');
});
```

Note: `stat-tile.spec.ts`'s `beforeEach` doesn't currently import `TranslateService`/`TestBed` translation setup beyond `TestBed.configureTestingModule` - check the file; if `TranslateService` isn't already injected there, these two new tests need `TestBed.inject(TranslateService)` available, which it is by default once `TranslatePipe` is in the component's `imports` (it already is).

- [ ] **Step 13: Run, confirm they fail, then implement is already done in Steps 10-11 - re-run to confirm pass**

Run: `npm test --workspace=@bitbutler/app -- --run stat-tile`
Expected: PASS (the implementation in Steps 10-11 already covers these - this step is the actual red-then-green checkpoint: run once before Step 10/11's edits are in place to see it fail, and once after to see it pass. Since this plan lists implementation before the "write test" step numbering for stat-tile got interleaved, execute Steps 10-12 together, then run this check once.)

- [ ] **Step 14: Update `widget-config.ts`'s `StatTileMetric` import**

```ts
import {
  BarChartConfig,
  PieChartConfig,
  PieChartField,
  ServerMetricId,
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';
import { SERVER_METRIC_CATALOG } from '../../pages/dashboard/server-metric-catalog';
```

Replace the hand-maintained array:

```ts
readonly statTileMetrics: ServerMetricId[] = SERVER_METRIC_CATALOG.map((m) => m.id);
```

(Leave `updateStatTileMetric`'s parameter type as `ServerMetricId` - same rename, no logic change. The torrent-count source-toggle UI is Task 10, not this task - `widget-config.spec.ts`'s existing stat-tile tests, which only ever pass `{ metric: ... }` configs, keep passing unchanged since `statTileConfig()` still narrows correctly via the union.)

- [ ] **Step 15: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all PASS.

- [ ] **Step 16: Add the 4 new stat-tile metric i18n labels**

`us.json`, inside `pages.dashboard.widgets.stat-tile.metric`, add:

```json
"dht_nodes": "DHT Nodes",
"total_peer_connections": "Peer Connections",
"download_limit": "Download Limit",
"upload_limit": "Upload Limit"
```

`hu.json`, same location:

```json
"dht_nodes": "DHT csomópontok",
"total_peer_connections": "Partner kapcsolatok",
"download_limit": "Letöltési korlát",
"upload_limit": "Feltöltési korlát"
```

- [ ] **Step 17: Commit**

```bash
git add packages/app/src/app/pages/dashboard/server-metric-catalog.ts packages/app/src/app/pages/dashboard/server-metric-catalog.spec.ts packages/app/src/app/models/dashboard.model.ts packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/pages/dashboard/widget-selectors.spec.ts packages/app/src/app/pages/dashboard/widgets/stat-tile packages/app/src/app/modals/widget-config/widget-config.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#324: generalize stat-tile with a server-metric catalog and torrent-count mode

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 9: `WidgetConfigModal` - bar-chart field select + pie-chart widened

**Files:**

- Modify: `packages/app/src/app/modals/widget-config/widget-config.ts`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.html`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `BREAKDOWN_FIELD_CATALOG` (Task 2), `BarChartConfig` (Task 1).
- Produces: `breakdownFieldOptions: { value: BreakdownField; label: string; group: string }[]` on `WidgetConfig` - reused by Task 10's stat-tile torrent-count field select.

- [ ] **Step 1: Write the failing tests**

Add to `widget-config.spec.ts`:

```ts
it('should offer all 4 single-valued fields for a pie-chart', () => {
  withInputs('pie-chart', { groupBy: 'state' });
  expect(component.groupByOptions.sort()).toEqual(
    ['category', 'save_path', 'state', 'tracker'].sort(),
  );
});

it('should update groupBy to tracker for a pie-chart', () => {
  withInputs('pie-chart', { groupBy: 'state' });
  component.updatePieChartGroupBy('tracker');
  expect(component.config()).toEqual({ groupBy: 'tracker' });
});

it('should offer all 9 breakdown fields, grouped into categorical/numeric, for a bar-chart', () => {
  withInputs('bar-chart', { field: 'state' });
  const values = component.breakdownFieldOptions.map((o) => o.value);
  expect(values.sort()).toEqual(
    [
      'state',
      'category',
      'tracker',
      'save_path',
      'tags',
      'ratio',
      'progress',
      'size',
      'eta',
    ].sort(),
  );
  const ratioOption = component.breakdownFieldOptions.find((o) => o.value === 'ratio')!;
  const categoryOption = component.breakdownFieldOptions.find((o) => o.value === 'category')!;
  expect(ratioOption.group).not.toBe(categoryOption.group);
});

it('should seed config from initialConfig for a bar-chart', () => {
  withInputs('bar-chart', { field: 'category' });
  expect(component.config()).toEqual({ field: 'category' });
});

it('should update the field for a bar-chart', () => {
  withInputs('bar-chart', { field: 'state' });
  component.updateBarChartField('ratio');
  expect(component.config()).toEqual({ field: 'ratio' });
});

it('should always allow saving a bar-chart', () => {
  withInputs('bar-chart', { field: 'state' });
  expect(component.canSave()).toBe(true);
});
```

- [ ] **Step 2: Run, confirm they fail**

Run: `npm test --workspace=@bitbutler/app -- --run widget-config`
Expected: FAIL - `breakdownFieldOptions`/`updateBarChartField` don't exist, `groupByOptions` only has 2 entries.

- [ ] **Step 3: Implement**

```ts
import {
  BarChartConfig,
  BreakdownField,
  PieChartConfig,
  PieChartField,
  ServerMetricId,
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';
import { BREAKDOWN_FIELD_CATALOG } from '../../pages/dashboard/breakdown-field-catalog';
import { SERVER_METRIC_CATALOG } from '../../pages/dashboard/server-metric-catalog';
import { TORRENT_FIELD_CATALOG, TorrentField } from '../../pages/dashboard/torrent-field-catalog';

export interface BreakdownFieldOption {
  value: BreakdownField;
  label: string;
  group: string;
}
```

```ts
readonly groupByOptions: PieChartField[] = ['state', 'category', 'tracker', 'save_path'];

readonly breakdownFieldOptions: BreakdownFieldOption[] = BREAKDOWN_FIELD_CATALOG.map((m) => ({
  value: m.field,
  label: this.translateService.instant(m.labelKey),
  group:
    m.kind === 'categorical'
      ? this.translateService.instant('components.modals.widget-config.field-group.categorical')
      : this.translateService.instant('components.modals.widget-config.field-group.numeric'),
}));

readonly barChartConfig = computed(() => this.config() as BarChartConfig);
readonly isBarChart = computed(() => this.widgetTypeId() === 'bar-chart');
```

Add `updateBarChartField`:

```ts
updateBarChartField(field: BarChartConfig['field']): void {
  this.config.set({ field } satisfies BarChartConfig);
}
```

Update `canSave` to also treat `bar-chart` as always-savable (it already falls through to `return true` for anything but `torrent-list`, so no change is needed there - confirm by reading the current guard: `if (this.widgetTypeId() !== 'torrent-list') return true;` already covers `bar-chart`).

- [ ] **Step 4: Update `widget-config.html`**

Replace the `isPieChart()` branch's `ng-select` to use `groupByOptions` with the reused col-def label lookup instead of the old `pie-chart.group-by.*` keys:

```html
} @else if (isPieChart()) {
<div class="row mb-3">
  <div class="col-12">
    <label class="form-label">{{ 'components.modals.widget-config.group-by' | translate }}</label>
    <ng-select
      [items]="groupByOptions"
      [clearable]="false"
      [searchable]="false"
      [ngModel]="pieChartConfig().groupBy"
      (change)="updatePieChartGroupBy($event)"
    >
      <ng-template ng-label-tmp let-item="item"
        >{{ 'pages.main.grid.grid-lib.col-def.' + item | translate }}</ng-template
      >
      <ng-template ng-option-tmp let-item="item"
        >{{ 'pages.main.grid.grid-lib.col-def.' + item | translate }}</ng-template
      >
    </ng-select>
  </div>
</div>
} @else if (isBarChart()) {
<div class="row mb-3">
  <div class="col-12">
    <label class="form-label">{{ 'components.modals.widget-config.field' | translate }}</label>
    <ng-select
      [items]="breakdownFieldOptions"
      bindLabel="label"
      bindValue="value"
      groupBy="group"
      [clearable]="false"
      [searchable]="false"
      [ngModel]="barChartConfig().field"
      (ngModelChange)="updateBarChartField($event)"
    >
    </ng-select>
  </div>
</div>
} @else {
```

- [ ] **Step 5: Run, confirm the new tests pass**

Run: `npm test --workspace=@bitbutler/app -- --run widget-config`
Expected: PASS.

- [ ] **Step 6: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all PASS.

- [ ] **Step 7: i18n - remove the obsolete pie-chart group-by keys, add the new field/field-group labels**

In both `us.json` and `hu.json`: delete `pages.dashboard.widgets.pie-chart.group-by` entirely (its labels are now sourced from `pages.main.grid.grid-lib.col-def.*`, which already exist). If `pages.dashboard.widgets.pie-chart` is now left with only unrelated content or becomes empty, check what remains and remove the now-empty `pie-chart` object too (`bucket` moved to `breakdown.state.bucket` in Task 3, `group-by` is removed here - if both are gone, `pie-chart` has nothing left under `widgets`).

Add to `components.modals.widget-config` in `us.json`:

```json
"field": "Field",
"field-group": {
  "categorical": "By Category",
  "numeric": "By Value Range"
}
```

`hu.json`:

```json
"field": "Mező",
"field-group": {
  "categorical": "Kategória szerint",
  "numeric": "Érték tartomány szerint"
}
```

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/widget-config packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#324: widen pie-chart field picker and add the bar-chart field select

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Task 10: `WidgetConfigModal` - stat-tile torrent-count mode

**Files:**

- Modify: `packages/app/src/app/modals/widget-config/widget-config.ts`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.html`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `listBreakdownValues` (Task 3), `breakdownFieldOptions` (Task 9), `TorrentStoreService.torrentsArray` (existing).

- [ ] **Step 1: Write the failing tests**

Add to `widget-config.spec.ts`. This task's tests need `TorrentStoreService` provided - add a mock alongside the existing `NgbActiveModal` provider:

```ts
import { signal } from '@angular/core';
import { Torrent } from '../../models/torrent.model';
import { TorrentStoreService } from '../../services/torrent-store.service';
```

```ts
let torrentStoreMock: { torrentsArray: ReturnType<typeof signal<Torrent[]>> };

beforeEach(async () => {
  activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
  torrentStoreMock = { torrentsArray: signal<Torrent[]>([]) };
  await TestBed.configureTestingModule({
    imports: [WidgetConfig],
    providers: [
      { provide: NgbActiveModal, useValue: activeModalMock },
      { provide: TorrentStoreService, useValue: torrentStoreMock },
    ],
  }).compileComponents();
  // ...rest unchanged
```

```ts
it('should default to "metric" source for a plain metric config', () => {
  withInputs('stat-tile', { metric: 'download_speed' });
  expect(component.statTileSource()).toBe('metric');
});

it('should report "torrent-count" source for a torrent-count config', () => {
  withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
  expect(component.statTileSource()).toBe('torrent-count');
});

it('should switch to torrent-count mode with the first available category value', () => {
  torrentStoreMock.torrentsArray.set([
    { category: 'linux' } as Torrent,
    { category: 'games' } as Torrent,
  ]);
  withInputs('stat-tile', { metric: 'download_speed' });
  component.updateStatTileSource('torrent-count');
  expect(component.config()).toEqual({
    source: 'torrent-count',
    field: 'state',
    value: 'downloading',
  });
});

it('should switch back to metric mode with a sensible default', () => {
  withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
  component.updateStatTileSource('metric');
  expect(component.config()).toEqual({ metric: 'download_speed' });
});

it('should update the torrent-count field and reset value to the first available option', () => {
  torrentStoreMock.torrentsArray.set([
    { category: 'linux' } as Torrent,
    { category: 'games' } as Torrent,
  ]);
  withInputs('stat-tile', { source: 'torrent-count', field: 'state', value: 'downloading' });
  component.updateTorrentCountField('category');
  const config = component.config() as any;
  expect(config.field).toBe('category');
  expect(['linux', 'games']).toContain(config.value);
});

it('should update the torrent-count value without changing the field', () => {
  withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
  component.updateTorrentCountValue('games');
  expect(component.config()).toEqual({
    source: 'torrent-count',
    field: 'category',
    value: 'games',
  });
});

it('should list live torrentCountValueOptions for the currently selected field', () => {
  torrentStoreMock.torrentsArray.set([
    { category: 'linux' } as Torrent,
    { category: 'linux' } as Torrent,
    { category: 'games' } as Torrent,
  ]);
  withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
  const values = component.torrentCountValueOptions().map((o) => o.value);
  expect(values.sort()).toEqual(['games', 'linux']);
});

it('should disallow saving a torrent-count stat-tile with an empty value', () => {
  withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: '' });
  expect(component.canSave()).toBe(false);
});

it('should allow saving a torrent-count stat-tile with a value set', () => {
  withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
  expect(component.canSave()).toBe(true);
});
```

Note: the `'should default to "state"' with value 'downloading'` expectation in the "switch to torrent-count mode" test above assumes an empty `torrentStoreMock` isn't used there (it explicitly sets 2 category torrents, but the default field on switch is `'state'`, not `'category'` - since none of those two torrents were given an explicit `state`, an object literal `{ category: 'linux' } as Torrent` has `state: undefined`, which doesn't match any `PIE_STATE_BUCKETS` key). Use `makeTorrent`-style fully-populated torrents instead of bare casts for this specific test - replace it with:

```ts
it('should switch to torrent-count mode with the first available state value', () => {
  torrentStoreMock.torrentsArray.set([{ state: 'downloading' } as Torrent]);
  withInputs('stat-tile', { metric: 'download_speed' });
  component.updateStatTileSource('torrent-count');
  expect(component.config()).toEqual({
    source: 'torrent-count',
    field: 'state',
    value: 'downloading',
  });
});
```

- [ ] **Step 2: Run, confirm they fail**

Run: `npm test --workspace=@bitbutler/app -- --run widget-config`
Expected: FAIL - `statTileSource`/`updateStatTileSource`/`updateTorrentCountField`/`updateTorrentCountValue`/`torrentCountValueOptions` don't exist; `TorrentStoreService` isn't injected yet so the component would fail to construct once it's added as a required dependency in Step 3 - run this check right after Step 3's injection is added but before the handler methods exist, or accept that this red/green cycle is verified in one combined run after Step 3+4 together (constructing the component at all requires the provider to exist).

- [ ] **Step 3: Inject `TorrentStoreService` and add the source/field/value logic**

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { BreakdownField, StatTileConfig } from '../../models/dashboard.model';
import { listBreakdownValues } from '../../pages/dashboard/widget-selectors';
import { TorrentStoreService } from '../../services/torrent-store.service';
```

```ts
private readonly torrentStore = inject(TorrentStoreService);

readonly sourceOptions: ('metric' | 'torrent-count')[] = ['metric', 'torrent-count'];

readonly statTileSource = computed<'metric' | 'torrent-count'>(() =>
  'source' in this.statTileConfig() ? 'torrent-count' : 'metric',
);

readonly torrentCountConfig = computed(
  () => this.statTileConfig() as Extract<StatTileConfig, { source: 'torrent-count' }>,
);

readonly torrentCountValueOptions = computed(() => {
  if (this.statTileSource() !== 'torrent-count') return [];
  return listBreakdownValues(this.torrentStore.torrentsArray(), this.torrentCountConfig().field).map(
    (s) => ({ value: s.key, labelKey: s.labelKey, fallbackLabel: s.key }),
  );
});

updateStatTileSource(source: 'metric' | 'torrent-count'): void {
  if (source === 'metric') {
    this.config.set({ metric: 'download_speed' } satisfies StatTileConfig);
    return;
  }
  const field = 'state' as const;
  const firstValue = listBreakdownValues(this.torrentStore.torrentsArray(), field)[0]?.key ?? '';
  this.config.set({ source: 'torrent-count', field, value: firstValue } satisfies StatTileConfig);
}

updateTorrentCountField(field: BreakdownField): void {
  const firstValue = listBreakdownValues(this.torrentStore.torrentsArray(), field)[0]?.key ?? '';
  this.config.set({ source: 'torrent-count', field, value: firstValue } satisfies StatTileConfig);
}

updateTorrentCountValue(value: string): void {
  const c = this.torrentCountConfig();
  this.config.set({ ...c, value } satisfies StatTileConfig);
}
```

Update `canSave` to validate torrent-count mode:

```ts
readonly canSave = computed(() => {
  if (this.widgetTypeId() === 'stat-tile') {
    const c = this.statTileConfig();
    return !('source' in c) || !!c.value;
  }
  if (this.widgetTypeId() !== 'torrent-list') return true;

  const c = this.torrentListConfig();
  return (
    !!(c.title ?? '').trim() &&
    Number.isFinite(c.count) &&
    c.count >= 1 &&
    !!c.sortField &&
    !!c.sortOrder &&
    c.columns.length > 0
  );
});
```

- [ ] **Step 4: Update `widget-config.html`**

Replace the `isStatTile()` branch:

```html
@if (isStatTile()) {
<div class="row mb-3">
  <div class="col-12">
    <label class="form-label">{{ 'components.modals.widget-config.source' | translate }}</label>
    <ng-select
      [items]="sourceOptions"
      [clearable]="false"
      [searchable]="false"
      [ngModel]="statTileSource()"
      (change)="updateStatTileSource($event)"
    >
      <ng-template ng-label-tmp let-item="item"
        >{{ 'components.modals.widget-config.source-option.' + item | translate }}</ng-template
      >
      <ng-template ng-option-tmp let-item="item"
        >{{ 'components.modals.widget-config.source-option.' + item | translate }}</ng-template
      >
    </ng-select>
  </div>
</div>
@if (statTileSource() === 'metric') {
<div class="row mb-3">
  <div class="col-12">
    <label class="form-label">{{ 'components.modals.widget-config.metric' | translate }}</label>
    <ng-select
      [items]="statTileMetrics"
      [clearable]="false"
      [searchable]="false"
      [ngModel]="statTileConfig().metric"
      (change)="updateStatTileMetric($event)"
    >
      <ng-template ng-label-tmp let-item="item"
        >{{ 'pages.dashboard.widgets.stat-tile.metric.' + item | translate }}</ng-template
      >
      <ng-template ng-option-tmp let-item="item"
        >{{ 'pages.dashboard.widgets.stat-tile.metric.' + item | translate }}</ng-template
      >
    </ng-select>
  </div>
</div>
} @else {
<div class="row mb-3">
  <div class="col-6">
    <label class="form-label">{{ 'components.modals.widget-config.field' | translate }}</label>
    <ng-select
      [items]="breakdownFieldOptions"
      bindLabel="label"
      bindValue="value"
      groupBy="group"
      [clearable]="false"
      [searchable]="false"
      [ngModel]="torrentCountConfig().field"
      (ngModelChange)="updateTorrentCountField($event)"
    >
    </ng-select>
  </div>
  <div class="col-6">
    <label class="form-label">{{ 'components.modals.widget-config.value' | translate }}</label>
    <ng-select
      [items]="torrentCountValueOptions()"
      bindLabel="fallbackLabel"
      bindValue="value"
      [clearable]="false"
      [searchable]="true"
      [ngModel]="torrentCountConfig().value"
      (ngModelChange)="updateTorrentCountValue($event)"
    >
      <ng-template ng-label-tmp let-item="item"
        >{{ item.labelKey ? (item.labelKey | translate) : item.fallbackLabel }}</ng-template
      >
      <ng-template ng-option-tmp let-item="item"
        >{{ item.labelKey ? (item.labelKey | translate) : item.fallbackLabel }}</ng-template
      >
    </ng-select>
  </div>
</div>
} } @else if (isPieChart()) {
```

(Everything from `} @else if (isPieChart()) {` onward is unchanged from Task 9.)

- [ ] **Step 5: Run, confirm the new tests pass**

Run: `npm test --workspace=@bitbutler/app -- --run widget-config`
Expected: PASS.

- [ ] **Step 6: Run the full app test suite and a production build**

Run: `npm test --workspace=@bitbutler/app && npm run build --workspace=@bitbutler/app`
Expected: all PASS, build succeeds.

- [ ] **Step 7: i18n**

`us.json`, inside `components.modals.widget-config`, add:

```json
"value": "Value",
"source": "Source",
"source-option": {
  "metric": "Server Metric",
  "torrent-count": "Torrent Count"
}
```

`hu.json`:

```json
"value": "Érték",
"source": "Forrás",
"source-option": {
  "metric": "Szerver metrika",
  "torrent-count": "Torrent szám"
}
```

- [ ] **Step 8: Manual check**

Run `npm start`. Add a stat-tile widget, switch its source to "Torrent Count", pick "Category" as the field and any live category as the value, save, and confirm the tile shows the category name and a live count that tracks your torrents. Reopen its Configure menu and confirm the saved field/value are pre-selected.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/modals/widget-config packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#324: add stat-tile torrent-count mode with live value picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CmqoxJsAegLK11FUqiPXrQ
EOF
)"
```

---

## Final verification

- [ ] Run the full workspace test suite: `npm test`
- [ ] Run lint: `npm run lint`
- [ ] Run a full UI build: `npm run build:ui`
- [ ] Manual pass: add one of each widget type (stat-tile in both modes, torrent-list, pie-chart with each of its 4 fields, bar-chart with a sample of categorical and numeric fields), confirm an existing dashboard saved before this change (if you have one from `main`) still loads without error.
