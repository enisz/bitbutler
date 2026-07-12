# Peers/Trackers Column Filters + Header Filter-Menu Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Peers and Trackers torrent-details modal grids up to the same custom-filter standard as the main torrent grid (swapping built-in `agTextColumnFilter`/`agNumberColumnFilter` for `TextColumnFilter`/`NumberColumnFilter`/`SizeColumnFilter`/`SetColumnFilter`, and adding a few new hidden raw/percentage columns), and remove the now-redundant header right-click "Filter" submenu (Open Filter/Clear Filter/Toggle Floating Filters) and the floating-filters feature from all three grids.

**Architecture:** `SetColumnFilter` currently only works for the main grid because it's hardcoded to pull its value list from `TorrentStoreService`. It's generalized first (`filterParams.getItems`/`getValues` callbacks instead of a `source` union), which is what lets Peers/Trackers use it for `country`/`connection`/`client`/`status` without a shared store - each grid computes its own value counts from its own current rows via a new `buildValueCounts` helper. The header-menu "Filter" submenu and floating-filters plumbing are removed together (same underlying feature, same commit boundaries) before the Peers/Trackers column-def changes, so every intermediate commit leaves the app in a compiling, fully-green state.

**Tech Stack:** Angular 20 (standalone components, signals), `@ngx-translate/core`, ag-Grid Community + `ag-grid-angular` custom filter components, Vitest (`npm run test --workspace=@bitbutler/app`).

## Global Constraints

- All new/removed translation keys are applied to **both** `public/i18n/us.json` and `public/i18n/hu.json`.
- `ValueCount` moves from `torrent-store.service.ts` to `set-column-filter.ts` - the store imports it back.
- Every newly-added grid column starts hidden (`hide: true`).
- No filter is added to Peers' `files` column or Trackers' `msg` column.
- No changes to the main grid's existing column filter _assignments_ - only the `SetColumnFilter`/`TorrentStoreService` plumbing underneath `state`/`category`/`tags` changes, behavior stays identical.
- Test command: `npm run test --workspace=@bitbutler/app`. Lint command: `npm run lint`.

---

### Task 1: Generalize `SetColumnFilter` to take its items from `filterParams`

**Files:**

- Modify: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts`
- Modify: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.spec.ts`

**Interfaces:**

- Produces: `ValueCount { key, label, count }` (moved here from `torrent-store.service.ts`), `SetColumnFilterParams extends IFilterParams { getItems: () => ValueCount[]; getValues?: (cellValue: unknown) => string[] }`, and `buildValueCounts<T>(rows: readonly T[], getValue: (row: T) => string | null | undefined): ValueCount[]` - all consumed by Task 2 (main grid) and Task 4/5 (Peers/Trackers).

- [ ] **Step 1: Rewrite the failing test**

Replace the full contents of `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.spec.ts` with:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetColumnFilter, buildValueCounts } from './set-column-filter';

describe('SetColumnFilter', () => {
  let component: SetColumnFilter;
  let fixture: ComponentFixture<SetColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      getItems: vi.fn().mockReturnValue([
        { key: 'Movies', label: 'Movies', count: 3 },
        { key: 'Books', label: 'Books', count: 1 },
      ]),
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.category),
    };

    await TestBed.configureTestingModule({
      imports: [SetColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(SetColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('reads its item list from getItems', () => {
    expect(component.items()).toEqual([
      { key: 'Movies', label: 'Movies', count: 3 },
      { key: 'Books', label: 'Books', count: 1 },
    ]);
  });

  describe('toggle', () => {
    it('adds and removes keys from draftValues', () => {
      component.toggle('Movies');
      expect(component.draftValues.has('Movies')).toBe(true);
      component.toggle('Movies');
      expect(component.draftValues.has('Movies')).toBe(false);
    });
  });

  describe('doesFilterPass', () => {
    it('passes everything when no values are applied', () => {
      expect(component.doesFilterPass({ node: { data: { category: 'Movies' } } } as any)).toBe(
        true,
      );
    });

    it('matches an exact selected value using getValue', () => {
      component.appliedValues = new Set(['Movies']);
      expect(component.doesFilterPass({ node: { data: { category: 'Movies' } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { category: 'Books' } } } as any)).toBe(
        false,
      );
    });

    it('matches multi-value cells by overlap when getValues is provided', () => {
      mockParams.getValues = (cellValue: unknown) =>
        String(cellValue ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      mockParams.getValue = vi.fn((node: { data: any }) => node.data?.tags);
      component.agInit(mockParams);
      component.appliedValues = new Set(['hd']);
      expect(component.doesFilterPass({ node: { data: { tags: 'hd, 4k' } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { tags: '4k' } } } as any)).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when nothing is applied', () => {
      expect(component.getModel()).toBeNull();
    });

    it('round-trips applied values through get/setModel', () => {
      component.setModel({ values: ['Movies', 'Books'] });
      expect(component.appliedValues).toEqual(new Set(['Movies', 'Books']));
      expect(component.draftValues).toEqual(new Set(['Movies', 'Books']));
      expect(component.getModel()).toEqual({ values: ['Movies', 'Books'] });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draftValues into appliedValues and calls filterChangedCallback', () => {
      component.toggle('Movies');
      component.apply();
      expect(component.appliedValues).toEqual(new Set(['Movies']));
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draftValues and appliedValues and calls filterChangedCallback', () => {
      component.appliedValues = new Set(['Movies']);
      component.draftValues = new Set(['Movies']);
      component.clear();
      expect(component.appliedValues.size).toBe(0);
      expect(component.draftValues.size).toBe(0);
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when draftValues matches appliedValues', () => {
      component.draftValues = new Set(['Movies']);
      component.appliedValues = new Set(['Movies']);
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when draftValues differs from appliedValues', () => {
      component.draftValues = new Set(['Movies', 'Books']);
      component.appliedValues = new Set(['Movies']);
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});

describe('buildValueCounts', () => {
  it('tallies and sorts distinct values by label', () => {
    const rows = [{ country: 'US' }, { country: 'DE' }, { country: 'US' }, { country: undefined }];
    expect(buildValueCounts(rows, (r) => r.country)).toEqual([
      { key: 'DE', label: 'DE', count: 1 },
      { key: 'US', label: 'US', count: 2 },
    ]);
  });

  it('excludes null/undefined/empty values', () => {
    const rows = [{ v: '' }, { v: null }, { v: undefined }];
    expect(buildValueCounts(rows, (r: any) => r.v)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- set-column-filter`
Expected: FAIL - `mockParams.getItems`/`buildValueCounts` don't exist on the current component/module yet (the old spec mocked `TorrentStoreService` and passed `source`, which this rewritten spec no longer does).

- [ ] **Step 3: Rewrite the component**

Replace the full contents of `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts` with:

```typescript
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser, faXmark } from '@fortawesome/free-solid-svg-icons';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { debounceTime, startWith } from 'rxjs/operators';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';

const FILTER_DEBOUNCE_MS = 150;

export interface ValueCount {
  key: string;
  label: string;
  count: number;
}

export interface SetColumnFilterParams extends IFilterParams {
  getItems: () => ValueCount[];
  getValues?: (cellValue: unknown) => string[];
}

export interface SetFilterValue {
  values: string[];
}

export function buildValueCounts<T>(
  rows: readonly T[],
  getValue: (row: T) => string | null | undefined,
): ValueCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = getValue(row);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

@Component({
  selector: 'app-set-column-filter',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './set-column-filter.html',
  styleUrl: './set-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetColumnFilter implements IFilterAngularComp {
  private params!: SetColumnFilterParams;

  public readonly icons = { faCheck, faEraser, faXmark };
  public filterCtrl = new FormControl('', { nonNullable: true });
  public readonly instanceId = createFilterInstanceId('set-filter');

  draftValues = new Set<string>();
  appliedValues = new Set<string>();

  private readonly searchText = toSignal(
    this.filterCtrl.valueChanges.pipe(startWith(''), debounceTime(FILTER_DEBOUNCE_MS)),
    { initialValue: '' },
  );

  readonly items = computed<ValueCount[]>(() => this.params?.getItems() ?? []);

  readonly filteredItems = computed<ValueCount[]>(() => {
    const text = this.searchText().toLowerCase();
    return this.items().filter((item) => item.label.toLowerCase().includes(text));
  });

  agInit(params: SetColumnFilterParams): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return this.appliedValues.size > 0;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (this.appliedValues.size === 0) return true;
    const cellValue = this.params.getValue(params.node);
    const values = this.params.getValues
      ? this.params.getValues(cellValue)
      : cellValue != null
        ? [String(cellValue)]
        : [];
    return values.some((v) => this.appliedValues.has(v));
  }

  getModel(): SetFilterValue | null {
    return this.isFilterActive() ? { values: [...this.appliedValues] } : null;
  }

  setModel(model: SetFilterValue | null): void {
    this.appliedValues = new Set(model?.values ?? []);
    this.draftValues = new Set(this.appliedValues);
  }

  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.draftValues = new Set(this.appliedValues);
    this.filterCtrl.reset('');
  }

  toggle(key: string): void {
    const next = new Set(this.draftValues);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.draftValues = next;
  }

  apply(): void {
    this.appliedValues = new Set(this.draftValues);
    this.params.filterChangedCallback();
  }

  clear(): void {
    this.draftValues = new Set();
    this.appliedValues = new Set();
    this.params.filterChangedCallback();
  }

  isApplyDisabled(): boolean {
    if (this.draftValues.size !== this.appliedValues.size) return false;
    for (const value of this.draftValues) {
      if (!this.appliedValues.has(value)) return false;
    }
    return true;
  }
}
```

Note what changed from the current file: the `TorrentStoreService`/`inject` import and injection are gone, `SetColumnFilterSource`/`source` are gone, `items` now reads `this.params.getItems()` instead of switching on `source`, and `doesFilterPass` uses `getValues` instead of a hardcoded `source === 'tags'` branch. The `.html`/`.scss` files and the `@Component` decorator are unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- set-column-filter`
Expected: PASS - all `SetColumnFilter` and `buildValueCounts` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/column-filters/set-column-filter
git commit -m "#216: generalize SetColumnFilter to take its items from filterParams"
```

---

### Task 2: Wire the generalized `SetColumnFilter` into the main grid

**Files:**

- Modify: `packages/app/src/app/services/torrent-store.service.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.ts`

**Interfaces:**

- Consumes: `SetColumnFilterParams`, `ValueCount` from Task 1's `set-column-filter.ts`.
- Produces: `getGridColDefs(uiFormatService, translateService, torrentStoreService)` and `getGridOptions(..., torrentStoreService, opts)` - both gain a `torrentStoreService: TorrentStoreService` parameter, consumed by `grid.ts`.

This task has no dedicated new test: it's a pure wiring change (the main grid's `state`/`category`/`tags` set filters keep behaving exactly as before - Task 1's `set-column-filter.spec.ts` already covers the component logic). Verify with the full test suite at the end.

- [ ] **Step 1: Move `ValueCount` out of `torrent-store.service.ts`**

In `packages/app/src/app/services/torrent-store.service.ts`, find:

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Maindata, QbCategory, Torrent, TorrentMap, TorrentState } from '../models/torrent.model';

export interface TorrentTxnDelta {
  fullUpdate: boolean;
  add: Torrent[];
  update: Torrent[];
  remove: Torrent[];
}

export type TorrentFinishedEvent = {
  hash: string;
  torrent: Torrent;
  ts: number;
};

export interface ValueCount {
  key: string;
  label: string;
  count: number;
}
```

Replace with:

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ValueCount } from '../components/column-filters/set-column-filter/set-column-filter';
import { Maindata, QbCategory, Torrent, TorrentMap, TorrentState } from '../models/torrent.model';

export interface TorrentTxnDelta {
  fullUpdate: boolean;
  add: Torrent[];
  update: Torrent[];
  remove: Torrent[];
}

export type TorrentFinishedEvent = {
  hash: string;
  torrent: Torrent;
  ts: number;
};

export type { ValueCount };
```

- [ ] **Step 2: Add the `TorrentStoreService` parameter to `getGridColDefs`**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, find:

```typescript
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
```

Replace with:

```typescript
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
```

(Note: `TorrentStoreService` goes in the `services/` import group, alphabetically between `SelectionStoreService` and `UiFormatService` - place it there, not next to the `GridContextMenuService` import shown above for context.)

Then find:

```typescript
export function getGridColDefs(
  uiFormatService: UiFormatService,
  translateService: TranslateService,
): ColDef<Torrent>[] {
```

Replace with:

```typescript
export function getGridColDefs(
  uiFormatService: UiFormatService,
  translateService: TranslateService,
  torrentStoreService: TorrentStoreService,
): ColDef<Torrent>[] {
```

- [ ] **Step 3: Wire `getItems`/`getValues` onto the `state`, `category`, and `tags` columns**

In the same file, find:

```typescript
      tooltipField: 'state',
      filter: SetColumnFilter,
      filterParams: { source: 'state' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
```

Replace with:

```typescript
      tooltipField: 'state',
      filter: SetColumnFilter,
      filterParams: {
        getItems: () => torrentStoreService.statesWithCounts(),
      } satisfies Partial<SetColumnFilterParams>,
      hide: true,
```

Find:

```typescript
      filter: SetColumnFilter,
      filterParams: { source: 'category' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
```

Replace with:

```typescript
      filter: SetColumnFilter,
      filterParams: {
        getItems: () => torrentStoreService.categoriesWithCounts(),
      } satisfies Partial<SetColumnFilterParams>,
      hide: true,
```

Find:

```typescript
      filter: SetColumnFilter,
      filterParams: { source: 'tags' } satisfies Partial<SetColumnFilterParams>,
      hide: true,
```

Replace with:

```typescript
      filter: SetColumnFilter,
      filterParams: {
        getItems: () => torrentStoreService.tagsWithCounts(),
        getValues: (v) =>
          String(v ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      } satisfies Partial<SetColumnFilterParams>,
      hide: true,
```

- [ ] **Step 4: Pass the new parameter through `getGridOptions`**

In the same file, find:

```typescript
export function getGridOptions(
  contextMenuService: ContextMenuService,
  selectionStore: SelectionStoreService,
  filterService: FilterService,
  gridStateService: GridStateService,
  gridContextMenuService: GridContextMenuService,
  uiFormatService: UiFormatService,
  translateService: TranslateService,
  opts: {
```

Replace with:

```typescript
export function getGridOptions(
  contextMenuService: ContextMenuService,
  selectionStore: SelectionStoreService,
  filterService: FilterService,
  gridStateService: GridStateService,
  gridContextMenuService: GridContextMenuService,
  uiFormatService: UiFormatService,
  translateService: TranslateService,
  torrentStoreService: TorrentStoreService,
  opts: {
```

Then find:

```typescript
    columnDefs: getGridColDefs(uiFormatService, translateService),
```

Replace with:

```typescript
    columnDefs: getGridColDefs(uiFormatService, translateService, torrentStoreService),
```

- [ ] **Step 5: Inject `TorrentStoreService` in `grid.ts` and pass it through**

In `packages/app/src/app/pages/main/grid/grid.ts`, find:

```typescript
import { ThemeService } from '../../../services/theme.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { UiFormatService } from '../../../services/ui-format.service';
```

Replace with:

```typescript
import { ThemeService } from '../../../services/theme.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { UiFormatService } from '../../../services/ui-format.service';
```

Find:

```typescript
  private readonly qbPollingService = inject(QbPollingService);
  private readonly gridInlineEditService = inject(GridInlineEditService);
```

Replace with:

```typescript
  private readonly qbPollingService = inject(QbPollingService);
  private readonly gridInlineEditService = inject(GridInlineEditService);
  private readonly torrentStoreService = inject(TorrentStoreService);
```

Find:

```typescript
    this.gridOptions = getGridOptions(
      this.contextMenuService,
      this.selectionStore,
      this.filterService,
      this.gridStateService,
      this.gridContextMenuService,
      this.uiFormatService,
      this.translateService,
      {
```

Replace with:

```typescript
    this.gridOptions = getGridOptions(
      this.contextMenuService,
      this.selectionStore,
      this.filterService,
      this.gridStateService,
      this.gridContextMenuService,
      this.uiFormatService,
      this.translateService,
      this.torrentStoreService,
      {
```

Find:

```typescript
this.api.setGridOption('columnDefs', getGridColDefs(this.uiFormatService, this.translateService));
```

Replace with:

```typescript
this.api.setGridOption(
  'columnDefs',
  getGridColDefs(this.uiFormatService, this.translateService, this.torrentStoreService),
);
```

- [ ] **Step 6: Run lint and the full test suite**

Run: `npm run lint`
Expected: PASS - no unused-import or type errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - `TorrentStoreService` is `providedIn: 'root'` with no constructor dependencies of its own, so `grid.spec.ts`'s `TestBed` module picks up a real instance automatically without needing an explicit mock provider.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/services/torrent-store.service.ts packages/app/src/app/pages/main/grid/grid.lib.ts packages/app/src/app/pages/main/grid/grid.ts
git commit -m "#216: wire the generalized SetColumnFilter into the main grid via TorrentStoreService"
```

---

### Task 3: Remove the header "Filter" submenu and floating-filters feature (all three grids)

This is one atomic task (not split further) because `GridContextMenuService.buildHeaderMenu`'s signature change and every one of its call sites (`grid.lib.ts`, `peers.ts`, `trackers.ts`) must change together to keep the build compiling.

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`
- Modify: `packages/app/src/app/services/filter.service.ts`
- Modify: `packages/app/src/app/services/filter.service.spec.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts`
- Modify: `packages/app/src/app/modals/torrent-details/peers/peers.ts`
- Modify: `packages/app/src/app/modals/torrent-details/peers/peers.spec.ts`
- Modify: `packages/app/src/app/modals/torrent-details/trackers/trackers.ts`
- Modify: `packages/app/src/app/modals/torrent-details/trackers/trackers.spec.ts`
- Modify: `packages/app/src/app/models/peers-grid.model.ts`
- Modify: `packages/app/src/app/models/trackers-grid.model.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Produces: `GridContextMenuService.buildHeaderMenu(event: ColumnHeaderContextMenuEvent<any, any>): ContextMenuEntry[]` - the `opts` parameter is removed entirely. Consumed by Task 4/5's `peers.ts`/`trackers.ts` column-def work (unaffected by this task, since those files only call `buildHeaderMenu(e)`, never touch `colDefs`).

- [ ] **Step 1: Remove the "Filter" submenu and floating-filter option from `GridContextMenuService`**

In `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`, find:

```typescript
import {
  faArrowDown,
  faArrowDownUpAcrossLine,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsLeftRight,
  faArrowsUpToLine,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faEye,
  faEyeSlash,
  faFilePen,
  faFilter,
  faFilterCircleXmark,
  faFolder,
  faFolderOpen,
  faFolderTree,
  faFont,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faMagnet,
  faPause,
  faPenToSquare,
  faPlaneDeparture,
  faPlay,
  faRotate,
  faShare,
  faSliders,
  faSort,
  faSortDown,
  faSortUp,
  faTableColumns,
  faTags,
  faThumbTack,
  faThumbTackSlash,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import type { ColDef, Column, ColumnHeaderContextMenuEvent } from 'ag-grid-community';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentExportService } from '../../../../services/torrent-export.service';
import { ContextMenuEntry, GridContextMenuData } from './context-menu.types';

@Injectable({ providedIn: 'root' })
export class GridContextMenuService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly clipboard = inject(Clipboard);
  private readonly filterService = inject(FilterService);
  private readonly pathService = inject(PathService);
```

Replace with:

```typescript
import {
  faArrowDown,
  faArrowDownUpAcrossLine,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsLeftRight,
  faArrowsUpToLine,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faEye,
  faEyeSlash,
  faFilePen,
  faFolder,
  faFolderOpen,
  faFolderTree,
  faFont,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faMagnet,
  faPause,
  faPenToSquare,
  faPlaneDeparture,
  faPlay,
  faRotate,
  faShare,
  faSliders,
  faSort,
  faSortDown,
  faSortUp,
  faTableColumns,
  faTags,
  faThumbTack,
  faThumbTackSlash,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import type { Column, ColumnHeaderContextMenuEvent } from 'ag-grid-community';
import { CommandBusService } from '../../../../services/command-bus.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentExportService } from '../../../../services/torrent-export.service';
import { ContextMenuEntry, GridContextMenuData } from './context-menu.types';

@Injectable({ providedIn: 'root' })
export class GridContextMenuService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly clipboard = inject(Clipboard);
  private readonly pathService = inject(PathService);
```

Now find (the `buildHeaderMenu` signature and the sort/filter submenus):

```typescript
  public buildHeaderMenu(
    event: ColumnHeaderContextMenuEvent<any, any>,
    opts: {
      enableFloatingFiltersToggle?: boolean;
      onFloatingFiltersToggle?: (newState: boolean) => Promise<void>;
    } = {},
  ): ContextMenuEntry[] {
    const api = event.api;
    const column = event.column as Column;
    const floatingFilterActive = (api.getColumnDefs() ?? []).some(
      (d) => (d as ColDef<any>).floatingFilter === true,
    );

    const columns =
```

Replace with:

```typescript
  public buildHeaderMenu(event: ColumnHeaderContextMenuEvent<any, any>): ContextMenuEntry[] {
    const api = event.api;
    const column = event.column as Column;

    const columns =
```

Now find the entire "filter" submenu block, from directly after the "sort" submenu's closing `},` to directly before the "pin" submenu:

```typescript
      {
        kind: 'submenu',
        id: `filter.${payload.colId}`,
        label: 'pages.main.grid.context-menu.submenu.filter',
        icon: faFilter,
        children: [
          {
            kind: 'item',
            id: `filter.open.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.open-filter',
            icon: faFilter,
            disabled: !column.getColDef().filter,
            tooltip: !column.getColDef().filter
              ? 'pages.main.grid.context-menu.tooltip.filter-not-supported'
              : undefined,
            action: () => api.showColumnFilter(payload.colId),
          },
          {
            kind: 'item',
            id: `filter.clear.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.clear-filter',
            icon: faFilterCircleXmark,
            disabled: !column.isFilterActive(),
            tooltip: !column.isFilterActive()
              ? 'pages.main.grid.context-menu.tooltip.no-filter-active'
              : undefined,
            action: () => this.filterService.clearColumnFilter(payload.colId),
          },
          ...(opts.enableFloatingFiltersToggle !== false
            ? [
                {
                  kind: 'item' as const,
                  id: `filter.toggleFloating.${payload.colId}`,
                  label: floatingFilterActive
                    ? 'pages.main.grid.context-menu.item.hide-floating-filters'
                    : 'pages.main.grid.context-menu.item.show-floating-filters',
                  icon: floatingFilterActive ? faEyeSlash : faEye,
                  action: async () => {
                    const currentDefs = api.getColumnDefs() ?? [];
                    const isActive = currentDefs.some(
                      (d) => (d as ColDef<any>).floatingFilter === true,
                    );
                    const newDefs = currentDefs.map((d) => {
                      const colDef = { ...(d as ColDef<any>) };
                      if (colDef.floatingFilter === false) return colDef;
                      colDef.floatingFilter = isActive ? undefined : true;
                      return colDef;
                    });
                    api.updateGridOptions({ columnDefs: newDefs });
                    await opts.onFloatingFiltersToggle?.(!isActive);
                  },
                },
              ]
            : []),
        ],
      },
      {
        kind: 'submenu',
        id: `pin.${payload.colId}`,
```

Replace with:

```typescript
      {
        kind: 'submenu',
        id: `pin.${payload.colId}`,
```

- [ ] **Step 2: Remove `clearColumnFilter` from `FilterService`**

In `packages/app/src/app/services/filter.service.ts`, find:

```typescript
  public clearColumnFilter(colId: string): void {
    this.setColumnFilter(colId, null);
  }

  public clearAllColumnFilters(): void {
```

Replace with:

```typescript
  public clearAllColumnFilters(): void {
```

- [ ] **Step 3: Disable the floating-filters toggle call site in the main grid**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, find:

```typescript
      contextMenuService.open({
        items: gridContextMenuService.buildHeaderMenu(e, { enableFloatingFiltersToggle: false }),
```

Replace with:

```typescript
      contextMenuService.open({
        items: gridContextMenuService.buildHeaderMenu(e),
```

- [ ] **Step 4: Simplify Peers' `restoreColumnState` and header-menu call**

In `packages/app/src/app/modals/torrent-details/peers/peers.ts`, find:

```typescript
  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings = await this.peersGridSettingsService.load();
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
      const floatingFilters = settings.floatingFilters ?? false;
      const currentDefs = this.gridApi.getColumnDefs() ?? [];
      const newDefs = currentDefs.map((d) => {
        const colDef = { ...(d as ColDef<QbTorrentPeer>) };
        if (colDef.floatingFilter === false) return colDef;
        colDef.floatingFilter = floatingFilters ? true : undefined;
        return colDef;
      });
      this.gridApi.updateGridOptions({ columnDefs: newDefs });
    } finally {
      this.isRestoringState = false;
    }
  }
```

Replace with:

```typescript
  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings = await this.peersGridSettingsService.load();
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
    } finally {
      this.isRestoringState = false;
    }
  }
```

Then find:

```typescript
      onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<QbTorrentPeer>) => {
        if (!e.column) return;
        this.contextMenuService.open({
          items: this.gridContextMenuService.buildHeaderMenu(e, {
            onFloatingFiltersToggle: async (newState: boolean) => {
              const settings = await this.peersGridSettingsService.load();
              await this.peersGridSettingsService.save({ ...settings, floatingFilters: newState });
            },
          }),
          payload: {
            colId: e.column.getId(),
            displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
          },
        });
      },
```

Replace with:

```typescript
      onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<QbTorrentPeer>) => {
        if (!e.column) return;
        this.contextMenuService.open({
          items: this.gridContextMenuService.buildHeaderMenu(e),
          payload: {
            colId: e.column.getId(),
            displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
          },
        });
      },
```

- [ ] **Step 5: Simplify Trackers' `restoreColumnState` and header-menu call**

In `packages/app/src/app/modals/torrent-details/trackers/trackers.ts`, find:

```typescript
  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings = await this.trackersGridSettingsService.load();
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
      const floatingFilters = settings.floatingFilters ?? false;
      const currentDefs = this.gridApi.getColumnDefs() ?? [];
      const newDefs = currentDefs.map((d) => {
        const colDef = { ...(d as ColDef<QbTorrentTracker>) };
        if (colDef.floatingFilter === false) return colDef;
        colDef.floatingFilter = floatingFilters ? true : undefined;
        return colDef;
      });
      this.gridApi.updateGridOptions({ columnDefs: newDefs });
    } finally {
      this.isRestoringState = false;
    }
  }
```

Replace with:

```typescript
  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings = await this.trackersGridSettingsService.load();
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
    } finally {
      this.isRestoringState = false;
    }
  }
```

Then find:

```typescript
      onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<QbTorrentTracker>) => {
        if (!e.column) return;
        this.contextMenuService.open({
          items: this.gridContextMenuService.buildHeaderMenu(e, {
            onFloatingFiltersToggle: async (newState: boolean) => {
              const settings = await this.trackersGridSettingsService.load();
              await this.trackersGridSettingsService.save({
                ...settings,
                floatingFilters: newState,
              });
            },
          }),
          payload: {
            colId: e.column.getId(),
            displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
          },
        });
      },
```

Replace with:

```typescript
      onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<QbTorrentTracker>) => {
        if (!e.column) return;
        this.contextMenuService.open({
          items: this.gridContextMenuService.buildHeaderMenu(e),
          payload: {
            colId: e.column.getId(),
            displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
          },
        });
      },
```

- [ ] **Step 6: Remove `floatingFilters` from the Peers/Trackers settings models**

Replace the full contents of `packages/app/src/app/models/peers-grid.model.ts` with:

```typescript
import type { ColumnState } from 'ag-grid-community';

export interface PeersGridSettings {
  columnState: ColumnState[];
}

export const DEFAULT_PEERS_GRID_SETTINGS: PeersGridSettings = {
  columnState: [
    { colId: 'country_code', hide: false, width: 30 },
    { colId: 'country', hide: false },
    { colId: 'ip', hide: false },
    { colId: 'port', hide: false },
    { colId: 'connection', hide: false },
    { colId: 'flags', hide: false },
    { colId: 'client', hide: false },
    { colId: 'progress', hide: false, width: 135 },
    { colId: 'dl_speed', hide: false },
    { colId: 'up_speed', hide: false },
    { colId: 'downloaded', hide: false },
    { colId: 'uploaded', hide: false },
    { colId: 'relevance', hide: false },
    { colId: 'files', hide: false },
  ],
};
```

(Task 4 adds the 6 new hidden columns to this file - left as-is here to keep this task's diff focused on the floating-filters removal.)

Replace the full contents of `packages/app/src/app/models/trackers-grid.model.ts` with:

```typescript
import type { ColumnState } from 'ag-grid-community';

export interface TrackersGridSettings {
  columnState: ColumnState[];
}

export const DEFAULT_TRACKERS_GRID_SETTINGS: TrackersGridSettings = {
  columnState: [
    { colId: 'tier', hide: false, width: 70 },
    { colId: 'url', hide: false },
    { colId: 'status', hide: false, width: 120 },
    { colId: 'num_peers', hide: false, width: 100 },
    { colId: 'num_seeds', hide: false, width: 100 },
    { colId: 'num_leeches', hide: false, width: 100 },
    { colId: 'num_downloaded', hide: false, width: 130 },
    { colId: 'msg', hide: false },
  ],
};
```

- [ ] **Step 7: Update `grid-context-menu.service.spec.ts`**

Find:

```typescript
import type { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { PathService } from '../../../../services/path.service';
```

Replace with:

```typescript
import type { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { PathService } from '../../../../services/path.service';
```

Find:

```typescript
let pathService: { resolveLocalPath: ReturnType<typeof vi.fn> };
let filterService: { clearColumnFilter: ReturnType<typeof vi.fn> };
let toastService: { danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
```

Replace with:

```typescript
let pathService: { resolveLocalPath: ReturnType<typeof vi.fn> };
let toastService: { danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
```

Find:

```typescript
pathService = { resolveLocalPath: vi.fn().mockResolvedValue('/local/path') };
filterService = { clearColumnFilter: vi.fn() };
toastService = { danger: vi.fn(), info: vi.fn() };
```

Replace with:

```typescript
pathService = { resolveLocalPath: vi.fn().mockResolvedValue('/local/path') };
toastService = { danger: vi.fn(), info: vi.fn() };
```

Find:

```typescript
        { provide: PathService, useValue: pathService },
        { provide: FilterService, useValue: filterService },
        {
          provide: ServerStoreService,
```

Replace with:

```typescript
        { provide: PathService, useValue: pathService },
        {
          provide: ServerStoreService,
```

Find (`makeApi`'s default mock, dropping the now-unused floating-filter-only properties):

```typescript
function makeApi(column: any, overrides: Record<string, any> = {}) {
  return {
    getColumnDefs: vi.fn().mockReturnValue([{ colId: 'name', floatingFilter: false }]),
    getColumns: vi.fn().mockReturnValue([column]),
    getDisplayNameForColumn: vi.fn().mockReturnValue('Name'),
    applyColumnState: vi.fn(),
    showColumnFilter: vi.fn(),
    setColumnsVisible: vi.fn(),
    setColumnsPinned: vi.fn(),
    autoSizeColumns: vi.fn(),
    autoSizeAllColumns: vi.fn(),
    updateGridOptions: vi.fn(),
    getColumn: vi.fn().mockReturnValue(column),
    ...overrides,
  };
}
```

Replace with:

```typescript
function makeApi(column: any, overrides: Record<string, any> = {}) {
  return {
    getColumns: vi.fn().mockReturnValue([column]),
    getDisplayNameForColumn: vi.fn().mockReturnValue('Name'),
    applyColumnState: vi.fn(),
    showColumnFilter: vi.fn(),
    setColumnsVisible: vi.fn(),
    setColumnsPinned: vi.fn(),
    autoSizeColumns: vi.fn(),
    autoSizeAllColumns: vi.fn(),
    getColumn: vi.fn().mockReturnValue(column),
    ...overrides,
  };
}
```

Find and delete the entire `describe('filter items', ...)` block:

```typescript
describe('filter items', () => {
  it('open filter is disabled with a tooltip when the column has no filter', () => {
    const { entries } = build({ getColDef: vi.fn().mockReturnValue({ colId: 'name' }) });
    expect(findItem(entries, 'filter.open.name')?.disabled).toBe(true);
    expect(findItem(entries, 'filter.open.name')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.filter-not-supported',
    );
  });

  it('open filter is enabled with no tooltip when column has a filter', () => {
    const { entries } = build({ getColDef: vi.fn().mockReturnValue({ filter: true }) });
    expect(findItem(entries, 'filter.open.name')?.disabled).toBeFalsy();
    expect(findItem(entries, 'filter.open.name')?.tooltip).toBeUndefined();
  });

  it('clear filter is disabled with a tooltip when no filter is active', () => {
    const { entries } = build({ isFilterActive: vi.fn().mockReturnValue(false) });
    expect(findItem(entries, 'filter.clear.name')?.disabled).toBe(true);
    expect(findItem(entries, 'filter.clear.name')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.no-filter-active',
    );
  });

  it('clear filter is enabled with no tooltip when column filter is active', () => {
    const { entries } = build({ isFilterActive: vi.fn().mockReturnValue(true) });
    expect(findItem(entries, 'filter.clear.name')?.disabled).toBeFalsy();
    expect(findItem(entries, 'filter.clear.name')?.tooltip).toBeUndefined();
  });

  it('toggle floating filter shows "show" label when floating filters are inactive', () => {
    const { entries } = build(
      {},
      { getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: false }]) },
    );
    expect(findItem(entries, 'filter.toggleFloating.name')?.label).toContain(
      'show-floating-filters',
    );
  });

  it('toggle floating filter shows "hide" label when floating filters are active', () => {
    const { entries } = build(
      {},
      { getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: true }]) },
    );
    expect(findItem(entries, 'filter.toggleFloating.name')?.label).toContain(
      'hide-floating-filters',
    );
  });
});
```

Find and delete the entire `describe('floating filters toggle visibility', ...)` block:

```typescript
describe('floating filters toggle visibility', () => {
  function buildWithOpts(opts: { enableFloatingFiltersToggle?: boolean }) {
    const column = makeColumn();
    const api = makeApi(column);
    return service.buildHeaderMenu({ api, column } as any, opts);
  }

  it('is included when no opts are passed (default)', () => {
    const { entries } = build();
    expect(findItem(entries, 'filter.toggleFloating.name')).toBeDefined();
  });

  it('is included when enableFloatingFiltersToggle is true', () => {
    const entries = buildWithOpts({ enableFloatingFiltersToggle: true });
    expect(findItem(entries, 'filter.toggleFloating.name')).toBeDefined();
  });

  it('is excluded when enableFloatingFiltersToggle is false', () => {
    const entries = buildWithOpts({ enableFloatingFiltersToggle: false });
    expect(findItem(entries, 'filter.toggleFloating.name')).toBeUndefined();
  });

  it('other filter items remain present when toggle is disabled', () => {
    const entries = buildWithOpts({ enableFloatingFiltersToggle: false });
    expect(findItem(entries, 'filter.open.name')).toBeDefined();
    expect(findItem(entries, 'filter.clear.name')).toBeDefined();
  });
});
```

Find and delete the `open filter action` and `clear filter action` tests:

```typescript
it('open filter action calls showColumnFilter', () => {
  const { entries, api } = build();
  (findItem(entries, 'filter.open.name')!.action as () => void)();
  expect(api.showColumnFilter).toHaveBeenCalledWith('name');
});

it('clear filter action calls filterService.clearColumnFilter', () => {
  const { entries } = build();
  (findItem(entries, 'filter.clear.name')!.action as () => void)();
  expect(filterService.clearColumnFilter).toHaveBeenCalledWith('name');
});
```

Find and delete the two `toggle floating filter action` tests at the end of the `actions` describe block:

```typescript

      it('toggle floating filter action calls updateGridOptions and invokes the onFloatingFiltersToggle callback', async () => {
        const onFloatingFiltersToggle = vi.fn().mockResolvedValue(undefined);
        const column = makeColumn();
        const api = makeApi(column, {
          getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: false }]),
        });
        const entries = service.buildHeaderMenu({ api, column } as any, {
          onFloatingFiltersToggle,
        });
        await (findItem(entries, 'filter.toggleFloating.name')!.action as () => Promise<void>)();
        expect(api.updateGridOptions).toHaveBeenCalled();
        expect(onFloatingFiltersToggle).toHaveBeenCalledWith(true);
      });

      it('toggle floating filter action calls updateGridOptions without a callback when none is provided', async () => {
        const { entries, api } = build(
          {},
          { getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: false }]) },
        );
        await (findItem(entries, 'filter.toggleFloating.name')!.action as () => Promise<void>)();
        expect(api.updateGridOptions).toHaveBeenCalled();
      });
    });
```

with:

```typescript
    });
```

(that closes the `actions` describe block right after the `hide all columns` test, which is now the last one).

- [ ] **Step 8: Remove the `clearColumnFilter` test from `filter.service.spec.ts`**

In `packages/app/src/app/services/filter.service.spec.ts`, find:

```typescript
  it('should clear a single column filter', () => {
    service.setColumnFilter('name', { filterType: 'text' });
    service.clearColumnFilter('name');
    expect((service.columns() as any)['name']).toBeUndefined();
  });

  it('should clear all column filters', () => {
```

Replace with:

```typescript
  it('should clear all column filters', () => {
```

- [ ] **Step 9: Update Peers' and Trackers' `restoreColumnState` tests**

In `packages/app/src/app/modals/torrent-details/peers/peers.spec.ts`, find:

```typescript
it('restoreColumnState loads settings and applies column state', async () => {
  const state = [{ colId: 'ip', hide: false }];
  mockSettingsService.load.mockResolvedValue({ columnState: state, floatingFilters: false });
  const mockApi = {
    applyColumnState: vi.fn(),
    getColumnState: vi.fn().mockReturnValue([]),
    getColumnDefs: vi.fn().mockReturnValue([]),
    updateGridOptions: vi.fn(),
  };
  (component as any).gridApi = mockApi;

  await (component as any).restoreColumnState();

  expect(mockSettingsService.load).toHaveBeenCalled();
  expect(mockApi.applyColumnState).toHaveBeenCalledWith({ state, applyOrder: true });
});
```

Replace with:

```typescript
it('restoreColumnState loads settings and applies column state', async () => {
  const state = [{ colId: 'ip', hide: false }];
  mockSettingsService.load.mockResolvedValue({ columnState: state });
  const mockApi = {
    applyColumnState: vi.fn(),
    getColumnState: vi.fn().mockReturnValue([]),
  };
  (component as any).gridApi = mockApi;

  await (component as any).restoreColumnState();

  expect(mockSettingsService.load).toHaveBeenCalled();
  expect(mockApi.applyColumnState).toHaveBeenCalledWith({ state, applyOrder: true });
});
```

In `packages/app/src/app/modals/torrent-details/trackers/trackers.spec.ts`, find:

```typescript
it('restoreColumnState loads settings and applies column state', async () => {
  const state = [{ colId: 'tier', hide: false, width: 70 }];
  mockSettingsService.load.mockResolvedValue({ columnState: state, floatingFilters: false });
  const mockApi = {
    applyColumnState: vi.fn(),
    getColumnState: vi.fn().mockReturnValue([]),
    getColumnDefs: vi.fn().mockReturnValue([]),
    updateGridOptions: vi.fn(),
  };
  (component as any).gridApi = mockApi;

  await (component as any).restoreColumnState();

  expect(mockSettingsService.load).toHaveBeenCalled();
  expect(mockApi.applyColumnState).toHaveBeenCalledWith({
    state,
    applyOrder: true,
  });
});
```

Replace with:

```typescript
it('restoreColumnState loads settings and applies column state', async () => {
  const state = [{ colId: 'tier', hide: false, width: 70 }];
  mockSettingsService.load.mockResolvedValue({ columnState: state });
  const mockApi = {
    applyColumnState: vi.fn(),
    getColumnState: vi.fn().mockReturnValue([]),
  };
  (component as any).gridApi = mockApi;

  await (component as any).restoreColumnState();

  expect(mockSettingsService.load).toHaveBeenCalled();
  expect(mockApi.applyColumnState).toHaveBeenCalledWith({
    state,
    applyOrder: true,
  });
});
```

- [ ] **Step 10: Remove the now-unused context-menu translation keys**

In `public/i18n/us.json`, find:

```json
            "sort": "Sort",
            "filter": "Filter",
            "resize": "Resize",
```

Replace with:

```json
            "sort": "Sort",
            "resize": "Resize",
```

Find:

```json
            "clear-sort": "Clear Sort",
            "open-filter": "Open Filter",
            "show-floating-filters": "Show Floating Filters",
            "hide-floating-filters": "Hide Floating Filters",
            "autosize-column": "Auto-size This Column",
```

Replace with:

```json
            "clear-sort": "Clear Sort",
            "autosize-column": "Auto-size This Column",
```

Find:

```json
            "hide-column": "Hide Column",
            "clear-filter": "Clear Filter",
            "show-all": "Show All",
```

Replace with:

```json
            "hide-column": "Hide Column",
            "show-all": "Show All",
```

Find:

```json
            "no-sort-applied": "No sort is applied to this column.",
            "filter-not-supported": "This column does not support filtering.",
            "no-filter-active": "No filter is active on this column.",
            "already-pinned-left": "This column is already pinned to the left.",
```

Replace with:

```json
            "no-sort-applied": "No sort is applied to this column.",
            "already-pinned-left": "This column is already pinned to the left.",
```

In `public/i18n/hu.json`, find:

```json
            "sort": "Rendezés",
            "filter": "Szűrő",
            "resize": "Átméretezés",
```

Replace with:

```json
            "sort": "Rendezés",
            "resize": "Átméretezés",
```

Find:

```json
            "hide-column": "Oszlop elrejtése",
            "clear-filter": "Szűrő törlése",
            "show-all": "Összes megjelenítése",
```

Replace with:

```json
            "hide-column": "Oszlop elrejtése",
            "show-all": "Összes megjelenítése",
```

Find:

```json
            "clear-sort": "Rendezés törlése",
            "open-filter": "Szűrő megnyitása",
            "show-floating-filters": "Lebegő szűrők megjelenítése",
            "hide-floating-filters": "Lebegő szűrők elrejtése",
            "autosize-column": "Oszlop automatikus méretezése",
```

Replace with:

```json
            "clear-sort": "Rendezés törlése",
            "autosize-column": "Oszlop automatikus méretezése",
```

Find:

```json
            "filter-not-supported": "Ez az oszlop nem támogatja a szűrést.",
            "no-filter-active": "Ehhez az oszlophoz nincs aktív szűrő.",
```

Delete both lines entirely (they're a contiguous, unique pair).

- [ ] **Step 11: Run lint and the full test suite**

Run: `npm run lint`
Expected: PASS - no unused-import (`ColDef`, `FilterService`, `faFilter`, `faFilterCircleXmark`) or type errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - `grid-context-menu.service.spec.ts`, `filter.service.spec.ts`, `peers.spec.ts`, `trackers.spec.ts` all green with the filter-submenu/floating-filter assertions removed.

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts packages/app/src/app/services/filter.service.ts packages/app/src/app/services/filter.service.spec.ts packages/app/src/app/pages/main/grid/grid.lib.ts packages/app/src/app/modals/torrent-details/peers/peers.ts packages/app/src/app/modals/torrent-details/peers/peers.spec.ts packages/app/src/app/modals/torrent-details/trackers/trackers.ts packages/app/src/app/modals/torrent-details/trackers/trackers.spec.ts packages/app/src/app/models/peers-grid.model.ts packages/app/src/app/models/trackers-grid.model.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#216: remove the header filter submenu and floating filters feature"
```

---

### Task 4: Peers grid column filter migration

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/peers/peers.ts`
- Modify: `packages/app/src/app/modals/torrent-details/peers/peers.spec.ts`
- Modify: `packages/app/src/app/models/peers-grid.model.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: `TextColumnFilter`, `NumberColumnFilter`, `SizeColumnFilter`, `SetColumnFilter`, `SetColumnFilterParams`, `buildValueCounts` (Task 1).

- [ ] **Step 1: Extend the failing test with the new filter/column assertions**

In `packages/app/src/app/modals/torrent-details/peers/peers.spec.ts`, find:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbTorrentPeer } from '../../../models/torrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Peers } from './peers';
```

Replace with:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import { SetColumnFilter } from '../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { QbTorrentPeer } from '../../../models/torrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Peers } from './peers';
```

Find:

```typescript
    it('text-based columns have a tooltipField', () => {
      const textCols = component.colDefs.filter(
        (c) => c.colId !== 'country_code' && c.colId !== 'progress' && c.colId !== 'flags',
      );
      expect(textCols.every((c) => !!c.tooltipField)).toBe(true);
    });

    it('colIds cover all expected fields', () => {
      const colIds = component.colDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'country_code',
          'country',
          'ip',
          'port',
          'connection',
          'flags',
          'client',
          'progress',
          'dl_speed',
          'up_speed',
          'downloaded',
          'uploaded',
          'relevance',
          'files',
        ]),
      );
    });
  });
```

Replace with:

```typescript
    it('text-based columns have a tooltipField', () => {
      const textCols = component.colDefs.filter(
        (c) =>
          c.colId !== 'country_code' &&
          c.colId !== 'progress' &&
          c.colId !== 'progress_percentage' &&
          c.colId !== 'flags',
      );
      expect(textCols.every((c) => !!c.tooltipField)).toBe(true);
    });

    it('colIds cover all expected fields', () => {
      const colIds = component.colDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'country_code',
          'country',
          'ip',
          'port',
          'connection',
          'flags',
          'client',
          'progress',
          'progress_percentage',
          'progress_raw',
          'dl_speed',
          'dl_speed_raw',
          'up_speed',
          'up_speed_raw',
          'downloaded',
          'downloaded_raw',
          'uploaded',
          'uploaded_raw',
          'relevance',
          'files',
        ]),
      );
    });

    it('assigns TextColumnFilter to ip and flags', () => {
      for (const colId of ['ip', 'flags']) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(TextColumnFilter);
      }
    });

    it('assigns NumberColumnFilter to port, relevance, and the percentage/raw columns', () => {
      const numberFilterCols = [
        'port',
        'relevance',
        'progress_percentage',
        'progress_raw',
        'dl_speed_raw',
        'up_speed_raw',
        'downloaded_raw',
        'uploaded_raw',
      ];
      for (const colId of numberFilterCols) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(NumberColumnFilter);
      }
    });

    it('assigns SizeColumnFilter to dl_speed, up_speed, downloaded, and uploaded', () => {
      for (const colId of ['dl_speed', 'up_speed', 'downloaded', 'uploaded']) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(SizeColumnFilter);
      }
    });

    it('assigns SetColumnFilter to country, connection, and client', () => {
      for (const colId of ['country', 'connection', 'client']) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(SetColumnFilter);
      }
    });

    it('has no filter on country_code, progress, and files', () => {
      for (const colId of ['country_code', 'progress', 'files']) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(false);
      }
    });

    it('the new percentage/raw columns start hidden', () => {
      const hiddenCols = [
        'progress_percentage',
        'progress_raw',
        'dl_speed_raw',
        'up_speed_raw',
        'downloaded_raw',
        'uploaded_raw',
      ];
      for (const colId of hiddenCols) {
        expect(component.colDefs.find((c) => c.colId === colId)?.hide).toBe(true);
      }
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- peers.spec`
Expected: FAIL - the new colIds/filter-type assertions don't match the current `getColDefs()` output yet.

- [ ] **Step 3: Update `peers-grid.model.ts` with the 6 new hidden columns**

In `packages/app/src/app/models/peers-grid.model.ts`, find:

```typescript
export const DEFAULT_PEERS_GRID_SETTINGS: PeersGridSettings = {
  columnState: [
    { colId: 'country_code', hide: false, width: 30 },
    { colId: 'country', hide: false },
    { colId: 'ip', hide: false },
    { colId: 'port', hide: false },
    { colId: 'connection', hide: false },
    { colId: 'flags', hide: false },
    { colId: 'client', hide: false },
    { colId: 'progress', hide: false, width: 135 },
    { colId: 'dl_speed', hide: false },
    { colId: 'up_speed', hide: false },
    { colId: 'downloaded', hide: false },
    { colId: 'uploaded', hide: false },
    { colId: 'relevance', hide: false },
    { colId: 'files', hide: false },
  ],
};
```

Replace with:

```typescript
export const DEFAULT_PEERS_GRID_SETTINGS: PeersGridSettings = {
  columnState: [
    { colId: 'country_code', hide: false, width: 30 },
    { colId: 'country', hide: false },
    { colId: 'ip', hide: false },
    { colId: 'port', hide: false },
    { colId: 'connection', hide: false },
    { colId: 'flags', hide: false },
    { colId: 'client', hide: false },
    { colId: 'progress', hide: false, width: 135 },
    { colId: 'progress_percentage', hide: true },
    { colId: 'progress_raw', hide: true },
    { colId: 'dl_speed', hide: false },
    { colId: 'dl_speed_raw', hide: true },
    { colId: 'up_speed', hide: false },
    { colId: 'up_speed_raw', hide: true },
    { colId: 'downloaded', hide: false },
    { colId: 'downloaded_raw', hide: true },
    { colId: 'uploaded', hide: false },
    { colId: 'uploaded_raw', hide: true },
    { colId: 'relevance', hide: false },
    { colId: 'files', hide: false },
  ],
};
```

- [ ] **Step 4: Add the new `col-def` translation keys**

In `public/i18n/us.json`, find:

```json
            "progress": "Progress",
            "dl_speed": "Download Speed",
            "up_speed": "Upload Speed",
            "downloaded": "Downloaded",
            "uploaded": "Uploaded",
            "relevance": "Relevance",
            "files": "Files"
```

Replace with:

```json
            "progress": "Progress",
            "progress_percentage": "Progress (%)",
            "progress_raw": "Progress (raw)",
            "dl_speed": "Download Speed",
            "dl_speed_raw": "Download Speed (raw)",
            "up_speed": "Upload Speed",
            "up_speed_raw": "Upload Speed (raw)",
            "downloaded": "Downloaded",
            "downloaded_raw": "Downloaded (raw)",
            "uploaded": "Uploaded",
            "uploaded_raw": "Uploaded (raw)",
            "relevance": "Relevance",
            "files": "Files"
```

In `public/i18n/hu.json`, find:

```json
            "progress": "Állapot",
            "dl_speed": "Letöltés sebesség",
            "up_speed": "Feltöltés sebesség",
            "downloaded": "Letöltve",
            "uploaded": "Feltöltve",
            "relevance": "Relevancia",
            "files": "Fájlok"
```

Replace with:

```json
            "progress": "Állapot",
            "progress_percentage": "Haladás (%)",
            "progress_raw": "Haladás (nyers)",
            "dl_speed": "Letöltés sebesség",
            "dl_speed_raw": "Letöltés sebesség (nyers)",
            "up_speed": "Feltöltés sebesség",
            "up_speed_raw": "Feltöltés sebesség (nyers)",
            "downloaded": "Letöltve",
            "downloaded_raw": "Letöltve (nyers)",
            "uploaded": "Feltöltve",
            "uploaded_raw": "Feltöltve (nyers)",
            "relevance": "Relevancia",
            "files": "Fájlok"
```

- [ ] **Step 5: Rewrite `peers.ts`'s imports, computed signals, and `getColDefs()`**

In `packages/app/src/app/modals/torrent-details/peers/peers.ts`, find:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../app.const';
import { QbTorrentPeer } from '../../../models/torrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ContextMenuService } from '../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';

@Component({
```

Replace with:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  TooltipValueGetterFunc,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../app.const';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  buildValueCounts,
  SetColumnFilter,
  SetColumnFilterParams,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { QbTorrentPeer } from '../../../models/torrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ContextMenuService } from '../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';

const tooltipFormattedValue: TooltipValueGetterFunc<QbTorrentPeer, any> = (params) =>
  params.valueFormatted ?? '';

@Component({
```

Find:

```typescript
  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  public theme = this.themeService.effectiveMode;
```

Replace with:

```typescript
  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  private readonly countryItems = computed(() =>
    buildValueCounts(this.dataService.peers(), (p) => p.country),
  );
  private readonly connectionItems = computed(() =>
    buildValueCounts(this.dataService.peers(), (p) => p.connection),
  );
  private readonly clientItems = computed(() =>
    buildValueCounts(this.dataService.peers(), (p) => p.client),
  );

  public theme = this.themeService.effectiveMode;
```

Now find the entire `getColDefs()` method:

```typescript
  private getColDefs(): ColDef<QbTorrentPeer>[] {
    return [
      {
        colId: 'country_code',
        field: 'country_code',
        width: 40,
        headerName: '',
        sortable: false,
        filter: false,
        floatingFilter: false,
        resizable: false,
        cellRenderer: FlagCellRenderer,
      },
      {
        colId: 'country',
        field: 'country',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
        tooltipField: 'country',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'ip',
        field: 'ip',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        tooltipField: 'ip',
        sortable: true,
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'port',
        field: 'port',
        width: 90,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
        tooltipField: 'port',
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'connection',
        field: 'connection',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
        tooltipField: 'connection',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'flags',
        field: 'flags',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        tooltipComponent: FlagsTooltipComponent,
        tooltipValueGetter: (p) => p.data?.flags ?? '',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'client',
        field: 'client',
        width: 160,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
        tooltipField: 'client',
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'progress',
        field: 'progress',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress',
        ),
        valueGetter: (params: ValueGetterParams<QbTorrentPeer, number>): number => {
          const progress = params.data?.progress;

          if (!progress) return 0;
          if (progress === 0 || progress === 1) return progress * 100;
          return Number((progress * 100).toFixed(1));
        },
        valueFormatter: (params: ValueFormatterParams): string => `${params.value ?? 0}%`,
        cellRenderer: ProgressCellRenderer,
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'dl_speed',
        field: 'dl_speed',
        width: 160,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        tooltipField: 'dl_speed',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'up_speed',
        field: 'up_speed',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        tooltipField: 'up_speed',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'downloaded',
        field: 'downloaded',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        tooltipField: 'downloaded',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'uploaded',
        field: 'uploaded',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        tooltipField: 'uploaded',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: false,
        floatingFilter: false,
      },
      {
        colId: 'relevance',
        field: 'relevance',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
        tooltipField: 'relevance',
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'files',
        field: 'files',
        width: 450,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
        tooltipField: 'files',
        filter: 'agTextColumnFilter',
      },
    ];
  }
}
```

Replace with:

```typescript
  private getColDefs(): ColDef<QbTorrentPeer>[] {
    return [
      {
        colId: 'country_code',
        field: 'country_code',
        width: 40,
        headerName: '',
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: FlagCellRenderer,
      },
      {
        colId: 'country',
        field: 'country',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.country',
        ),
        tooltipField: 'country',
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.countryItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'ip',
        field: 'ip',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.ip',
        ),
        tooltipField: 'ip',
        sortable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'port',
        field: 'port',
        width: 90,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.port',
        ),
        tooltipField: 'port',
        filter: NumberColumnFilter,
      },
      {
        colId: 'connection',
        field: 'connection',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.connection',
        ),
        tooltipField: 'connection',
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.connectionItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'flags',
        field: 'flags',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.flags',
        ),
        tooltipComponent: FlagsTooltipComponent,
        tooltipValueGetter: (p) => p.data?.flags ?? '',
        filter: TextColumnFilter,
      },
      {
        colId: 'client',
        field: 'client',
        width: 160,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.client',
        ),
        tooltipField: 'client',
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.clientItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'progress',
        field: 'progress',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress',
        ),
        valueGetter: (params: ValueGetterParams<QbTorrentPeer, number>): number => {
          const progress = params.data?.progress;

          if (!progress) return 0;
          if (progress === 0 || progress === 1) return progress * 100;
          return Number((progress * 100).toFixed(1));
        },
        valueFormatter: (params: ValueFormatterParams): string => `${params.value ?? 0}%`,
        cellRenderer: ProgressCellRenderer,
        filter: false,
      },
      {
        colId: 'progress_percentage',
        field: 'progress',
        tooltipValueGetter: tooltipFormattedValue,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_percentage',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_percentage',
        ),
        width: 130,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>): string =>
          params.value != null ? (params.value * 100).toFixed(1) + '%' : '',
      },
      {
        colId: 'progress_raw',
        field: 'progress',
        tooltipField: 'progress',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.progress_raw',
        ),
        width: 130,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
      },
      {
        colId: 'dl_speed',
        field: 'dl_speed',
        width: 160,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed',
        ),
        tooltipField: 'dl_speed',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: SizeColumnFilter,
      },
      {
        colId: 'dl_speed_raw',
        field: 'dl_speed',
        tooltipField: 'dl_speed',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.dl_speed_raw',
        ),
        width: 160,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
      },
      {
        colId: 'up_speed',
        field: 'up_speed',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed',
        ),
        tooltipField: 'up_speed',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: SizeColumnFilter,
      },
      {
        colId: 'up_speed_raw',
        field: 'up_speed',
        tooltipField: 'up_speed',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.up_speed_raw',
        ),
        width: 140,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
      },
      {
        colId: 'downloaded',
        field: 'downloaded',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded',
        ),
        tooltipField: 'downloaded',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: SizeColumnFilter,
      },
      {
        colId: 'downloaded_raw',
        field: 'downloaded',
        tooltipField: 'downloaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.downloaded_raw',
        ),
        width: 130,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
      },
      {
        colId: 'uploaded',
        field: 'uploaded',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded',
        ),
        tooltipField: 'uploaded',
        valueFormatter: (params: ValueFormatterParams<QbTorrentPeer, number>) =>
          this.fileSizePipe.transform(params.value),
        filter: SizeColumnFilter,
      },
      {
        colId: 'uploaded_raw',
        field: 'uploaded',
        tooltipField: 'uploaded',
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded_raw',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.uploaded_raw',
        ),
        width: 120,
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
        hide: true,
      },
      {
        colId: 'relevance',
        field: 'relevance',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.relevance',
        ),
        tooltipField: 'relevance',
        filter: NumberColumnFilter,
      },
      {
        colId: 'files',
        field: 'files',
        width: 450,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.peers.col-def.files',
        ),
        tooltipField: 'files',
        filter: false,
      },
    ];
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- peers.spec`
Expected: PASS - all `Peers` tests green, including the new filter-type and hidden-column assertions.

- [ ] **Step 7: Run lint and the full test suite**

Run: `npm run lint`
Expected: PASS.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/peers/peers.ts packages/app/src/app/modals/torrent-details/peers/peers.spec.ts packages/app/src/app/models/peers-grid.model.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#216: migrate the peers grid to custom column filters and add raw/percentage columns"
```

---

### Task 5: Trackers grid column filter migration

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/trackers/trackers.ts`
- Modify: `packages/app/src/app/modals/torrent-details/trackers/trackers.spec.ts`

**Interfaces:**

- Consumes: `TextColumnFilter`, `NumberColumnFilter`, `SetColumnFilter`, `SetColumnFilterParams`, `buildValueCounts` (Task 1).

- [ ] **Step 1: Extend the failing test with the new filter-type assertions**

In `packages/app/src/app/modals/torrent-details/trackers/trackers.spec.ts`, find:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbTorrentTracker } from '../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { ThemeService } from '../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../services/trackers-grid.settings.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Trackers } from './trackers';
```

Replace with:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import { SetColumnFilter } from '../../../components/column-filters/set-column-filter/set-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { QbTorrentTracker } from '../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { ThemeService } from '../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../services/trackers-grid.settings.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Trackers } from './trackers';
```

Find:

```typescript
    it('colIds cover all expected fields', () => {
      const colIds = component.colDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'tier',
          'url',
          'status',
          'num_peers',
          'num_seeds',
          'num_leeches',
          'num_downloaded',
          'msg',
        ]),
      );
    });
  });
```

Replace with:

```typescript
    it('colIds cover all expected fields', () => {
      const colIds = component.colDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'tier',
          'url',
          'status',
          'num_peers',
          'num_seeds',
          'num_leeches',
          'num_downloaded',
          'msg',
        ]),
      );
    });

    it('assigns NumberColumnFilter to tier, num_peers, num_seeds, num_leeches, and num_downloaded', () => {
      const numberFilterCols = ['tier', 'num_peers', 'num_seeds', 'num_leeches', 'num_downloaded'];
      for (const colId of numberFilterCols) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(NumberColumnFilter);
      }
    });

    it('assigns TextColumnFilter to url', () => {
      expect(component.colDefs.find((c) => c.colId === 'url')?.filter).toBe(TextColumnFilter);
    });

    it('assigns SetColumnFilter to status', () => {
      expect(component.colDefs.find((c) => c.colId === 'status')?.filter).toBe(SetColumnFilter);
    });

    it('has no filter on msg', () => {
      expect(component.colDefs.find((c) => c.colId === 'msg')?.filter).toBe(false);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- trackers.spec`
Expected: FAIL - the new filter-type assertions don't match the current `getColDefs()` output yet (still `'agTextColumnFilter'`/`'agNumberColumnFilter'`).

- [ ] **Step 3: Rewrite `trackers.ts`'s imports, computed signal, and `getColDefs()`**

In `packages/app/src/app/modals/torrent-details/trackers/trackers.ts`, find:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../app.const';
import { QbTorrentTracker, QbTrackerStatus } from '../../../models/qbittorrent.model';
```

Replace with:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../app.const';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { QbTorrentTracker, QbTrackerStatus } from '../../../models/qbittorrent.model';
```

Find:

```typescript
  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  public theme = this.themeService.effectiveMode;
```

Replace with:

```typescript
  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  private readonly statusItems = computed(() =>
    buildValueCounts(this.dataService.trackers(), (t) => this.trackerStatusLabel(t.status)),
  );

  public theme = this.themeService.effectiveMode;
```

Now find the entire `getColDefs()` method:

```typescript
  private getColDefs(): ColDef<QbTorrentTracker>[] {
    return [
      {
        colId: 'tier',
        field: 'tier',
        width: 90,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        tooltipField: 'tier',
        sortable: true,
        resizable: true,
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'url',
        field: 'url',
        width: 590,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        tooltipField: 'url',
        sortable: true,
        resizable: true,
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'status',
        field: 'status',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentTracker, QbTrackerStatus>) =>
          this.trackerStatusLabel(params.value ?? QbTrackerStatus.Disabled),
        filterValueGetter: (params: ValueGetterParams<QbTorrentTracker>) =>
          this.trackerStatusLabel(params.data?.status ?? QbTrackerStatus.Disabled),
        tooltipValueGetter: (params) => this.trackerStatusLabel(params.value as QbTrackerStatus),
        sortable: true,
        resizable: true,
        filter: 'agTextColumnFilter',
      },
      {
        colId: 'num_peers',
        field: 'num_peers',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        tooltipField: 'num_peers',
        sortable: true,
        resizable: true,
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'num_seeds',
        field: 'num_seeds',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        tooltipField: 'num_seeds',
        sortable: true,
        resizable: true,
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'num_leeches',
        field: 'num_leeches',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        tooltipField: 'num_leeches',
        sortable: true,
        resizable: true,
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'num_downloaded',
        field: 'num_downloaded',
        width: 190,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        tooltipField: 'num_downloaded',
        sortable: true,
        resizable: true,
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'msg',
        field: 'msg',
        width: 260,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        tooltipField: 'msg',
        sortable: true,
        resizable: true,
        filter: 'agTextColumnFilter',
      },
    ];
  }
}
```

Replace with:

```typescript
  private getColDefs(): ColDef<QbTorrentTracker>[] {
    return [
      {
        colId: 'tier',
        field: 'tier',
        width: 90,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.tier',
        ),
        tooltipField: 'tier',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'url',
        field: 'url',
        width: 590,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.url',
        ),
        tooltipField: 'url',
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'status',
        field: 'status',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.status',
        ),
        valueFormatter: (params: ValueFormatterParams<QbTorrentTracker, QbTrackerStatus>) =>
          this.trackerStatusLabel(params.value ?? QbTrackerStatus.Disabled),
        filterValueGetter: (params: ValueGetterParams<QbTorrentTracker>) =>
          this.trackerStatusLabel(params.data?.status ?? QbTrackerStatus.Disabled),
        tooltipValueGetter: (params) => this.trackerStatusLabel(params.value as QbTrackerStatus),
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => this.statusItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'num_peers',
        field: 'num_peers',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_peers',
        ),
        tooltipField: 'num_peers',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'num_seeds',
        field: 'num_seeds',
        width: 100,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_seeds',
        ),
        tooltipField: 'num_seeds',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'num_leeches',
        field: 'num_leeches',
        width: 120,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_leeches',
        ),
        tooltipField: 'num_leeches',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'num_downloaded',
        field: 'num_downloaded',
        width: 190,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.num_downloaded',
        ),
        tooltipField: 'num_downloaded',
        sortable: true,
        resizable: true,
        filter: NumberColumnFilter,
      },
      {
        colId: 'msg',
        field: 'msg',
        width: 260,
        headerName: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.torrent-details.trackers.col-def.msg',
        ),
        tooltipField: 'msg',
        sortable: true,
        resizable: true,
        filter: false,
      },
    ];
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- trackers.spec`
Expected: PASS - all `Trackers` tests green, including the new filter-type assertions.

- [ ] **Step 5: Run lint and the full test suite**

Run: `npm run lint`
Expected: PASS.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/trackers/trackers.ts packages/app/src/app/modals/torrent-details/trackers/trackers.spec.ts
git commit -m "#216: migrate the trackers grid to custom column filters"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite and lint one more time**

Run: `npm run lint`
Expected: PASS with zero warnings.

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Start the app**

Run: `npm start`

- [ ] **Step 3: Verify the Peers grid**

Open a torrent's details and go to the Peers tab.

- Confirm `ip`/`flags` open a text filter, `port`/`relevance` open a number filter, `country`/`connection`/`client` open a checkbox-list set filter with counts, and `dl_speed`/`up_speed`/`downloaded`/`uploaded` open a size filter with a unit dropdown.
- Right-click the header → Columns, unhide `progress_percentage`, `progress_raw`, `dl_speed_raw`, `up_speed_raw`, `downloaded_raw`, `uploaded_raw`; confirm each opens a number filter and shows the expected raw/percentage value.
- Confirm `files` has no filter icon.
- Confirm applying and clearing a filter (via the filter popup's own Clear button) works and updates the grid.

- [ ] **Step 4: Verify the Trackers grid**

Open the Trackers tab.

- Confirm `url` opens a text filter, `tier`/`num_peers`/`num_seeds`/`num_leeches`/`num_downloaded` open number filters, and `status` opens a checkbox-list set filter showing the translated status labels with counts.
- Confirm `msg` has no filter icon.

- [ ] **Step 5: Verify the header "Filter" submenu is gone everywhere**

Right-click a column header on the main torrent grid, the Peers grid, and the Trackers grid. Confirm none of them show a "Filter" submenu (Open Filter / Clear Filter / Show-Hide Floating Filters) anymore - only Sort, Pin Column, Resize, and (main grid only, N/A here) Columns.

- [ ] **Step 6: Verify the main grid's existing set filters are unaffected**

On the main torrent grid, open the `State`, `Category`, and `Tags` column filters (via Columns submenu → unhide them if needed). Confirm they still show checkbox lists with correct counts and still filter the grid correctly - this exercises the `TorrentStoreService`-backed `getItems` wiring from Task 2.
