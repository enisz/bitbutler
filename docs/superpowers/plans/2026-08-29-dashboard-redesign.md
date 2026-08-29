# Dashboard restyle + chart widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the dashboard to match the reference design, replace the widget "manage panel" with a per-widget ellipsis menu, fix widget rows stretching/scrollbar-clipping on resize, move widget-add to a side offcanvas, and add a configurable Highcharts pie-chart widget type.

**Architecture:** Existing dashboard widget system (issue #324: `WIDGET_CATALOG` registry, `WidgetConfigModal`, `resolveWidgetData` selectors, gridstack-hosted widget components) gets a third widget type (`pie-chart`) following the exact same registration pattern as `stat-tile`/`torrent-list`. A new shared `WidgetMenu` presentational component (ellipsis + `NgbDropdown`) is composed into every widget template; since gridstack instantiates widget components dynamically via `props` (inputs only - no template, so no way to bind `(output)`), the dashboard passes `onConfigure`/`onRemove` as callback-function inputs rather than using `@Output()` or the app's global `CommandBusService` (that bus is for cross-cutting app commands with dedicated handler services; this is local parent/child wiring within one component subtree, and gridstack's props-as-inputs constraint rules out an output-based channel regardless).

**Tech Stack:** Angular 22 (standalone, zoneless, signals), `gridstack` (already integrated), `@ng-bootstrap/ng-bootstrap` (`NgbDropdown`, adding `NgbOffcanvas`), `highcharts` + `highcharts-angular` (new), `@ngx-translate/core`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-dashboard-redesign-design.md`

## Global Constraints

- Card visuals must use existing `--bs-*` design tokens (`--bs-card-bg`, `--bs-border-color`, `--bs-body-color`, etc.) - never hardcode the reference design's colors - so every one of the 8 theme families and both light/dark modes render correctly with no new theme work.
- No new IPC calls, no new backend data. Every widget's data comes from `DashboardSnapshot` (`torrents`, `serverState`) already available today.
- `pages.dashboard.widgets.<type>.*` i18n namespace convention (already used by `stat-tile`/`torrent-list`) applies to the new `pie-chart` widget too - do not reuse `pages.main.status.*` even though the concepts overlap.
- Every new/changed user-facing string needs both `packages/app/public/i18n/us.json` and `packages/app/public/i18n/hu.json` entries, at the same JSON path in both files.
- `npm run lint` must stay at zero warnings (project-wide `max-warnings=0`).

---

### Task 1: Pie-chart data model + selector

**Files:**

- Modify: `packages/app/src/app/models/dashboard.model.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`

**Interfaces:**

- Produces: `WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart'`, `PieChartGroupBy = 'state' | 'category'`, `PieChartConfig { groupBy: PieChartGroupBy }`, `PieChartSlice { key: string; labelKey?: string; value: number }`, `PieChartData { groupBy: PieChartGroupBy; slices: PieChartSlice[] }`, `selectPieChartData(snapshot, config): PieChartData`. `resolveWidgetData` now returns `StatTileData | TorrentListData | PieChartData`.

- [ ] **Step 1: Write the failing selector tests**

Append to `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts` (add `selectPieChartData` to the existing import line, and this new `describe` block before `describe('resolveWidgetData', ...)`):

```ts
import {
  resolveWidgetData,
  selectPieChartData,
  selectStatTileData,
  selectTorrentListData,
} from './widget-selectors';

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
        labelKey: 'pages.dashboard.widgets.pie-chart.bucket.downloading',
        value: 2,
      },
      {
        key: 'completed',
        labelKey: 'pages.dashboard.widgets.pie-chart.bucket.completed',
        value: 1,
      },
      { key: 'errored', labelKey: 'pages.dashboard.widgets.pie-chart.bucket.errored', value: 1 },
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
```

Also add this case to the existing `describe('resolveWidgetData', ...)` block:

```ts
it('should dispatch to selectPieChartData for a pie-chart instance', () => {
  const instance: DashboardWidgetInstance = {
    instanceId: 'i3',
    widgetTypeId: 'pie-chart',
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    config: { groupBy: 'state' },
  };
  const snapshot: DashboardSnapshot = {
    torrents: [makeTorrent({ state: 'downloading' })],
    serverState: null,
  };

  expect(resolveWidgetData(instance, snapshot)).toEqual({
    groupBy: 'state',
    slices: [
      {
        key: 'downloading',
        labelKey: 'pages.dashboard.widgets.pie-chart.bucket.downloading',
        value: 1,
      },
    ],
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- widget-selectors`
Expected: FAIL - `selectPieChartData` is not exported, `pie-chart` is not assignable to `WidgetTypeId`.

- [ ] **Step 3: Widen the model**

In `packages/app/src/app/models/dashboard.model.ts`, change:

```ts
export type WidgetTypeId = 'stat-tile' | 'torrent-list';
```

to:

```ts
export type WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart';
```

Add after the `TorrentListConfig` interface:

```ts
export type PieChartGroupBy = 'state' | 'category';

export interface PieChartConfig {
  groupBy: PieChartGroupBy;
}
```

Change:

```ts
export type WidgetConfig = StatTileConfig | TorrentListConfig;
```

to:

```ts
export type WidgetConfig = StatTileConfig | TorrentListConfig | PieChartConfig;
```

Add after the `TorrentListData` interface at the end of the file:

```ts
export interface PieChartSlice {
  key: string;
  /** Translation key for a 'state' bucket slice. Absent for 'category' slices - `key` there is the raw category string, already display-ready. */
  labelKey?: string;
  value: number;
}

export interface PieChartData {
  groupBy: PieChartGroupBy;
  slices: PieChartSlice[];
}
```

- [ ] **Step 4: Implement the state-bucket partition and selector**

In `packages/app/src/app/pages/dashboard/widget-selectors.ts`, add `PieChartConfig` and `PieChartData`/`PieChartSlice` to the existing import from `../../models/dashboard.model`, and add after the `ACTIVE_STATES` constant:

```ts
// Every TorrentState maps to exactly one bucket (unlike ACTIVE_STATES/the sidebar's `groups` map
// in status.ts, whose groups deliberately overlap for independent filter checkboxes) - a pie
// chart's slices must sum to the full torrent count.
type PieStateBucket =
  | 'downloading'
  | 'completed'
  | 'inactive'
  | 'stopped'
  | 'checking'
  | 'errored'
  | 'other';

const PIE_STATE_BUCKETS: Record<TorrentState, PieStateBucket> = {
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

const PIE_STATE_BUCKET_ORDER: PieStateBucket[] = [
  'downloading',
  'completed',
  'inactive',
  'stopped',
  'checking',
  'errored',
  'other',
];
```

Then add the selector function, after `selectTorrentListData`:

```ts
export function selectPieChartData(
  snapshot: DashboardSnapshot,
  config: PieChartConfig,
): PieChartData {
  const counts = new Map<string, number>();

  if (config.groupBy === 'state') {
    for (const t of snapshot.torrents) {
      const bucket = PIE_STATE_BUCKETS[t.state];
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const slices: PieChartSlice[] = PIE_STATE_BUCKET_ORDER.filter(
      (bucket) => (counts.get(bucket) ?? 0) > 0,
    ).map((bucket) => ({
      key: bucket,
      labelKey: `pages.dashboard.widgets.pie-chart.bucket.${bucket}`,
      value: counts.get(bucket)!,
    }));
    return { groupBy: 'state', slices };
  }

  for (const t of snapshot.torrents) {
    const key = t.category || '-';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const slices: PieChartSlice[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
  return { groupBy: 'category', slices };
}
```

Finally, update `resolveWidgetData`:

```ts
export function resolveWidgetData(
  instance: DashboardWidgetInstance,
  snapshot: DashboardSnapshot,
): StatTileData | TorrentListData | PieChartData {
  switch (instance.widgetTypeId) {
    case 'stat-tile':
      return selectStatTileData(snapshot, instance.config as StatTileConfig);
    case 'torrent-list':
      return selectTorrentListData(snapshot, instance.config as TorrentListConfig);
    case 'pie-chart':
      return selectPieChartData(snapshot, instance.config as PieChartConfig);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- widget-selectors`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

Run: `npm run build --workspace=@bitbutler/app -- --configuration=development` (or `npx tsc -p packages/app --noEmit` if faster) to confirm no other file broke from the widened unions - nothing should, since no other file switches exhaustively on `WidgetTypeId`/`WidgetConfig` yet.

```bash
git add packages/app/src/app/models/dashboard.model.ts packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/pages/dashboard/widget-selectors.spec.ts
git commit -m "#324: add pie-chart data model and selector"
```

---

### Task 2: Fix widget-row height + scrollbar-inside-border on `torrent-list-widget`

Fixes two bugs together since they're both in the same file and the same root cause (the table owns both height and its own border/radius): rows currently stretch/shrink to fill whatever height gridstack gives the widget instead of keeping a fixed row height, and the table's native scrollbar renders flush against (and visually outside) the card's rounded border because the border and the scrolling element are the same box.

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html`
- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss`
- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new (visual/structural only) - `TorrentListWidget`'s public shape (`data`, `formattedValue`) is unchanged.

- [ ] **Step 1: Update the failing structural test**

The existing test queries `td` directly on the fixture root, which still works after the wrapper is added (querying isn't scoped to a specific ancestor), so no test changes are strictly required for correctness - but add one assertion that pins the new wrapper structure so a future edit can't silently reintroduce `height: 100%` on the table:

In `torrent-list-widget.spec.ts`, add to the existing `it('should render one row per data.rows entry ...')` test body:

```ts
const scrollHost = fixture.nativeElement.querySelector('.torrent-list-widget__scroll');
expect(scrollHost).toBeTruthy();
expect(fixture.nativeElement.querySelector('table').classList).toContain(
  'torrent-list-widget__table',
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- torrent-list-widget`
Expected: FAIL - `.torrent-list-widget__scroll` not found (current markup has no wrapper).

- [ ] **Step 3: Restructure the template**

Replace the full contents of `torrent-list-widget.html` with:

```html
<div class="torrent-list-widget">
  <div class="torrent-list-widget__scroll">
    <table class="torrent-list-widget__table">
      <thead>
        <tr>
          @for (column of data.columns; track column) {
          <th>{{ 'pages.dashboard.widgets.torrent-list.column.' + column | translate }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of data.rows; track row.hash) {
        <tr>
          @for (column of data.columns; track column) {
          <td>{{ formattedValue(row, column) }}</td>
          }
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 4: Restructure the styles**

Replace the full contents of `torrent-list-widget.scss` with:

```scss
// See stat-tile.scss for why :host needs an explicit display/size: GridStack inserts
// <app-torrent-list-widget> as a bare custom element, which renders inline by default and gives
// height:100% below nothing definite to resolve against.
:host {
  display: block;
  height: 100%;
  width: 100%;
}

.torrent-list-widget {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--bs-card-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  // Clips the scroll layer's content to the card's rounded corners - without this, a table tall
  // enough to scroll paints square corners over the border-radius.
  overflow: hidden;

  &__scroll {
    height: 100%;
    width: 100%;
    overflow-y: auto;
    // Right-side gutter so the scrollbar has space of its own instead of sitting flush against
    // (and, with a rounded border, visually poking outside of) the card edge.
    padding-right: 0.375rem;
  }

  &__table {
    width: 100%;
    // No height rule here - rows keep their intrinsic padding/font-size height. Below that
    // height the __scroll wrapper scrolls; above it, the table just leaves blank space beneath
    // itself instead of the browser stretching rows to fill the container.
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    padding: 0.25rem 0.5rem;
    text-align: left;
    white-space: nowrap;
  }

  th {
    text-transform: uppercase;
    font-size: 0.7rem;
    opacity: 0.7;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- torrent-list-widget`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts
git commit -m "#324: fix fixed-height rows and scrollbar gutter on torrent-list-widget"
```

---

### Task 3: Shared `WidgetMenu` component

A small presentational component: an ellipsis button (shown only when `visible()` is true) that opens an `NgbDropdown` with "Configure" and "Delete" actions. Reused by every widget type from Task 4 onward.

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.ts`
- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.html`
- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.scss`
- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `WidgetMenu` standalone component, selector `app-widget-menu`, `input<boolean>() visible` (default `false`), `output<void>() configure`, `output<void>() remove`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WidgetMenu } from './widget-menu';

describe('WidgetMenu', () => {
  let fixture: ComponentFixture<WidgetMenu>;
  let component: WidgetMenu;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WidgetMenu] }).compileComponents();
    fixture = TestBed.createComponent(WidgetMenu);
    component = fixture.componentInstance;
  });

  it('should render nothing when not visible', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.widget-menu')).toBeNull();
  });

  it('should render the toggle when visible', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.widget-menu')).toBeTruthy();
  });

  it('should emit configure when the Configure item is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.configure.subscribe(emitted);

    fixture.nativeElement.querySelector('[data-test="widget-menu-configure"]').click();

    expect(emitted).toHaveBeenCalled();
  });

  it('should emit remove when the Delete item is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.remove.subscribe(emitted);

    fixture.nativeElement.querySelector('[data-test="widget-menu-remove"]').click();

    expect(emitted).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- widget-menu`
Expected: FAIL - cannot find module `./widget-menu`.

- [ ] **Step 3: Add i18n keys**

In `packages/app/public/i18n/us.json`, inside `general.button` (after `"edit": "Edit",`), add:

```json
      "configure": "Configure",
```

In `packages/app/public/i18n/hu.json`, inside `general.button` (after `"edit": "Szerkesztés",`), add:

```json
      "configure": "Konfigurálás",
```

In `packages/app/public/i18n/us.json`, inside `pages.dashboard` (as a new sibling of `"widgets"`, right after the closing `}` of the `widgets` block on line 1264), add:

```json
      "widget-menu": {
        "toggle-label": "Widget options"
      },
```

In `packages/app/public/i18n/hu.json`, at the same spot:

```json
      "widget-menu": {
        "toggle-label": "Widget műveletek"
      },
```

- [ ] **Step 4: Implement the component**

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-widget-menu',
  standalone: true,
  imports: [NgbDropdownModule, FontAwesomeModule, TranslatePipe],
  templateUrl: './widget-menu.html',
  styleUrl: './widget-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetMenu {
  readonly visible = input(false);
  readonly configure = output<void>();
  readonly remove = output<void>();

  readonly icon = { faEllipsisVertical };
}
```

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.html`:

```html
@if (visible()) {
<div class="widget-menu" ngbDropdown container="body" placement="bottom-end">
  <button
    type="button"
    class="widget-menu__toggle"
    ngbDropdownToggle
    [attr.aria-label]="'pages.dashboard.widget-menu.toggle-label' | translate"
  >
    <fa-icon [icon]="icon.faEllipsisVertical" />
  </button>
  <div ngbDropdownMenu>
    <button
      type="button"
      ngbDropdownItem
      data-test="widget-menu-configure"
      (click)="configure.emit()"
    >
      {{ 'general.button.configure' | translate }}
    </button>
    <button type="button" ngbDropdownItem data-test="widget-menu-remove" (click)="remove.emit()">
      {{ 'general.button.delete' | translate }}
    </button>
  </div>
</div>
}
```

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.scss`:

```scss
.widget-menu {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1;

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: var(--bs-border-radius);
    background: transparent;
    color: var(--bs-body-color);
    opacity: 0.6;

    &:hover {
      opacity: 1;
      background-color: var(--bs-border-color);
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- widget-menu`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/widget-menu packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add shared WidgetMenu component"
```

---

### Task 4: Wire `WidgetMenu` into the dashboard; remove the manage panel

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.html`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.html`
- Modify: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.scss`
- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.ts`
- Modify: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html`

**Interfaces:**

- Consumes: `WidgetMenu` (Task 3) selector `app-widget-menu`, inputs `visible`, outputs `configure`/`remove`.
- Produces: `Dashboard.items()` now emits `props: { data, editMode, onConfigure, onRemove }` per widget (widened from `{ data }`). `StatTile`/`TorrentListWidget` gain `@Input() editMode = false`, `@Input() onConfigure!: () => void`, `@Input() onRemove!: () => void`.

- [ ] **Step 1: Update the failing `Dashboard` tests**

In `dashboard.spec.ts`, replace the `describe('items', ...)` block with:

```ts
describe('items', () => {
  it('should map each placed widget instance to a gridstack node with component/props fields', async () => {
    await createComponent();

    const items = component.items();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'w1',
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      component: 'app-stat-tile',
      props: {
        data: { metric: 'download_speed', value: 0 },
        editMode: false,
      },
    });
    expect(typeof (items[0].props as any).onConfigure).toBe('function');
    expect(typeof (items[0].props as any).onRemove).toBe('function');
  });

  it('should reflect editMode in props and toggle it live', async () => {
    await createComponent();
    expect((component.items()[0].props as any).editMode).toBe(false);

    component.toggleEditMode();

    expect((component.items()[0].props as any).editMode).toBe(true);
  });

  it("should route each widget's onConfigure/onRemove callback to editWidget/removeWidget for that instance", async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    const configResult = Promise.resolve({ metric: 'active_count' });
    modalServiceMock.open.mockReturnValue({ result: configResult, componentInstance: {} });
    await createComponent();

    const props = component.items()[0].props as any;
    props.onConfigure();
    await configResult;
    await Promise.resolve();

    expect(component.widgets()[0]).toMatchObject({ config: { metric: 'active_count' } });

    props.onRemove();
    expect(component.widgets()).toEqual([]);
  });
});
```

Remove the now-redundant manual `editMode()` toggle assertions are unaffected (that `describe('editMode', ...)` block stays as-is).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- dashboard.spec`
Expected: FAIL - `props` only has `data`, no `editMode`/`onConfigure`/`onRemove`.

- [ ] **Step 3: Widen `items()` in `dashboard.ts`**

Replace the `items` computed:

```ts
  readonly items = computed<NgGridStackWidget[]>(() =>
    this.widgets().map((instance) => ({
      id: instance.instanceId,
      x: instance.x,
      y: instance.y,
      w: instance.w,
      h: instance.h,
      component: WIDGET_CATALOG[instance.widgetTypeId].componentSelector,
      props: {
        data: this.dataFor(instance),
        editMode: this.editMode(),
        onConfigure: () => this.editWidget(instance.instanceId),
        onRemove: () => this.removeWidget(instance.instanceId),
      },
    })),
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- dashboard.spec`
Expected: PASS

- [ ] **Step 5: Remove the manage panel from `dashboard.html`**

Delete this whole block from `dashboard.html` (the `@if (editMode())` manage-panel section, between the `</header>` and the `<gridstack` element):

```html
@if (editMode()) {
<div class="dashboard__manage-panel">
  <ul class="list-group list-group-flush">
    @for (widget of widgets(); track widget.instanceId) {
    <li class="list-group-item d-flex align-items-center justify-content-between">
      <span>{{ catalog[widget.widgetTypeId].labelKey | translate }}</span>
      <div class="d-flex gap-1">
        <button
          type="button"
          class="btn btn-link p-1"
          [ngbTooltip]="'general.button.edit' | translate"
          (click)="editWidget(widget.instanceId)"
        >
          <fa-icon [icon]="icon.faPenToSquare" />
        </button>
        <button
          type="button"
          class="btn btn-link text-danger p-1"
          [ngbTooltip]="'general.button.delete' | translate"
          (click)="removeWidget(widget.instanceId)"
        >
          <fa-icon [icon]="icon.faTrashCan" />
        </button>
      </div>
    </li>
    }
  </ul>
</div>
}
```

In `dashboard.scss`, delete the now-unused `&__manage-panel { ... }` rule.

In `dashboard.ts`: `editWidget`/`removeWidget`/`catalog` stay (still used by `items()` and the offcanvas picker in Task 5). But `faPenToSquare`/`faTrashCan` and `NgbTooltipModule` were only ever used by the manage panel's Edit/Delete buttons (`[ngbTooltip]`, `<fa-icon [icon]="icon.faPenToSquare">`/`faTrashCan`) - nothing else in `dashboard.html` uses them, so remove them here rather than leave dead imports:

```ts
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
```

```ts
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [GridstackComponent, TranslatePipe, FontAwesomeModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

```ts
  readonly icon = { faPlus };
```

(`NgbModal` stays - Task 5 still uses it for `WidgetConfigModal`.)

- [ ] **Step 6: Wire `WidgetMenu` into `StatTile`**

In `stat-tile.ts`, add `WidgetMenu` to imports and the new inputs:

```ts
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { StatTileData } from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
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
  @Input() editMode = false;
  @Input() onConfigure!: () => void;
  @Input() onRemove!: () => void;

  get labelKey(): string {
    return `pages.dashboard.widgets.stat-tile.metric.${this.data.metric}`;
  }

  get displayKind(): 'bytes' | 'speed' | 'ratio' | 'count' {
    switch (this.data.metric) {
      case 'download_speed':
      case 'upload_speed':
        return 'speed';
      case 'free_disk_space':
        return 'bytes';
      case 'global_ratio':
        return 'ratio';
      case 'active_count':
        return 'count';
    }
  }
}
```

In `stat-tile.html`, add the menu as the first child of `.stat-tile`:

```html
<div class="stat-tile">
  <app-widget-menu [visible]="editMode" (configure)="onConfigure()" (remove)="onRemove()" />
  <div class="stat-tile__label">{{ labelKey | translate }}</div>
  <div class="stat-tile__value">
    @switch (displayKind) { @case ('speed') { {{ data.value | fileSize }}/s } @case ('bytes') { {{
    data.value | fileSize }} } @case ('ratio') { {{ data.value | ratio }} } @case ('count') { {{
    data.value }} @if (data.total !== undefined) {
    <span class="stat-tile__total">of {{ data.total }}</span>
    } } }
  </div>
</div>
```

In `stat-tile.scss`, add `position: relative;` to the `.stat-tile` rule (needed so `WidgetMenu`'s `position: absolute` anchors to the tile, not the page) and `overflow: hidden;` (clips to the tile's rounded border, matching the torrent-list-widget fix from Task 2):

```scss
.stat-tile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  padding: 0.75rem 1rem;
  position: relative;
  overflow: hidden;
  background-color: var(--bs-card-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);

  &__label {
    font-size: 0.75rem;
    text-transform: uppercase;
    opacity: 0.7;
  }

  &__value {
    font-size: 1.75rem;
    font-weight: 600;
  }

  &__total {
    font-size: 1rem;
    font-weight: 400;
    opacity: 0.7;
    margin-left: 0.25rem;
  }
}
```

- [ ] **Step 7: Wire `WidgetMenu` into `TorrentListWidget`**

In `torrent-list-widget.ts`, add `WidgetMenu` to imports and the new inputs:

```ts
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import {
  TorrentListColumn,
  TorrentListData,
  TorrentListRow,
} from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
import { WidgetMenu } from '../widget-menu/widget-menu';

@Component({
  selector: 'app-torrent-list-widget',
  standalone: true,
  imports: [TranslatePipe, WidgetMenu],
  templateUrl: './torrent-list-widget.html',
  styleUrl: './torrent-list-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentListWidget extends BaseWidget {
  @Input() data!: TorrentListData;
  @Input() editMode = false;
  @Input() onConfigure!: () => void;
  @Input() onRemove!: () => void;

  private readonly ratioPipe = inject(RatioPipe);
  private readonly filesizePipe = inject(FilesizePipe);
  private readonly humanizeDurationPipe = inject(HumanizeDurationPipe);

  formattedValue(row: TorrentListRow, column: TorrentListColumn): string {
    switch (column) {
      case 'name':
        return row.name;
      case 'state':
        return row.state;
      case 'category':
        return row.category || '-';
      case 'ratio':
        return this.ratioPipe.transform(row.ratio);
      case 'dlspeed':
        return `${this.filesizePipe.transform(row.dlspeed)}/s`;
      case 'upspeed':
        return `${this.filesizePipe.transform(row.upspeed)}/s`;
      case 'size':
        return this.filesizePipe.transform(row.size);
      case 'progress':
        return `${Math.round(row.progress * 100)}%`;
      case 'added_on':
        return row.added_on ? new Date(row.added_on * 1000).toLocaleDateString() : '-';
      case 'eta':
        return this.humanizeDurationPipe.transform(row.eta * 1000, 'short', 2);
    }
  }
}
```

In `torrent-list-widget.html`, add the menu as the first child of `.torrent-list-widget` (outside the scroll wrapper, so it stays fixed while the table scrolls):

```html
<div class="torrent-list-widget">
  <app-widget-menu [visible]="editMode" (configure)="onConfigure()" (remove)="onRemove()" />
  <div class="torrent-list-widget__scroll">
    <table class="torrent-list-widget__table">
      <thead>
        <tr>
          @for (column of data.columns; track column) {
          <th>{{ 'pages.dashboard.widgets.torrent-list.column.' + column | translate }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of data.rows; track row.hash) {
        <tr>
          @for (column of data.columns; track column) {
          <td>{{ formattedValue(row, column) }}</td>
          }
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 8: Run the full dashboard test suite and verify everything passes**

Run: `npm test --workspace=@bitbutler/app -- dashboard.spec stat-tile torrent-list-widget widget-menu`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/pages/dashboard
git commit -m "#324: replace the manage panel with per-widget WidgetMenu"
```

---

### Task 5: Widget picker moves to an offcanvas; catalog gains icon/description metadata

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/widget-catalog.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-catalog.spec.ts`
- Modify: `packages/app/src/app/modals/widget-picker/widget-picker.ts`
- Modify: `packages/app/src/app/modals/widget-picker/widget-picker.html`
- Modify: `packages/app/src/app/modals/widget-picker/widget-picker.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `WidgetCatalogMeta` gains `icon: IconDefinition` and `descriptionKey: string`. `WidgetPicker` uses `NgbActiveOffcanvas` instead of `NgbActiveModal` (same `close(value)`/`dismiss()` shape). `Dashboard.addWidget()` opens it via `NgbOffcanvas.open(WidgetPicker, { position: 'end' })` instead of `NgbModal.open(...)`.

- [ ] **Step 1: Update the failing catalog test**

In `widget-catalog.spec.ts`, update the entries-list assertion and add coverage for the new fields:

```ts
import { WIDGET_CATALOG } from './widget-catalog';

describe('WIDGET_CATALOG', () => {
  it('should have an entry for every WidgetTypeId', () => {
    expect(Object.keys(WIDGET_CATALOG).sort()).toEqual(['pie-chart', 'stat-tile', 'torrent-list']);
  });

  it('should map stat-tile to the StatTile component selector', () => {
    expect(WIDGET_CATALOG['stat-tile'].componentSelector).toBe('app-stat-tile');
  });

  it('should map torrent-list to the TorrentListWidget component selector', () => {
    expect(WIDGET_CATALOG['torrent-list'].componentSelector).toBe('app-torrent-list-widget');
  });

  it('should give torrent-list a sensible default config', () => {
    expect(WIDGET_CATALOG['torrent-list'].defaultConfig).toEqual({
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    });
  });

  it('should give every entry an icon and a description key', () => {
    for (const entry of Object.values(WIDGET_CATALOG)) {
      expect(entry.icon).toBeTruthy();
      expect(entry.descriptionKey).toMatch(/^pages\.dashboard\.catalog-type\./);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- widget-catalog`
Expected: FAIL - `pie-chart` missing from `WIDGET_CATALOG`, `icon`/`descriptionKey` undefined.

- [ ] **Step 3: Add i18n keys**

In `packages/app/public/i18n/us.json`, inside `pages.dashboard.catalog` add a `"pie-chart"` entry, and add a new sibling `catalog-type` block right after it:

```json
      "catalog": {
        "stat-tile": "Stat Tile",
        "torrent-list": "Torrent List",
        "pie-chart": "Pie Chart"
      },
      "catalog-type": {
        "stat-tile": "Number",
        "torrent-list": "Table",
        "pie-chart": "Pie"
      },
```

In `packages/app/public/i18n/hu.json`, same location:

```json
      "catalog": {
        "stat-tile": "Statisztika csempe",
        "torrent-list": "Torrent lista",
        "pie-chart": "Kördiagram"
      },
      "catalog-type": {
        "stat-tile": "Szám",
        "torrent-list": "Táblázat",
        "pie-chart": "Kör"
      },
```

- [ ] **Step 4: Update the catalog**

Replace `packages/app/src/app/pages/dashboard/widget-catalog.ts`:

```ts
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faChartPie, faHashtag, faTable } from '@fortawesome/free-solid-svg-icons';
import {
  PieChartConfig,
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig,
  WidgetTypeId,
} from '../../models/dashboard.model';

export interface WidgetCatalogMeta {
  id: WidgetTypeId;
  labelKey: string;
  descriptionKey: string;
  icon: IconDefinition;
  componentSelector: string;
  defaultConfig: WidgetConfig;
  defaultSize: { w: number; h: number };
}

export const WIDGET_CATALOG: Record<WidgetTypeId, WidgetCatalogMeta> = {
  'stat-tile': {
    id: 'stat-tile',
    labelKey: 'pages.dashboard.catalog.stat-tile',
    descriptionKey: 'pages.dashboard.catalog-type.stat-tile',
    icon: faHashtag,
    componentSelector: 'app-stat-tile',
    defaultConfig: { metric: 'download_speed' } satisfies StatTileConfig,
    defaultSize: { w: 3, h: 2 },
  },
  'torrent-list': {
    id: 'torrent-list',
    labelKey: 'pages.dashboard.catalog.torrent-list',
    descriptionKey: 'pages.dashboard.catalog-type.torrent-list',
    icon: faTable,
    componentSelector: 'app-torrent-list-widget',
    defaultConfig: {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    } satisfies TorrentListConfig,
    defaultSize: { w: 6, h: 4 },
  },
  'pie-chart': {
    id: 'pie-chart',
    labelKey: 'pages.dashboard.catalog.pie-chart',
    descriptionKey: 'pages.dashboard.catalog-type.pie-chart',
    icon: faChartPie,
    componentSelector: 'app-pie-chart-widget',
    defaultConfig: { groupBy: 'state' } satisfies PieChartConfig,
    defaultSize: { w: 4, h: 4 },
  },
};
```

- [ ] **Step 5: Run the catalog test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- widget-catalog`
Expected: PASS (the `pie-chart` component `app-pie-chart-widget` doesn't need to exist yet - this is metadata only, resolved to a real component in Task 8).

- [ ] **Step 6: Update the failing picker tests**

Replace `packages/app/src/app/modals/widget-picker/widget-picker.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { WidgetPicker } from './widget-picker';

describe('WidgetPicker', () => {
  let component: WidgetPicker;
  let fixture: ComponentFixture<WidgetPicker>;
  let activeOffcanvasMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeOffcanvasMock = { close: vi.fn(), dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [WidgetPicker],
      providers: [{ provide: NgbActiveOffcanvas, useValue: activeOffcanvasMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(WidgetPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should list every catalog entry', () => {
    expect(component.catalogEntries.map((e) => e.id).sort()).toEqual([
      'pie-chart',
      'stat-tile',
      'torrent-list',
    ]);
  });

  it('should close the offcanvas with the chosen widget type id', () => {
    component.choose('stat-tile');
    expect(activeOffcanvasMock.close).toHaveBeenCalledWith('stat-tile');
  });

  it('should dismiss on cancel', () => {
    component.cancel();
    expect(activeOffcanvasMock.dismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the picker test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- widget-picker`
Expected: FAIL - `WidgetPicker` still injects `NgbActiveModal`, not provided here.

- [ ] **Step 8: Convert `WidgetPicker` to an offcanvas**

Replace `packages/app/src/app/modals/widget-picker/widget-picker.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { WidgetTypeId } from '../../models/dashboard.model';
import { WIDGET_CATALOG, WidgetCatalogMeta } from '../../pages/dashboard/widget-catalog';

@Component({
  selector: 'app-widget-picker',
  standalone: true,
  imports: [TranslatePipe, FontAwesomeModule],
  templateUrl: './widget-picker.html',
  styleUrl: './widget-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPicker {
  private readonly activeOffcanvas = inject(NgbActiveOffcanvas);

  readonly catalogEntries: WidgetCatalogMeta[] = Object.values(WIDGET_CATALOG);

  choose(widgetTypeId: WidgetTypeId): void {
    this.activeOffcanvas.close(widgetTypeId);
  }

  cancel(): void {
    this.activeOffcanvas.dismiss();
  }
}
```

Replace `packages/app/src/app/modals/widget-picker/widget-picker.html`:

```html
<div class="offcanvas-header">
  <h5 class="offcanvas-title">{{ 'components.modals.widget-picker.title' | translate }}</h5>
  <button
    type="button"
    class="btn-close"
    aria-label="{{ 'general.button.close' | translate }}"
    (click)="cancel()"
  ></button>
</div>
<div class="offcanvas-body">
  <div class="list-group list-group-flush">
    @for (entry of catalogEntries; track entry.id) {
    <button
      type="button"
      class="list-group-item list-group-item-action d-flex align-items-center gap-3"
      (click)="choose(entry.id)"
    >
      <fa-icon [icon]="entry.icon" />
      <span class="flex-grow-1">
        <span class="d-block">{{ entry.labelKey | translate }}</span>
        <span class="d-block text-body-secondary small"
          >{{ entry.descriptionKey | translate }}</span
        >
      </span>
    </button>
    }
  </div>
</div>
```

`widget-picker.scss` is currently empty and needs no changes - Bootstrap's `.offcanvas-header`/`.offcanvas-body` classes already inherit the app's card/border tokens.

- [ ] **Step 9: Run the picker test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- widget-picker`
Expected: PASS

- [ ] **Step 10: Update `Dashboard.addWidget()` to open the offcanvas**

In `dashboard.ts`, change the import (added in Task 4 as just `NgbModal`):

```ts
import { NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
```

Add the injected service alongside `modalService`:

```ts
  private readonly modalService = inject(NgbModal);
  private readonly offcanvasService = inject(NgbOffcanvas);
```

Replace `addWidget()`:

```ts
  addWidget(): void {
    const pickerRef = this.offcanvasService.open(WidgetPicker, { position: 'end' });
    pickerRef.result
      .then((widgetTypeId: WidgetTypeId) => {
        const meta = WIDGET_CATALOG[widgetTypeId];
        const configRef = this.modalService.open(WidgetConfigModal, { centered: true });
        setModalInput(configRef, 'widgetTypeId', widgetTypeId);
        setModalInput(configRef, 'initialConfig', meta.defaultConfig);

        return configRef.result.then((config: WidgetConfig) => {
          const instance: DashboardWidgetInstance = {
            instanceId: crypto.randomUUID(),
            widgetTypeId,
            x: 0,
            y: 0,
            w: meta.defaultSize.w,
            h: meta.defaultSize.h,
            config,
          };
          const next = [...this.widgets(), instance];
          this.widgets.set(next);
          void this.dashboardSettingsService.save({ widgets: next });
        });
      })
      .catch(() => {});
  }
```

(`NgbOffcanvasRef.result` has the identical `Promise`/`close`/`dismiss` shape as `NgbModalRef.result`, so the rest of the chain is unchanged.)

- [ ] **Step 11: Update the failing `Dashboard.addWidget` test**

`dashboard.spec.ts` currently mocks `NgbModal` and asserts on `modalServiceMock.open`. It needs a second mock for `NgbOffcanvas`. Update the top of the file:

```ts
import { NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
```

Add an `offcanvasServiceMock` alongside `modalServiceMock`:

```ts
let offcanvasServiceMock: { open: ReturnType<typeof vi.fn> };
```

In `createComponent()`'s providers array, add:

```ts
        { provide: NgbOffcanvas, useValue: offcanvasServiceMock },
```

In `beforeEach`, add:

```ts
offcanvasServiceMock = { open: vi.fn() };
```

Update the `describe('addWidget', ...)` test to open the picker via the offcanvas mock instead of the modal mock:

```ts
describe('addWidget', () => {
  it('should open the picker offcanvas, then the config modal pre-filled with the catalog default, then append the confirmed instance', async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    const pickerResult = Promise.resolve('stat-tile');
    const configResult = Promise.resolve({ metric: 'global_ratio' });
    offcanvasServiceMock.open.mockReturnValue({ result: pickerResult });
    modalServiceMock.open.mockReturnValue({ result: configResult, componentInstance: {} });
    await createComponent();

    component.addWidget();
    await pickerResult;
    await Promise.resolve();
    await configResult;
    await Promise.resolve();

    expect(offcanvasServiceMock.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ position: 'end' }),
    );
    const added = component.widgets().find((w) => w !== statTileInstance);
    expect(added).toMatchObject({
      widgetTypeId: 'stat-tile',
      config: { metric: 'global_ratio' },
    });
    expect(dashboardSettingsMock.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 12: Run the full dashboard suite and verify it passes**

Run: `npm test --workspace=@bitbutler/app -- dashboard.spec widget-picker widget-catalog`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widget-catalog.ts packages/app/src/app/pages/dashboard/widget-catalog.spec.ts packages/app/src/app/modals/widget-picker packages/app/src/app/pages/dashboard/dashboard.ts packages/app/src/app/pages/dashboard/dashboard.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: move widget picker to an offcanvas; add catalog icon/description metadata"
```

---

### Task 6: Add the Highcharts dependency

**Files:**

- Modify: `packages/app/package.json`

- [ ] **Step 1: Install the packages**

Run: `npm install highcharts@^12 highcharts-angular@^5.4.1 --workspace=@bitbutler/app`

- [ ] **Step 2: Verify the install**

Run: `npm ls highcharts highcharts-angular --workspace=@bitbutler/app`
Expected: both listed with no `UNMET DEPENDENCY`/peer-dependency warnings.

- [ ] **Step 3: Commit**

```bash
git add packages/app/package.json package-lock.json
git commit -m "#324: add highcharts and highcharts-angular dependencies"
```

---

### Task 7: `PieChartWidget` component

Builds a Highcharts pie/donut from `PieChartData`, recoloring on theme change since Highcharts renders SVG and won't pick up CSS variable changes on its own.

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.ts`
- Create: `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.html`
- Create: `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.scss`
- Create: `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `PieChartData`/`PieChartSlice` (Task 1), `WidgetMenu` (Task 3), `ThemeService.family()`/`effectiveMode()` (`packages/app/src/app/services/theme.service.ts`).
- Produces: `PieChartWidget` standalone component, selector `app-pie-chart-widget`, `@Input() data!: PieChartData`, `@Input() editMode = false`, `@Input() onConfigure!: () => void`, `@Input() onRemove!: () => void`, method `buildOptions(): Highcharts.Options` (tested directly - it's pure given `data`/color inputs, so it's tested without mounting Highcharts itself).

- [ ] **Step 1: Add the bucket/category i18n keys**

In `packages/app/public/i18n/us.json`, inside `pages.dashboard.widgets` add a `pie-chart` sibling to `stat-tile`/`torrent-list`:

```json
        "pie-chart": {
          "bucket": {
            "downloading": "Downloading",
            "completed": "Completed",
            "inactive": "Inactive",
            "stopped": "Stopped",
            "checking": "Checking",
            "errored": "Errored",
            "other": "Other"
          }
        }
```

(Insert as the third entry of the `widgets` object, after `torrent-list`, adding a trailing comma after `torrent-list`'s closing `}`.)

In `packages/app/public/i18n/hu.json`, same location:

```json
        "pie-chart": {
          "bucket": {
            "downloading": "Letöltés alatt",
            "completed": "Kész",
            "inactive": "Inaktív",
            "stopped": "Szüneteltetve",
            "checking": "Ellenőrzés",
            "errored": "Hiba",
            "other": "Egyéb"
          }
        }
```

- [ ] **Step 2: Write the failing test**

Create `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import type * as Highcharts from 'highcharts';
import { PieChartWidget } from './pie-chart-widget';

describe('PieChartWidget', () => {
  let fixture: ComponentFixture<PieChartWidget>;
  let component: PieChartWidget;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PieChartWidget] }).compileComponents();
    fixture = TestBed.createComponent(PieChartWidget);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        dashboard: { widgets: { 'pie-chart': { bucket: { downloading: 'Downloading' } } } },
      },
    });
    TestBed.inject(TranslateService).use('en');
  });

  it('should build one Highcharts pie series point per slice, translating state bucket labelKeys', () => {
    component.data = {
      groupBy: 'state',
      slices: [
        {
          key: 'downloading',
          labelKey: 'pages.dashboard.widgets.pie-chart.bucket.downloading',
          value: 3,
        },
      ],
    };
    fixture.detectChanges();

    const options = component.buildOptions();
    const series = options.series![0] as Highcharts.SeriesPieOptions;
    expect(series.type).toBe('pie');
    expect(series.data).toEqual([expect.objectContaining({ name: 'Downloading', y: 3 })]);
  });

  it('should use the raw key as the point name for category slices (no labelKey)', () => {
    component.data = { groupBy: 'category', slices: [{ key: 'linux', value: 5 }] };
    fixture.detectChanges();

    const options = component.buildOptions();
    const series = options.series![0] as Highcharts.SeriesPieOptions;
    expect(series.data).toEqual([expect.objectContaining({ name: 'linux', y: 5 })]);
  });

  it('should render a transparent chart background so the card surface shows through', () => {
    component.data = { groupBy: 'state', slices: [] };
    fixture.detectChanges();

    const options = component.buildOptions();
    expect(options.chart?.backgroundColor).toBe('transparent');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- pie-chart-widget`
Expected: FAIL - cannot find module `./pie-chart-widget`.

- [ ] **Step 4: Implement the component**

Create `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.ts`:

```ts
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import * as Highcharts from 'highcharts';
import { HighchartsChartModule } from 'highcharts-angular';
import { PieChartData } from '../../../../models/dashboard.model';
import { ThemeService } from '../../../../services/theme.service';
import { WidgetMenu } from '../widget-menu/widget-menu';

const COLOR_TOKENS = [
  '--bs-primary',
  '--bs-secondary',
  '--bs-success',
  '--bs-danger',
  '--bs-warning',
  '--bs-info',
];

@Component({
  selector: 'app-pie-chart-widget',
  standalone: true,
  imports: [HighchartsChartModule, WidgetMenu],
  templateUrl: './pie-chart-widget.html',
  styleUrl: './pie-chart-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieChartWidget extends BaseWidget {
  @Input() data!: PieChartData;
  @Input() editMode = false;
  @Input() onConfigure!: () => void;
  @Input() onRemove!: () => void;

  readonly Highcharts = Highcharts;

  private readonly translate = inject(TranslateService);
  private readonly themeService = inject(ThemeService);

  private themeColors(): string[] {
    const styles = getComputedStyle(document.documentElement);
    return COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
  }

  private bodyColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color').trim();
  }

  buildOptions(): Highcharts.Options {
    // Re-read ThemeService here (rather than caching) so buildOptions() picks up the current
    // family/mode every time it's called - the caller (the template's [options] binding) re-runs
    // it on every change detection pass, which includes theme changes.
    this.themeService.family();
    this.themeService.effectiveMode();

    const colors = this.themeColors();
    const textColor = this.bodyColor();

    const points = this.data.slices.map((slice, i) => ({
      name: slice.labelKey ? this.translate.instant(slice.labelKey) : slice.key,
      y: slice.value,
      color: colors[i % colors.length],
    }));

    return {
      chart: { type: 'pie', backgroundColor: 'transparent', style: { color: textColor } },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { itemStyle: { color: textColor } },
      plotOptions: { pie: { innerSize: '60%', dataLabels: { enabled: false } } },
      series: [{ type: 'pie', name: '', data: points }],
    };
  }
}
```

Create `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.html`:

```html
<div class="pie-chart-widget">
  <app-widget-menu [visible]="editMode" (configure)="onConfigure()" (remove)="onRemove()" />
  <highcharts-chart
    class="pie-chart-widget__chart"
    [Highcharts]="Highcharts"
    [options]="buildOptions()"
  ></highcharts-chart>
</div>
```

Create `packages/app/src/app/pages/dashboard/widgets/pie-chart-widget/pie-chart-widget.scss`:

```scss
:host {
  display: block;
  height: 100%;
  width: 100%;
}

.pie-chart-widget {
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
    display: block;
    height: 100%;
    width: 100%;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- pie-chart-widget`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/pie-chart-widget packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add PieChartWidget"
```

---

### Task 8: Register `pie-chart` end-to-end on the dashboard

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`

**Interfaces:**

- Consumes: `PieChartWidget` (Task 7).
- Produces: `pie-chart` widget instances now render and behave identically to `stat-tile`/`torrent-list` on the grid.

- [ ] **Step 1: Write the failing test**

Add to `dashboard.spec.ts`, inside the `describe('items', ...)` block:

```ts
it('should map a pie-chart instance to the app-pie-chart-widget component', async () => {
  dashboardSettingsMock.load = vi.fn().mockResolvedValue({
    widgets: [
      {
        instanceId: 'w2',
        widgetTypeId: 'pie-chart',
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        config: { groupBy: 'state' },
      },
    ],
  });
  await createComponent();

  expect(component.items()[0].component).toBe('app-pie-chart-widget');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- dashboard.spec`
Expected: PASS already for `items()`'s mapping (that part just reads `WIDGET_CATALOG`, already correct since Task 5) - but if `PieChartWidget` isn't registered with `GridstackComponent.registerComponents`, the widget won't actually render in the real app even though this specific unit test can't detect that (the test only inspects `items()`'s plain data, not gridstack's runtime rendering). Run it anyway to confirm the data-mapping is already correct, then proceed to Step 3 for the registration gridstack itself needs.

Expected: PASS (this confirms `items()` already works from Task 5's catalog entry - the real fix in this task is the `registerComponents` call below, which has no unit-test seam since it's gridstack's internal component registry).

- [ ] **Step 3: Register the component with gridstack**

In `dashboard.ts`, add the import:

```ts
import { PieChartWidget } from './widgets/pie-chart-widget/pie-chart-widget';
```

Update the constructor:

```ts
  constructor() {
    GridstackComponent.registerComponents([StatTile, TorrentListWidget, PieChartWidget]);
    void this.dashboardSettingsService.load().then((layout) => this.widgets.set(layout.widgets));
  }
```

- [ ] **Step 4: Manually verify in the running app**

Run: `npm start` (from the repo root - starts the Angular dev server + Electron together)

In the app: open the Dashboard, click Edit, click Add Widget - the offcanvas should list all 3 types including "Pie Chart" / "Pie". Add a pie chart, leave the default "state" grouping, save. It should render a donut chart with a slice per non-empty state bucket, colored from the current theme's `--bs-primary`/`--bs-secondary`/etc. tokens. Switch theme family/mode in Settings and confirm the chart recolors immediately (no page reload). Click the widget's ellipsis menu → Configure, change grouping to "category", save, confirm the chart updates.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/dashboard/dashboard.ts packages/app/src/app/pages/dashboard/dashboard.spec.ts
git commit -m "#324: register PieChartWidget with the dashboard grid"
```

---

### Task 9: `WidgetConfigModal` groupBy branch for `pie-chart`

**Files:**

- Modify: `packages/app/src/app/modals/widget-config/widget-config.ts`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.html`
- Modify: `packages/app/src/app/modals/widget-config/widget-config.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `PieChartConfig`/`PieChartGroupBy` (Task 1).
- Produces: `WidgetConfig` (the component) gains `isPieChart`, `pieChartConfig`, `groupByOptions`, `updatePieChartGroupBy(groupBy)`.

- [ ] **Step 1: Add i18n keys**

In `packages/app/public/i18n/us.json`, inside `components.modals.widget-config` (after `"columns": "Columns"`), add:

```json
    "group-by": "Group By"
```

(note: this makes the previous line's `"columns": "Columns"` need a trailing comma)

In `packages/app/public/i18n/hu.json`, same location:

```json
    "group-by": "Csoportosítás"
```

In `packages/app/public/i18n/us.json`, inside `pages.dashboard.widgets.pie-chart` (added in Task 7), add a `group-by` sibling to `bucket`:

```json
        "pie-chart": {
          "bucket": { ... },
          "group-by": {
            "state": "State",
            "category": "Category"
          }
        }
```

In `packages/app/public/i18n/hu.json`, same location:

```json
        "pie-chart": {
          "bucket": { ... },
          "group-by": {
            "state": "Állapot",
            "category": "Kategória"
          }
        }
```

- [ ] **Step 2: Write the failing tests**

Add to `widget-config.spec.ts`:

```ts
it('should seed config from initialConfig for a pie-chart', () => {
  withInputs('pie-chart' as any, { groupBy: 'state' });
  expect(component.config()).toEqual({ groupBy: 'state' });
});

it('should update groupBy for a pie-chart', () => {
  withInputs('pie-chart' as any, { groupBy: 'state' });
  component.updatePieChartGroupBy('category');
  expect(component.config()).toEqual({ groupBy: 'category' });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- widget-config`
Expected: FAIL - `updatePieChartGroupBy` does not exist.

- [ ] **Step 4: Implement the branch**

In `widget-config.ts`, add `PieChartConfig`/`PieChartGroupBy` to the model import, add the constant list and computed/updater, alongside the existing `isStatTile`/`statTileConfig`:

```ts
  readonly groupByOptions: PieChartGroupBy[] = ['state', 'category'];

  readonly isStatTile = computed(() => this.widgetTypeId() === 'stat-tile');
  readonly isPieChart = computed(() => this.widgetTypeId() === 'pie-chart');
  readonly statTileConfig = computed(() => this.config() as StatTileConfig);
  readonly torrentListConfig = computed(() => this.config() as TorrentListConfig);
  readonly pieChartConfig = computed(() => this.config() as PieChartConfig);

  updatePieChartGroupBy(groupBy: PieChartGroupBy): void {
    this.config.set({ groupBy } satisfies PieChartConfig);
  }
```

In `widget-config.html`, change the `@if (isStatTile()) { ... } @else { ... }` to a three-way switch:

```html
@if (isStatTile()) {
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
        >{{ 'pages.dashboard.widgets.pie-chart.group-by.' + item | translate }}</ng-template
      >
      <ng-template ng-option-tmp let-item="item"
        >{{ 'pages.dashboard.widgets.pie-chart.group-by.' + item | translate }}</ng-template
      >
    </ng-select>
  </div>
</div>
} @else {
```

(the existing torrent-list body stays as the final `@else` branch, unchanged - only the opening `} @else {` becomes `} @else if (isPieChart()) { ... } @else {`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- widget-config`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/widget-config packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add pie-chart groupBy config to WidgetConfigModal"
```

---

### Task 10: Final verification pass

**Files:** none (verification only; fix forward in the relevant file if something fails).

- [ ] **Step 1: Full lint**

Run: `npm run lint`
Expected: zero warnings/errors. Fix any unused-import or type issues surfaced by the widened `WidgetTypeId`/`WidgetConfig` unions before proceeding.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all workspaces pass, including `@bitbutler/app`.

- [ ] **Step 3: Production build**

Run: `npm run build --workspace=@bitbutler/app`
Expected: builds cleanly - this is the step most likely to catch a `highcharts`/`highcharts-angular` bundling issue (e.g. missing `sideEffects` handling) that unit tests wouldn't.

- [ ] **Step 4: Manual pass in the running app**

Run: `npm start`

Checklist (from the spec's Testing section):

- Toggle Edit mode: drag/resize only works while editing (already correct pre-existing behavior - confirm no regression).
- Each widget shows a `⋮` only in edit mode, top-right, not clipped by the card's rounded corner.
- Ellipsis → Configure opens the same config modal as before; → Delete removes the widget.
- Add Widget opens a right-side offcanvas (not a centered modal) listing all 3 types with icon + name + type subtitle.
- Shrink a `torrent-list` widget below its row count: a scrollbar appears inside the card, with a small gutter - not flush against/outside the rounded border (this is the bug from the user's screenshot).
- Grow a `torrent-list` widget beyond its row count: blank space appears below the last row - rows do not stretch.
- Add a `pie-chart` widget (default "state" grouping): donut renders with one slice per non-empty state bucket.
- Switch theme family and light/dark mode in Settings: the pie chart recolors immediately, no reload needed.
- Reconfigure the pie chart to "category" grouping: chart updates to one slice per torrent category.

- [ ] **Step 5: Remove the spec/plan docs (per repo convention, before opening a PR)**

Per `CLAUDE.md`'s "Specs & plans" section, these must not be merged to main. Do this only once the user confirms the feature is done and ready for PR - do not do it automatically as part of this task.

```bash
git rm docs/superpowers/specs/2026-08-29-dashboard-redesign-design.md docs/superpowers/plans/2026-08-29-dashboard-redesign.md
git commit -m "#324: removed spec and plan"
```
