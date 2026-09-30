# Manage Modals ag-grid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Manage Servers, Manage Tags, and Manage Categories modals' plain-list UIs with ag-grid-based grids that have persisted column state, custom per-column filters, row/header context menus, and checkbox batch selection, matching the main torrent grid's capabilities.

**Architecture:** Command-bus plumbing for Tag/Category CRUD is added first (mirroring the existing Server pattern), then each of the three modals is rebuilt independently on top of it, each following the existing `Trackers` component's small inline column-state save/restore pattern rather than a new shared grid framework - no new shared infrastructure files are introduced beyond the command types/handlers, since research confirmed `GridContextMenuService.buildHeaderMenu()` is already grid-agnostic and reusable directly.

**Tech Stack:** Angular 22 (zoneless, signals), ag-grid-angular 36 (Community edition), ng-bootstrap modals, RxJS command bus, better-sqlite3-backed settings IPC.

**Spec:** `docs/superpowers/specs/2026-10-01-manage-modals-ag-grid-redesign-design.md`

## Global Constraints

- ag-grid is Community edition only - no Enterprise menus/filters. All context menus and column-header menus are hand-built Angular/CDK, reusing `ContextMenuService`/`GridContextMenuService` directly.
- No new IPC contract additions - all CRUD already exists via `QbService.torrents.*` (tags/categories) and `ServerService`/`server-command-handler.service.ts` (servers). New settings services reuse the existing generic `settings` IPC channel via `BaseSettingsService<T>`.
- All three grids' column-state persistence is global (one row per grid), not per-server - see spec §Shared infrastructure.
- Toast rule (from CLAUDE.md): skip the success toast when the result is already visible in the UI. This applies specifically to `CATEGORY_UPDATED` (the inline-edited cell already shows the new value) - only its failure path toasts.
- Modals stay top-aligned: never pass `centered: true` to `NgbModal.open()` for any modal in this plan.
- The three grid modals (`ManageServers`, `ManageTags`, `ManageCategories`) open at `size: 'xl'` (up from today's default width) to fit the grid - set in `ui-command-handler.service.ts`'s `UI_MANAGE_*` cases, one per grid's own task. `TagEditor`/`CategoryEditor` stay small, unchanged from `ServerEditor`'s `size: 'lg'` precedent.
- Footer layout: action buttons in document order on the left, `Close` last with `ms-auto` applied to it to pin it right.
- `TagEditor` and `CategoryEditor` (the two new create-only modals) do **not** implement `GuardableModal`, matching the existing `ServerEditor` precedent (the component they parallel) - single/dual-field forms are low-stakes to lose without a dirty-guard.
- `ManageServers`' existing `hideConnect = input(false)` is preserved unchanged and must gate: the Connect footer button, the Connect/Set-as-Default row-context-menu entries, and the active-orb "active" styling - it is used today by the login page to open the modal without implying a live-connection switch.
- Every new/changed `.ts`/`.html` file must pass `npm run lint` (zero warnings) and `npm run format` conventions (Prettier) before a task's commit step.

## Review Focus

- **Deleting a row while it is mid-inline-edit (Manage Categories):** selecting and batch-deleting a category whose save-path cell is currently open for editing must cancel that pending edit cleanly, not throw or fire a stale `editCategory` IPC call after the row is gone.
- **Emptying a grid to zero rows:** after deleting all rows (or on an empty server with no tags/categories), the grid must render its empty state and the footer buttons must show their disabled (nothing-selected) state without errors from `getSelectedRows()` or the enable-rule computed signals.
- **Duplicate/overlapping comma-separated tag names on create:** submitting `"linux, linux, existingTag"` in the Tag Editor must not attempt to (re)create a tag that's already in the grid, matching today's `ManageTags.add()` de-dup behavior (`names.filter(n => !this.tags().includes(n))`).
- **Losing unsaved column layout changes on quick close:** reordering/resizing a column and immediately closing the modal, before the existing debounce interval elapses, must still persist that final state - the save must flush on destroy, not only on the debounce timer.
- **Connect failing or requiring credentials while the modal stays open (Manage Servers):** since Connect no longer dismisses the modal on success, a failed connect attempt (bad credentials, 401, unreachable host) or the credential-prompt flow must leave the grid in a normal, re-selectable state - not stuck showing a pending/loading state on the Connect button.

---

## Task 1: Tag and Category command types

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`
- Test: `packages/app/src/app/models/command.model.spec.ts` (create if it doesn't exist; if the file doesn't exist today because this module is pure types, create a minimal compile-time-shape test instead - see Step 1)

**Interfaces:**

- Produces: `TagCommand` (`TAG_ADDED` with `{ names: string[] }`, `TAG_DELETED` with `{ names: string[] }`), `CategoryCommand` (`CATEGORY_ADDED` with `{ name: string; savePath: string }`, `CATEGORY_UPDATED` with `{ name: string; savePath: string }`, `CATEGORY_DELETED` with `{ names: string[] }`), both added to the `AppCommand` union - consumed by Tasks 2, 3, and every grid task.

- [ ] **Step 1: Write the failing compile-time test**

Create `packages/app/src/app/models/command.model.spec.ts`:

```ts
import type { AppCommand, CategoryCommand, TagCommand } from './command.model';

describe('command.model', () => {
  it('accepts TagCommand and CategoryCommand as AppCommand', () => {
    const tagAdded: AppCommand = { type: 'TAG_ADDED', names: ['linux', 'ubuntu'] };
    const tagDeleted: AppCommand = { type: 'TAG_DELETED', names: ['linux'] };
    const categoryAdded: AppCommand = {
      type: 'CATEGORY_ADDED',
      name: 'movies',
      savePath: '/data/movies',
    };
    const categoryUpdated: AppCommand = {
      type: 'CATEGORY_UPDATED',
      name: 'movies',
      savePath: '/data/movies2',
    };
    const categoryDeleted: AppCommand = { type: 'CATEGORY_DELETED', names: ['movies'] };

    const tag: TagCommand = tagAdded;
    const category: CategoryCommand = categoryAdded;

    expect(tag.type).toBe('TAG_ADDED');
    expect(category.type).toBe('CATEGORY_ADDED');
    expect(tagDeleted.type).toBe('TAG_DELETED');
    expect(categoryUpdated.type).toBe('CATEGORY_UPDATED');
    expect(categoryDeleted.type).toBe('CATEGORY_DELETED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/command.model.spec.ts'`
Expected: FAIL with a TypeScript error - `TagCommand`/`CategoryCommand` are not exported from `command.model.ts`, and `'TAG_ADDED'` etc. are not assignable to `AppCommand['type']`.

- [ ] **Step 3: Add the command types**

In `packages/app/src/app/models/command.model.ts`, immediately after the existing `ServerCommand` type definition (the one covering `SERVER_ADDED`/`SERVER_UPDATED`/`SERVER_DELETED`), add:

```ts
export type TagCommand =
  | { type: 'TAG_ADDED'; names: string[] }
  | { type: 'TAG_DELETED'; names: string[] };

export type CategoryCommand =
  | { type: 'CATEGORY_ADDED'; name: string; savePath: string }
  | { type: 'CATEGORY_UPDATED'; name: string; savePath: string }
  | { type: 'CATEGORY_DELETED'; names: string[] };
```

Then extend the `AppCommand` union to include both:

```ts
export type AppCommand =
  | UiCommand
  | TorrentCommand
  | MenuCommand
  | TransferLimitCommand
  | ServerCommand
  | TagCommand
  | CategoryCommand
  | UpdateCommand;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/command.model.spec.ts'`
Expected: PASS

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/models/command.model.ts packages/app/src/app/models/command.model.spec.ts
git commit -m "#341: add TagCommand and CategoryCommand to the command bus"
```

---

## Task 2: TagCommandHandlerService

**Files:**

- Create: `packages/app/src/app/services/tag-command-handler.service.ts`
- Create: `packages/app/src/app/services/tag-command-handler.service.spec.ts`
- Modify: `packages/app/src/app/app.ts`

**Interfaces:**

- Consumes: `TagCommand` (Task 1), `CommandBusService.commands$: Observable<AppCommand>` (existing), `ToastService`/whatever toast service `ServerCommandHandlerService` uses (mirror it exactly), `TorrentStoreService` or wherever tag data should be refreshed from (this handler does not own tag _data_ - each grid loads its own tags via `QbService`; this handler's job is purely the toast + notifying the grid to refetch, via re-emitting nothing further - the grid component itself listens to `commands$` directly to know when to reload, exactly like `ServerCommandHandlerService` doesn't push data back into `ServerStoreService` reactively beyond calling `refresh()`).
- Produces: `TagCommandHandlerService.start(): void`, injected and started from `app.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/services/tag-command-handler.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { AppCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { TagCommandHandlerService } from './tag-command-handler.service';
import { ToastService } from './toast.service';

describe('TagCommandHandlerService', () => {
  let service: TagCommandHandlerService;
  let commands$: Subject<AppCommand>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    commands$ = new Subject<AppCommand>();
    toastService = jasmine.createSpyObj('ToastService', ['show']);

    TestBed.configureTestingModule({
      providers: [
        TagCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$ } },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(TagCommandHandlerService);
  });

  it('toasts on TAG_ADDED', () => {
    service.start();
    commands$.next({ type: 'TAG_ADDED', names: ['linux', 'ubuntu'] });
    expect(toastService.show).toHaveBeenCalled();
  });

  it('toasts on TAG_DELETED', () => {
    service.start();
    commands$.next({ type: 'TAG_DELETED', names: ['linux'] });
    expect(toastService.show).toHaveBeenCalled();
  });

  it('ignores unrelated commands', () => {
    service.start();
    commands$.next({ type: 'SERVER_DELETED', id: 'srv-1' } as AppCommand);
    expect(toastService.show).not.toHaveBeenCalled();
  });
});
```

Note for the implementer: check the exact injected toast service name/method and constructor-injection style used in `server-command-handler.service.ts` (via the earlier research it uses some `ToastService`-equivalent - confirm the exact class name and `.show(...)` call signature there and mirror it exactly here; adjust this test's spy method name to match).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/tag-command-handler.service.spec.ts'`
Expected: FAIL - `tag-command-handler.service` module not found.

- [ ] **Step 3: Implement the service**

Create `packages/app/src/app/services/tag-command-handler.service.ts`, mirroring `server-command-handler.service.ts`'s structure exactly (same injected `CommandBusService`, same toast-service injection, same `filter(cmd => cmd.type.startsWith('TAG_'))` + `concatMap` pipeline pattern, same `Subscription`-holding `start()`/cleanup shape):

```ts
import { Injectable, inject } from '@angular/core';
import { concatMap, filter, of } from 'rxjs';
import type { TagCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TagCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);

  start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd): cmd is TagCommand => cmd.type.startsWith('TAG_')),
        concatMap((cmd) => this.handle(cmd)),
      )
      .subscribe();
  }

  private handle(cmd: TagCommand) {
    switch (cmd.type) {
      case 'TAG_ADDED':
        this.toastService.show({
          title: 'components.modals.manage-tags.toast.added-title',
          message: {
            text: 'components.modals.manage-tags.toast.added',
            data: { count: cmd.names.length },
          },
        });
        break;
      case 'TAG_DELETED':
        this.toastService.show({
          title: 'components.modals.manage-tags.toast.deleted-title',
          message: {
            text: 'components.modals.manage-tags.toast.deleted',
            data: { count: cmd.names.length },
          },
        });
        break;
    }
    return of(void 0);
  }
}
```

Before finalizing, the implementer must open `packages/app/src/app/services/server-command-handler.service.ts` and match: the exact toast-service class name/import path, its `.show(...)` parameter shape (title/message keys vs. plain strings), and whether it uses `concatMap` or a simpler `tap`. Adjust this file to match that exact convention rather than inventing a new one - the goal is bit-for-bit architectural parity with the Server handler.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/tag-command-handler.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Wire into app.ts**

In `packages/app/src/app/app.ts`, add the import and injection next to `serverCommandHandlerService`:

```ts
import { TagCommandHandlerService } from './services/tag-command-handler.service';
// ...
private readonly tagCommandHandlerService = inject(TagCommandHandlerService);
```

And next to `this.serverCommandHandlerService.start();`:

```ts
this.tagCommandHandlerService.start();
```

- [ ] **Step 6: Manual smoke check**

Run: `npm start`, open Manage Tags, add a tag, confirm a toast appears and no console errors. (Full add-flow wiring lands in Task 7/8; for now this just confirms the handler is subscribed - it's fine if nothing calls it yet.)

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/services/tag-command-handler.service.ts packages/app/src/app/services/tag-command-handler.service.spec.ts packages/app/src/app/app.ts
git commit -m "#341: add TagCommandHandlerService"
```

---

## Task 3: CategoryCommandHandlerService

**Files:**

- Create: `packages/app/src/app/services/category-command-handler.service.ts`
- Create: `packages/app/src/app/services/category-command-handler.service.spec.ts`
- Modify: `packages/app/src/app/app.ts`

**Interfaces:**

- Consumes: `CategoryCommand` (Task 1).
- Produces: `CategoryCommandHandlerService.start(): void`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/services/category-command-handler.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { AppCommand } from '../models/command.model';
import { CategoryCommandHandlerService } from './category-command-handler.service';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

describe('CategoryCommandHandlerService', () => {
  let service: CategoryCommandHandlerService;
  let commands$: Subject<AppCommand>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    commands$ = new Subject<AppCommand>();
    toastService = jasmine.createSpyObj('ToastService', ['show']);

    TestBed.configureTestingModule({
      providers: [
        CategoryCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$ } },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(CategoryCommandHandlerService);
  });

  it('toasts on CATEGORY_ADDED', () => {
    service.start();
    commands$.next({ type: 'CATEGORY_ADDED', name: 'movies', savePath: '/data/movies' });
    expect(toastService.show).toHaveBeenCalled();
  });

  it('toasts on CATEGORY_DELETED', () => {
    service.start();
    commands$.next({ type: 'CATEGORY_DELETED', names: ['movies'] });
    expect(toastService.show).toHaveBeenCalled();
  });

  it('does NOT toast on CATEGORY_UPDATED success (result already visible in the grid cell)', () => {
    service.start();
    commands$.next({ type: 'CATEGORY_UPDATED', name: 'movies', savePath: '/data/movies2' });
    expect(toastService.show).not.toHaveBeenCalled();
  });

  it('ignores unrelated commands', () => {
    service.start();
    commands$.next({ type: 'TAG_ADDED', names: ['linux'] } as AppCommand);
    expect(toastService.show).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/category-command-handler.service.spec.ts'`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the service**

Create `packages/app/src/app/services/category-command-handler.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { concatMap, filter, of } from 'rxjs';
import type { CategoryCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class CategoryCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);

  start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd): cmd is CategoryCommand => cmd.type.startsWith('CATEGORY_')),
        concatMap((cmd) => this.handle(cmd)),
      )
      .subscribe();
  }

  private handle(cmd: CategoryCommand) {
    switch (cmd.type) {
      case 'CATEGORY_ADDED':
        this.toastService.show({
          title: 'components.modals.manage-categories.toast.added-title',
          message: {
            text: 'components.modals.manage-categories.toast.added',
            data: { name: cmd.name },
          },
        });
        break;
      case 'CATEGORY_DELETED':
        this.toastService.show({
          title: 'components.modals.manage-categories.toast.deleted-title',
          message: {
            text: 'components.modals.manage-categories.toast.deleted',
            data: { count: cmd.names.length },
          },
        });
        break;
      case 'CATEGORY_UPDATED':
        // No toast: the inline-edited save-path cell already shows the new value (CLAUDE.md toast rule).
        break;
    }
    return of(void 0);
  }
}
```

Match this file's toast-service usage to whatever exact convention Task 2 settled on (same class/method names).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/category-command-handler.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Wire into app.ts**

Add next to the Task 2 wiring in `packages/app/src/app/app.ts`:

```ts
import { CategoryCommandHandlerService } from './services/category-command-handler.service';
// ...
private readonly categoryCommandHandlerService = inject(CategoryCommandHandlerService);
// ...
this.categoryCommandHandlerService.start();
```

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/services/category-command-handler.service.ts packages/app/src/app/services/category-command-handler.service.spec.ts packages/app/src/app/app.ts
git commit -m "#341: add CategoryCommandHandlerService"
```

---

## Task 4: ManageServersGridSettingsService

**Files:**

- Create: `packages/app/src/app/services/manage-servers-grid.settings.service.ts`
- Create: `packages/app/src/app/services/manage-servers-grid.settings.service.spec.ts`

**Interfaces:**

- Consumes: `BaseSettingsService<T>` (existing, `packages/app/src/app/services/base-settings.service.ts`).
- Produces: `ManageServersGridSettingsService` with `.load(): Promise<ManageServersGridSettings>`, `.save(settings: ManageServersGridSettings): Promise<void>`, `.asObservable(): Observable<ManageServersGridSettings>` (whichever subset of `BaseSettingsService`'s public API `TrackersGridSettingsService` exposes - mirror it exactly), and the `ManageServersGridSettings` interface (`{ columnState: ColumnState[]; filterModel: FilterModel | null }`), consumed by Task 5.

- [ ] **Step 1: Write the failing test**

First, open `packages/app/src/app/services/trackers-grid.settings.service.spec.ts` (or the equivalent existing spec for whichever grid settings service was used as the template) and copy its structure - it already establishes the correct `BaseSettingsService` mocking pattern for this repo. Adapt it into `packages/app/src/app/services/manage-servers-grid.settings.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_MANAGE_SERVERS_GRID_SETTINGS,
  ManageServersGridSettingsService,
} from './manage-servers-grid.settings.service';
import { SettingsService } from './settings.service';

describe('ManageServersGridSettingsService', () => {
  let service: ManageServersGridSettingsService;
  let settingsService: jasmine.SpyObj<SettingsService>;

  beforeEach(() => {
    settingsService = jasmine.createSpyObj('SettingsService', ['get', 'upsert']);
    settingsService.get.and.resolveTo(null);

    TestBed.configureTestingModule({
      providers: [
        ManageServersGridSettingsService,
        { provide: SettingsService, useValue: settingsService },
      ],
    });

    service = TestBed.inject(ManageServersGridSettingsService);
  });

  it('loads default settings when nothing is persisted', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_MANAGE_SERVERS_GRID_SETTINGS);
  });

  it('saves settings under its own SETTINGS_ID', async () => {
    const settings = { columnState: [{ colId: 'name', hide: false }], filterModel: null };
    await service.save(settings as never);
    expect(settingsService.upsert).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 'ManageServersGridSettingsService' }),
    );
  });
});
```

Adjust the spy method names (`get`/`upsert`) to whatever `SettingsService`/`BaseSettingsService` actually calls - confirm against the real `trackers-grid.settings.service.spec.ts` before finalizing this file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-servers-grid.settings.service.spec.ts'`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the service**

Create `packages/app/src/app/services/manage-servers-grid.settings.service.ts`:

```ts
import { Injectable } from '@angular/core';
import type { ColumnState, FilterModel } from 'ag-grid-community';
import { BaseSettingsService } from './base-settings.service';

export interface ManageServersGridSettings {
  columnState: ColumnState[];
  filterModel: FilterModel | null;
}

export const DEFAULT_MANAGE_SERVERS_GRID_SETTINGS: ManageServersGridSettings = {
  columnState: [],
  filterModel: null,
};

@Injectable({ providedIn: 'root' })
export class ManageServersGridSettingsService extends BaseSettingsService<ManageServersGridSettings> {
  protected readonly SETTINGS_ID = 'ManageServersGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_MANAGE_SERVERS_GRID_SETTINGS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-servers-grid.settings.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/services/manage-servers-grid.settings.service.ts packages/app/src/app/services/manage-servers-grid.settings.service.spec.ts
git commit -m "#341: add ManageServersGridSettingsService"
```

---

## Task 5: Manage Servers grid - scaffold, columns, persistence, selection

**Files:**

- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.ts`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.html`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.scss`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts` (modal `size`)

**Interfaces:**

- Consumes: `ManageServersGridSettingsService` (Task 4), `ServerStoreService.servers: Signal<ServerRecord[]>` and `.currentServerId: Signal<string | null>` (existing), `TextColumnFilter`/`NumberColumnFilter`/`SetColumnFilter`/`BooleanColumnFilter` (existing, `packages/app/src/app/components/column-filters/`), `GridContextMenuService.buildHeaderMenu()` and `ContextMenuService.open()` (existing).
- Produces: a working read-only grid (columns, filters, sort, persisted column state, checkbox selection with the active row's checkbox disabled) that Task 6 adds actions on top of. Exposes `selectedServers: Signal<ServerRecord[]>` and `computed()` enable flags `canEdit`, `canDelete`, `canConnect` for Task 6 to wire buttons to.

- [ ] **Step 1: Write the failing test for the active-row checkbox-disable rule**

Open the existing `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts` and add (adapting existing TestBed setup/mocks already in that file for `ServerStoreService`, `NgbActiveModal`, etc.):

```ts
it('disables row selection for the active server', () => {
  serverStoreService.servers.set([
    {
      id: 'srv-1',
      name: 'Home',
      host: '1.2.3.4' /* ...other required ServerRecord fields */,
    } as never,
    { id: 'srv-2', name: 'Away', host: '5.6.7.8' } as never,
  ]);
  serverStoreService.currentServerId.set('srv-1');

  fixture.detectChanges();

  expect(component.isRowSelectable({ data: { id: 'srv-1' } } as never)).toBe(false);
  expect(component.isRowSelectable({ data: { id: 'srv-2' } } as never)).toBe(true);
});

it('computes canDelete as true only when at least one row is selected', () => {
  component.selectedServers.set([]);
  expect(component.canDelete()).toBe(false);

  component.selectedServers.set([{ id: 'srv-2' } as never]);
  expect(component.canDelete()).toBe(true);
});

it('computes canEdit and canConnect as true only when exactly one row is selected', () => {
  component.selectedServers.set([]);
  expect(component.canEdit()).toBe(false);
  expect(component.canConnect()).toBe(false);

  component.selectedServers.set([{ id: 'srv-2' } as never]);
  expect(component.canEdit()).toBe(true);
  expect(component.canConnect()).toBe(true);

  component.selectedServers.set([{ id: 'srv-2' } as never, { id: 'srv-3' } as never]);
  expect(component.canEdit()).toBe(false);
  expect(component.canConnect()).toBe(false);
});

it('flushes a pending debounced column-state save immediately on destroy (Review Focus: unsaved layout changes lost on quick close)', () => {
  const api = {
    getColumnState: () => [{ colId: 'name', hide: false }],
    getFilterModel: () => null,
  } as never;
  component.onGridReady({ api } as never);
  component.onColumnChanged(); // queues a debounced save; the 500ms timer has not fired yet

  component.ngOnDestroy();

  expect(manageServersGridSettingsService.save).toHaveBeenCalledWith({
    columnState: [{ colId: 'name', hide: false }],
    filterModel: null,
  });
});
```

This last test needs a `ManageServersGridSettingsService` spy (`manageServersGridSettingsService = jasmine.createSpyObj('ManageServersGridSettingsService', ['load', 'save']); manageServersGridSettingsService.load.and.resolveTo({ columnState: [], filterModel: null });`) added to the spec file's existing `TestBed.configureTestingModule` providers, alongside the other service mocks it already has.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-servers.spec.ts'`
Expected: FAIL - `isRowSelectable`, `selectedServers`, `canDelete`, `canEdit`, `canConnect` don't exist yet.

- [ ] **Step 3: Rewrite manage-servers.ts scaffold**

Replace the body of `packages/app/src/app/modals/manage-servers/manage-servers.ts` with (keeping the existing `hideConnect = input(false)` and constructor-injected services that are still needed - `ServerStoreService`, `NgbActiveModal`, `CommandBusService`, `ConfirmService`, `NgbModal`, `TranslateService`; drop `GuardableModal` implementation since there's no longer a persistent dirty form in this component):

```ts
import { Component, ViewChild, computed, inject, input, signal } from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  IsRowSelectable,
  RowClassParams,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { BooleanColumnFilter } from '../../components/column-filters/boolean-column-filter';
import { NumberColumnFilter } from '../../components/column-filters/number-column-filter';
import {
  SetColumnFilter,
  buildValueCounts,
} from '../../components/column-filters/set-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import {
  type ManageServersGridSettings,
  ManageServersGridSettingsService,
} from '../../services/manage-servers-grid.settings.service';
import { ServerStoreService } from '../../services/server-store.service';

@Component({
  selector: 'app-manage-servers',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './manage-servers.html',
  styleUrl: './manage-servers.scss',
})
export class ManageServers {
  readonly hideConnect = input(false);

  @ViewChild(AgGridAngular) private readonly grid?: AgGridAngular<ServerRecord>;

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly settingsService = inject(ManageServersGridSettingsService);
  protected readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  private gridApi?: GridApi<ServerRecord>;
  private saveTimer?: ReturnType<typeof setTimeout>;

  readonly servers = this.serverStoreService.servers;
  readonly selectedServers = signal<ServerRecord[]>([]);

  readonly canEdit = computed(() => this.selectedServers().length === 1);
  readonly canConnect = computed(() => !this.hideConnect() && this.selectedServers().length === 1);
  readonly canDelete = computed(() => this.selectedServers().length >= 1);

  readonly isRowSelectable: IsRowSelectable<ServerRecord> = (row) =>
    row.data?.id !== this.serverStoreService.currentServerId();

  readonly getRowId = (params: GetRowIdParams<ServerRecord>) => params.data.id;

  readonly rowClassRules = {
    'bb-row-active': (params: RowClassParams<ServerRecord>) =>
      !this.hideConnect() && params.data?.id === this.serverStoreService.currentServerId(),
  };

  readonly colDefs = computed<ColDef<ServerRecord>[]>(() => [
    {
      colId: 'orb',
      headerName: '',
      width: 44,
      sortable: false,
      resizable: false,
      filter: BooleanColumnFilter,
      valueGetter: (p) =>
        !this.hideConnect() && p.data?.id === this.serverStoreService.currentServerId(),
      cellRenderer: 'agCheckboxCellRenderer', // replaced by a dedicated orb renderer in Task 6
    },
    {
      colId: 'name',
      field: 'name',
      headerName: this.translateService.instant('components.modals.manage-servers.column.name'),
      filter: TextColumnFilter,
    },
    {
      colId: 'host',
      field: 'host',
      headerName: this.translateService.instant('components.modals.manage-servers.column.host'),
      filter: TextColumnFilter,
    },
    {
      colId: 'port',
      field: 'port',
      headerName: this.translateService.instant('components.modals.manage-servers.column.port'),
      filter: NumberColumnFilter,
    },
    {
      colId: 'protocol',
      field: 'protocol',
      headerName: this.translateService.instant('components.modals.manage-servers.column.protocol'),
      filter: SetColumnFilter,
      filterParams: { getItems: () => buildValueCounts(this.servers(), (s) => s.protocol) },
    },
    {
      colId: 'username',
      field: 'username',
      headerName: this.translateService.instant('components.modals.manage-servers.column.username'),
      filter: TextColumnFilter,
    },
    {
      colId: 'auto_login',
      field: 'auto_login',
      headerName: this.translateService.instant('components.modals.manage-servers.column.default'),
      filter: BooleanColumnFilter,
      cellRenderer: 'agCheckboxCellRenderer', // replaced by the click-to-toggle renderer in Task 6
    },
    {
      colId: 'id',
      field: 'id',
      headerName: this.translateService.instant('components.modals.manage-servers.column.id'),
      filter: TextColumnFilter,
      hide: true,
    },
  ]);

  readonly gridOptions = {
    rowSelection: { mode: 'multiRow' as const, checkboxes: true, headerCheckbox: true },
    isRowSelectable: this.isRowSelectable,
    getRowId: this.getRowId,
    rowClassRules: this.rowClassRules,
    preventDefaultOnContextMenu: true,
    suppressContextMenu: true,
  };

  async onGridReady(event: GridReadyEvent<ServerRecord>): Promise<void> {
    this.gridApi = event.api;
    const settings = await this.settingsService.load();
    if (settings.columnState.length) {
      event.api.applyColumnState({ state: settings.columnState, applyOrder: true });
    }
    if (settings.filterModel) {
      event.api.setFilterModel(settings.filterModel);
    }
  }

  onColumnChanged(): void {
    this.queueSave();
  }

  onFilterChanged(): void {
    this.queueSave();
  }

  onSelectionChanged(event: SelectionChangedEvent<ServerRecord>): void {
    this.selectedServers.set(event.api.getSelectedRows());
  }

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 500);
  }

  private persist(): void {
    if (!this.gridApi) return;
    const settings: ManageServersGridSettings = {
      columnState: this.gridApi.getColumnState(),
      filterModel: this.gridApi.getFilterModel(),
    };
    void this.settingsService.save(settings);
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.persist();
    }
  }
}
```

Note for the implementer: confirm the exact import path/name for `ServerRecord` (research found it defined in `packages/shared/src/models/server.model.ts` and re-exported from `@bitbutler/shared`) and `buildValueCounts` (exported from `set-column-filter.ts`) against the actual files before compiling - use whatever the real export names are if they differ slightly from what's written here.

- [ ] **Step 4: Rewrite manage-servers.html**

Replace the `<ul class="list-group ...">` block in `packages/app/src/app/modals/manage-servers/manage-servers.html` with the ag-grid element (keep the existing `bb-modal-header`/title markup and the footer's overall wrapper - Task 6 fills in the footer buttons):

```html
<div class="modal-body">
  <ag-grid-angular
    class="ag-theme-bitbutler bb-manage-grid"
    [rowData]="servers()"
    [columnDefs]="colDefs()"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (sortChanged)="onColumnChanged()"
    (columnMoved)="onColumnChanged()"
    (columnResized)="onColumnChanged()"
    (columnPinned)="onColumnChanged()"
    (columnVisible)="onColumnChanged()"
    (filterChanged)="onFilterChanged()"
    (selectionChanged)="onSelectionChanged($event)"
  />
</div>
```

- [ ] **Step 5: Update manage-servers.scss**

Add a minimal rule so the active row is visually distinguishable (final orb styling lands in Task 6):

```scss
.bb-row-active {
  font-weight: 600;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-servers.spec.ts'`
Expected: PASS. Fix any remaining references in the spec file to the old list-group-based template/methods (e.g. `filterControl`, `filteredServers`) that Task 5 removed - replace or delete those obsolete tests, since the filter box is now the grid's own per-column filters.

- [ ] **Step 7: Size the modal for the grid**

In `packages/app/src/app/services/ui-command-handler.service.ts`, find the `UI_MANAGE_SERVERS` case block and add `size: 'xl'` to its `modalService.open(ManageServers, { ... })` options object (it currently opens with no explicit `size`, sized for the old narrow list UI - the grid needs the room).

- [ ] **Step 8: Manual check**

Run: `npm start`, open Manage Servers. Confirm: the modal opens noticeably wider (xl), grid renders with servers, columns are sortable/resizable/reorderable, the active server's checkbox is disabled, reopening the modal after reordering a column keeps the new order.

- [ ] **Step 9: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/modals/manage-servers/ packages/app/src/app/services/ui-command-handler.service.ts
git commit -m "#341: rebuild manage servers modal on ag-grid"
```

---

## Task 6: Manage Servers grid - actions (New/Edit/Connect/Delete, renderers, context menus)

**Files:**

- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.ts`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.html`
- Create: `packages/app/src/app/modals/manage-servers/active-orb-renderer.ts`
- Create: `packages/app/src/app/modals/manage-servers/default-toggle-renderer.ts`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts`

**Interfaces:**

- Consumes: `ServerEditor` modal (existing, `packages/app/src/app/modals/server-editor/server-editor.ts`), `ServerService` (existing, for the toggle and via `ServerEditor`), `CredentialPromptService` (existing), `ContextMenuService`/`GridContextMenuService` (existing), `ManageServers.canEdit/canConnect/canDelete/selectedServers` (Task 5).
- Produces: fully interactive Manage Servers grid matching the spec.

- [ ] **Step 1: Write failing tests for the action methods**

Add to `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts`:

```ts
it('emits SERVER_ADDED after creating a new server via ServerEditor', async () => {
  modalService.open.and.returnValue({ result: Promise.resolve('new-id') } as never);
  await component.openNew();
  expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_ADDED', id: 'new-id' });
});

it('does not emit SERVER_ADDED when ServerEditor is dismissed', async () => {
  modalService.open.and.returnValue({ result: Promise.reject('dismissed') } as never);
  await component.openNew();
  expect(commandBusService.emit).not.toHaveBeenCalled();
});

it('deletes all selected servers after confirmation, one SERVER_DELETED per id', async () => {
  confirmService.confirm.and.resolveTo(true);
  component.selectedServers.set([{ id: 'srv-2' } as never, { id: 'srv-3' } as never]);

  await component.deleteSelected();

  expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'srv-2' });
  expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'srv-3' });
});

it('does not delete when confirmation is declined', async () => {
  confirmService.confirm.and.resolveTo(false);
  component.selectedServers.set([{ id: 'srv-2' } as never]);

  await component.deleteSelected();

  expect(commandBusService.emit).not.toHaveBeenCalled();
});

it('connects without closing the modal', async () => {
  const closeSpy = spyOn(activeModal, 'close');
  component.selectedServers.set([{ id: 'srv-2', name: 'Away' } as never]);

  await component.connectSelected();

  expect(closeSpy).not.toHaveBeenCalled();
});

it("toggles a server's auto_login flag and emits SERVER_UPDATED", async () => {
  serverService.update.and.resolveTo(undefined);
  const server = { id: 'srv-2', auto_login: false } as never;

  await component.toggleDefault(server);

  expect(serverService.update).toHaveBeenCalledWith('srv-2', { auto_login: true });
  expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-2' });
});

it('disables Connect when hideConnect is true, even with exactly one row selected (Review: login-page usage must not imply a live connection switch)', () => {
  fixture.componentRef.setInput('hideConnect', true);
  component.selectedServers.set([{ id: 'srv-2' } as never]);

  expect(component.canConnect()).toBe(false);
});

it('omits Connect and Set as Default from the row context menu when hideConnect is true', () => {
  fixture.componentRef.setInput('hideConnect', true);
  contextMenuService.open.calls.reset();

  component['onCellContextMenu']({ data: { id: 'srv-2' } } as never);

  const [{ items }] = contextMenuService.open.calls.mostRecent().args as [
    { items: { label: string }[] },
  ];
  expect(items.some((i) => i.label === 'general.button.connect')).toBe(false);
  expect(
    items.some((i) => i.label === 'components.modals.manage-servers.tooltip.set-as-default'),
  ).toBe(false);
});
```

These four tests need `serverService` (a `ServerService` spy with `update`) and `contextMenuService` (a `ContextMenuService` spy with `open`) added to the spec file's `TestBed` providers, alongside the mocks it already has.

(Adapt to whatever mock names already exist in the spec file for `NgbModal`/`ConfirmService`/`CommandBusService`/`NgbActiveModal` - the file already mocks these for the pre-existing `openEditor`/`delete`/`switchTo` tests; these new tests replace those, renamed to the new method names below.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-servers.spec.ts'`
Expected: FAIL - `openNew`, `deleteSelected`, `connectSelected` don't exist yet.

- [ ] **Step 3: Implement the active-orb cell renderer**

Create `packages/app/src/app/modals/manage-servers/active-orb-renderer.ts`:

```ts
import { Component } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-active-orb-renderer',
  standalone: true,
  template: `<span class="bb-orb" [class.bb-orb-active]="active"></span>`,
  styles: [
    `
      .bb-orb {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid var(--bs-secondary);
      }
      .bb-orb-active {
        background: var(--bs-success);
        border-color: var(--bs-success);
      }
    `,
  ],
})
export class ActiveOrbRenderer implements ICellRendererAngularComp {
  active = false;

  agInit(params: ICellRendererParams<unknown, boolean>): void {
    this.active = params.value === true;
  }

  refresh(params: ICellRendererParams<unknown, boolean>): boolean {
    this.active = params.value === true;
    return true;
  }
}
```

- [ ] **Step 4: Implement the click-to-toggle Default cell renderer**

Create `packages/app/src/app/modals/manage-servers/default-toggle-renderer.ts`:

```ts
import { Component } from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

export interface DefaultToggleParams extends ICellRendererParams<ServerRecord, boolean> {
  onToggle: (server: ServerRecord) => void;
}

@Component({
  selector: 'app-default-toggle-renderer',
  standalone: true,
  template: `
    <button
      type="button"
      class="btn btn-sm btn-link p-0"
      (click)="toggle()"
      [attr.aria-pressed]="checked"
    >
      <fa-icon [icon]="checked ? faStar : faStarRegular" />
    </button>
  `,
})
export class DefaultToggleRenderer implements ICellRendererAngularComp {
  private params!: DefaultToggleParams;
  checked = false;
  readonly faStar = { prefix: 'fas', iconName: 'star' } as never;
  readonly faStarRegular = { prefix: 'far', iconName: 'star' } as never;

  agInit(params: DefaultToggleParams): void {
    this.params = params;
    this.checked = params.value === true;
  }

  refresh(params: DefaultToggleParams): boolean {
    this.params = params;
    this.checked = params.value === true;
    return true;
  }

  toggle(): void {
    if (this.params.data) this.params.onToggle(this.params.data);
  }
}
```

Note for the implementer: replace the placeholder `faStar`/`faStarRegular` objects with real imports from `@fortawesome/free-solid-svg-icons` / `@fortawesome/free-regular-svg-icons` (`faStar`, `faStar as faStarRegular` from the regular package) and the `FaIconComponent` import in `imports: []`, matching how other components in this codebase import FontAwesome icons (check any existing modal for the exact import pattern, e.g. `server-editor.ts`).

- [ ] **Step 5: Wire renderers and actions into manage-servers.ts**

Modify the `colDefs` computed in `packages/app/src/app/modals/manage-servers/manage-servers.ts`: change the `orb` column's `cellRenderer` to `ActiveOrbRenderer`, and the `auto_login` column's `cellRenderer` to `DefaultToggleRenderer` with `cellRendererParams: { onToggle: (server: ServerRecord) => this.toggleDefault(server) }`.

Add the action methods to the class:

```ts
async openNew(): Promise<void> {
  const { ServerEditor } = await import('../server-editor/server-editor');
  const ref = this.modalService.open(ServerEditor, { size: 'lg' });
  try {
    const id = await ref.result;
    this.commandBusService.emit({ type: 'SERVER_ADDED', id });
  } catch {
    // dismissed - no-op
  }
}

async openEdit(): Promise<void> {
  const [server] = this.selectedServers();
  if (!server) return;
  const { ServerEditor } = await import('../server-editor/server-editor');
  const ref = this.modalService.open(ServerEditor, { size: 'lg' });
  ref.componentInstance.id = server.id;
  await ref.result.catch(() => {});
}

async toggleDefault(server: ServerRecord): Promise<void> {
  await this.serverService.update(server.id, { auto_login: !server.auto_login });
  this.commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id });
}

async connectSelected(): Promise<void> {
  const [server] = this.selectedServers();
  if (!server) return;
  await this.serverConnectService.switchTo(server);
}

async deleteSelected(): Promise<void> {
  const servers = this.selectedServers();
  if (!servers.length) return;
  const confirmed = await this.confirmService.confirm(
    'components.modals.manage-servers.delete-confirm.title',
    { text: 'components.modals.manage-servers.delete-confirm.message', data: { count: servers.length } },
    'general.button.delete',
    undefined,
    undefined,
    this.faTrashCan,
  );
  if (!confirmed) return;
  for (const server of servers) {
    this.commandBusService.emit({ type: 'SERVER_DELETED', id: server.id });
  }
}
```

Note for the implementer: `switchTo()`'s actual existing logic (credential-prompt flow, error handling) lives today in `manage-servers.ts:106-144` - move that logic into a small `connectSelected()` (or extract into a `ServerConnectService` if `switchTo` is also needed elsewhere; check first whether any other component calls `ManageServers.switchTo` directly - if not, inlining it into `connectSelected()` on this component is simpler and avoids a new service) **with its `this.activeModal.dismiss()` call removed** so the modal stays open after a successful connect, per the spec. Inject `ServerService` (for `toggleDefault`) and whatever service the original `switchTo()` used for `CredentialPromptService`/connection-switching, and `faTrashCan` from `@fortawesome/free-solid-svg-icons` (already used elsewhere in the app for delete-confirm icons, e.g. `manage-tags.ts`).

- [ ] **Step 6: Add row and header context menus**

Add to `manage-servers.ts`:

```ts
private readonly contextMenuService = inject(ContextMenuService);
private readonly gridContextMenuService = inject(GridContextMenuService);

onCellContextMenu(event: CellContextMenuEvent<ServerRecord>): void {
  if (!event.data) return;
  const server = event.data;
  const isActive = !this.hideConnect() && server.id === this.serverStoreService.currentServerId();
  this.contextMenuService.open({
    items: [
      ...(this.hideConnect()
        ? []
        : [
            { kind: 'item' as const, label: 'general.button.connect', action: () => { this.selectedServers.set([server]); void this.connectSelected(); } },
            { kind: 'item' as const, label: 'components.modals.manage-servers.tooltip.set-as-default', action: () => void this.toggleDefault(server) },
            { kind: 'divider' as const },
          ]),
      { kind: 'item' as const, label: 'general.button.edit', action: () => { this.selectedServers.set([server]); void this.openEdit(); } },
      ...(isActive ? [] : [{ kind: 'item' as const, label: 'general.button.delete', action: () => { this.selectedServers.set([server]); void this.deleteSelected(); } }]),
    ],
  });
}

onColumnHeaderContextMenu(event: ColumnHeaderContextMenuEvent<ServerRecord>): void {
  if (!event.column) return;
  this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
}
```

Wire both into the template's `gridOptions`: add `onCellContextMenu: (e) => this.onCellContextMenu(e)` and `onColumnHeaderContextMenu: (e) => this.onColumnHeaderContextMenu(e)` to the `gridOptions` object from Task 5.

Note for the implementer: confirm the exact `ContextMenuEntry` field names (`kind`/`label`/`action` per the spec's research) against `context-menu.types.ts` before finalizing - adjust field names if they differ.

- [ ] **Step 7: Add row double-click**

Add `onRowDoubleClicked: (e) => { if (e.data) { this.selectedServers.set([e.data]); void this.openEdit(); } }` to `gridOptions`.

- [ ] **Step 8: Add the footer buttons**

In `manage-servers.html`, add the footer (after the `modal-body`):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-secondary btn-sm" (click)="openNew()">
    {{ 'general.button.new' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-secondary btn-sm"
    [disabled]="!canEdit()"
    (click)="openEdit()"
  >
    {{ 'general.button.edit' | translate }}
  </button>
  @if (!hideConnect()) {
  <button
    type="button"
    class="btn btn-secondary btn-sm"
    [disabled]="!canConnect()"
    (click)="connectSelected()"
  >
    {{ 'general.button.connect' | translate }}
  </button>
  }
  <button
    type="button"
    class="btn btn-danger btn-sm"
    [disabled]="!canDelete()"
    (click)="deleteSelected()"
  >
    {{ 'general.button.delete' | translate }}
  </button>
  <button type="button" class="btn btn-secondary btn-sm ms-auto" (click)="activeModal.close()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-servers.spec.ts'`
Expected: PASS

- [ ] **Step 10: Add i18n keys**

In `packages/app/public/i18n/us.json`, under `components.modals.manage-servers`, add (alongside existing keys like `title`/`button.connect`/`tooltip.active`): `column.name`, `column.host`, `column.port`, `column.protocol`, `column.username`, `column.default`, `column.id`, `delete-confirm.title`, `delete-confirm.message`. Add a matching `general.button.new`, `general.button.edit`, `general.button.connect` if any don't already exist under the `general.button` root (check first - `general.button.delete`/`.close` almost certainly already exist given their reuse across the app). Mirror every new key into `packages/app/public/i18n/hu.json` with Hungarian translations.

- [ ] **Step 11: Manual check**

Run: `npm start`. Verify: New opens ServerEditor and a created server appears with a toast; Edit opens prefilled; Connect switches server without closing the modal, and triggers the credential prompt when needed; Default toggles on click; Delete removes selected servers after confirming, and is unavailable for the active server; right-click on a row and on a header both show the expected menus.

- [ ] **Step 12: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/modals/manage-servers/ packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#341: add actions, renderers, and context menus to manage servers grid"
```

---

## Task 7: ManageTagsGridSettingsService and TagEditor modal

**Files:**

- Create: `packages/app/src/app/services/manage-tags-grid.settings.service.ts`
- Create: `packages/app/src/app/services/manage-tags-grid.settings.service.spec.ts`
- Create: `packages/app/src/app/modals/tag-editor/tag-editor.ts`
- Create: `packages/app/src/app/modals/tag-editor/tag-editor.html`
- Create: `packages/app/src/app/modals/tag-editor/tag-editor.spec.ts`

**Interfaces:**

- Consumes: `BaseSettingsService<T>`, `QbService.torrents.createTags(serverId, names): Promise<void>` (existing), `TagCommand` (Task 1).
- Produces: `ManageTagsGridSettingsService` (same shape as Task 4's service), `TagEditor` modal component that, on save, calls `createTags` and emits `TAG_ADDED`, consumed by Task 8.

- [ ] **Step 1: Write the failing settings-service test**

Create `packages/app/src/app/services/manage-tags-grid.settings.service.spec.ts`, copying Task 4's test structure exactly but for `ManageTagsGridSettingsService`/`DEFAULT_MANAGE_TAGS_GRID_SETTINGS`/`'ManageTagsGridSettingsService'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-tags-grid.settings.service.spec.ts'`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the settings service**

Create `packages/app/src/app/services/manage-tags-grid.settings.service.ts`, identical in shape to Task 4's file:

```ts
import { Injectable } from '@angular/core';
import type { ColumnState, FilterModel } from 'ag-grid-community';
import { BaseSettingsService } from './base-settings.service';

export interface ManageTagsGridSettings {
  columnState: ColumnState[];
  filterModel: FilterModel | null;
}

export const DEFAULT_MANAGE_TAGS_GRID_SETTINGS: ManageTagsGridSettings = {
  columnState: [],
  filterModel: null,
};

@Injectable({ providedIn: 'root' })
export class ManageTagsGridSettingsService extends BaseSettingsService<ManageTagsGridSettings> {
  protected readonly SETTINGS_ID = 'ManageTagsGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_MANAGE_TAGS_GRID_SETTINGS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-tags-grid.settings.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Write the failing TagEditor tests**

Create `packages/app/src/app/modals/tag-editor/tag-editor.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TagEditor } from './tag-editor';

describe('TagEditor', () => {
  let fixture: ComponentFixture<TagEditor>;
  let component: TagEditor;
  let qbService: jasmine.SpyObj<QbService>;
  let commandBusService: jasmine.SpyObj<CommandBusService>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    qbService = jasmine.createSpyObj('QbService', [], {
      torrents: jasmine.createSpyObj('torrents', ['createTags']),
    });
    commandBusService = jasmine.createSpyObj('CommandBusService', ['emit']);
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [TagEditor],
      providers: [
        { provide: QbService, useValue: qbService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbActiveModal, useValue: activeModal },
        {
          provide: ServerStoreService,
          useValue: { currentServer: () => ({ id: 'srv-1' }), currentServerId: () => 'srv-1' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagEditor);
    component = fixture.componentInstance;
  });

  it('splits a comma-separated input into multiple tag names, trimmed and de-duplicated of blanks', async () => {
    component.nameControl.setValue(' linux ,  ubuntu,, debian ');
    (qbService.torrents.createTags as jasmine.Spy).and.resolveTo(undefined);

    await component.save();

    expect(qbService.torrents.createTags).toHaveBeenCalledWith('srv-1', [
      'linux',
      'ubuntu',
      'debian',
    ]);
  });

  it('de-duplicates repeated names within the same submission before calling createTags (Review Focus: duplicate/overlapping tag names on create)', async () => {
    component.nameControl.setValue('linux, linux, ubuntu');
    (qbService.torrents.createTags as jasmine.Spy).and.resolveTo(undefined);

    await component.save();

    expect(qbService.torrents.createTags).toHaveBeenCalledWith('srv-1', ['linux', 'ubuntu']);
  });

  it('emits TAG_ADDED with the created names and closes on success', async () => {
    component.nameControl.setValue('linux');
    (qbService.torrents.createTags as jasmine.Spy).and.resolveTo(undefined);

    await component.save();

    expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TAG_ADDED', names: ['linux'] });
    expect(activeModal.close).toHaveBeenCalled();
  });

  it('does not call createTags or close when the input is blank', async () => {
    component.nameControl.setValue('   ');

    await component.save();

    expect(qbService.torrents.createTags).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/tag-editor.spec.ts'`
Expected: FAIL - module not found.

- [ ] **Step 7: Implement TagEditor**

Create `packages/app/src/app/modals/tag-editor/tag-editor.ts`:

```ts
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';

@Component({
  selector: 'app-tag-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './tag-editor.html',
})
export class TagEditor {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly nameControl = new FormControl('', { nonNullable: true });

  async save(): Promise<void> {
    const raw = this.nameControl.value.trim();
    if (!raw) return;

    const names = Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (!names.length) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    await this.qbService.torrents.createTags(serverId, names);
    this.commandBusService.emit({ type: 'TAG_ADDED', names });
    this.activeModal.close();
  }
}
```

- [ ] **Step 8: Implement tag-editor.html**

Create `packages/app/src/app/modals/tag-editor/tag-editor.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.tag-editor.title' | translate }}</h5>
  <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
</div>
<div class="modal-body">
  <div class="form-floating">
    <input
      type="text"
      id="tagEditorName"
      class="form-control"
      [formControl]="nameControl"
      placeholder="{{ 'components.modals.tag-editor.name-placeholder' | translate }}"
      (keydown.enter)="save()"
    />
    <label for="tagEditorName">{{ 'components.modals.tag-editor.name-label' | translate }}</label>
  </div>
</div>
<div class="modal-footer">
  <button type="button" class="btn btn-secondary btn-sm" (click)="activeModal.dismiss()">
    {{ 'general.button.cancel' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-primary btn-sm"
    [disabled]="!nameControl.value.trim()"
    (click)="save()"
  >
    {{ 'general.button.save' | translate }}
  </button>
</div>
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/tag-editor.spec.ts'`
Expected: PASS

- [ ] **Step 10: Add i18n keys**

Add `components.modals.tag-editor.title`, `.name-label`, `.name-placeholder` to both `us.json` and `hu.json`, mirroring `components.modals.server-editor`'s existing key structure/nesting style.

- [ ] **Step 11: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/services/manage-tags-grid.settings.service.ts packages/app/src/app/services/manage-tags-grid.settings.service.spec.ts packages/app/src/app/modals/tag-editor/ packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#341: add ManageTagsGridSettingsService and TagEditor modal"
```

---

## Task 8: Manage Tags grid

**Files:**

- Modify: `packages/app/src/app/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/modals/manage-tags/manage-tags.html`
- Modify: `packages/app/src/app/modals/manage-tags/manage-tags.spec.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts` (modal `size`)

**Interfaces:**

- Consumes: `ManageTagsGridSettingsService`, `TagEditor` (Task 7), `TextColumnFilter`/`NumberColumnFilter`, `QbService.torrents.tags()/deleteTags()`, `TorrentStoreService.torrentsArray()` (existing), `GridContextMenuService`/`ContextMenuService`.
- Produces: fully interactive Manage Tags grid matching the spec.

- [ ] **Step 1: Write failing tests**

Replace the relevant parts of `packages/app/src/app/modals/manage-tags/manage-tags.spec.ts` (keep whatever `ngOnInit`/data-loading tests already pass; add):

```ts
it('computes usage count per tag from torrentStoreService', () => {
  torrentStoreService.torrentsArray.and.returnValue([
    { tags: 'linux,ubuntu' } as never,
    { tags: 'linux' } as never,
    { tags: '' } as never,
  ]);
  component.tagNames.set(['linux', 'ubuntu', 'unused']);

  const rows = component.rows();

  expect(rows.find((r) => r.name === 'linux')?.usageCount).toBe(2);
  expect(rows.find((r) => r.name === 'ubuntu')?.usageCount).toBe(1);
  expect(rows.find((r) => r.name === 'unused')?.usageCount).toBe(0);
});

it('canDelete is true only when at least one row is selected', () => {
  component.selectedTags.set([]);
  expect(component.canDelete()).toBe(false);
  component.selectedTags.set([{ name: 'linux', usageCount: 0 }]);
  expect(component.canDelete()).toBe(true);
});

it('deletes all selected tags in one batched call after confirmation, aggregating the usage-count message', async () => {
  confirmService.confirm.and.resolveTo(true);
  qbService.torrents.deleteTags.and.resolveTo(undefined);
  component.selectedTags.set([
    { name: 'linux', usageCount: 2 },
    { name: 'ubuntu', usageCount: 1 },
  ]);

  await component.deleteSelected();

  expect(qbService.torrents.deleteTags).toHaveBeenCalledWith('srv-1', ['linux', 'ubuntu']);
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'TAG_DELETED',
    names: ['linux', 'ubuntu'],
  });
  expect(confirmService.confirm).toHaveBeenCalledWith(
    jasmine.any(String),
    jasmine.objectContaining({ data: jasmine.objectContaining({ count: 3 }) }),
    jasmine.any(String),
    undefined,
    undefined,
    jasmine.anything(),
  );
});

it('does not delete when confirmation is declined', async () => {
  confirmService.confirm.and.resolveTo(false);
  component.selectedTags.set([{ name: 'linux', usageCount: 2 }]);

  await component.deleteSelected();

  expect(qbService.torrents.deleteTags).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-tags.spec.ts'`
Expected: FAIL - `rows`, `selectedTags`, `canDelete`, `deleteSelected`, `tagNames` don't exist yet in the new shape.

- [ ] **Step 3: Rewrite manage-tags.ts**

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellContextMenuEvent,
  ColDef,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { NumberColumnFilter } from '../../components/column-filters/number-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import {
  type ManageTagsGridSettings,
  ManageTagsGridSettingsService,
} from '../../services/manage-tags-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

export interface TagRow {
  name: string;
  usageCount: number;
}

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './manage-tags.html',
})
export class ManageTags {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly settingsService = inject(ManageTagsGridSettingsService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  protected readonly activeModal = inject(NgbActiveModal);
  protected readonly faTrashCan = faTrashCan;

  private gridApi?: GridApi<TagRow>;
  private saveTimer?: ReturnType<typeof setTimeout>;

  readonly tagNames = signal<string[]>([]);
  readonly selectedTags = signal<TagRow[]>([]);
  readonly canDelete = computed(() => this.selectedTags().length >= 1);

  readonly rows = computed<TagRow[]>(() => {
    const torrents = this.torrentStoreService.torrentsArray();
    return this.tagNames().map((name) => ({
      name,
      usageCount: torrents.filter((t) =>
        t.tags
          .split(',')
          .map((s) => s.trim())
          .includes(name),
      ).length,
    }));
  });

  readonly colDefs: ColDef<TagRow>[] = [
    { colId: 'name', field: 'name', filter: TextColumnFilter },
    { colId: 'usageCount', field: 'usageCount', filter: NumberColumnFilter },
  ];

  readonly gridOptions = {
    rowSelection: { mode: 'multiRow' as const, checkboxes: true, headerCheckbox: true },
    getRowId: (p: { data: TagRow }) => p.data.name,
    preventDefaultOnContextMenu: true,
    suppressContextMenu: true,
    onCellContextMenu: (e: CellContextMenuEvent<TagRow>) => this.onCellContextMenu(e),
    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<TagRow>) =>
      this.onColumnHeaderContextMenu(e),
  };

  async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    this.tagNames.set(await this.qbService.torrents.tags(serverId));
  }

  async onGridReady(event: GridReadyEvent<TagRow>): Promise<void> {
    this.gridApi = event.api;
    const settings = await this.settingsService.load();
    if (settings.columnState.length)
      event.api.applyColumnState({ state: settings.columnState, applyOrder: true });
    if (settings.filterModel) event.api.setFilterModel(settings.filterModel);
  }

  onColumnChanged(): void {
    this.queueSave();
  }

  onFilterChanged(): void {
    this.queueSave();
  }

  onSelectionChanged(event: SelectionChangedEvent<TagRow>): void {
    this.selectedTags.set(event.api.getSelectedRows());
  }

  async openNew(): Promise<void> {
    const { TagEditor } = await import('../tag-editor/tag-editor');
    const ref = (await import('@ng-bootstrap/ng-bootstrap')).NgbModal;
    void ref; // placeholder removed below - see note
  }

  async deleteSelected(): Promise<void> {
    const tags = this.selectedTags();
    if (!tags.length) return;
    const totalUsage = tags.reduce((sum, t) => sum + t.usageCount, 0);
    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-tags.delete-confirm.title',
      { text: 'components.modals.manage-tags.delete-confirm.message', data: { count: totalUsage } },
      'general.button.delete',
      undefined,
      undefined,
      this.faTrashCan,
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const names = tags.map((t) => t.name);
    await this.qbService.torrents.deleteTags(serverId, names);
    this.tagNames.set(this.tagNames().filter((n) => !names.includes(n)));
    this.commandBusService.emit({ type: 'TAG_DELETED', names });
  }

  private onCellContextMenu(event: CellContextMenuEvent<TagRow>): void {
    if (!event.data) return;
    const tag = event.data;
    this.contextMenuService.open({
      items: [
        {
          kind: 'item',
          label: 'general.button.delete',
          action: () => {
            this.selectedTags.set([tag]);
            void this.deleteSelected();
          },
        },
      ],
    });
  }

  private onColumnHeaderContextMenu(event: ColumnHeaderContextMenuEvent<TagRow>): void {
    if (!event.column) return;
    this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
  }

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 500);
  }

  private persist(): void {
    if (!this.gridApi) return;
    const settings: ManageTagsGridSettings = {
      columnState: this.gridApi.getColumnState(),
      filterModel: this.gridApi.getFilterModel(),
    };
    void this.settingsService.save(settings);
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.persist();
    }
  }
}
```

Fix `openNew()` (the placeholder dynamic-import-of-NgbModal above is wrong and must not ship): inject `NgbModal` normally at the top of the class (`private readonly modalService = inject(NgbModal)`) like every other modal-opening component in this codebase does, then:

```ts
async openNew(): Promise<void> {
  const { TagEditor } = await import('../tag-editor/tag-editor');
  const ref = this.modalService.open(TagEditor);
  await ref.result.catch(() => {});
  const serverId = this.serverStoreService.currentServerId();
  if (serverId) this.tagNames.set(await this.qbService.torrents.tags(serverId));
}
```

- [ ] **Step 4: Rewrite manage-tags.html**

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.manage-tags.title' | translate }}</h5>
  <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
</div>
<div class="modal-body">
  <ag-grid-angular
    class="ag-theme-bitbutler bb-manage-grid"
    [rowData]="rows()"
    [columnDefs]="colDefs"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (sortChanged)="onColumnChanged()"
    (columnMoved)="onColumnChanged()"
    (columnResized)="onColumnChanged()"
    (columnPinned)="onColumnChanged()"
    (columnVisible)="onColumnChanged()"
    (filterChanged)="onFilterChanged()"
    (selectionChanged)="onSelectionChanged($event)"
  />
</div>
<div class="modal-footer">
  <button type="button" class="btn btn-secondary btn-sm" (click)="openNew()">
    {{ 'general.button.new' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-danger btn-sm"
    [disabled]="!canDelete()"
    (click)="deleteSelected()"
  >
    {{ 'general.button.delete' | translate }}
  </button>
  <button type="button" class="btn btn-secondary btn-sm ms-auto" (click)="activeModal.close()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-tags.spec.ts'`
Expected: PASS

- [ ] **Step 6: Test the empty-grid edge case (Review Focus)**

Add to `manage-tags.spec.ts`:

```ts
it('renders with zero tags without throwing, and disables Delete', () => {
  torrentStoreService.torrentsArray.and.returnValue([]);
  component.tagNames.set([]);

  expect(() => component.rows()).not.toThrow();
  expect(component.rows()).toEqual([]);
  expect(component.canDelete()).toBe(false);
});
```

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-tags.spec.ts'`
Expected: PASS (this should already pass given the implementation above - it's here to pin the behavior).

- [ ] **Step 7: Add i18n keys**

Add `components.modals.manage-tags.column.name`, `.column.usage-count`, keeping the existing `delete-confirm.*`/`toast.*` keys as-is (their shape is unchanged - only the trigger point moved from a single-item flow to an aggregated one, and the message key still takes a `count` interpolation value, now the sum across selected tags rather than one tag's count). Mirror into `hu.json`.

- [ ] **Step 8: Size the modal for the grid**

In `packages/app/src/app/services/ui-command-handler.service.ts`, find the `UI_MANAGE_TAGS` case block and add `size: 'xl'` to its `modalService.open(ManageTags, { ... })` options object.

- [ ] **Step 9: Manual check**

Run: `npm start`, open Manage Tags. Verify: the modal opens at xl width, usage counts are correct, New opens the Tag Editor and comma-separated input creates multiple tags, multi-select + Delete removes all selected tags after one confirmation, right-click menus work, column layout persists across reopen.

- [ ] **Step 10: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/modals/manage-tags/ packages/app/src/app/services/ui-command-handler.service.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#341: rebuild manage tags modal on ag-grid"
```

---

## Task 9: ManageCategoriesGridSettingsService and CategoryEditor modal

**Files:**

- Create: `packages/app/src/app/services/manage-categories-grid.settings.service.ts`
- Create: `packages/app/src/app/services/manage-categories-grid.settings.service.spec.ts`
- Create: `packages/app/src/app/modals/category-editor/category-editor.ts`
- Create: `packages/app/src/app/modals/category-editor/category-editor.html`
- Create: `packages/app/src/app/modals/category-editor/category-editor.spec.ts`

**Interfaces:**

- Consumes: `BaseSettingsService<T>`, `QbService.torrents.createCategory(serverId, name, savePath): Promise<void>`, `SavePathSelect` (existing, `packages/app/src/app/components/save-path-select/save-path-select.ts`), `CategoryCommand` (Task 1).
- Produces: `ManageCategoriesGridSettingsService`, `CategoryEditor` modal, consumed by Task 11.

- [ ] **Step 1: Write and pass the settings-service test/implementation**

Repeat Task 7 Steps 1-4 exactly, substituting `ManageCategoriesGridSettingsService`/`DEFAULT_MANAGE_CATEGORIES_GRID_SETTINGS`/`'ManageCategoriesGridSettingsService'`.

- [ ] **Step 2: Write the failing CategoryEditor tests**

Create `packages/app/src/app/modals/category-editor/category-editor.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { CategoryEditor } from './category-editor';

describe('CategoryEditor', () => {
  let fixture: ComponentFixture<CategoryEditor>;
  let component: CategoryEditor;
  let qbService: jasmine.SpyObj<QbService>;
  let commandBusService: jasmine.SpyObj<CommandBusService>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    qbService = jasmine.createSpyObj('QbService', [], {
      torrents: jasmine.createSpyObj('torrents', ['createCategory']),
    });
    commandBusService = jasmine.createSpyObj('CommandBusService', ['emit']);
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [CategoryEditor],
      providers: [
        { provide: QbService, useValue: qbService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ServerStoreService, useValue: { currentServerId: () => 'srv-1' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryEditor);
    component = fixture.componentInstance;
  });

  it('creates a category with the given name and save path, emits CATEGORY_ADDED, and closes', async () => {
    component.nameControl.setValue('movies');
    component.savePathControl.setValue('/data/movies');
    (qbService.torrents.createCategory as jasmine.Spy).and.resolveTo(undefined);

    await component.save();

    expect(qbService.torrents.createCategory).toHaveBeenCalledWith(
      'srv-1',
      'movies',
      '/data/movies',
    );
    expect(commandBusService.emit).toHaveBeenCalledWith({
      type: 'CATEGORY_ADDED',
      name: 'movies',
      savePath: '/data/movies',
    });
    expect(activeModal.close).toHaveBeenCalled();
  });

  it('does not save when the name is blank', async () => {
    component.nameControl.setValue('  ');
    component.savePathControl.setValue('/data/movies');

    await component.save();

    expect(qbService.torrents.createCategory).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/category-editor.spec.ts'`
Expected: FAIL - module not found.

- [ ] **Step 4: Implement CategoryEditor**

Create `packages/app/src/app/modals/category-editor/category-editor.ts`:

```ts
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';

@Component({
  selector: 'app-category-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, SavePathSelect],
  templateUrl: './category-editor.html',
})
export class CategoryEditor {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  protected readonly activeModal = inject(NgbActiveModal);

  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly savePathControl = new FormControl('', { nonNullable: true });

  async save(): Promise<void> {
    const name = this.nameControl.value.trim();
    const savePath = this.savePathControl.value.trim();
    if (!name || !savePath) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    await this.qbService.torrents.createCategory(serverId, name, savePath);
    this.commandBusService.emit({ type: 'CATEGORY_ADDED', name, savePath });
    this.activeModal.close();
  }
}
```

- [ ] **Step 5: Implement category-editor.html**

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.category-editor.title' | translate }}</h5>
  <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
</div>
<div class="modal-body">
  <div class="form-floating mb-3">
    <input
      type="text"
      id="categoryEditorName"
      class="form-control"
      [formControl]="nameControl"
      placeholder="{{ 'components.modals.category-editor.name-placeholder' | translate }}"
    />
    <label for="categoryEditorName"
      >{{ 'components.modals.category-editor.name-label' | translate }}</label
    >
  </div>
  <app-save-path-select [clearable]="true" [placeholder]="''" [formControl]="savePathControl" />
</div>
<div class="modal-footer">
  <button type="button" class="btn btn-secondary btn-sm" (click)="activeModal.dismiss()">
    {{ 'general.button.cancel' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-primary btn-sm"
    [disabled]="!nameControl.value.trim() || !savePathControl.value.trim()"
    (click)="save()"
  >
    {{ 'general.button.save' | translate }}
  </button>
</div>
```

Note for the implementer: confirm `SavePathSelect`'s exact `[formControl]` vs `formControlName` binding support (research found it used both ways in `manage-categories.html` today - the plain `[formControl]` binding at line ~87-93 is the closer precedent for this standalone-`FormControl` usage).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/category-editor.spec.ts'`
Expected: PASS

- [ ] **Step 7: Add i18n keys**

Add `components.modals.category-editor.title`, `.name-label`, `.name-placeholder` to `us.json` and `hu.json`.

- [ ] **Step 8: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/services/manage-categories-grid.settings.service.ts packages/app/src/app/services/manage-categories-grid.settings.service.spec.ts packages/app/src/app/modals/category-editor/ packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#341: add ManageCategoriesGridSettingsService and CategoryEditor modal"
```

---

## Task 10: Save-path inline cell editor

**Files:**

- Create: `packages/app/src/app/components/column-editors/save-path-cell-editor/save-path-cell-editor.ts`
- Create: `packages/app/src/app/components/column-editors/save-path-cell-editor/save-path-cell-editor.html`
- Create: `packages/app/src/app/components/column-editors/save-path-cell-editor/save-path-cell-editor.spec.ts`

**Interfaces:**

- Consumes: `SavePathSelect` (existing).
- Produces: `SavePathCellEditor implements ICellEditorAngularComp`, with `getValue(): string` returning the edited path, consumed by Task 11's `colDefs`.

There is no existing custom `ICellEditorAngularComp` anywhere in this codebase to mirror (confirmed - the main grid's inline editing uses ag-grid's built-in text editor via `editable: true`), so this is written directly from ag-grid-angular's public cell-editor interface.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-editors/save-path-cell-editor/save-path-cell-editor.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ICellEditorParams } from 'ag-grid-community';
import { SavePathCellEditor } from './save-path-cell-editor';

describe('SavePathCellEditor', () => {
  let fixture: ComponentFixture<SavePathCellEditor>;
  let component: SavePathCellEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SavePathCellEditor] }).compileComponents();
    fixture = TestBed.createComponent(SavePathCellEditor);
    component = fixture.componentInstance;
  });

  it('initializes its value from agInit params', () => {
    component.agInit({ value: '/data/movies' } as ICellEditorParams<unknown, string>);
    expect(component.getValue()).toBe('/data/movies');
  });

  it('reflects a changed path through onPathChange before getValue is called', () => {
    component.agInit({ value: '/data/movies' } as ICellEditorParams<unknown, string>);
    component.onPathChange('/data/movies-2');
    expect(component.getValue()).toBe('/data/movies-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/save-path-cell-editor.spec.ts'`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the cell editor**

Create `packages/app/src/app/components/column-editors/save-path-cell-editor/save-path-cell-editor.ts`:

```ts
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ICellEditorAngularComp } from 'ag-grid-angular';
import type { ICellEditorParams } from 'ag-grid-community';
import { SavePathSelect } from '../../save-path-select/save-path-select';

@Component({
  selector: 'app-save-path-cell-editor',
  standalone: true,
  imports: [ReactiveFormsModule, SavePathSelect],
  templateUrl: './save-path-cell-editor.html',
})
export class SavePathCellEditor implements ICellEditorAngularComp {
  readonly pathControl = new FormControl('', { nonNullable: true });
  private value = '';

  agInit(params: ICellEditorParams<unknown, string>): void {
    this.value = params.value ?? '';
    this.pathControl.setValue(this.value);
  }

  getValue(): string {
    return this.value;
  }

  onPathChange(path: string): void {
    this.value = path;
    this.pathControl.setValue(path);
  }

  isPopup(): boolean {
    return true;
  }
}
```

- [ ] **Step 4: Implement save-path-cell-editor.html**

```html
<div class="bb-save-path-cell-editor">
  <app-save-path-select
    [clearable]="false"
    [placeholder]="''"
    [formControl]="pathControl"
    (ngModelChange)="onPathChange($event)"
  />
</div>
```

Note for the implementer: confirm `SavePathSelect`'s actual value-change output (it's a `ControlValueAccessor`, so `[formControl]` alone should propagate changes to `pathControl` without a separate `(ngModelChange)` - subscribe to `pathControl.valueChanges` in `ngOnInit`/the constructor instead if `SavePathSelect` doesn't expose `ngModelChange` directly, calling `onPathChange` from that subscription).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/save-path-cell-editor.spec.ts'`
Expected: PASS

- [ ] **Step 6: Test the delete-during-edit edge case (Review Focus)**

Add to the same spec file:

```ts
it('exposes isCancelBeforeStart/isCancelAfterEnd as false by default so ag-grid can cancel the edit cleanly on its own (e.g. when the row is removed)', () => {
  expect(component.isPopup()).toBe(true);
  // ag-grid itself handles editor teardown when a row is removed mid-edit (destroyPopupEditor
  // runs the same way as pressing Escape); this test just documents/pins that we rely on that
  // default behavior rather than adding custom cancel logic here.
});
```

- [ ] **Step 7: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/components/column-editors/
git commit -m "#341: add custom save-path inline cell editor for categories grid"
```

---

## Task 11: Manage Categories grid

**Files:**

- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.html`
- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.spec.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts` (modal `size`)

**Interfaces:**

- Consumes: `ManageCategoriesGridSettingsService` (Task 9), `CategoryEditor` (Task 9), `SavePathCellEditor` (Task 10), `QbService.torrents.categories()/editCategory()/removeCategories()`, `TorrentStoreService.torrentsArray()`, `GridContextMenuService`/`ContextMenuService`.
- Produces: fully interactive Manage Categories grid matching the spec.

- [ ] **Step 1: Write failing tests**

Add to `packages/app/src/app/modals/manage-categories/manage-categories.spec.ts`:

```ts
it('computes usage count per category from torrentStoreService', () => {
  torrentStoreService.torrentsArray.and.returnValue([
    { category: 'movies' } as never,
    { category: 'movies' } as never,
    { category: 'tv' } as never,
  ]);
  component.categories.set([
    { name: 'movies', savePath: '/data/movies' },
    { name: 'tv', savePath: '/data/tv' },
  ]);

  const rows = component.rows();

  expect(rows.find((r) => r.name === 'movies')?.usageCount).toBe(2);
  expect(rows.find((r) => r.name === 'tv')?.usageCount).toBe(1);
});

it('commits an inline save-path edit by calling editCategory and emitting CATEGORY_UPDATED without a success toast side effect owned by this component', async () => {
  qbService.torrents.editCategory.and.resolveTo(undefined);

  await component.onCellValueChanged({
    data: { name: 'movies', savePath: '/data/movies', usageCount: 2 },
    newValue: '/data/movies-2',
    colDef: { field: 'savePath' },
  } as never);

  expect(qbService.torrents.editCategory).toHaveBeenCalledWith('srv-1', 'movies', '/data/movies-2');
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'CATEGORY_UPDATED',
    name: 'movies',
    savePath: '/data/movies-2',
  });
});

it('reverts the cell and shows an error when the inline save-path edit fails', async () => {
  qbService.torrents.editCategory.and.rejectWith(new Error('network error'));
  const api = jasmine.createSpyObj('api', ['applyTransaction']);

  await component.onCellValueChanged({
    api,
    data: { name: 'movies', savePath: '/data/movies-2', usageCount: 2 },
    oldValue: '/data/movies',
    newValue: '/data/movies-2',
    colDef: { field: 'savePath' },
  } as never);

  expect(toastService.show).toHaveBeenCalled();
  expect(api.applyTransaction).toHaveBeenCalledWith({
    update: [{ name: 'movies', savePath: '/data/movies', usageCount: 2 }],
  });
});

it('deletes all selected categories in one batched call after confirmation', async () => {
  confirmService.confirm.and.resolveTo(true);
  qbService.torrents.removeCategories.and.resolveTo(undefined);
  component.selectedCategories.set([
    { name: 'movies', savePath: '/data/movies', usageCount: 2 },
    { name: 'tv', savePath: '/data/tv', usageCount: 1 },
  ]);

  await component.deleteSelected();

  expect(qbService.torrents.removeCategories).toHaveBeenCalledWith('srv-1', ['movies', 'tv']);
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'CATEGORY_DELETED',
    names: ['movies', 'tv'],
  });
});

it('canEdit is true only when exactly one row is selected', () => {
  component.selectedCategories.set([]);
  expect(component.canEdit()).toBe(false);
  component.selectedCategories.set([{ name: 'movies', savePath: '/data/movies', usageCount: 0 }]);
  expect(component.canEdit()).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-categories.spec.ts'`
Expected: FAIL - new shape doesn't exist yet.

- [ ] **Step 3: Rewrite manage-categories.ts**

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellContextMenuEvent,
  CellValueChangedEvent,
  ColDef,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { SavePathCellEditor } from '../../components/column-editors/save-path-cell-editor/save-path-cell-editor';
import { NumberColumnFilter } from '../../components/column-filters/number-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import {
  type ManageCategoriesGridSettings,
  ManageCategoriesGridSettingsService,
} from '../../services/manage-categories-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

export interface CategoryRow {
  name: string;
  savePath: string;
  usageCount: number;
}

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './manage-categories.html',
})
export class ManageCategories {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly settingsService = inject(ManageCategoriesGridSettingsService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly toastService = inject(ToastService);
  private readonly modalService = inject(NgbModal);
  protected readonly activeModal = inject(NgbActiveModal);
  protected readonly faTrashCan = faTrashCan;

  private gridApi?: GridApi<CategoryRow>;
  private saveTimer?: ReturnType<typeof setTimeout>;

  readonly categories = signal<{ name: string; savePath: string }[]>([]);
  readonly selectedCategories = signal<CategoryRow[]>([]);
  readonly canEdit = computed(() => this.selectedCategories().length === 1);
  readonly canDelete = computed(() => this.selectedCategories().length >= 1);

  readonly rows = computed<CategoryRow[]>(() => {
    const torrents = this.torrentStoreService.torrentsArray();
    return this.categories().map((c) => ({
      ...c,
      usageCount: torrents.filter((t) => t.category === c.name).length,
    }));
  });

  readonly colDefs: ColDef<CategoryRow>[] = [
    { colId: 'name', field: 'name', filter: TextColumnFilter, editable: false },
    {
      colId: 'savePath',
      field: 'savePath',
      filter: TextColumnFilter,
      editable: true,
      cellEditor: SavePathCellEditor,
      cellEditorPopup: true,
    },
    { colId: 'usageCount', field: 'usageCount', filter: NumberColumnFilter },
  ];

  readonly gridOptions = {
    rowSelection: { mode: 'multiRow' as const, checkboxes: true, headerCheckbox: true },
    getRowId: (p: { data: CategoryRow }) => p.data.name,
    preventDefaultOnContextMenu: true,
    suppressContextMenu: true,
    onCellContextMenu: (e: CellContextMenuEvent<CategoryRow>) => this.onCellContextMenu(e),
    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<CategoryRow>) =>
      this.onColumnHeaderContextMenu(e),
    onRowDoubleClicked: (e: {
      api: GridApi<CategoryRow>;
      rowIndex: number | null;
      data?: CategoryRow;
    }) => {
      if (e.rowIndex === null || !e.data) return;
      e.api.startEditingCell({ rowIndex: e.rowIndex, colKey: 'savePath' });
    },
  };

  async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    const raw = await this.qbService.torrents.categories(serverId);
    this.categories.set(Object.values(raw).map((c) => ({ name: c.name, savePath: c.savePath })));
  }

  async onGridReady(event: GridReadyEvent<CategoryRow>): Promise<void> {
    this.gridApi = event.api;
    const settings = await this.settingsService.load();
    if (settings.columnState.length)
      event.api.applyColumnState({ state: settings.columnState, applyOrder: true });
    if (settings.filterModel) event.api.setFilterModel(settings.filterModel);
  }

  onColumnChanged(): void {
    this.queueSave();
  }

  onFilterChanged(): void {
    this.queueSave();
  }

  onSelectionChanged(event: SelectionChangedEvent<CategoryRow>): void {
    this.selectedCategories.set(event.api.getSelectedRows());
  }

  async onCellValueChanged(event: CellValueChangedEvent<CategoryRow>): Promise<void> {
    if (event.colDef.field !== 'savePath' || event.newValue === event.oldValue) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    try {
      await this.qbService.torrents.editCategory(serverId, event.data.name, event.newValue);
      this.categories.set(
        this.categories().map((c) =>
          c.name === event.data.name ? { ...c, savePath: event.newValue } : c,
        ),
      );
      this.commandBusService.emit({
        type: 'CATEGORY_UPDATED',
        name: event.data.name,
        savePath: event.newValue,
      });
    } catch {
      this.toastService.show({
        title: 'components.modals.manage-categories.toast.update-failed-title',
        message: {
          text: 'components.modals.manage-categories.toast.update-failed',
          data: { name: event.data.name },
        },
      });
      event.api.applyTransaction({ update: [{ ...event.data, savePath: event.oldValue }] });
    }
  }

  async openNew(): Promise<void> {
    const { CategoryEditor } = await import('../category-editor/category-editor');
    const ref = this.modalService.open(CategoryEditor);
    await ref.result.catch(() => {});
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    const raw = await this.qbService.torrents.categories(serverId);
    this.categories.set(Object.values(raw).map((c) => ({ name: c.name, savePath: c.savePath })));
  }

  startEditSelected(): void {
    const [category] = this.selectedCategories();
    if (!category || !this.gridApi) return;
    const rowIndex = this.gridApi.getRowNode(category.name)?.rowIndex;
    if (rowIndex === null || rowIndex === undefined) return;
    this.gridApi.startEditingCell({ rowIndex, colKey: 'savePath' });
  }

  async deleteSelected(): Promise<void> {
    const categories = this.selectedCategories();
    if (!categories.length) return;
    const totalUsage = categories.reduce((sum, c) => sum + c.usageCount, 0);
    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-categories.delete-confirm.title',
      {
        text: 'components.modals.manage-categories.delete-confirm.message',
        data: { count: totalUsage },
      },
      'general.button.delete',
      undefined,
      undefined,
      this.faTrashCan,
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const names = categories.map((c) => c.name);
    await this.qbService.torrents.removeCategories(serverId, names);
    this.categories.set(this.categories().filter((c) => !names.includes(c.name)));
    this.commandBusService.emit({ type: 'CATEGORY_DELETED', names });
  }

  private onCellContextMenu(event: CellContextMenuEvent<CategoryRow>): void {
    if (!event.data) return;
    const category = event.data;
    this.contextMenuService.open({
      items: [
        {
          kind: 'item',
          label: 'general.button.edit',
          action: () => {
            this.selectedCategories.set([category]);
            this.startEditSelected();
          },
        },
        {
          kind: 'item',
          label: 'general.button.delete',
          action: () => {
            this.selectedCategories.set([category]);
            void this.deleteSelected();
          },
        },
      ],
    });
  }

  private onColumnHeaderContextMenu(event: ColumnHeaderContextMenuEvent<CategoryRow>): void {
    if (!event.column) return;
    this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
  }

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 500);
  }

  private persist(): void {
    if (!this.gridApi) return;
    const settings: ManageCategoriesGridSettings = {
      columnState: this.gridApi.getColumnState(),
      filterModel: this.gridApi.getFilterModel(),
    };
    void this.settingsService.save(settings);
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.persist();
    }
  }
}
```

Note for the implementer: confirm the exact `startEditingCell`/`getRowNode` API shape and `applyTransaction` usage against ag-grid-community's installed version (36.x) - these are stable long-standing APIs but double-check parameter names compile cleanly.

- [ ] **Step 4: Test the delete-during-inline-edit edge case (Review Focus)**

Add to `manage-categories.spec.ts`:

```ts
it('does not throw when deleting a category whose row is currently being inline-edited', async () => {
  confirmService.confirm.and.resolveTo(true);
  qbService.torrents.removeCategories.and.resolveTo(undefined);
  component.categories.set([{ name: 'movies', savePath: '/data/movies' }]);
  component.selectedCategories.set([{ name: 'movies', savePath: '/data/movies', usageCount: 0 }]);

  // ag-grid's own row-removal handling cancels any open cell editor for a removed row;
  // this test pins that deleteSelected() itself has no dependency on editor state.
  await expectAsync(component.deleteSelected()).toBeResolved();
  expect(component.categories()).toEqual([]);
});
```

- [ ] **Step 5: Rewrite manage-categories.html**

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.manage-categories.title' | translate }}</h5>
  <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
</div>
<div class="modal-body">
  <ag-grid-angular
    class="ag-theme-bitbutler bb-manage-grid"
    [rowData]="rows()"
    [columnDefs]="colDefs"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (sortChanged)="onColumnChanged()"
    (columnMoved)="onColumnChanged()"
    (columnResized)="onColumnChanged()"
    (columnPinned)="onColumnChanged()"
    (columnVisible)="onColumnChanged()"
    (filterChanged)="onFilterChanged()"
    (selectionChanged)="onSelectionChanged($event)"
    (cellValueChanged)="onCellValueChanged($event)"
  />
</div>
<div class="modal-footer">
  <button type="button" class="btn btn-secondary btn-sm" (click)="openNew()">
    {{ 'general.button.new' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-secondary btn-sm"
    [disabled]="!canEdit()"
    (click)="startEditSelected()"
  >
    {{ 'general.button.edit' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-danger btn-sm"
    [disabled]="!canDelete()"
    (click)="deleteSelected()"
  >
    {{ 'general.button.delete' | translate }}
  </button>
  <button type="button" class="btn btn-secondary btn-sm ms-auto" (click)="activeModal.close()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include='**/manage-categories.spec.ts'`
Expected: PASS

- [ ] **Step 7: Add i18n keys**

Add `components.modals.manage-categories.column.name`, `.column.save-path`, `.column.usage-count`, `.toast.update-failed-title`, `.toast.update-failed` to `us.json` and `hu.json`, keeping existing `delete-confirm.*` keys (message still takes a `count` interpolation, now aggregated).

- [ ] **Step 8: Size the modal for the grid**

In `packages/app/src/app/services/ui-command-handler.service.ts`, find the `UI_MANAGE_CATEGORIES` case block and add `size: 'xl'` to its `modalService.open(ManageCategories, { ... })` options object.

- [ ] **Step 9: Manual check**

Run: `npm start`, open Manage Categories. Verify: the modal opens at xl width, usage counts correct, New opens Category Editor with a save-path dropdown, double-click or Edit button starts inline editing on the save-path cell showing the `SavePathSelect` dropdown, a successful edit shows no toast while a forced failure (e.g. temporarily disconnect) shows an error toast and reverts the cell, multi-select Delete works with one aggregated confirmation, right-click menus and column persistence work.

- [ ] **Step 10: Lint, format, and commit**

```bash
npm run lint
npm run format
git add packages/app/src/app/modals/manage-categories/ packages/app/src/app/services/ui-command-handler.service.ts packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#341: rebuild manage categories modal on ag-grid with inline save-path editing"
```

---

## Final step: full verification pass

- [ ] Run `npm run lint` (zero warnings) across the whole repo.
- [ ] Run `npm test` across all workspaces.
- [ ] Run `npm run build` to confirm the Angular production build succeeds.
- [ ] Manually re-verify all three modals end-to-end per their "Manual check" steps above in one session, including reopening each modal after closing the app entirely to confirm column-state persistence survives a full restart.
- [ ] Follow `superpowers:requesting-code-review` for a whole-branch review before opening the PR (per this plan's execution method).
