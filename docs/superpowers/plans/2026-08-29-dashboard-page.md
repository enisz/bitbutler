# Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Dashboard" page to BitButler showing a user-configurable grid of widgets (stat tiles and ranked torrent lists) for the currently selected server, with a live/paused toggle and an edit mode for adding, configuring, resizing, dragging, and removing widgets.

**Architecture:** A new `pages/dashboard` route mounts a `Dashboard` page component that owns the live-polling lifecycle (mirroring `Main`'s existing pattern) and a persisted widget layout (`DashboardSettingsService`). Each placed widget's data is derived by a pure selector function keyed off a shared `DashboardSnapshot` (torrents + server state), memoized per widget instance so cost scales only with what's actually placed on the board. Widgets render as dumb, presentational Angular components inside a `gridstack` (GridStack.js, official Angular bindings) grid for drag/resize; a separate "manage widgets" panel (shown only in edit mode) handles adding, configuring, and removing widgets, since GridStack's dynamically-injected components don't cleanly support projecting extra sibling controls into the same tile.

**Tech Stack:** Angular 22 (zoneless, signals), RxJS, `gridstack` (with its `gridstack/dist/angular` bindings), `@ng-bootstrap/ng-bootstrap` (existing modal pattern), `@ngx-translate/core`, Vitest (`ng test`).

**Spec:** `docs/superpowers/specs/2026-08-29-dashboard-page-design.md`

## Global Constraints

- Dashboard is scoped to the currently selected server only (matches `Main`'s existing single-server UX) - no multi-server aggregation.
- The torrent-list widget is count + sort field + sort order only - no state/category/tag filtering in v1.
- Widgets have no in-widget interactive sorting (no clickable column headers) - their order is fixed by config and re-derives automatically as poll data changes.
- No recent-activity feed and no rich (per-mount-point) disk usage in v1.
- Widget cost must scale only with what is actually placed on the dashboard - a widget not on the board must never run its selector.
- Navigation is strictly one page at a time (existing router behavior) - no shared shell/sidebar, no concurrent polling from two pages.
- Commit format: `#324: short description` (this feature is tracked as issue #324; current branch is `324-dashboard-page`, stacked on the unmerged `319-multi-page-navigation-shell` branch).
- Use `-` (hyphen) instead of `—` (em dash) in all written output, including code comments and commit messages.
- Run `npm run lint` and the affected package's test command after every task; both must be clean before moving on.

---

## Task 1: Move `server_state` into `TorrentStoreService`

**Files:**

- Modify: `packages/app/src/app/services/torrent-store.service.ts`
- Modify: `packages/app/src/app/services/torrent-store.service.spec.ts`
- Modify: `packages/app/src/app/pages/main/main.ts`
- Modify: `packages/app/src/app/pages/main/main.spec.ts`

**Interfaces:**

- Produces: `TorrentStoreService.serverState: Signal<QbServerState | null>` - readable by any page without that page having driven polling itself. Later tasks (8, 9) read this directly.

- [ ] **Step 1: Write the failing test for merging `server_state` into the store**

Add to `packages/app/src/app/services/torrent-store.service.spec.ts` (extend the existing `makeMaindata` helper's callers - it already accepts `Partial<Maindata>`, so pass `server_state` directly):

```typescript
describe('serverState', () => {
  it('should start as null', () => {
    expect(service.serverState()).toBeNull();
  });

  it('should be set on the first full_update', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        server_state: { dl_info_speed: 100, up_info_speed: 50 } as any,
      }),
    );

    expect(service.serverState()?.dl_info_speed).toBe(100);
  });

  it('should merge partial server_state on incremental updates, keeping prior fields', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        server_state: { dl_info_speed: 100, up_info_speed: 50 } as any,
      }),
    );
    service.applyMaindata(makeMaindata({ server_state: { dl_info_speed: 200 } as any }));

    expect(service.serverState()?.dl_info_speed).toBe(200);
    expect(service.serverState()?.up_info_speed).toBe(50);
  });

  it('should reset to null on clear()', () => {
    service.applyMaindata(
      makeMaindata({ full_update: true, server_state: { dl_info_speed: 100 } as any }),
    );
    service.clear();

    expect(service.serverState()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/torrent-store.service.spec.ts` (or `ng test --watch=false` from `packages/app`)
Expected: FAIL - `service.serverState` is not a function.

- [ ] **Step 3: Implement `serverState` in `TorrentStoreService`**

In `packages/app/src/app/services/torrent-store.service.ts`, add the signal and merge logic. Add near the other private signals (after `private readonly _tags`):

```typescript
  private readonly _serverState = signal<QbServerState | null>(null);
  readonly serverState = this._serverState.asReadonly();
```

Add `QbServerState` to the existing model import at the top of the file:

```typescript
import {
  Maindata,
  QbCategory,
  QbServerState,
  Torrent,
  TorrentMap,
  TorrentState,
} from '../models/torrent.model';
```

In `applyMaindata`, after the existing categories/tags handling block (right before `const delta: TorrentTxnDelta = ...`), add:

```typescript
if (data.server_state) {
  this._serverState.update((prev) => mergeServerState(prev, data.server_state));
}
```

Add the `mergeServerState` helper as a module-level function at the bottom of the file (moved here from `main.ts`, unchanged):

```typescript
function mergeServerState(
  prev: QbServerState | null,
  patch: QbServerState | null | undefined,
): QbServerState | null {
  if (!patch) return prev;
  if (!prev) return patch;

  const out: QbServerState = { ...prev };
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}
```

In `clear()`, add:

```typescript
this._serverState.set(null);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/torrent-store.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Update `Main` to read `serverState` from the store instead of merging it locally**

Update `packages/app/src/app/pages/main/main.spec.ts` first (TDD for the consumer change):

Replace the `serverState` describe block:

```typescript
describe('serverState', () => {
  it('should be the serverState signal from TorrentStoreService', async () => {
    await createComponent();
    expect(component.serverState).toBe(torrentStoreMock.serverState);
  });
});
```

Add `serverState: signal(null)` to the `torrentStoreMock` object in `beforeEach`.

- [ ] **Step 6: Run `main.spec.ts` to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/main.spec.ts`
Expected: FAIL - `component.serverState` is `null`, not the mock signal (still a local signal at this point).

- [ ] **Step 7: Update `Main` to consume the store's `serverState`**

In `packages/app/src/app/pages/main/main.ts`:

- Remove the `readonly serverState = signal<QbServerState | null>(null);` line and replace it with:

```typescript
  readonly serverState = this.torrentStore.serverState;
```

- Remove the `this.serverState.set(null);` line inside `_pollEffect` (no longer needed - the store already resets it via `clear()`, which `QbPollingService.startMaindataPolling` calls on a fresh start).
- Simplify the polling subscription callback from:

```typescript
      this.qbPollingService.startMaindataPolling(serverId).subscribe((data: Maindata) => {
        this.torrentStore.applyMaindata(data);
        this.serverState.update((prev) => mergeServerState(prev, data.server_state));
      }),
```

to:

```typescript
      this.qbPollingService.startMaindataPolling(serverId).subscribe((data: Maindata) => {
        this.torrentStore.applyMaindata(data);
      }),
```

- Remove the now-unused `mergeServerState` function and the `QbServerState` import (the `signal` import for `serverState` may now be unused too - check and remove if so; `signal` is still used elsewhere in the file for `sidebarSettings`... actually that uses `toSignal`, so check whether `signal(` is still called anywhere else in `main.ts` before removing the import).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/main.spec.ts --include=**/torrent-store.service.spec.ts`
Expected: PASS

- [ ] **Step 9: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/services/torrent-store.service.ts packages/app/src/app/services/torrent-store.service.spec.ts packages/app/src/app/pages/main/main.ts packages/app/src/app/pages/main/main.spec.ts
git commit -m "#324: move server_state into TorrentStoreService"
```

---

## Task 2: Dashboard model and settings persistence

**Files:**

- Create: `packages/app/src/app/models/dashboard.model.ts`
- Create: `packages/app/src/app/services/dashboard-settings.service.ts`
- Create: `packages/app/src/app/services/dashboard-settings.service.spec.ts`

**Interfaces:**

- Consumes: nothing new (only `Torrent`, `QbServerState`, `TorrentState` from `../models/torrent.model`, and `BaseSettingsService` from `./base-settings.service`).
- Produces: `DashboardLayout`, `DashboardWidgetInstance`, `WidgetTypeId`, `WidgetConfig`, `StatTileConfig`, `StatTileMetric`, `TorrentListConfig`, `TorrentListSortField`, `TorrentListColumn`, `DashboardSnapshot`, `StatTileData`, `TorrentListRow`, `TorrentListData`, `DEFAULT_DASHBOARD_LAYOUT` - the vocabulary every later task builds on. `DashboardSettingsService.load(): Promise<DashboardLayout>` and `.save(layout: DashboardLayout): Promise<void>` (inherited from `BaseSettingsService<DashboardLayout>`).

- [ ] **Step 1: Write the model file (no test - this is a pure type/constant module, exercised indirectly by every later task's tests)**

Create `packages/app/src/app/models/dashboard.model.ts`:

```typescript
import { QbServerState, Torrent, TorrentState } from './torrent.model';

export type WidgetTypeId = 'stat-tile' | 'torrent-list';

export type StatTileMetric =
  | 'download_speed'
  | 'upload_speed'
  | 'active_count'
  | 'global_ratio'
  | 'free_disk_space';

export interface StatTileConfig {
  metric: StatTileMetric;
}

export type TorrentListSortField =
  | 'ratio'
  | 'dlspeed'
  | 'upspeed'
  | 'size'
  | 'progress'
  | 'added_on'
  | 'eta';

export type TorrentListColumn = 'name' | 'state' | 'category' | TorrentListSortField;

export interface TorrentListConfig {
  count: number;
  sortField: TorrentListSortField;
  sortOrder: 'asc' | 'desc';
  columns: TorrentListColumn[];
}

export type WidgetConfig = StatTileConfig | TorrentListConfig;

export interface DashboardWidgetInstance {
  instanceId: string;
  widgetTypeId: WidgetTypeId;
  x: number;
  y: number;
  w: number;
  h: number;
  config: WidgetConfig;
}

export interface DashboardLayout {
  widgets: DashboardWidgetInstance[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [
    {
      instanceId: 'default-download-speed',
      widgetTypeId: 'stat-tile',
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'download_speed' },
    },
    {
      instanceId: 'default-upload-speed',
      widgetTypeId: 'stat-tile',
      x: 3,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'upload_speed' },
    },
    {
      instanceId: 'default-active-count',
      widgetTypeId: 'stat-tile',
      x: 6,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'active_count' },
    },
    {
      instanceId: 'default-global-ratio',
      widgetTypeId: 'stat-tile',
      x: 9,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'global_ratio' },
    },
  ],
};

export interface DashboardSnapshot {
  torrents: Torrent[];
  serverState: QbServerState | null;
}

export interface StatTileData {
  metric: StatTileMetric;
  value: number;
  /** Only set for 'active_count' - total torrent count, for an "18 of 42" style display. */
  total?: number;
}

export interface TorrentListRow {
  hash: string;
  name: string;
  state: TorrentState;
  category: string;
  ratio: number;
  dlspeed: number;
  upspeed: number;
  size: number;
  progress: number;
  added_on: number;
  eta: number;
}

export interface TorrentListData {
  columns: TorrentListColumn[];
  rows: TorrentListRow[];
}
```

- [ ] **Step 2: Write the failing test for `DashboardSettingsService`**

Create `packages/app/src/app/services/dashboard-settings.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { DEFAULT_DASHBOARD_LAYOUT } from '../models/dashboard.model';
import { DashboardSettingsService } from './dashboard-settings.service';
import { SettingsService } from './settings.service';

describe('DashboardSettingsService', () => {
  let service: DashboardSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        DashboardSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(DashboardSettingsService);
  });

  it('should return the default layout when nothing is stored', async () => {
    const layout = await service.load();
    expect(layout).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('should return a stored layout over the default', async () => {
    const stored = { widgets: [] };
    mockSettingsService.get.mockResolvedValue(stored);

    const layout = await service.load();
    expect(layout).toEqual(stored);
  });

  it('should persist a saved layout under its settings id', async () => {
    const next = { widgets: [] };
    await service.save(next);
    expect(mockSettingsService.set).toHaveBeenCalledWith('DashboardSettingsService', next);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/dashboard-settings.service.spec.ts`
Expected: FAIL - cannot find module `./dashboard-settings.service`.

- [ ] **Step 4: Implement `DashboardSettingsService`**

Create `packages/app/src/app/services/dashboard-settings.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { DEFAULT_DASHBOARD_LAYOUT, DashboardLayout } from '../models/dashboard.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class DashboardSettingsService extends BaseSettingsService<DashboardLayout> {
  protected readonly SETTINGS_ID = 'DashboardSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_DASHBOARD_LAYOUT;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/dashboard-settings.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/models/dashboard.model.ts packages/app/src/app/services/dashboard-settings.service.ts packages/app/src/app/services/dashboard-settings.service.spec.ts
git commit -m "#324: add dashboard model and settings persistence"
```

---

## Task 3: Routing, View menu entry, i18n, and Dashboard page skeleton

**Files:**

- Modify: `packages/app/src/app/app.routes.ts`
- Modify: `packages/electron/src/menu.ts`
- Modify: `packages/electron/src/menu.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`
- Create: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Create: `packages/app/src/app/pages/dashboard/dashboard.html`
- Create: `packages/app/src/app/pages/dashboard/dashboard.scss`
- Create: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`

**Interfaces:**

- Produces: the `Dashboard` component class (empty shell for now - later tasks fill in its body), reachable at route `pages/dashboard` and via View menu viewId `'dashboard'`.

- [ ] **Step 1: Write the failing test for the Dashboard skeleton**

Create `packages/app/src/app/pages/dashboard/dashboard.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Dashboard] }).compileComponents();
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: FAIL - cannot find module `./dashboard`.

- [ ] **Step 3: Create the Dashboard skeleton component**

Create `packages/app/src/app/pages/dashboard/dashboard.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {}
```

Create `packages/app/src/app/pages/dashboard/dashboard.html`:

```html
<div class="dashboard"></div>
```

Create `packages/app/src/app/pages/dashboard/dashboard.scss`:

```scss
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: PASS

- [ ] **Step 5: Wire the route**

In `packages/app/src/app/app.routes.ts`, add the `dashboard` child route alongside `torrent-list`:

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((mod) => mod.Login),
  },
  {
    path: 'pages',
    children: [
      {
        path: 'torrent-list',
        loadComponent: () => import('./pages/main/main').then((mod) => mod.Main),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((mod) => mod.Dashboard),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
```

No test needed here - there is no existing spec for `app.routes.ts`, and `UI_VIEW_SELECT` navigation (`ui-command-handler.service.spec.ts:233`) is already generic over `viewId`. `app.ts:164-165`'s active-view reporting is also generic (regex over `/pages/<segment>`), so it picks up `dashboard` automatically.

- [ ] **Step 6: Write the failing test for the View menu entry**

In `packages/electron/src/menu.spec.ts`, add to the existing `describe('View menu', ...)` block (after the last `it(...)`):

```typescript
it('is shown when logged in, with the dashboard item checked when active', async () => {
  mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
  mockGetActiveViewId.mockReturnValue('dashboard');
  const template = await buildMenu();
  const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
  const items = viewMenu!.submenu as MenuItemConstructorOptions[];
  expect(items[1]).toMatchObject({
    label: 'electron.menu.view-dashboard',
    type: 'radio',
    checked: true,
  });
});

it('sends view.select with the dashboard view id when clicked', async () => {
  mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
  const mainWindow = createFakeWindow();
  const template = await buildMenu(mainWindow);
  const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
  const items = viewMenu!.submenu as MenuItemConstructorOptions[];
  (items[1].click as () => void)();
  expect(mainWindow.webContents.send).toHaveBeenCalledWith(
    'menu:clicked',
    expect.objectContaining({ action: 'view.select', viewId: 'dashboard' }),
  );
});
```

- [ ] **Step 7: Run the menu tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/electron -- menu.spec.ts` (the electron package's `test` script is plain `vitest run`, so this becomes `vitest run menu.spec.ts`)
Expected: FAIL - `items[1]` is undefined (only one item in the View submenu today).

- [ ] **Step 8: Add the Dashboard item to the View submenu**

In `packages/electron/src/menu.ts`, extend the View submenu array:

```typescript
        {
          label: t('electron.menu.view-menu'),
          submenu: [
            {
              label: t('electron.menu.view-torrent-list'),
              type: 'radio' as const,
              checked: getActiveViewId() === 'torrent-list',
              click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'torrent-list' }),
            },
            {
              label: t('electron.menu.view-dashboard'),
              type: 'radio' as const,
              checked: getActiveViewId() === 'dashboard',
              click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'dashboard' }),
            },
          ],
        },
```

- [ ] **Step 9: Run the menu tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/electron -- menu.spec.ts`
Expected: PASS

- [ ] **Step 10: Add i18n keys**

In `packages/app/public/i18n/us.json`, add `"view-dashboard": "Dashboard",` right after line 2163 (`"view-torrent-list": "Torrent List",`).

In `packages/app/public/i18n/hu.json`, add `"view-dashboard": "Irányítópult",` right after line 2162 (`"view-torrent-list": "Torrent lista",`).

Also add a `pages.dashboard` section. In `packages/app/public/i18n/us.json`, right after `"pages": {` (line 1226), insert a new sibling before `"login"`:

```json
    "dashboard": {
      "title": "Dashboard"
    },
```

In `packages/app/public/i18n/hu.json`, add the equivalent at the same relative position:

```json
    "dashboard": {
      "title": "Irányítópult"
    },
```

- [ ] **Step 11: Update the Dashboard skeleton to show its title**

Update `packages/app/src/app/pages/dashboard/dashboard.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {}
```

Update `packages/app/src/app/pages/dashboard/dashboard.html`:

```html
<div class="dashboard">
  <header class="dashboard__header">
    <h1>{{ 'pages.dashboard.title' | translate }}</h1>
  </header>
</div>
```

- [ ] **Step 12: Run all the affected tests once more**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts` and `npm run test --workspace=@bitbutler/electron -- menu.spec.ts`
Expected: PASS (the `Dashboard` spec renders it with `TestBed.configureTestingModule({imports:[Dashboard]})`, which requires ngx-translate to be set up - if it fails on a missing `TranslateService` provider, add `providers: [provideTranslateService... ]` or a minimal `TranslatePipe` stub consistent with how other page specs in this codebase handle `TranslatePipe` in standalone component tests; check `main.spec.ts` or `status.spec.ts` for the exact existing convention if this comes up, since `Status`'s spec above already provides real `TranslateService` via `TestBed` implicitly through its module setup).

- [ ] **Step 13: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/app.routes.ts packages/electron/src/menu.ts packages/electron/src/menu.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json packages/app/src/app/pages/dashboard/
git commit -m "#324: add dashboard route, View menu entry, and page skeleton"
```

---

## Task 4: Dashboard snapshot type usage and stat-tile selector

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Create: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`

**Interfaces:**

- Consumes: `DashboardSnapshot`, `StatTileConfig`, `StatTileData`, `StatTileMetric` from `../../models/dashboard.model` (Task 2).
- Produces: `selectStatTileData(snapshot: DashboardSnapshot, config: StatTileConfig): StatTileData` - a pure function, the first half of the widget data layer. Task 5 adds `selectTorrentListData` and `resolveWidgetData` to this same file.

- [ ] **Step 1: Write the failing tests**

Create `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`:

```typescript
import { DashboardSnapshot } from '../../models/dashboard.model';
import { Torrent } from '../../models/torrent.model';
import { selectStatTileData } from './widget-selectors';

const makeTorrent = (overrides: Partial<Torrent>): Torrent =>
  ({
    hash: 'h',
    name: 'name',
    state: 'downloading',
    category: '',
    ratio: 0,
    dlspeed: 0,
    upspeed: 0,
    size: 0,
    progress: 0,
    added_on: 0,
    eta: 0,
    ...overrides,
  }) as Torrent;

describe('selectStatTileData', () => {
  const emptySnapshot: DashboardSnapshot = { torrents: [], serverState: null };

  it('should read download_speed from server_state', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { dl_info_speed: 1234 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'download_speed' })).toEqual({
      metric: 'download_speed',
      value: 1234,
    });
  });

  it('should read upload_speed from server_state', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { up_info_speed: 5678 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'upload_speed' })).toEqual({
      metric: 'upload_speed',
      value: 5678,
    });
  });

  it('should read free_disk_space from server_state', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { free_space_on_disk: 999 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'free_disk_space' })).toEqual({
      metric: 'free_disk_space',
      value: 999,
    });
  });

  it('should parse global_ratio (a string in server_state) into a number', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { global_ratio: '2.34' } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'global_ratio' })).toEqual({
      metric: 'global_ratio',
      value: 2.34,
    });
  });

  it('should default to 0 when server_state is null', () => {
    expect(selectStatTileData(emptySnapshot, { metric: 'download_speed' })).toEqual({
      metric: 'download_speed',
      value: 0,
    });
  });

  it('should count active torrents and report the total for active_count', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ state: 'downloading' }),
        makeTorrent({ state: 'pausedDL' }),
        makeTorrent({ state: 'uploading' }),
      ],
      serverState: null,
    };
    expect(selectStatTileData(snapshot, { metric: 'active_count' })).toEqual({
      metric: 'active_count',
      value: 2,
      total: 3,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-selectors.spec.ts`
Expected: FAIL - cannot find module `./widget-selectors`.

- [ ] **Step 3: Implement `selectStatTileData`**

Create `packages/app/src/app/pages/dashboard/widget-selectors.ts`:

```typescript
import { DashboardSnapshot, StatTileConfig, StatTileData } from '../../models/dashboard.model';
import { TorrentState } from '../../models/torrent.model';

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

export function selectStatTileData(
  snapshot: DashboardSnapshot,
  config: StatTileConfig,
): StatTileData {
  const { torrents, serverState } = snapshot;

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
    case 'active_count': {
      let active = 0;
      for (const t of torrents) if (ACTIVE_STATES.has(t.state)) active++;
      return { metric: config.metric, value: active, total: torrents.length };
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-selectors.spec.ts`
Expected: PASS

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/pages/dashboard/widget-selectors.spec.ts
git commit -m "#324: add the stat-tile widget data selector"
```

---

## Task 5: Torrent-list selector and the widget data dispatcher

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`

**Interfaces:**

- Consumes: `TorrentListConfig`, `TorrentListData`, `TorrentListRow`, `DashboardWidgetInstance` from `../../models/dashboard.model`.
- Produces: `selectTorrentListData(snapshot, config): TorrentListData` and `resolveWidgetData(instance: DashboardWidgetInstance, snapshot: DashboardSnapshot): StatTileData | TorrentListData` - the single entry point Task 9's Dashboard page calls per placed widget.

- [ ] **Step 1: Write the failing tests**

Append to `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`:

```typescript
import { DashboardWidgetInstance } from '../../models/dashboard.model';
import { resolveWidgetData, selectTorrentListData } from './widget-selectors';

describe('selectTorrentListData', () => {
  it('should sort descending by the configured field and truncate to count', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', ratio: 1.5 }),
        makeTorrent({ hash: 'b', ratio: 3.0 }),
        makeTorrent({ hash: 'c', ratio: 2.0 }),
      ],
      serverState: null,
    };

    const result = selectTorrentListData(snapshot, {
      count: 2,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    });

    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'c']);
    expect(result.columns).toEqual(['name', 'ratio']);
  });

  it('should sort ascending when configured', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', progress: 0.9 }),
        makeTorrent({ hash: 'b', progress: 0.1 }),
      ],
      serverState: null,
    };

    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'progress',
      sortOrder: 'asc',
      columns: ['name'],
    });

    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'a']);
  });

  it('should return fewer rows than count when there are fewer torrents', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ hash: 'only' })],
      serverState: null,
    };
    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    expect(result.rows).toHaveLength(1);
  });

  it('should return no rows for an empty torrent map', () => {
    const result = selectTorrentListData(
      { torrents: [], serverState: null },
      { count: 5, sortField: 'ratio', sortOrder: 'desc', columns: ['name'] },
    );
    expect(result.rows).toEqual([]);
  });
});

describe('resolveWidgetData', () => {
  it('should dispatch to selectStatTileData for a stat-tile instance', () => {
    const instance: DashboardWidgetInstance = {
      instanceId: 'i1',
      widgetTypeId: 'stat-tile',
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'download_speed' },
    };
    const snapshot: DashboardSnapshot = { torrents: [], serverState: { dl_info_speed: 42 } as any };

    expect(resolveWidgetData(instance, snapshot)).toEqual({ metric: 'download_speed', value: 42 });
  });

  it('should dispatch to selectTorrentListData for a torrent-list instance', () => {
    const instance: DashboardWidgetInstance = {
      instanceId: 'i2',
      widgetTypeId: 'torrent-list',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      config: { count: 1, sortField: 'ratio', sortOrder: 'desc', columns: ['name'] },
    };
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ hash: 'x' })],
      serverState: null,
    };

    expect(resolveWidgetData(instance, snapshot)).toEqual({
      columns: ['name'],
      rows: [expect.objectContaining({ hash: 'x' })],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-selectors.spec.ts`
Expected: FAIL - `selectTorrentListData` and `resolveWidgetData` are not exported.

- [ ] **Step 3: Implement `selectTorrentListData` and `resolveWidgetData`**

Append to `packages/app/src/app/pages/dashboard/widget-selectors.ts` (and update the model import at the top to include the new types):

```typescript
import {
  DashboardSnapshot,
  DashboardWidgetInstance,
  StatTileConfig,
  StatTileData,
  TorrentListConfig,
  TorrentListData,
  TorrentListRow,
} from '../../models/dashboard.model';
```

```typescript
export function selectTorrentListData(
  snapshot: DashboardSnapshot,
  config: TorrentListConfig,
): TorrentListData {
  const rows: TorrentListRow[] = snapshot.torrents.map((t) => ({
    hash: t.hash,
    name: t.name,
    state: t.state,
    category: t.category,
    ratio: t.ratio,
    dlspeed: t.dlspeed,
    upspeed: t.upspeed,
    size: t.size,
    progress: t.progress,
    added_on: t.added_on,
    eta: t.eta,
  }));

  const direction = config.sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => (a[config.sortField] - b[config.sortField]) * direction);

  return { columns: config.columns, rows: rows.slice(0, config.count) };
}

export function resolveWidgetData(
  instance: DashboardWidgetInstance,
  snapshot: DashboardSnapshot,
): StatTileData | TorrentListData {
  switch (instance.widgetTypeId) {
    case 'stat-tile':
      return selectStatTileData(snapshot, instance.config as StatTileConfig);
    case 'torrent-list':
      return selectTorrentListData(snapshot, instance.config as TorrentListConfig);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-selectors.spec.ts`
Expected: PASS

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/pages/dashboard/widget-selectors.spec.ts
git commit -m "#324: add the torrent-list selector and widget data dispatcher"
```

---

## Task 6: Add the `gridstack` dependency and the `StatTile` widget component

**Files:**

- Modify: `package.json` (root)
- Create: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.ts`
- Create: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.html`
- Create: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.scss`
- Create: `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `StatTileData` from `../../../../models/dashboard.model`; `FilesizePipe`, `RatioPipe`.
- Produces: `StatTile` component with a classic `@Input() data!: StatTileData` (not a signal `input()` - it must extend GridStack's `BaseWidget`, which populates inputs via `Object.assign(this, w.input)`, not Angular's `setInput()`). Task 8 registers it with `GridstackComponent.addComponentToSelectorType`.

- [ ] **Step 1: Add the `gridstack` dependency**

Run: `npm install gridstack --workspace=@bitbutler/app`

This adds `gridstack` to `packages/app/package.json` and updates the root `package-lock.json` - the same hoisted-dependency pattern already used for `ag-grid-community`/`ag-grid-angular`. Record whatever version npm resolves; do not hand-edit a version number.

- [ ] **Step 2: Write the failing test**

Create `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatTile } from './stat-tile';

describe('StatTile', () => {
  let fixture: ComponentFixture<StatTile>;
  let component: StatTile;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatTile] }).compileComponents();
    fixture = TestBed.createComponent(StatTile);
    component = fixture.componentInstance;
  });

  it('should format download_speed as bytes/sec', () => {
    component.data = { metric: 'download_speed', value: 1024 };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('/s');
  });

  it('should format global_ratio with two decimals', () => {
    component.data = { metric: 'global_ratio', value: 2.3 };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2.30');
  });

  it('should show "value of total" for active_count', () => {
    component.data = { metric: 'active_count', value: 18, total: 42 };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('18');
    expect(text).toContain('42');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/stat-tile.spec.ts`
Expected: FAIL - cannot find module `./stat-tile`.

- [ ] **Step 4: Add i18n keys for the stat tile metrics**

In `packages/app/public/i18n/us.json`, inside the `pages.dashboard` section added in Task 3, expand it to:

```json
    "dashboard": {
      "title": "Dashboard",
      "widgets": {
        "stat-tile": {
          "metric": {
            "download_speed": "Download",
            "upload_speed": "Upload",
            "active_count": "Active Torrents",
            "global_ratio": "Ratio",
            "free_disk_space": "Free Disk Space"
          }
        }
      }
    },
```

In `packages/app/public/i18n/hu.json`, add the equivalent Hungarian translations at the same relative position.

- [ ] **Step 5: Implement the `StatTile` component**

Create `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.ts`:

```typescript
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseWidget } from 'gridstack/dist/angular';
import { StatTileData } from '../../../../models/dashboard.model';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';

@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [TranslatePipe, FilesizePipe, RatioPipe],
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatTile extends BaseWidget {
  @Input() data!: StatTileData;

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

Create `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.html`:

```html
<div class="stat-tile">
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

Create `packages/app/src/app/pages/dashboard/widgets/stat-tile/stat-tile.scss`:

```scss
.stat-tile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding: 0.75rem 1rem;

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

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/stat-tile.spec.ts`
Expected: PASS. If `TestBed.configureTestingModule({imports:[StatTile]})` fails on a missing translation setup, check how `packages/app/src/test-setup.ts` configures `TranslateModule`/`TranslateService` globally for all specs before adding a component-local provider.

- [ ] **Step 7: Lint and commit**

Run: `npm run lint`

```bash
git add package.json package-lock.json packages/app/package.json packages/app/src/app/pages/dashboard/widgets/stat-tile/ packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add gridstack dependency and the StatTile widget"
```

---

## Task 7: `TorrentListWidget` component

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.ts`
- Create: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html`
- Create: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss`
- Create: `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `TorrentListData`, `TorrentListColumn`, `TorrentListRow` from `../../../../models/dashboard.model`; `RatioPipe`, `FilesizePipe`, `HumanizeDurationPipe`.
- Produces: `TorrentListWidget` component with classic `@Input() data!: TorrentListData` (same `BaseWidget` constraint as `StatTile`).

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentListRow } from '../../../../models/dashboard.model';
import { TorrentListWidget } from './torrent-list-widget';

const row: TorrentListRow = {
  hash: 'h1',
  name: 'Ubuntu ISO',
  state: 'downloading',
  category: 'linux',
  ratio: 1.5,
  dlspeed: 1024,
  upspeed: 512,
  size: 1073741824,
  progress: 0.5,
  added_on: 0,
  eta: 60,
};

describe('TorrentListWidget', () => {
  let fixture: ComponentFixture<TorrentListWidget>;
  let component: TorrentListWidget;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TorrentListWidget] }).compileComponents();
    fixture = TestBed.createComponent(TorrentListWidget);
    component = fixture.componentInstance;
  });

  describe('formattedValue', () => {
    it('should format ratio with two decimals', () => {
      expect(component.formattedValue(row, 'ratio')).toBe('1.50');
    });

    it('should format dlspeed and upspeed as bytes/sec', () => {
      expect(component.formattedValue(row, 'dlspeed')).toContain('/s');
      expect(component.formattedValue(row, 'upspeed')).toContain('/s');
    });

    it('should format progress as a whole percentage', () => {
      expect(component.formattedValue(row, 'progress')).toBe('50%');
    });

    it('should pass name and state through unchanged', () => {
      expect(component.formattedValue(row, 'name')).toBe('Ubuntu ISO');
      expect(component.formattedValue(row, 'state')).toBe('downloading');
    });

    it('should show a dash for an empty category', () => {
      expect(component.formattedValue({ ...row, category: '' }, 'category')).toBe('-');
    });
  });

  it('should render one row per data.rows entry with the configured columns', () => {
    component.data = { columns: ['name', 'ratio'], rows: [row] };
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll('td');
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toContain('Ubuntu ISO');
    expect(cells[1].textContent).toContain('1.50');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/torrent-list-widget.spec.ts`
Expected: FAIL - cannot find module `./torrent-list-widget`.

- [ ] **Step 3: Add i18n keys for the torrent-list column headers**

In `packages/app/public/i18n/us.json`, extend the `pages.dashboard.widgets` object added in Task 6 with a sibling `torrent-list` key:

```json
        "torrent-list": {
          "column": {
            "name": "Name",
            "state": "State",
            "category": "Category",
            "ratio": "Ratio",
            "dlspeed": "Down Speed",
            "upspeed": "Up Speed",
            "size": "Size",
            "progress": "Progress",
            "added_on": "Added On",
            "eta": "ETA"
          }
        }
```

Add the Hungarian equivalent to `packages/app/public/i18n/hu.json` at the same relative position.

- [ ] **Step 4: Implement `TorrentListWidget`**

Create `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.ts`:

```typescript
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

@Component({
  selector: 'app-torrent-list-widget',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './torrent-list-widget.html',
  styleUrl: './torrent-list-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentListWidget extends BaseWidget {
  @Input() data!: TorrentListData;

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

Create `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.html`:

```html
<table class="torrent-list-widget">
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
```

Create `packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/torrent-list-widget.scss`:

```scss
.torrent-list-widget {
  width: 100%;
  height: 100%;
  overflow: auto;
  border-collapse: collapse;
  font-size: 0.85rem;

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

Run: `npm run test --workspace=@bitbutler/app -- --include=**/torrent-list-widget.spec.ts`
Expected: PASS

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/pages/dashboard/widgets/torrent-list-widget/ packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add the TorrentListWidget"
```

---

## Task 8: Widget catalog registry

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widget-catalog.ts`
- Create: `packages/app/src/app/pages/dashboard/widget-catalog.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `WidgetTypeId`, `WidgetConfig`, `StatTileConfig`, `TorrentListConfig` from `../../models/dashboard.model`.
- Produces: `WIDGET_CATALOG: Record<WidgetTypeId, WidgetCatalogMeta>` where `WidgetCatalogMeta = { id, labelKey, componentSelector, defaultConfig, defaultSize }`. `componentSelector` is the widget component's own Angular `@Component({selector})` string (`'app-stat-tile'` / `'app-torrent-list-widget'`) - this is what GridStack's `NgGridStackWidget.selector` field needs, which is a separate concept from our own `widgetTypeId`. Task 9 uses this to build GridStack items and to register the components; Tasks 11-12 use `labelKey`/`defaultConfig`/`defaultSize` for the add-widget flow.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/pages/dashboard/widget-catalog.spec.ts`:

```typescript
import { WIDGET_CATALOG } from './widget-catalog';

describe('WIDGET_CATALOG', () => {
  it('should have an entry for every WidgetTypeId', () => {
    expect(Object.keys(WIDGET_CATALOG).sort()).toEqual(['stat-tile', 'torrent-list']);
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-catalog.spec.ts`
Expected: FAIL - cannot find module `./widget-catalog`.

- [ ] **Step 3: Add i18n keys for the catalog labels**

In `packages/app/public/i18n/us.json`, extend `pages.dashboard` (added in Task 3/6/7) with a `catalog` sibling:

```json
      "catalog": {
        "stat-tile": "Stat Tile",
        "torrent-list": "Torrent List"
      },
```

Add the Hungarian equivalent to `hu.json`.

- [ ] **Step 4: Implement `WIDGET_CATALOG`**

Create `packages/app/src/app/pages/dashboard/widget-catalog.ts`:

```typescript
import {
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig,
  WidgetTypeId,
} from '../../models/dashboard.model';

export interface WidgetCatalogMeta {
  id: WidgetTypeId;
  labelKey: string;
  componentSelector: string;
  defaultConfig: WidgetConfig;
  defaultSize: { w: number; h: number };
}

export const WIDGET_CATALOG: Record<WidgetTypeId, WidgetCatalogMeta> = {
  'stat-tile': {
    id: 'stat-tile',
    labelKey: 'pages.dashboard.catalog.stat-tile',
    componentSelector: 'app-stat-tile',
    defaultConfig: { metric: 'download_speed' } satisfies StatTileConfig,
    defaultSize: { w: 3, h: 2 },
  },
  'torrent-list': {
    id: 'torrent-list',
    labelKey: 'pages.dashboard.catalog.torrent-list',
    componentSelector: 'app-torrent-list-widget',
    defaultConfig: {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    } satisfies TorrentListConfig,
    defaultSize: { w: 6, h: 4 },
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-catalog.spec.ts`
Expected: PASS

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/pages/dashboard/widget-catalog.ts packages/app/src/app/pages/dashboard/widget-catalog.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add the widget catalog registry"
```

---

## Task 9: Dashboard renders the grid, wired to live polling

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.html`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `DashboardSettingsService.load()`, `QbPollingService.startMaindataPolling/isPaused$/pause/resume`, `ServerStoreService.currentServerId`, `TorrentStoreService.torrentsArray/serverState/applyMaindata`, `WIDGET_CATALOG`, `resolveWidgetData`, `StatTile`, `TorrentListWidget`.
- Produces: a working live dashboard with drag/resize (via `gridstack`'s official Angular bindings, `GridstackComponent`/`GridstackItemComponent` from `gridstack/dist/angular`) but no add/edit/remove UI yet (Tasks 10-12).

Before writing code: `GridstackComponent`'s change output is shown as both `(change)` and `(changeCB)` in different parts of the GridStack docs. TypeScript will fail to compile against whichever name the installed version doesn't actually expose as an `@Output()` - if `(change)` doesn't compile, use `(changeCB)` instead; the rest of this task is unaffected either way.

- [ ] **Step 1: Write the failing tests**

Replace `packages/app/src/app/pages/dashboard/dashboard.spec.ts`:

```typescript
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DashboardWidgetInstance } from '../../models/dashboard.model';
import { DashboardSettingsService } from '../../services/dashboard-settings.service';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  let serverStoreMock: { currentServerId: ReturnType<typeof signal<string | null>> };
  let torrentStoreMock: {
    torrentsArray: ReturnType<typeof signal<any[]>>;
    serverState: ReturnType<typeof signal<any>>;
    applyMaindata: ReturnType<typeof vi.fn>;
  };
  let qbPollingMock: {
    startMaindataPolling: ReturnType<typeof vi.fn>;
    isPaused$: Subject<boolean>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  let dashboardSettingsMock: { load: ReturnType<typeof vi.fn> };

  const statTileInstance: DashboardWidgetInstance = {
    instanceId: 'w1',
    widgetTypeId: 'stat-tile',
    x: 0,
    y: 0,
    w: 3,
    h: 2,
    config: { metric: 'download_speed' },
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
        { provide: QbPollingService, useValue: qbPollingMock },
        { provide: DashboardSettingsService, useValue: dashboardSettingsMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Dashboard, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(() => {
    serverStoreMock = { currentServerId: signal<string | null>(null) };
    torrentStoreMock = {
      torrentsArray: signal([]),
      serverState: signal(null),
      applyMaindata: vi.fn(),
    };
    qbPollingMock = {
      startMaindataPolling: vi.fn().mockReturnValue(new Subject()),
      isPaused$: new Subject<boolean>(),
      pause: vi.fn().mockReturnValue(Symbol('pause-token')),
      resume: vi.fn(),
    };
    dashboardSettingsMock = { load: vi.fn().mockResolvedValue({ widgets: [statTileInstance] }) };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  it('should load the persisted layout into widgets()', async () => {
    await createComponent();
    expect(component.widgets()).toEqual([statTileInstance]);
  });

  describe('polling lifecycle', () => {
    it('should start polling when a server becomes current', async () => {
      await createComponent();
      expect(qbPollingMock.startMaindataPolling).not.toHaveBeenCalled();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledWith('server-1');
    });

    it('should stop the previous subscription and start a new one on server switch', async () => {
      await createComponent();
      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();
      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledTimes(2);
      expect(qbPollingMock.startMaindataPolling).toHaveBeenLastCalledWith('server-2');
    });
  });

  describe('toggleLive', () => {
    it('should pause via QbPollingService when live and toggled', async () => {
      await createComponent();
      component.toggleLive();
      expect(qbPollingMock.pause).toHaveBeenCalled();
    });

    it('should resume via QbPollingService when paused and toggled', async () => {
      await createComponent();
      component.toggleLive();
      qbPollingMock.isPaused$.next(true);
      fixture.detectChanges();
      component.toggleLive();
      expect(qbPollingMock.resume).toHaveBeenCalled();
    });
  });

  describe('dataFor', () => {
    it('should memoize widget data across calls for the same instance reference', async () => {
      await createComponent();
      const first = component.dataFor(statTileInstance);
      const second = component.dataFor(statTileInstance);
      expect(first).toBe(second);
    });

    it('should recompute when the instance reference changes (e.g. after a config edit)', async () => {
      await createComponent();
      component.dataFor(statTileInstance);

      torrentStoreMock.serverState.set({ up_info_speed: 777 });
      const edited: DashboardWidgetInstance = {
        ...statTileInstance,
        config: { metric: 'upload_speed' },
      };

      expect(component.dataFor(edited)).toEqual({ metric: 'upload_speed', value: 777 });
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: FAIL - `widgets`, `toggleLive`, `dataFor` don't exist yet.

- [ ] **Step 3: Add i18n keys for the live toggle**

In `packages/app/public/i18n/us.json`, extend `pages.dashboard`:

```json
      "live-toggle": {
        "live": "Live",
        "paused": "Paused"
      },
```

Add the Hungarian equivalent to `hu.json`.

- [ ] **Step 4: Implement the Dashboard component**

Replace `packages/app/src/app/pages/dashboard/dashboard.ts`:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import {
  GridstackComponent,
  GridstackItemComponent,
  NgGridStackWidget,
} from 'gridstack/dist/angular';
import { Subscription } from 'rxjs';
import {
  DashboardWidgetInstance,
  StatTileData,
  TorrentListData,
} from '../../models/dashboard.model';
import { DashboardSettingsService } from '../../services/dashboard-settings.service';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { WIDGET_CATALOG } from './widget-catalog';
import { resolveWidgetData } from './widget-selectors';
import { StatTile } from './widgets/stat-tile/stat-tile';
import { TorrentListWidget } from './widgets/torrent-list-widget/torrent-list-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [GridstackComponent, GridstackItemComponent, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnDestroy {
  private readonly qbPollingService = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly dashboardSettingsService = inject(DashboardSettingsService);

  readonly widgets = signal<DashboardWidgetInstance[]>([]);
  readonly isPaused = toSignal(this.qbPollingService.isPaused$, { initialValue: false });

  readonly gridOptions = { column: 12, cellHeight: 64, margin: 8, staticGrid: true };

  private readonly snapshot = computed(() => ({
    torrents: this.torrentStore.torrentsArray(),
    serverState: this.torrentStore.serverState(),
  }));

  private readonly dataCache = new Map<
    string,
    { instance: DashboardWidgetInstance; value: StatTileData | TorrentListData }
  >();

  readonly items = computed<NgGridStackWidget[]>(() =>
    this.widgets().map((instance) => ({
      id: instance.instanceId,
      x: instance.x,
      y: instance.y,
      w: instance.w,
      h: instance.h,
      selector: WIDGET_CATALOG[instance.widgetTypeId].componentSelector,
      input: { data: this.dataFor(instance) },
    })),
  );

  private pauseToken: symbol | null = null;
  private pollSub: Subscription | null = null;

  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;
    sub.add(
      this.qbPollingService
        .startMaindataPolling(serverId)
        .subscribe((data) => this.torrentStore.applyMaindata(data)),
    );

    onCleanup(() => sub.unsubscribe());
  });

  constructor() {
    GridstackComponent.addComponentToSelectorType([StatTile, TorrentListWidget]);
    void this.dashboardSettingsService.load().then((layout) => this.widgets.set(layout.widgets));
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  toggleLive(): void {
    if (this.isPaused()) {
      if (this.pauseToken) this.qbPollingService.resume(this.pauseToken);
      this.pauseToken = null;
    } else {
      this.pauseToken = this.qbPollingService.pause();
    }
  }

  dataFor(instance: DashboardWidgetInstance): StatTileData | TorrentListData {
    const cached = this.dataCache.get(instance.instanceId);
    if (cached && cached.instance === instance) return cached.value;

    const value = resolveWidgetData(instance, this.snapshot());
    this.dataCache.set(instance.instanceId, { instance, value });
    return value;
  }
}
```

- [ ] **Step 5: Update the Dashboard template**

Replace `packages/app/src/app/pages/dashboard/dashboard.html`:

```html
<div class="dashboard">
  <header class="dashboard__header">
    <h1>{{ 'pages.dashboard.title' | translate }}</h1>
    <button type="button" (click)="toggleLive()">
      {{ (isPaused() ? 'pages.dashboard.live-toggle.paused' : 'pages.dashboard.live-toggle.live') |
      translate }}
    </button>
  </header>

  <gridstack [options]="gridOptions">
    @for (item of items(); track item.id) {
    <gridstack-item [options]="item"></gridstack-item>
    }
  </gridstack>
</div>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: PASS

- [ ] **Step 7: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/pages/dashboard/dashboard.ts packages/app/src/app/pages/dashboard/dashboard.html packages/app/src/app/pages/dashboard/dashboard.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: render the dashboard grid, wired to live polling"
```

---

## Task 10: Edit mode toggle and layout persistence

**Files:**

- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.html`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `editMode: Signal<boolean>`, `toggleEditMode(): void`, `onGridChange(event): void` - persists position/size changes from drag/resize back through `DashboardSettingsService.save()`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/pages/dashboard/dashboard.spec.ts`:

```typescript
describe('editMode', () => {
  it('should default to false', async () => {
    await createComponent();
    expect(component.editMode()).toBe(false);
  });

  it('should toggle', async () => {
    await createComponent();
    component.toggleEditMode();
    expect(component.editMode()).toBe(true);
    component.toggleEditMode();
    expect(component.editMode()).toBe(false);
  });
});

describe('onGridChange', () => {
  it('should update the matching widget position/size and persist the layout', async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    await createComponent();

    component.onGridChange({ nodes: [{ id: 'w1', x: 4, y: 1, w: 5, h: 3 }] } as any);

    expect(component.widgets()[0]).toMatchObject({ x: 4, y: 1, w: 5, h: 3 });
    expect(dashboardSettingsMock.save).toHaveBeenCalledWith({ widgets: component.widgets() });
  });

  it('should leave widgets with no matching node untouched', async () => {
    await createComponent();
    const before = component.widgets()[0];
    component.onGridChange({ nodes: [{ id: 'not-w1', x: 9, y: 9, w: 9, h: 9 }] } as any);
    expect(component.widgets()[0]).toEqual(before);
  });
});
```

Add `save: vi.fn().mockResolvedValue(undefined)` to `dashboardSettingsMock` in `beforeEach`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: FAIL - `editMode`, `toggleEditMode`, `onGridChange` don't exist yet.

- [ ] **Step 3: Add i18n keys for the edit-mode toggle**

In `packages/app/public/i18n/us.json`, extend `pages.dashboard`:

```json
      "edit-toggle": {
        "edit": "Edit",
        "done": "Done"
      },
```

Add the Hungarian equivalent to `hu.json`.

- [ ] **Step 4: Implement edit mode and change persistence**

In `packages/app/src/app/pages/dashboard/dashboard.ts`, add the `ViewChild` import and `nodesCB`/`GridStackNode` type import:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  GridstackComponent,
  GridstackItemComponent,
  NgGridStackWidget,
  nodesCB,
} from 'gridstack/dist/angular';
```

Add inside the class body:

```typescript
  @ViewChild(GridstackComponent) private gridComp?: GridstackComponent;

  readonly editMode = signal(false);

  private readonly _staticEffect = effect(() => {
    this.gridComp?.grid?.setStatic(!this.editMode());
  });
```

Add the methods:

```typescript
  toggleEditMode(): void {
    this.editMode.update((v) => !v);
  }

  onGridChange(event: nodesCB): void {
    const positions = new Map(event.nodes.map((n) => [String(n.id), n]));
    const next = this.widgets().map((w) => {
      const pos = positions.get(w.instanceId);
      if (!pos) return w;
      return {
        ...w,
        x: pos.x ?? w.x,
        y: pos.y ?? w.y,
        w: pos.w ?? w.w,
        h: pos.h ?? w.h,
      };
    });
    this.widgets.set(next);
    void this.dashboardSettingsService.save({ widgets: next });
  }
```

Note: this task's spec calls `component.onGridChange({ nodes: [...] } as any)` directly rather than through the real `(change)` DOM event, so it is unaffected by whichever of `(change)`/`(changeCB)` the installed version actually exposes - resolve that naming question when wiring the template binding in Step 5.

- [ ] **Step 5: Wire edit mode and the change handler into the template**

Update `packages/app/src/app/pages/dashboard/dashboard.html`:

```html
<div class="dashboard">
  <header class="dashboard__header">
    <h1>{{ 'pages.dashboard.title' | translate }}</h1>
    <div class="dashboard__actions">
      <button type="button" (click)="toggleLive()">
        {{ (isPaused() ? 'pages.dashboard.live-toggle.paused' : 'pages.dashboard.live-toggle.live')
        | translate }}
      </button>
      <button type="button" (click)="toggleEditMode()">
        {{ (editMode() ? 'pages.dashboard.edit-toggle.done' : 'pages.dashboard.edit-toggle.edit') |
        translate }}
      </button>
    </div>
  </header>

  <gridstack [options]="gridOptions" (change)="onGridChange($event)">
    @for (item of items(); track item.id) {
    <gridstack-item [options]="item"></gridstack-item>
    }
  </gridstack>
</div>
```

If `(change)` does not compile against the installed `gridstack` version's Angular typings, replace it with `(changeCB)` - this is the one place in the whole feature where that naming ambiguity matters.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: PASS

- [ ] **Step 7: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/pages/dashboard/dashboard.ts packages/app/src/app/pages/dashboard/dashboard.html packages/app/src/app/pages/dashboard/dashboard.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add dashboard edit mode and layout persistence"
```

---

## Task 11: Add Widget button and the Widget Picker modal

**Files:**

- Create: `packages/app/src/app/modals/widget-picker/widget-picker.ts`
- Create: `packages/app/src/app/modals/widget-picker/widget-picker.html`
- Create: `packages/app/src/app/modals/widget-picker/widget-picker.scss`
- Create: `packages/app/src/app/modals/widget-picker/widget-picker.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.html`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `WidgetPicker` modal component (`NgbActiveModal.close(widgetTypeId: WidgetTypeId)` on selection). `Dashboard.addWidget(): void`, shown only when `editMode()` is true, opens the picker and (on selection) appends a new `DashboardWidgetInstance` with the catalog's `defaultConfig`/`defaultSize` to `widgets()` and persists it. Widget-specific configuration (beyond the catalog default) is deferred to Task 12's config panel, opened from the same flow.

- [ ] **Step 1: Write the failing test for the picker**

Create `packages/app/src/app/modals/widget-picker/widget-picker.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WidgetPicker } from './widget-picker';

describe('WidgetPicker', () => {
  let component: WidgetPicker;
  let fixture: ComponentFixture<WidgetPicker>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [WidgetPicker],
      providers: [{ provide: NgbActiveModal, useValue: activeModalMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(WidgetPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should list both catalog entries', () => {
    expect(component.catalogEntries.map((e) => e.id).sort()).toEqual(['stat-tile', 'torrent-list']);
  });

  it('should close the modal with the chosen widget type id', () => {
    component.choose('stat-tile');
    expect(activeModalMock.close).toHaveBeenCalledWith('stat-tile');
  });

  it('should dismiss on cancel', () => {
    component.cancel();
    expect(activeModalMock.dismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-picker.spec.ts`
Expected: FAIL - cannot find module `./widget-picker`.

- [ ] **Step 3: Add i18n keys**

In `packages/app/public/i18n/us.json`, alongside the existing `modals.torrent-exists` section, add a sibling `modals.widget-picker`:

```json
    "widget-picker": {
      "title": "Add Widget"
    },
```

Add the Hungarian equivalent to `hu.json`. Also add `"add-widget": "Add Widget"` to `pages.dashboard` in both files.

- [ ] **Step 4: Implement `WidgetPicker`**

Create `packages/app/src/app/modals/widget-picker/widget-picker.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { WidgetTypeId } from '../../models/dashboard.model';
import { WIDGET_CATALOG, WidgetCatalogMeta } from '../../pages/dashboard/widget-catalog';

@Component({
  selector: 'app-widget-picker',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './widget-picker.html',
  styleUrl: './widget-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPicker {
  private readonly activeModal = inject(NgbActiveModal);

  readonly catalogEntries: WidgetCatalogMeta[] = Object.values(WIDGET_CATALOG);

  choose(widgetTypeId: WidgetTypeId): void {
    this.activeModal.close(widgetTypeId);
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
```

Create `packages/app/src/app/modals/widget-picker/widget-picker.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'modals.widget-picker.title' | translate }}</h5>
  <button type="button" class="btn-close" (click)="cancel()"></button>
</div>
<div class="modal-body widget-picker">
  @for (entry of catalogEntries; track entry.id) {
  <button type="button" class="widget-picker__option" (click)="choose(entry.id)">
    {{ entry.labelKey | translate }}
  </button>
  }
</div>
```

Create `packages/app/src/app/modals/widget-picker/widget-picker.scss`:

```scss
.widget-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__option {
    padding: 0.75rem 1rem;
    text-align: left;
  }
}
```

- [ ] **Step 5: Run the picker test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-picker.spec.ts`
Expected: PASS

- [ ] **Step 6: Write the failing test for `Dashboard.addWidget`**

Add to `packages/app/src/app/pages/dashboard/dashboard.spec.ts` (add `NgbModal` to the mocked providers):

```typescript
describe('addWidget', () => {
  it('should append a new instance with the catalog default config/size on confirm', async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    const resultPromise = Promise.resolve('stat-tile');
    modalServiceMock.open.mockReturnValue({ result: resultPromise });
    await createComponent();

    component.addWidget();
    await resultPromise;
    await Promise.resolve();

    const added = component
      .widgets()
      .find((w) => w.widgetTypeId === 'stat-tile' && w !== statTileInstance);
    expect(added).toMatchObject({
      widgetTypeId: 'stat-tile',
      w: 3,
      h: 2,
      config: { metric: 'download_speed' },
    });
    expect(dashboardSettingsMock.save).toHaveBeenCalled();
  });
});
```

Add to `beforeEach`:

```typescript
modalServiceMock = { open: vi.fn() };
```

Declare `let modalServiceMock: { open: ReturnType<typeof vi.fn> };` alongside the other mock declarations, and add `{ provide: NgbModal, useValue: modalServiceMock }` to the `providers` array in `createComponent()`. Import `NgbModal` from `@ng-bootstrap/ng-bootstrap`.

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: FAIL - `component.addWidget` is not a function.

- [ ] **Step 8: Implement `Dashboard.addWidget`**

In `packages/app/src/app/pages/dashboard/dashboard.ts`, add imports:

```typescript
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { WidgetPicker } from '../../modals/widget-picker/widget-picker';
```

Add the injected service and method:

```typescript
  private readonly modalService = inject(NgbModal);
```

```typescript
  addWidget(): void {
    const pickerRef = this.modalService.open(WidgetPicker, { centered: true });
    pickerRef.result
      .then((widgetTypeId: WidgetTypeId) => {
        const meta = WIDGET_CATALOG[widgetTypeId];
        const instance: DashboardWidgetInstance = {
          instanceId: crypto.randomUUID(),
          widgetTypeId,
          x: 0,
          y: 0,
          w: meta.defaultSize.w,
          h: meta.defaultSize.h,
          config: meta.defaultConfig,
        };
        const next = [...this.widgets(), instance];
        this.widgets.set(next);
        void this.dashboardSettingsService.save({ widgets: next });
      })
      .catch(() => {});
  }
```

Add the `WidgetTypeId` import from `../../models/dashboard.model` if not already present.

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: PASS

- [ ] **Step 10: Add the "Add Widget" button to the template, edit-mode only**

Update `packages/app/src/app/pages/dashboard/dashboard.html`, inside `.dashboard__actions`, adding it before the edit-mode toggle button:

```html
@if (editMode()) {
<button type="button" (click)="addWidget()">{{ 'pages.dashboard.add-widget' | translate }}</button>
}
```

- [ ] **Step 11: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/modals/widget-picker/ packages/app/src/app/pages/dashboard/dashboard.ts packages/app/src/app/pages/dashboard/dashboard.html packages/app/src/app/pages/dashboard/dashboard.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add the Add Widget button and widget picker modal"
```

---

## Task 12: Widget config modal, config-in-add-flow, and remove widget

**Files:**

- Create: `packages/app/src/app/modals/widget-config/widget-config.ts`
- Create: `packages/app/src/app/modals/widget-config/widget-config.html`
- Create: `packages/app/src/app/modals/widget-config/widget-config.scss`
- Create: `packages/app/src/app/modals/widget-config/widget-config.spec.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.ts`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.html`
- Modify: `packages/app/src/app/pages/dashboard/dashboard.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `WidgetConfig` modal component (`input.required<WidgetTypeId>() widgetTypeId`, `input.required<WidgetConfig>() initialConfig`, closes with the edited `WidgetConfig`). `Dashboard.editWidget(instanceId: string): void` and `Dashboard.removeWidget(instanceId: string): void`, plus a "manage widgets" panel (edit-mode only) listing each placed widget with Edit/Remove actions - kept separate from the grid tiles themselves, since GridStack's dynamically-injected components (Task 6/7's `BaseWidget` subclasses) don't have a documented way to emit `@Output()` events back through the declarative `[options]`/`input` binding, so per-tile overlay controls aren't a reliable option here.

- [ ] **Step 1: Write the failing test for the config modal**

Create `packages/app/src/app/modals/widget-config/widget-config.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WidgetConfig } from './widget-config';

describe('WidgetConfig', () => {
  let component: WidgetConfig;
  let fixture: ComponentFixture<WidgetConfig>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [WidgetConfig],
      providers: [{ provide: NgbActiveModal, useValue: activeModalMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(WidgetConfig);
    component = fixture.componentInstance;
  });

  function withInputs(widgetTypeId: 'stat-tile' | 'torrent-list', initialConfig: unknown): void {
    fixture.componentRef.setInput('widgetTypeId', widgetTypeId);
    fixture.componentRef.setInput('initialConfig', initialConfig);
    fixture.detectChanges();
  }

  it('should seed config from initialConfig for a stat-tile', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    expect(component.config()).toEqual({ metric: 'download_speed' });
  });

  it('should update the metric for a stat-tile', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    component.updateStatTileMetric('global_ratio');
    expect(component.config()).toEqual({ metric: 'global_ratio' });
  });

  it('should update a single torrent-list field without disturbing the others', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    component.updateTorrentListField('count', 10);
    expect(component.config()).toEqual({
      count: 10,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
  });

  it('should add and remove a column via toggleColumn', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    component.toggleColumn('ratio');
    expect((component.config() as any).columns).toEqual(['name', 'ratio']);
    component.toggleColumn('name');
    expect((component.config() as any).columns).toEqual(['ratio']);
  });

  it('should close the modal with the current config on save', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    component.updateStatTileMetric('active_count');
    component.save();
    expect(activeModalMock.close).toHaveBeenCalledWith({ metric: 'active_count' });
  });

  it('should dismiss on cancel', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    component.cancel();
    expect(activeModalMock.dismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-config.spec.ts`
Expected: FAIL - cannot find module `./widget-config`.

- [ ] **Step 3: Add i18n keys**

In `packages/app/public/i18n/us.json`, add a `modals.widget-config` sibling to `modals.widget-picker`:

```json
    "widget-config": {
      "title": "Configure Widget",
      "metric": "Metric",
      "count": "Count",
      "sort-field": "Sort By",
      "sort-order": "Order",
      "columns": "Columns"
    },
```

Add the Hungarian equivalent to `hu.json`.

- [ ] **Step 4: Implement `WidgetConfig`**

Create `packages/app/src/app/modals/widget-config/widget-config.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import {
  StatTileConfig,
  StatTileMetric,
  TorrentListColumn,
  TorrentListConfig,
  TorrentListSortField,
  WidgetConfig as WidgetConfigModel,
  WidgetTypeId,
} from '../../models/dashboard.model';

@Component({
  selector: 'app-widget-config',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './widget-config.html',
  styleUrl: './widget-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetConfig {
  private readonly activeModal = inject(NgbActiveModal);

  readonly widgetTypeId = input.required<WidgetTypeId>();
  readonly initialConfig = input.required<WidgetConfigModel>();

  readonly statTileMetrics: StatTileMetric[] = [
    'download_speed',
    'upload_speed',
    'active_count',
    'global_ratio',
    'free_disk_space',
  ];

  readonly sortFields: TorrentListSortField[] = [
    'ratio',
    'dlspeed',
    'upspeed',
    'size',
    'progress',
    'added_on',
    'eta',
  ];

  readonly availableColumns: TorrentListColumn[] = [
    'name',
    'state',
    'category',
    'ratio',
    'dlspeed',
    'upspeed',
    'size',
    'progress',
    'added_on',
    'eta',
  ];

  readonly config = signal<WidgetConfigModel>(this.initialConfig());

  readonly isStatTile = computed(() => this.widgetTypeId() === 'stat-tile');

  updateStatTileMetric(metric: StatTileMetric): void {
    this.config.set({ metric } satisfies StatTileConfig);
  }

  updateTorrentListField<K extends keyof TorrentListConfig>(
    key: K,
    value: TorrentListConfig[K],
  ): void {
    this.config.update((c) => ({ ...(c as TorrentListConfig), [key]: value }));
  }

  toggleColumn(column: TorrentListColumn): void {
    const c = this.config() as TorrentListConfig;
    const has = c.columns.includes(column);
    const columns = has ? c.columns.filter((x) => x !== column) : [...c.columns, column];
    this.config.set({ ...c, columns });
  }

  save(): void {
    this.activeModal.close(this.config());
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
```

Create `packages/app/src/app/modals/widget-config/widget-config.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'modals.widget-config.title' | translate }}</h5>
  <button type="button" class="btn-close" (click)="cancel()"></button>
</div>
<div class="modal-body widget-config">
  @if (isStatTile()) {
  <label>
    {{ 'modals.widget-config.metric' | translate }}
    <select (change)="updateStatTileMetric($any($event.target).value)">
      @for (metric of statTileMetrics; track metric) {
      <option [value]="metric" [selected]="$any(config()).metric === metric">
        {{ 'pages.dashboard.widgets.stat-tile.metric.' + metric | translate }}
      </option>
      }
    </select>
  </label>
  } @else {
  <label>
    {{ 'modals.widget-config.count' | translate }}
    <input
      type="number"
      min="1"
      [value]="$any(config()).count"
      (change)="updateTorrentListField('count', +$any($event.target).value)"
    />
  </label>
  <label>
    {{ 'modals.widget-config.sort-field' | translate }}
    <select (change)="updateTorrentListField('sortField', $any($event.target).value)">
      @for (field of sortFields; track field) {
      <option [value]="field" [selected]="$any(config()).sortField === field">
        {{ 'pages.dashboard.widgets.torrent-list.column.' + field | translate }}
      </option>
      }
    </select>
  </label>
  <label>
    {{ 'modals.widget-config.sort-order' | translate }}
    <select (change)="updateTorrentListField('sortOrder', $any($event.target).value)">
      <option value="desc" [selected]="$any(config()).sortOrder === 'desc'">desc</option>
      <option value="asc" [selected]="$any(config()).sortOrder === 'asc'">asc</option>
    </select>
  </label>
  <fieldset>
    <legend>{{ 'modals.widget-config.columns' | translate }}</legend>
    @for (column of availableColumns; track column) {
    <label>
      <input
        type="checkbox"
        [checked]="$any(config()).columns.includes(column)"
        (change)="toggleColumn(column)"
      />
      {{ 'pages.dashboard.widgets.torrent-list.column.' + column | translate }}
    </label>
    }
  </fieldset>
  }
</div>
<div class="modal-footer">
  <button type="button" (click)="cancel()">{{ 'general.button.cancel' | translate }}</button>
  <button type="button" (click)="save()">{{ 'general.button.save' | translate }}</button>
</div>
```

Create `packages/app/src/app/modals/widget-config/widget-config.scss`:

```scss
.widget-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
}
```

- [ ] **Step 5: Run the config modal test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/widget-config.spec.ts`
Expected: PASS

- [ ] **Step 6: Write the failing tests for `Dashboard.addWidget` routing through config, `editWidget`, and `removeWidget`**

Replace the `addWidget` describe block added in Task 11 in `packages/app/src/app/pages/dashboard/dashboard.spec.ts` with:

```typescript
describe('addWidget', () => {
  it('should open the picker, then the config modal pre-filled with the catalog default, then append the confirmed instance', async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    const pickerResult = Promise.resolve('stat-tile');
    const configResult = Promise.resolve({ metric: 'global_ratio' });
    modalServiceMock.open
      .mockReturnValueOnce({ result: pickerResult })
      .mockReturnValueOnce({ result: configResult, componentInstance: {} });
    await createComponent();

    component.addWidget();
    await pickerResult;
    await Promise.resolve();
    await configResult;
    await Promise.resolve();

    const added = component.widgets().find((w) => w !== statTileInstance);
    expect(added).toMatchObject({ widgetTypeId: 'stat-tile', config: { metric: 'global_ratio' } });
    expect(dashboardSettingsMock.save).toHaveBeenCalled();
  });
});

describe('editWidget', () => {
  it('should open the config modal pre-filled with the instance config and update it on confirm', async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    const configResult = Promise.resolve({ metric: 'active_count' });
    modalServiceMock.open.mockReturnValue({ result: configResult, componentInstance: {} });
    await createComponent();

    component.editWidget('w1');
    await configResult;
    await Promise.resolve();

    expect(component.widgets()[0]).toMatchObject({
      instanceId: 'w1',
      config: { metric: 'active_count' },
    });
    expect(dashboardSettingsMock.save).toHaveBeenCalled();
  });

  it('should do nothing for an unknown instance id', async () => {
    await createComponent();
    component.editWidget('does-not-exist');
    expect(modalServiceMock.open).not.toHaveBeenCalled();
  });
});

describe('removeWidget', () => {
  it('should remove the matching widget and persist the layout', async () => {
    dashboardSettingsMock.save = vi.fn().mockResolvedValue(undefined);
    await createComponent();

    component.removeWidget('w1');

    expect(component.widgets()).toEqual([]);
    expect(dashboardSettingsMock.save).toHaveBeenCalledWith({ widgets: [] });
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: FAIL - `editWidget`/`removeWidget` don't exist, and `addWidget` doesn't yet route through the config modal.

- [ ] **Step 8: Implement `editWidget`, `removeWidget`, and route `addWidget` through the config modal**

In `packages/app/src/app/pages/dashboard/dashboard.ts`, add the import:

```typescript
import { WidgetConfig as WidgetConfigModal } from '../../modals/widget-config/widget-config';
import { WidgetConfig } from '../../models/dashboard.model';
import { setModalInput } from '../../utils/modal-input';
```

(`WidgetConfig` the model type and `WidgetConfig` the modal component share a name - import the component under an alias, `WidgetConfigModal`, to avoid a collision with the `WidgetConfig` type already imported from `dashboard.model`.)

Replace `addWidget` with:

```typescript
  addWidget(): void {
    const pickerRef = this.modalService.open(WidgetPicker, { centered: true });
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

  editWidget(instanceId: string): void {
    const target = this.widgets().find((w) => w.instanceId === instanceId);
    if (!target) return;

    const configRef = this.modalService.open(WidgetConfigModal, { centered: true });
    setModalInput(configRef, 'widgetTypeId', target.widgetTypeId);
    setModalInput(configRef, 'initialConfig', target.config);

    configRef.result
      .then((config: WidgetConfig) => {
        const next = this.widgets().map((w) => (w.instanceId === instanceId ? { ...w, config } : w));
        this.widgets.set(next);
        void this.dashboardSettingsService.save({ widgets: next });
      })
      .catch(() => {});
  }

  removeWidget(instanceId: string): void {
    const next = this.widgets().filter((w) => w.instanceId !== instanceId);
    this.widgets.set(next);
    void this.dashboardSettingsService.save({ widgets: next });
  }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/pages/dashboard/dashboard.spec.ts`
Expected: PASS

- [ ] **Step 10: Add the manage-widgets panel to the template, edit-mode only**

Update `packages/app/src/app/pages/dashboard/dashboard.html`, inserting the panel between the header and the `<gridstack>` element:

```html
@if (editMode()) {
<div class="dashboard__manage-panel">
  <ul>
    @for (widget of widgets(); track widget.instanceId) {
    <li>
      <span>{{ catalog[widget.widgetTypeId].labelKey | translate }}</span>
      <button type="button" (click)="editWidget(widget.instanceId)">
        {{ 'general.button.edit' | translate }}
      </button>
      <button type="button" (click)="removeWidget(widget.instanceId)">
        {{ 'general.button.delete' | translate }}
      </button>
    </li>
    }
  </ul>
</div>
}
```

Add `readonly catalog = WIDGET_CATALOG;` to the `Dashboard` class body so the template can resolve each widget's label.

- [ ] **Step 11: Run the full app test suite once and fix any fallout**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS across the whole `@bitbutler/app` workspace.

- [ ] **Step 12: Lint and commit**

Run: `npm run lint`

```bash
git add packages/app/src/app/modals/widget-config/ packages/app/src/app/pages/dashboard/dashboard.ts packages/app/src/app/pages/dashboard/dashboard.html packages/app/src/app/pages/dashboard/dashboard.spec.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add widget config modal, editing, and removal"
```

---

## Final verification

- [ ] Run `npm run lint` at the repo root - zero warnings.
- [ ] Run `npm test` at the repo root - all workspaces pass.
- [ ] Run `npm start` and manually verify in the running app: the View menu shows "Dashboard" as a second option; switching to it shows the four default stat tiles reading live data; the Live toggle freezes/resumes updates; Edit mode reveals the manage-widgets panel and the Add Widget button; adding a torrent-list widget via the picker + config flow places it on the grid; dragging/resizing a tile in edit mode persists across a page reload; editing a widget's config re-renders it with the new data; removing a widget takes it off the grid.
- [ ] Remove the `docs/superpowers` folder in its own commit before opening the PR, per this repo's convention for specs/plans (`git rm -r docs/superpowers && git commit -m "#324: removed spec and plan"`).
