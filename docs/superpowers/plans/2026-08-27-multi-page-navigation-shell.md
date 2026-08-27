# Multi-Page Navigation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a persistent, non-collapsible right-hand navigation rail behind a new routing shell, and fix the polling-lifecycle bug (store cleared on every remount, even when resuming the same server) that any future sibling route would otherwise expose.

**Architecture:** A new `Shell` component becomes the routed component at `/pages`, owning a nested `<router-outlet>` and a new `NavRail` component. The existing `Main` component moves underneath it, unchanged in content, at the child route `torrent-list`. `Login` moves from `pages/login` to a top-level `/login` route. `QbPollingService` becomes the sole owner of the "is this a fresh start or a same-server resume" decision, including clearing `TorrentStoreService` - `Main` stops clearing the store itself.

**Tech Stack:** Angular 22 (zoneless, standalone components, signals), Angular Router, RxJS, `@ngx-translate/core`, `@ng-bootstrap/ng-bootstrap`, `@fortawesome/angular-fontawesome`, Vitest (via `@angular/build:unit-test`).

**Spec:** `docs/superpowers/specs/2026-08-27-multi-page-navigation-shell-design.md`

## Global Constraints

- No rail icon other than Torrents. No disabled/"coming soon" placeholders for Statistics/Log Viewer/Settings.
- Do not register `/pages/settings` or `/pages/logs` routes, and do not create placeholder components for them.
- Settings keeps opening as an `NgbModal` via the existing `UI_OPEN_SETTINGS` command - unchanged.
- The nav rail is fixed-width and not collapsible - no toggle button, no collapsed/expanded states.
- The nav rail is right-aligned and has no logo/brand mark of its own.
- Any new user-facing rail text needs entries in both `packages/app/public/i18n/us.json` and `packages/app/public/i18n/hu.json`.
- `QbPollingService` is the sole owner of the fresh-start-vs-resume decision, including clearing `TorrentStoreService`. `Main` must not call `torrentStore.clear()` itself.
- No new "which routes need polling" orchestration service - `Main` keeps owning when to start/stop its own polling subscription.
- `Main.ngOnDestroy()` keeps only unsubscribing its local subscription - it must not call `QbPollingService.stopPolling()`.
- The brand/server-status block stays inside `Main` - it is not hoisted into `Shell` in this change.
- No changes to `packages/electron/src/menu.ts` or `MenuBarCommandHandlerService`.

---

## Task 1: `QbPollingService` owns clearing the torrent store

**Files:**

- Modify: `packages/app/src/app/services/qb-polling.service.ts`
- Test: `packages/app/src/app/services/qb-polling.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentStoreService.clear(): void` and `TorrentStoreService.torrentsMap(): TorrentMap` (both existing, from `packages/app/src/app/services/torrent-store.service.ts`)
- Produces: `QbPollingService.startMaindataPolling(serverId: string): Observable<Maindata>` - signature unchanged; later tasks keep calling it exactly as today.

- [ ] **Step 1: Write the failing tests**

Add the import and a `mockTorrentStore` variable, and wire it into the existing `beforeEach`'s `TestBed.configureTestingModule`:

```ts
// At the top of packages/app/src/app/services/qb-polling.service.spec.ts, add:
import { TorrentStoreService } from './torrent-store.service';
```

Replace the existing `beforeEach` block:

```ts
beforeEach(() => {
  mockQbService = {
    sync: {
      maindata: vi.fn().mockResolvedValue({ rid: 1 }),
      torrentPeers: vi.fn().mockResolvedValue({ rid: 1, peers: {} }),
    },
  };

  mockWindowService = {
    state: signal({
      height: 0,
      isFullScreen: false,
      isMaximized: false,
      isMinimized: false,
      width: 0,
    }),
  };

  mockServerSettings = {
    load: vi.fn().mockResolvedValue({ polling: { foreground: 2000, background: 5000 } }),
    asObservable: vi.fn().mockReturnValue(new Subject()),
  };

  TestBed.configureTestingModule({
    providers: [
      QbPollingService,
      { provide: QbService, useValue: mockQbService },
      { provide: WindowService, useValue: mockWindowService },
      { provide: ServerSettingsService, useValue: mockServerSettings },
    ],
  });

  service = TestBed.inject(QbPollingService);
});
```

with:

```ts
let mockTorrentStore: any;

beforeEach(() => {
  mockQbService = {
    sync: {
      maindata: vi.fn().mockResolvedValue({ rid: 1 }),
      torrentPeers: vi.fn().mockResolvedValue({ rid: 1, peers: {} }),
    },
  };

  mockWindowService = {
    state: signal({
      height: 0,
      isFullScreen: false,
      isMaximized: false,
      isMinimized: false,
      width: 0,
    }),
  };

  mockServerSettings = {
    load: vi.fn().mockResolvedValue({ polling: { foreground: 2000, background: 5000 } }),
    asObservable: vi.fn().mockReturnValue(new Subject()),
  };

  mockTorrentStore = {
    clear: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      QbPollingService,
      { provide: QbService, useValue: mockQbService },
      { provide: WindowService, useValue: mockWindowService },
      { provide: ServerSettingsService, useValue: mockServerSettings },
      { provide: TorrentStoreService, useValue: mockTorrentStore },
    ],
  });

  service = TestBed.inject(QbPollingService);
});
```

Then add two new `describe` blocks, placed right after the existing `'should reset the rid to 0 when restarting polling for a different server'` test and before `describe('pause / resume', ...)`:

```ts
describe('clearing the torrent store', () => {
  it('should clear the torrent store on a fresh start for a new server', async () => {
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);

    const sub2 = service.startMaindataPolling('server-2').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub2.unsubscribe();

    expect(mockTorrentStore.clear).toHaveBeenCalledTimes(2);
  });

  it('should not clear the torrent store when resuming polling for the same server', async () => {
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);

    const sub2 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub2.unsubscribe();

    expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);
  });

  it('should clear the torrent store again after stopPolling() resets fresh-start tracking, even for the same server', async () => {
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    service.stopPolling();

    const sub2 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub2.unsubscribe();

    expect(mockTorrentStore.clear).toHaveBeenCalledTimes(2);
  });
});

describe('data preservation across a same-server restart', () => {
  let realTorrentStore: TorrentStoreService;
  let realService: QbPollingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        QbPollingService,
        TorrentStoreService,
        { provide: QbService, useValue: mockQbService },
        { provide: WindowService, useValue: mockWindowService },
        { provide: ServerSettingsService, useValue: mockServerSettings },
      ],
    });

    realTorrentStore = TestBed.inject(TorrentStoreService);
    realService = TestBed.inject(QbPollingService);
  });

  it('should not lose torrents that did not change when restarting polling for the same server without an intervening stopPolling()', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({
      rid: 1,
      full_update: true,
      torrents: {
        'hash-a': { name: 'Torrent A' },
        'hash-b': { name: 'Torrent B' },
      },
    });

    const sub1 = realService.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    expect(realTorrentStore.torrentsMap().size).toBe(2);

    // Simulate a remount (e.g. navigating to another page and back) without an intervening
    // stopPolling() call - lastPolledServerId is still 'server-1', so this is a resume, not
    // a fresh start, and the response below is a delta containing only hash-b.
    mockQbService.sync.maindata.mockResolvedValueOnce({
      rid: 2,
      full_update: false,
      torrents: {
        'hash-b': { name: 'Torrent B (updated)' },
      },
    });

    const sub2 = realService.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub2.unsubscribe();

    expect(realTorrentStore.torrentsMap().has('hash-a')).toBe(true);
    expect(realTorrentStore.torrentsMap().get('hash-b')?.name).toBe('Torrent B (updated)');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - the new tests in `clearing the torrent store` and `data preservation across a same-server restart` fail (`mockTorrentStore.clear` is never called; `hash-a` is missing after the second response). All previously-passing tests in the file still pass.

- [ ] **Step 3: Implement the fix**

In `packages/app/src/app/services/qb-polling.service.ts`, add the import:

```ts
import { TorrentStoreService } from './torrent-store.service';
```

Add the injection alongside the other injected services:

```ts
  private qb = inject(QbService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly windowService = inject(WindowService);
  private readonly torrentStore = inject(TorrentStoreService);
```

In `startMaindataPolling()`, change:

```ts
this.stopPolling$.next();
this._pauseTokens$.next(new Set());
if (isFreshStart) {
  this.maindataRid$.next(0);
}
```

to:

```ts
this.stopPolling$.next();
this._pauseTokens$.next(new Set());
if (isFreshStart) {
  this.maindataRid$.next(0);
  this.torrentStore.clear();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all tests in `qb-polling.service.spec.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/qb-polling.service.ts packages/app/src/app/services/qb-polling.service.spec.ts
git commit -m "#319: move torrent store clearing into QbPollingService"
```

---

## Task 2: `Main` stops clearing the torrent store itself

**Files:**

- Modify: `packages/app/src/app/pages/main/main.ts`
- Modify: `packages/app/src/app/pages/main/main.spec.ts`

**Interfaces:**

- Consumes: `QbPollingService.startMaindataPolling(serverId: string): Observable<Maindata>` (from Task 1, signature unchanged)
- Produces: no change to `Main`'s own public shape - it keeps its existing selector `app-main` and inputs/outputs (none).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `packages/app/src/app/pages/main/main.spec.ts` with:

```ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
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
    refresh: ReturnType<typeof vi.fn>;
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

  let torrentStoreMock: {
    applyMaindata: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  let qbPollingMock: {
    startMaindataPolling: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ThemeService, useValue: themeMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: QbPollingService, useValue: qbPollingMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Main, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(Main);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    themeMock = {
      family: signal('bitbutler'),
      effectiveMode: signal<'dark' | 'light'>('dark'),
    };
    serverStoreMock = {
      currentServer: signal(null),
      currentServerId: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    torrentStoreMock = {
      applyMaindata: vi.fn(),
      clear: vi.fn(),
    };
    qbPollingMock = {
      startMaindataPolling: vi.fn().mockReturnValue(new Subject()),
    };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  describe('theme', () => {
    it('should be the effectiveMode signal from ThemeService', async () => {
      await createComponent();
      expect(component.theme).toBe(themeMock.effectiveMode);
    });
  });

  describe('currentServer', () => {
    it('should be the currentServer signal from ServerStoreService', async () => {
      await createComponent();
      expect(component.currentServer).toBe(serverStoreMock.currentServer);
    });
  });

  describe('serverState', () => {
    it('should be null initially', async () => {
      await createComponent();
      expect(component.serverState()).toBeNull();
    });
  });

  describe('polling', () => {
    it('should start polling the new server on switch', async () => {
      await createComponent();
      expect(qbPollingMock.startMaindataPolling).not.toHaveBeenCalled();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledWith('server-1');
    });

    it('should start polling again on a subsequent switch to another server', async () => {
      await createComponent();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledTimes(2);
      expect(qbPollingMock.startMaindataPolling).toHaveBeenLastCalledWith('server-2');
    });

    // Clearing the store on a fresh start (vs. resuming the same server) is QbPollingService's
    // call, not Main's - it is the only thing that knows whether a restart is a genuine reset
    // or a same-server resume. See QbPollingService's own spec for that coverage.
    it('should never clear the torrent store itself', async () => {
      await createComponent();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(torrentStoreMock.clear).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `'should never clear the torrent store itself'` fails, because `Main` still calls `torrentStore.clear()`.

- [ ] **Step 3: Implement the fix**

In `packages/app/src/app/pages/main/main.ts`, change:

```ts
  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.serverState.set(null);

    if (!serverId) return;

    this.torrentStore.clear();

    const sub = new Subscription();
    this.pollSub = sub;
```

to:

```ts
  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.serverState.set(null);

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all tests in `main.spec.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/main.ts packages/app/src/app/pages/main/main.spec.ts
git commit -m "#319: stop Main from clearing the torrent store directly"
```

---

## Task 3: `NavRail` component

**Files:**

- Create: `packages/app/src/app/pages/shell/nav-rail/nav-rail.ts`
- Create: `packages/app/src/app/pages/shell/nav-rail/nav-rail.html`
- Create: `packages/app/src/app/pages/shell/nav-rail/nav-rail.scss`
- Test: `packages/app/src/app/pages/shell/nav-rail/nav-rail.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `NavRail` component, selector `app-nav-rail`, no inputs/outputs. Used by `Shell` in Task 4.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/pages/shell/nav-rail/nav-rail.spec.ts`:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NavRail } from './nav-rail';

describe('NavRail', () => {
  let fixture: ComponentFixture<NavRail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavRail, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavRail);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render exactly one link, to the torrent list route', () => {
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/pages/torrent-list');
  });

  it('should give the torrent list link an accessible label', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('aria-label')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL with a module-resolution error - `./nav-rail` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `packages/app/src/app/pages/shell/nav-rail/nav-rail.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faList } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive, FontAwesomeModule, NgbTooltip, TranslatePipe],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRail {
  public readonly icons = { faList };
}
```

Create `packages/app/src/app/pages/shell/nav-rail/nav-rail.html`:

```html
<nav
  class="bb-nav-rail d-flex flex-column align-items-center"
  [attr.aria-label]="'pages.shell.nav.label' | translate"
>
  <a
    class="bb-nav-rail-item"
    routerLink="/pages/torrent-list"
    routerLinkActive="active"
    [ngbTooltip]="'pages.shell.nav.torrents' | translate"
    placement="start"
    [attr.aria-label]="'pages.shell.nav.torrents' | translate"
  >
    <fa-icon [icon]="icons.faList"></fa-icon>
  </a>
</nav>
```

Create `packages/app/src/app/pages/shell/nav-rail/nav-rail.scss`:

```scss
:host {
  --bb-nav-rail-width: 56px;
  display: block;
  height: 100%;
}

.bb-nav-rail {
  width: var(--bb-nav-rail-width);
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  background-color: var(--bs-card-bg);
  border-left: 1px solid var(--bs-border-color);
  padding: 12px 0;
  gap: 8px;
}

.bb-nav-rail-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--bb-control-placeholder);
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background-color: var(--bb-hover-list-item-bg);
    color: var(--bs-body-color);
  }

  &.active {
    background-color: var(--bb-active-list-item-bg);
    color: var(--bs-body-color);
  }
}
```

In `packages/app/public/i18n/us.json`, insert a new `shell` key between the existing `login` and `main` keys under `pages`. Change:

```json
      "delete-confirm": {
        "title": "Delete Host",
        "message": "Are you sure you want to delete {{name}}?"
      }
    },
    "main": {
```

to:

```json
      "delete-confirm": {
        "title": "Delete Host",
        "message": "Are you sure you want to delete {{name}}?"
      }
    },
    "shell": {
      "nav": {
        "label": "Page navigation",
        "torrents": "Torrents"
      }
    },
    "main": {
```

In `packages/app/public/i18n/hu.json`, make the matching change. Change:

```json
      "delete-confirm": {
        "title": "Host törlése",
        "message": "Biztosan törölni szeretnéd a következőt: {{name}}?"
      }
    },
    "main": {
```

to:

```json
      "delete-confirm": {
        "title": "Host törlése",
        "message": "Biztosan törölni szeretnéd a következőt: {{name}}?"
      }
    },
    "shell": {
      "nav": {
        "label": "Oldal navigáció",
        "torrents": "Torrentek"
      }
    },
    "main": {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all three `NavRail` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/shell/nav-rail packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#319: add the nav rail component"
```

---

## Task 4: `Shell` component

**Files:**

- Create: `packages/app/src/app/pages/shell/shell.ts`
- Create: `packages/app/src/app/pages/shell/shell.html`
- Create: `packages/app/src/app/pages/shell/shell.scss`
- Test: `packages/app/src/app/pages/shell/shell.spec.ts`

**Interfaces:**

- Consumes: `NavRail` (selector `app-nav-rail`, from Task 3).
- Produces: `Shell` component, selector `app-shell`, no inputs/outputs. Used as the routed component for `/pages` in Task 5.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/pages/shell/shell.spec.ts`:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a router-outlet', () => {
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render the nav rail', () => {
    expect(fixture.nativeElement.querySelector('app-nav-rail')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL with a module-resolution error - `./shell` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `packages/app/src/app/pages/shell/shell.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavRail } from './nav-rail/nav-rail';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, NavRail],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {}
```

Create `packages/app/src/app/pages/shell/shell.html`:

```html
<div class="d-flex flex-row vw-100 vh-100">
  <div class="flex-grow-1 min-w-0 min-h-0">
    <router-outlet></router-outlet>
  </div>

  <app-nav-rail></app-nav-rail>
</div>
```

Create `packages/app/src/app/pages/shell/shell.scss`:

```scss
.min-h-0 {
  min-height: 0 !important;
}

.min-w-0 {
  min-width: 0 !important;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all three `Shell` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/shell/shell.ts packages/app/src/app/pages/shell/shell.html packages/app/src/app/pages/shell/shell.scss packages/app/src/app/pages/shell/shell.spec.ts
git commit -m "#319: add the Shell component"
```

---

## Task 5: Wire up routing

**Files:**

- Modify: `packages/app/src/app/app.routes.ts`
- Modify: `packages/app/src/app/pages/main/main.html`
- Modify: `packages/app/src/app/pages/login/login.ts`
- Modify: `packages/app/src/app/pages/login/login.spec.ts`

**Interfaces:**

- Consumes: `Shell` (selector `app-shell`, from Task 4), `Main` (existing, unchanged selector `app-main`), `Login` (existing, unchanged selector `app-login`).
- Produces: the final route tree - `/login`, `/pages` (→ `Shell`) with child `torrent-list` (→ `Main`), and the `**` fallback.

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/pages/login/login.spec.ts`, change:

```ts
expect(router.navigate).toHaveBeenCalledWith(['/pages/main']);
```

to:

```ts
expect(router.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `Login.connect()` still navigates to `/pages/main`.

- [ ] **Step 3: Update `Login`'s navigation target**

In `packages/app/src/app/pages/login/login.ts`, change:

```ts
await this.windowService.setOpenFilesEnabled(true);
loadingModalRef.close();
this.router.navigate(['/pages/main']);
```

to:

```ts
await this.windowService.setOpenFilesEnabled(true);
loadingModalRef.close();
this.router.navigate(['/pages/torrent-list']);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - the updated assertion in `login.spec.ts` passes.

- [ ] **Step 5: Restructure the route table**

Replace the full contents of `packages/app/src/app/app.routes.ts` with:

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((mod) => mod.Login),
  },
  {
    path: 'pages',
    loadComponent: () => import('./pages/shell/shell').then((mod) => mod.Shell),
    children: [
      {
        path: 'torrent-list',
        loadComponent: () => import('./pages/main/main').then((mod) => mod.Main),
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

- [ ] **Step 6: Fix `Main`'s root layout to fill its new parent instead of the viewport**

`Main` now renders inside `Shell`'s content column instead of directly under the app's root `<router-outlet>`, so it must size itself to that column (`100%` of its parent) rather than the whole viewport. In `packages/app/src/app/pages/main/main.html`, change:

```html
<div class="d-flex flex-row vw-100 vh-100"></div>
```

to:

```html
<div class="d-flex flex-row w-100 h-100"></div>
```

- [ ] **Step 7: Verify the full app still builds and all tests pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - the full `@bitbutler/app` suite passes, including `app.spec.ts`, `login.spec.ts`, `main.spec.ts`, `qb-polling.service.spec.ts`, `shell.spec.ts`, and `nav-rail.spec.ts`.

Run: `npm run build --workspace=@bitbutler/app`
Expected: PASS - the production build compiles cleanly, confirming the lazy-loaded route imports (`./pages/shell/shell`, `./pages/main/main`, `./pages/login/login`) all resolve.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/app.routes.ts packages/app/src/app/pages/main/main.html packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts
git commit -m "#319: wire the shell into the route table"
```

---

## Manual verification (after all tasks)

Once all tasks are committed, start the app (`npm start`) and confirm:

1. Launching the app with no active session lands on `/login`.
2. Logging in navigates to `/pages/torrent-list` and shows the torrent grid exactly as before, with the new nav rail fixed to the right edge, showing a single highlighted Torrents icon.
3. The existing filter sidebar inside `Main` still collapses/expands independently of the rail, which never changes size.
4. Triggering a session expiry (or manually logging out and back into the same server) no longer clears torrents that didn't change while logged out - this is the regression the design spec calls out, covered automatically by Task 1's integration test, but worth confirming once live.
