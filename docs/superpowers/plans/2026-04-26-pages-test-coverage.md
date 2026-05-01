# Pages Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add meaningful unit tests to all spec files under `src/app/pages` that currently only contain a `should create` smoke test, and create the one missing spec for `SettingsStateService`.

**Architecture:** Each spec file gets a fresh `beforeEach` with explicit `vi.fn()` mocks for every service whose observable side-effects need verification. Components with deep child trees use `NO_ERRORS_SCHEMA` plus `overrideComponent` to remove child imports, keeping tests isolated to the component under test.

**Tech Stack:** Angular 20 (zoneless), Vitest, `@analogjs/vitest-angular`, `vi.fn()` for mocks, `signal()` for reactive mock state.

---

## Global test infrastructure (read before every task)

- **`src/test-setup.ts`** — stubs the entire `window.bitbutler` IPC bridge so real IPC never fires
- **`src/test-providers.ts`** — globally provides `provideZonelessChangeDetection()`, `provideTranslateService()` (returns key as translation when no loader), all format pipes, and `SettingsStateService`
- Any service NOT explicitly provided in a spec resolves from the global providers above
- Run all tests: `npm test`

---

## Task 1: Create `settings/settings-state.service.spec.ts`

**Files:**

- Create: `src/app/pages/settings/settings-state.service.spec.ts`

- [ ] **Step 1: Write the spec file**

```typescript
// src/app/pages/settings/settings-state.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SettingsStateService } from './settings-state.service';

describe('SettingsStateService', () => {
  let service: SettingsStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SettingsStateService],
    });
    service = TestBed.inject(SettingsStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isDirty', () => {
    it('should be false initially', () => {
      expect(service.isDirty()).toBe(false);
    });

    it('should be true after any tab is marked dirty', () => {
      service.markDirty('general', true);
      expect(service.isDirty()).toBe(true);
    });

    it('should be false once the dirty tab is cleaned', () => {
      service.markDirty('general', true);
      service.markDirty('general', false);
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('isDirtyMap', () => {
    it('should start with all tabs clean', () => {
      expect(Object.values(service.isDirtyMap()).every((v) => !v)).toBe(true);
    });

    it('should reflect per-tab dirty state', () => {
      service.markDirty('server', true);
      expect(service.isDirtyMap()['server']).toBe(true);
      expect(service.isDirtyMap()['general']).toBe(false);
    });
  });

  describe('markDirty', () => {
    it('should mark a tab dirty', () => {
      service.markDirty('torrent-list-grid', true);
      expect(service.isDirtyMap()['torrent-list-grid']).toBe(true);
    });

    it('should mark a tab clean', () => {
      service.markDirty('torrent-list-grid', true);
      service.markDirty('torrent-list-grid', false);
      expect(service.isDirtyMap()['torrent-list-grid']).toBe(false);
    });

    it('should not affect other tabs', () => {
      service.markDirty('status-bar', true);
      expect(service.isDirtyMap()['general']).toBe(false);
      expect(service.isDirtyMap()['server']).toBe(false);
    });
  });

  describe('resetDirty', () => {
    it('should reset all dirty tabs to clean', () => {
      service.markDirty('general', true);
      service.markDirty('server', true);
      service.resetDirty();
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('registerSave / saveAll', () => {
    it('should call the save fn for dirty tabs', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('general', fn);
      service.markDirty('general', true);
      await service.saveAll();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should not call the save fn for clean tabs', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('server', fn);
      await service.saveAll();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset dirty state after saving', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('general', fn);
      service.markDirty('general', true);
      await service.saveAll();
      expect(service.isDirty()).toBe(false);
    });

    it('should call save fns for every dirty tab', async () => {
      const genFn = vi.fn().mockResolvedValue(undefined);
      const srvFn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('general', genFn);
      service.registerSave('server', srvFn);
      service.markDirty('general', true);
      service.markDirty('server', true);
      await service.saveAll();
      expect(genFn).toHaveBeenCalledOnce();
      expect(srvFn).toHaveBeenCalledOnce();
    });

    it('should resolve without throwing when no fn is registered for a dirty tab', async () => {
      service.markDirty('general', true);
      await expect(service.saveAll()).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `SettingsStateService` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/settings-state.service.spec.ts
git commit -m "#49: add tests for SettingsStateService"
```

---

## Task 2: Enhance `login/login.spec.ts`

**Files:**

- Modify: `src/app/pages/login/login.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/login/login.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
  let serverStoreMock: {
    servers: ReturnType<typeof signal<any[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
    currentServer: ReturnType<typeof signal<any>>;
    refresh: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    isAutoLoginSuppressed: ReturnType<typeof vi.fn>;
    clearAutoLoginSuppression: ReturnType<typeof vi.fn>;
  };
  let serverServiceMock: { update: ReturnType<typeof vi.fn> };
  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<string>>;
  };
  let toastMock: { danger: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  let electronMock: {
    getBitButlerVersion: ReturnType<typeof vi.fn>;
    goToRelease: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    confirmMock = { confirm: vi.fn().mockResolvedValue(false) };
    serverStoreMock = {
      servers: signal([]),
      loading: signal(false),
      currentServerId: signal(null),
      currentServer: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(),
      isAutoLoginSuppressed: vi.fn().mockReturnValue(false),
      clearAutoLoginSuppression: vi.fn(),
    };
    serverServiceMock = { update: vi.fn().mockResolvedValue(undefined) };
    themeMock = { family: signal('bitbutler'), effectiveMode: signal('dark') };
    toastMock = { danger: vi.fn(), success: vi.fn() };
    electronMock = {
      getBitButlerVersion: vi.fn().mockReturnValue('1.0.0'),
      goToRelease: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: ServerService, useValue: serverServiceMock },
        { provide: ThemeService, useValue: themeMock },
        { provide: ToastService, useValue: toastMock },
        { provide: ElectronService, useValue: electronMock },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: NgbModal,
          useValue: {
            open: vi.fn().mockReturnValue({ componentInstance: {}, close: vi.fn() }),
          },
        },
        {
          provide: QbService,
          useValue: { login: vi.fn().mockResolvedValue({ loggedIn: false }) },
        },
        {
          provide: WindowService,
          useValue: {
            setSize: vi.fn(),
            setOpenFilesEnabled: vi.fn().mockResolvedValue(undefined),
            maximize: vi.fn(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('trackByFn', () => {
    it('should return item id when present', () => {
      expect(component.trackByFn(0, { id: 'abc' } as any)).toBe('abc');
    });

    it('should return the index when item id is absent', () => {
      expect(component.trackByFn(5, {} as any)).toBe(5);
    });

    it('should return the index when item is null', () => {
      expect(component.trackByFn(3, null as any)).toBe(3);
    });
  });

  describe('canConnect', () => {
    it('should return false when loading', () => {
      serverStoreMock.loading.set(true);
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.canConnect()).toBe(false);
    });

    it('should return false when the server list is empty', () => {
      serverStoreMock.loading.set(false);
      serverStoreMock.servers.set([]);
      expect(component.canConnect()).toBe(false);
    });

    it('should return true when not loading and servers exist', () => {
      serverStoreMock.loading.set(false);
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.canConnect()).toBe(true);
    });
  });

  describe('logoUrl', () => {
    it('should build a URL from the current theme family', () => {
      themeMock.family.set('aurora');
      expect(component.logoUrl()).toBe('assets/images/bitbutler-logo-aurora.png');
    });
  });

  describe('addServer', () => {
    it('should emit UI_SERVER_EDITOR_OPEN', () => {
      component.addServer();
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_SERVER_EDITOR_OPEN' });
    });
  });

  describe('editServer', () => {
    it('should emit UI_SERVER_EDITOR_OPEN with the server id', () => {
      component.editServer({ id: 'srv-1' } as any);
      expect(commandBusMock.emit).toHaveBeenCalledWith({
        type: 'UI_SERVER_EDITOR_OPEN',
        id: 'srv-1',
      });
    });
  });

  describe('deleteServer', () => {
    it('should emit SERVER_DELETED when the user confirms', async () => {
      confirmMock.confirm.mockResolvedValue(true);
      await component.deleteServer({ id: 'srv-1', name: 'My Server' } as any);
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'srv-1' });
    });

    it('should not emit when the user cancels', async () => {
      confirmMock.confirm.mockResolvedValue(false);
      await component.deleteServer({ id: 'srv-1', name: 'My Server' } as any);
      expect(commandBusMock.emit).not.toHaveBeenCalled();
    });
  });

  describe('toggleAutoLogin', () => {
    it('should update auto_login to its inverse and emit SERVER_UPDATED', async () => {
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      await component.toggleAutoLogin(event, {
        id: 'srv-1',
        name: 'S',
        auto_login: false,
      } as any);
      expect(serverServiceMock.update).toHaveBeenCalledWith('srv-1', { auto_login: true });
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-1' });
    });

    it('should suppress the event default and propagation', async () => {
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      await component.toggleAutoLogin(event, {
        id: 'srv-1',
        name: 'S',
        auto_login: true,
      } as any);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `Login` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/login/login.spec.ts
git commit -m "#49: add tests for Login component"
```

---

## Task 3: Enhance `main/main.spec.ts`

**Files:**

- Modify: `src/app/pages/main/main.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/main/main.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentListGridSettingsService } from '../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { WindowService } from '../../services/window.service';
import { Main } from './main';

describe('Main', () => {
  let component: Main;
  let fixture: ComponentFixture<Main>;

  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<'dark' | 'light'>>;
  };
  let serverStoreMock: {
    currentServer: ReturnType<typeof signal<any>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
  };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(async () => {
    themeMock = {
      family: signal('bitbutler'),
      effectiveMode: signal<'dark' | 'light'>('dark'),
    };
    serverStoreMock = {
      currentServer: signal(null),
      currentServerId: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ThemeService, useValue: themeMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        {
          provide: QbPollingService,
          useValue: { startMaindataPolling: vi.fn().mockReturnValue(new Subject()) },
        },
        { provide: TorrentStoreService, useValue: { applyMaindata: vi.fn() } },
        { provide: WindowService, useValue: { maximize: vi.fn() } },
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(new Subject().asObservable()) },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Main, { set: { imports: [] } })
      .compileComponents();

    fixture = TestBed.createComponent(Main);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('logoUrl', () => {
    it('should build the URL from the current theme family', () => {
      themeMock.family.set('aurora');
      expect(component.logoUrl()).toBe('assets/images/bitbutler-logo-aurora.png');
    });
  });

  describe('theme', () => {
    it('should be the effectiveMode signal from ThemeService', () => {
      expect(component.theme).toBe(themeMock.effectiveMode);
    });
  });

  describe('currentServer', () => {
    it('should be the currentServer signal from ServerStoreService', () => {
      expect(component.currentServer).toBe(serverStoreMock.currentServer);
    });
  });

  describe('serverState', () => {
    it('should be null initially', () => {
      expect(component.serverState()).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `Main` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/main/main.spec.ts
git commit -m "#49: add tests for Main component"
```

---

## Task 4: Enhance `main/button-bar/button-bar.spec.ts`

**Files:**

- Modify: `src/app/pages/main/button-bar/button-bar.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/main/button-bar/button-bar.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ButtonBar } from './button-bar';

describe('ButtonBar', () => {
  let component: ButtonBar;
  let fixture: ComponentFixture<ButtonBar>;

  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let filterMock: { setSearch: ReturnType<typeof vi.fn>; clearSearch: ReturnType<typeof vi.fn> };
  let selectionMock: { selected: ReturnType<typeof signal<any[]>> };
  let torrentStoreMock: { totalCount: ReturnType<typeof signal<number>> };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    filterMock = { setSearch: vi.fn(), clearSearch: vi.fn() };
    selectionMock = { selected: signal([]) };
    torrentStoreMock = { totalCount: signal(0) };

    await TestBed.configureTestingModule({
      imports: [ButtonBar],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: FilterService, useValue: filterMock },
        { provide: SelectionStoreService, useValue: selectionMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasSelection', () => {
    it('should be false when nothing is selected', () => {
      selectionMock.selected.set([]);
      expect(component.hasSelection()).toBe(false);
    });

    it('should be true when at least one torrent is selected', () => {
      selectionMock.selected.set([{ hash: 'a' }] as any);
      expect(component.hasSelection()).toBe(true);
    });
  });

  describe('trackBy', () => {
    it('should return a:id for action entries', () => {
      expect(component.trackBy(0, { kind: 'action', id: 'control.resume' } as any)).toBe(
        'a:control.resume',
      );
    });

    it('should return d:index for divider entries', () => {
      expect(component.trackBy(3, { kind: 'divider' } as any)).toBe('d:3');
    });
  });

  describe('clearSearchField', () => {
    it('should reset the search form control to empty', () => {
      component.searchForm.get('search')?.setValue('hello');
      component.clearSearchField();
      expect(component.searchForm.get('search')?.value).toBe('');
    });

    it('should call filterService.clearSearch', () => {
      component.clearSearchField();
      expect(filterMock.clearSearch).toHaveBeenCalled();
    });
  });

  describe('onClick', () => {
    it('should emit TORRENT_RESUME for control.resume', () => {
      component.onClick('control.resume');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_RESUME' });
    });

    it('should emit TORRENT_PAUSE for control.pause', () => {
      component.onClick('control.pause');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_PAUSE' });
    });

    it('should emit TORRENT_RESUME_ALL for control.resumeAll', () => {
      component.onClick('control.resumeAll');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_RESUME_ALL' });
    });

    it('should emit TORRENT_PAUSE_ALL for control.pauseAll', () => {
      component.onClick('control.pauseAll');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_PAUSE_ALL' });
    });

    it('should emit UI_OPEN_SETTINGS for settings.open', () => {
      component.onClick('settings.open');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_OPEN_SETTINGS' });
    });

    it('should emit UI_ADD_TORRENT for new.addTorrentFile', () => {
      component.onClick('new.addTorrentFile');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
    });

    it('should emit QUEUE_MOVE_TOP for queue.moveTop', () => {
      component.onClick('queue.moveTop');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_TOP' });
    });

    it('should emit QUEUE_MOVE_UP for queue.moveUp', () => {
      component.onClick('queue.moveUp');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_UP' });
    });

    it('should emit QUEUE_MOVE_DOWN for queue.moveDown', () => {
      component.onClick('queue.moveDown');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_DOWN' });
    });

    it('should emit QUEUE_MOVE_BOTTOM for queue.moveBottom', () => {
      component.onClick('queue.moveBottom');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_BOTTOM' });
    });

    it('should emit UI_TORRENT_DELETE_REQUEST with defaultRemoveFiles false by default', () => {
      component.onClick('delete.deleteTorrent');
      expect(commandBusMock.emit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: false,
      });
    });

    it('should throw for an unknown action id', () => {
      expect(() => component.onClick('unknown.action')).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `ButtonBar` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/main/button-bar/button-bar.spec.ts
git commit -m "#49: add tests for ButtonBar component"
```

---

## Task 5: Enhance `main/status/status.spec.ts`

**Files:**

- Modify: `src/app/pages/main/status/status.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/main/status/status.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { FilterService, GRID_FILTER_INITIAL } from '../../../services/filter.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { Status } from './status';

describe('Status', () => {
  let component: Status;
  let fixture: ComponentFixture<Status>;

  let filterMock: {
    external: ReturnType<typeof signal<typeof GRID_FILTER_INITIAL.external>>;
    clearStates: ReturnType<typeof vi.fn>;
    setStates: ReturnType<typeof vi.fn>;
    clearTrackers: ReturnType<typeof vi.fn>;
    setTrackers: ReturnType<typeof vi.fn>;
    clearSavePaths: ReturnType<typeof vi.fn>;
    setSavePaths: ReturnType<typeof vi.fn>;
    clearCategories: ReturnType<typeof vi.fn>;
    setCategories: ReturnType<typeof vi.fn>;
    clearTags: ReturnType<typeof vi.fn>;
    setTags: ReturnType<typeof vi.fn>;
    resetAll: ReturnType<typeof vi.fn>;
  };
  let torrentStoreMock: {
    totalCount: ReturnType<typeof signal<number>>;
    countsByState: ReturnType<typeof signal<Record<string, number>>>;
    torrentsArray: ReturnType<typeof signal<any[]>>;
    categoriesMap: ReturnType<typeof signal<Map<string, any>>>;
    tagsSet: ReturnType<typeof signal<Set<string>>>;
  };

  beforeEach(async () => {
    filterMock = {
      external: signal({ ...GRID_FILTER_INITIAL.external }),
      clearStates: vi.fn(),
      setStates: vi.fn(),
      clearTrackers: vi.fn(),
      setTrackers: vi.fn(),
      clearSavePaths: vi.fn(),
      setSavePaths: vi.fn(),
      clearCategories: vi.fn(),
      setCategories: vi.fn(),
      clearTags: vi.fn(),
      setTags: vi.fn(),
      resetAll: vi.fn(),
    };
    torrentStoreMock = {
      totalCount: signal(0),
      countsByState: signal({}),
      torrentsArray: signal([]),
      categoriesMap: signal(new Map()),
      tagsSet: signal(new Set()),
    };

    await TestBed.configureTestingModule({
      imports: [Status],
      providers: [
        { provide: FilterService, useValue: filterMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
        // TranslateService is globally provided via test-providers.ts
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Status);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('setGroup', () => {
    it('should call filterService.clearStates when key is "all"', () => {
      component.setGroup('all');
      expect(filterMock.clearStates).toHaveBeenCalled();
    });

    it('should call filterService.setStates with the downloading group', () => {
      component.setGroup('downloading');
      expect(filterMock.setStates).toHaveBeenCalledWith(
        expect.arrayContaining(['downloading', 'forcedDL', 'stalledDL']),
      );
    });

    it('should call filterService.setStates with the stopped group', () => {
      component.setGroup('stopped');
      expect(filterMock.setStates).toHaveBeenCalledWith(
        expect.arrayContaining(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      );
    });

    it('should call filterService.setStates with an empty array for unknown keys', () => {
      component.setGroup('nonexistent');
      expect(filterMock.setStates).toHaveBeenCalledWith([]);
    });
  });

  describe('setTrackerGroup', () => {
    it('should call clearTrackers when key is "all"', () => {
      component.setTrackerGroup('all');
      expect(filterMock.clearTrackers).toHaveBeenCalled();
    });

    it('should call setTrackers with the key when not "all"', () => {
      component.setTrackerGroup('tracker.example.com');
      expect(filterMock.setTrackers).toHaveBeenCalledWith(['tracker.example.com']);
    });
  });

  describe('setSavePathGroup', () => {
    it('should call clearSavePaths when key is "all"', () => {
      component.setSavePathGroup('all');
      expect(filterMock.clearSavePaths).toHaveBeenCalled();
    });

    it('should call setSavePaths with the key when not "all"', () => {
      component.setSavePathGroup('/downloads');
      expect(filterMock.setSavePaths).toHaveBeenCalledWith(['/downloads']);
    });
  });

  describe('setCategoryGroup', () => {
    it('should call clearCategories when key is "all"', () => {
      component.setCategoryGroup('all');
      expect(filterMock.clearCategories).toHaveBeenCalled();
    });

    it('should call setCategories with the key when not "all"', () => {
      component.setCategoryGroup('Movies');
      expect(filterMock.setCategories).toHaveBeenCalledWith(['Movies']);
    });
  });

  describe('setTagGroup', () => {
    it('should call clearTags when key is "all"', () => {
      component.setTagGroup('all');
      expect(filterMock.clearTags).toHaveBeenCalled();
    });

    it('should call setTags with the key when not "all"', () => {
      component.setTagGroup('hd');
      expect(filterMock.setTags).toHaveBeenCalledWith(['hd']);
    });
  });

  describe('clearAll', () => {
    it('should call filterService.resetAll', () => {
      component.clearAll();
      expect(filterMock.resetAll).toHaveBeenCalled();
    });
  });

  describe('activeKey', () => {
    it('should return "all" when no states filter is active', () => {
      filterMock.external.set({ ...GRID_FILTER_INITIAL.external, states: new Set() });
      expect(component.activeKey()).toBe('all');
    });

    it('should return "stopped" when the stopped states are active', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      });
      expect(component.activeKey()).toBe('stopped');
    });

    it('should return "all" for an unrecognised combination of states', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['downloading', 'uploading']),
      });
      expect(component.activeKey()).toBe('all');
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `Status` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/main/status/status.spec.ts
git commit -m "#49: add tests for Status component"
```

---

## Task 6: Enhance `settings/settings.spec.ts`

**Files:**

- Modify: `src/app/pages/settings/settings.spec.ts`

Note: `Settings` declares `providers: [SettingsStateService]` in its `@Component` decorator, which creates a component-level injector. The TestBed-level mock won't reach the component unless we use `overrideComponent` to replace that provider.

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/settings/settings.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { Settings } from './settings';
import { SettingsStateService } from './settings-state.service';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  let stateServiceMock: {
    isDirty: ReturnType<typeof signal<boolean>>;
    isDirtyMap: ReturnType<typeof signal<any>>;
    saveAll: ReturnType<typeof vi.fn>;
    resetDirty: ReturnType<typeof vi.fn>;
  };
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    stateServiceMock = {
      isDirty: signal(false),
      isDirtyMap: signal({
        general: false,
        server: false,
        'torrent-list-grid': false,
        'status-bar': false,
      }),
      saveAll: vi.fn().mockResolvedValue(undefined),
      resetDirty: vi.fn(),
    };
    confirmMock = { confirm: vi.fn().mockResolvedValue(false) };
    toastMock = { success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ToastService, useValue: toastMock },
        // TranslateService is globally provided via test-providers.ts
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Settings, {
        set: {
          providers: [{ provide: SettingsStateService, useValue: stateServiceMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('tabs', () => {
    it('should define exactly 4 tabs', () => {
      expect(component.tabs).toHaveLength(4);
    });

    it('should include general, server, torrent-list-grid and status-bar tabs', () => {
      const ids = component.tabs.map((t) => t.id);
      expect(ids).toContain('general');
      expect(ids).toContain('server');
      expect(ids).toContain('torrent-list-grid');
      expect(ids).toContain('status-bar');
    });
  });

  describe('selectTab', () => {
    it('should update the activeTabId signal', () => {
      component.selectTab('server');
      expect(component.activeTabId()).toBe('server');
    });

    it('should update again on subsequent calls', () => {
      component.selectTab('server');
      component.selectTab('status-bar');
      expect(component.activeTabId()).toBe('status-bar');
    });
  });

  describe('canDeactivate', () => {
    it('should return true immediately when the form is not dirty', async () => {
      stateServiceMock.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
      expect(confirmMock.confirm).not.toHaveBeenCalled();
    });

    it('should open a confirm dialog when dirty', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(false);
      await component.canDeactivate();
      expect(confirmMock.confirm).toHaveBeenCalled();
    });

    it('should reset dirty state and return true when the user confirms', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(true);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not reset dirty state and return false when the user cancels', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(false);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('onSave', () => {
    it('should call stateService.saveAll', async () => {
      await component.onSave();
      expect(stateServiceMock.saveAll).toHaveBeenCalled();
    });

    it('should show a success toast', async () => {
      await component.onSave();
      expect(toastMock.success).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `Settings` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/settings.spec.ts
git commit -m "#49: add tests for Settings component"
```

---

## Task 7: Enhance `settings/general/general.spec.ts`

**Files:**

- Modify: `src/app/pages/settings/general/general.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/settings/general/general.spec.ts
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
import { SettingsStateService } from '../settings-state.service';
import { General } from './general';

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;

  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: SettingsStateService, useValue: stateServiceMock },
        // TranslateService and GeneralSettingsService come from global providers / window.bitbutler mock
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getFamilyLogo', () => {
    it('should return the logo URL for a given family name', () => {
      expect(component.getFamilyLogo('aurora')).toBe('assets/images/bitbutler-logo-aurora.png');
    });

    it('should use the exact family name in the URL', () => {
      expect(component.getFamilyLogo('mint-green')).toBe(
        'assets/images/bitbutler-logo-mint-green.png',
      );
    });
  });

  describe('checkUpdates', () => {
    it('should emit UPDATE_CHECK_FOR_UPDATE', () => {
      component.checkUpdates();
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `General` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/general/general.spec.ts
git commit -m "#49: add tests for General settings tab"
```

---

## Task 8: Enhance `settings/server/server.spec.ts`

**Files:**

- Modify: `src/app/pages/settings/server/server.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/settings/server/server.spec.ts
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElectronService } from '../../../services/electron.service';
import { SettingsStateService } from '../settings-state.service';
import { Server } from './server';

describe('Server', () => {
  let component: Server;
  let fixture: ComponentFixture<Server>;

  let electronMock: {
    openPath: ReturnType<typeof vi.fn>;
    showOpenDialog: ReturnType<typeof vi.fn>;
  };
  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    electronMock = {
      openPath: vi.fn(),
      showOpenDialog: vi.fn().mockResolvedValue(null),
    };
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Server],
      providers: [
        { provide: ElectronService, useValue: electronMock },
        { provide: SettingsStateService, useValue: stateServiceMock },
        // ServerStoreService and ServerSettingsService resolve from global / window.bitbutler mock
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Server);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('pathMappings getter', () => {
    it('should return the pathMappings FormArray', () => {
      expect(component.pathMappings).toBe(component.serverSettingsForm.controls.pathMappings);
    });
  });

  describe('addPathMapping', () => {
    it('should add one new mapping to the array', () => {
      const before = component.pathMappings.length;
      component.addPathMapping();
      expect(component.pathMappings.length).toBe(before + 1);
    });

    it('new mapping should have empty remote and local controls', () => {
      component.addPathMapping();
      const last = component.pathMappings.at(component.pathMappings.length - 1);
      expect(last.get('remote')?.value).toBe('');
      expect(last.get('local')?.value).toBe('');
    });
  });

  describe('removePathMapping', () => {
    it('should remove the mapping at the given index when more than one exist', () => {
      component.addPathMapping(); // ensure at least 2
      const before = component.pathMappings.length;
      component.removePathMapping(0);
      expect(component.pathMappings.length).toBe(before - 1);
    });

    it('should reset the mapping to empty strings instead of removing when only one remains', () => {
      // Start from exactly 1 mapping
      while (component.pathMappings.length > 1) {
        component.removePathMapping(0);
      }
      component.pathMappings.at(0).patchValue({ remote: 'r', local: 'l' });
      component.removePathMapping(0);
      expect(component.pathMappings.length).toBe(1);
      expect(component.pathMappings.at(0).get('remote')?.value).toBe('');
      expect(component.pathMappings.at(0).get('local')?.value).toBe('');
    });
  });

  describe('testMapping', () => {
    it('should call electronService.openPath with the given path', () => {
      component.testMapping('/some/local/path');
      expect(electronMock.openPath).toHaveBeenCalledWith('/some/local/path');
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `Server` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/server/server.spec.ts
git commit -m "#49: add tests for Server settings tab"
```

---

## Task 9: Enhance `settings/status-bar/status-bar.spec.ts`

**Files:**

- Modify: `src/app/pages/settings/status-bar/status-bar.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/settings/status-bar/status-bar.spec.ts
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsStateService } from '../settings-state.service';
import { StatusBar } from './status-bar';

describe('StatusBar', () => {
  let component: StatusBar;
  let fixture: ComponentFixture<StatusBar>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StatusBar],
      providers: [
        { provide: SettingsStateService, useValue: stateServiceMock },
        // StatusBarSettingsService resolves from global / window.bitbutler mock
        // TranslateService resolves from global providers
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('drop', () => {
    it('should reorder items when dragged within the same container', () => {
      component.left = [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ];
      const container = { data: component.left } as any;
      component.drop({
        previousContainer: container,
        container,
        previousIndex: 0,
        currentIndex: 2,
      } as any);
      expect(component.left[0].id).toBe('b');
      expect(component.left[1].id).toBe('c');
      expect(component.left[2].id).toBe('a');
    });

    it('should transfer an item between containers', () => {
      component.left = [{ id: 'a', label: 'A' }];
      component.right = [{ id: 'b', label: 'B' }];
      component.drop({
        previousContainer: { data: component.left } as any,
        container: { data: component.right } as any,
        previousIndex: 0,
        currentIndex: 0,
      } as any);
      expect(component.right[0].id).toBe('a');
      expect(component.left).toHaveLength(0);
    });

    it('should mark status-bar as dirty after any drop', () => {
      component.left = [{ id: 'a', label: 'A' }];
      const container = { data: component.left } as any;
      component.drop({
        previousContainer: container,
        container,
        previousIndex: 0,
        currentIndex: 0,
      } as any);
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('status-bar', true);
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `StatusBar` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/status-bar/status-bar.spec.ts
git commit -m "#49: add tests for StatusBar settings tab"
```

---

## Task 10: Enhance `settings/torrent-list-grid/torrent-list-grid.spec.ts`

**Files:**

- Modify: `src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts`

- [ ] **Step 1: Replace the file with the following**

```typescript
// src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { SettingsStateService } from '../settings-state.service';
import { TorrentListGrid } from './torrent-list-grid';

const DEFAULT_SETTINGS = {
  columnState: [],
  pagination: true,
  animateRows: true,
  rowDoubleClickAction: 'DETAILS' as const,
  floatingFilters: false,
};

describe('TorrentListGrid', () => {
  let component: TorrentListGrid;
  let fixture: ComponentFixture<TorrentListGrid>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let gridSettingsMock: {
    asObservable: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    gridSettingsMock = {
      asObservable: vi.fn().mockReturnValue(of(DEFAULT_SETTINGS)),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TorrentListGrid],
      providers: [
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: TorrentListGridSettingsService, useValue: gridSettingsMock },
        // UiFormatService and TranslateService resolve from global providers
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentListGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('drop', () => {
    it('should reorder orderedColumns when an item is moved', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
        { value: 'progress', label: 'Progress' },
      ]);
      component.drop({ previousIndex: 0, currentIndex: 2 } as any);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids[0]).toBe('size');
      expect(ids[1]).toBe('progress');
      expect(ids[2]).toBe('name');
    });

    it('should mark torrent-list-grid as dirty after a drop', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.drop({ previousIndex: 0, currentIndex: 1 } as any);
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test
```

Expected: all new `TorrentListGrid` tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts
git commit -m "#49: add tests for TorrentListGrid settings tab"
```
