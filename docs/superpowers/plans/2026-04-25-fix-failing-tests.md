# Fix Failing Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 44 currently failing tests (plus 3 fakeAsync service spec files) by adding missing providers, correcting direct-instantiation patterns, and migrating Zone.js async helpers to vitest-compatible equivalents.

**Architecture:** Five categories of failure are addressed in dependency order: global providers first (fixes the most tests with the least code), then per-spec fixes by category. No source files are changed — only `*.spec.ts` files and `src/test-providers.ts`.

**Tech Stack:** Angular 20 (zoneless, standalone), `@angular/build:unit-test` vitest runner, `@ngx-translate/core` v17, `@ng-bootstrap/ng-bootstrap`, Angular CDK, vitest globals (`vi.fn`, `async`/`await`)

---

## Task 1: Extend global test providers

Fixes all `_TranslateService` and `_FilesizePipe` NG0201 errors across ~21 tests without touching their spec files.

`provideTranslateService()` is the standalone provider from `@ngx-translate/core` v17 (verified in the package's `index.d.ts`). `FilesizePipe` is not `providedIn: 'root'` but is injected by `UiFormatService` (which IS root-provided), so it must be globally registered.

**Files:**

- Modify: `src/test-providers.ts`

- [ ] **Step 1: Update test-providers.ts**

Replace the file content with:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesizePipe } from './app/pipes/filesize-pipe';

export default [provideZonelessChangeDetection(), provideTranslateService(), FilesizePipe];
```

- [ ] **Step 2: Run tests and verify the count improves**

```bash
npm test 2>&1 | grep "Test Files\|Tests "
```

Expected: at least 21 more tests pass (all TranslateService + 3 FilesizePipe). The failing count should drop from 44 to ≈23 (plus the 3 fakeAsync files).

- [ ] **Step 3: Commit**

```bash
git add src/test-providers.ts
git commit -m "#49: add global TranslateService and FilesizePipe providers for tests"
```

---

## Task 2: Fix pipes and directives using `new X()` directly

These 4 specs call `new PipeOrDirective()` in tests. That fails with NG0203 because all four use Angular's `inject()` function internally, which requires a DI context. Fix: obtain instances through `TestBed.inject()` for pipes; for the directive (which also needs a host element), create a host component.

**Files:**

- Modify: `src/app/pipes/humanize-duration-pipe.spec.ts`
- Modify: `src/app/pipes/ratio-limit-pipe.spec.ts`
- Modify: `src/app/pipes/time-limit-pipe.spec.ts`
- Modify: `src/app/directives/tooltip-overflow.spec.ts`

- [ ] **Step 1: Fix humanize-duration-pipe.spec.ts**

```ts
import { TestBed } from '@angular/core/testing';
import { HumanizeDurationPipe } from './humanize-duration-pipe';

describe('HumanizeDurationPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({ providers: [HumanizeDurationPipe] });
    const pipe = TestBed.inject(HumanizeDurationPipe);
    expect(pipe).toBeTruthy();
  });
});
```

- [ ] **Step 2: Fix ratio-limit-pipe.spec.ts**

```ts
import { TestBed } from '@angular/core/testing';
import { RatioLimitPipe } from './ratio-limit-pipe';

describe('RatioLimitPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({ providers: [RatioLimitPipe] });
    const pipe = TestBed.inject(RatioLimitPipe);
    expect(pipe).toBeTruthy();
  });
});
```

- [ ] **Step 3: Fix time-limit-pipe.spec.ts**

`TimeLimitPipe` injects both `HumanizeDurationPipe` and `TranslateService`. Both must be listed as providers (TranslateService is already global, HumanizeDurationPipe is not).

```ts
import { TestBed } from '@angular/core/testing';
import { HumanizeDurationPipe } from './humanize-duration-pipe';
import { TimeLimitPipe } from './time-limit-pipe';

describe('TimeLimitPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({ providers: [TimeLimitPipe, HumanizeDurationPipe] });
    const pipe = TestBed.inject(TimeLimitPipe);
    expect(pipe).toBeTruthy();
  });
});
```

- [ ] **Step 4: Fix tooltip-overflow.spec.ts**

`TooltipOverflow` uses `inject(NgbTooltip, { host: true, self: true })`, meaning it must be applied as an attribute on a host element that already has `NgbTooltip`. Use a small inline host component.

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TooltipOverflow } from './tooltip-overflow';

@Component({
  template: '<span ngbTooltip="tip" bbTooltipOverflow>text</span>',
  imports: [NgbTooltip, TooltipOverflow],
})
class TestHostComponent {}

describe('TooltipOverflow', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    const directive = fixture.debugElement
      .query(By.directive(TooltipOverflow))
      .injector.get(TooltipOverflow);
    expect(directive).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run tests and confirm all 4 now pass**

```bash
npm test 2>&1 | grep -E "humanize-duration|ratio-limit|time-limit|tooltip-overflow"
```

Expected: all 4 lines show `✓`.

- [ ] **Step 6: Commit**

```bash
git add src/app/pipes/humanize-duration-pipe.spec.ts \
        src/app/pipes/ratio-limit-pipe.spec.ts \
        src/app/pipes/time-limit-pipe.spec.ts \
        src/app/directives/tooltip-overflow.spec.ts
git commit -m "#49: fix pipe and directive specs to use TestBed.inject instead of new X()"
```

---

## Task 3: Fix modal component specs — missing `NgbActiveModal`

Modal content components inject `NgbActiveModal` from `@ng-bootstrap/ng-bootstrap`. When tested in isolation (not opened through `NgbModal`), this token has no provider. Fix: add `NgbActiveModal` to `providers` in each spec.

The `Settings` page also injects `SettingsStateService` (not `providedIn: 'root'`), so it needs both providers.

**Files (12 simple — only need NgbActiveModal):**

- Modify: `src/app/components/modals/about/about.spec.ts`
- Modify: `src/app/components/add-torrent/add-torrent.spec.ts`
- Modify: `src/app/components/modals/delete-torrent/delete-torrent.spec.ts`
- Modify: `src/app/components/modals/limit-torrent-share/limit-torrent-share.spec.ts`
- Modify: `src/app/components/modals/limit-transfer-rate/limit-transfer-rate.spec.ts`
- Modify: `src/app/components/modals/rename-torrent/rename-torrent.spec.ts`
- Modify: `src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts`
- Modify: `src/app/components/modals/set-torrent-location/set-torrent-location.spec.ts`
- Modify: `src/app/components/modals/set-torrent-tags/set-torrent-tags.spec.ts`
- Modify: `src/app/components/modals/torrent-exists/torrent-exists.spec.ts`
- Modify: `src/app/components/modals/update-available/update-available.spec.ts`
- Modify: `src/app/components/modals/torrent-details/torrent-details.spec.ts`

**Files (2 special — need NgbActiveModal + another provider):**

- Modify: `src/app/components/modals/confirm/confirm.spec.ts`
- Modify: `src/app/pages/settings/settings.spec.ts`

The 12 simple cases all follow this exact same pattern — add `NgbActiveModal` to `providers`:

- [ ] **Step 1: Apply the NgbActiveModal provider fix to the 12 simple modal specs**

For each of the 12 files listed above, find the `TestBed.configureTestingModule` call and add `NgbActiveModal` to its `providers` array. The full corrected shape is always:

```ts
// At the top: add this import
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

// In configureTestingModule:
await TestBed.configureTestingModule({
  imports: [ComponentName], // keep existing import
  providers: [NgbActiveModal], // add this line
}).compileComponents();
```

Apply this pattern to all 12 files. Example for `about.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { About } from './about';

describe('About', () => {
  let component: About;
  let fixture: ComponentFixture<About>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [About],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

Repeat identically for the other 11 files, substituting the correct class name and import path in each.

- [ ] **Step 2: Fix confirm.spec.ts — NgbActiveModal only**

`Confirm` only injects `NgbActiveModal` (no `TranslateService` since it has no translate usage in the source). Apply the same pattern:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Confirm } from './confirm';

describe('Confirm', () => {
  let component: Confirm;
  let fixture: ComponentFixture<Confirm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Confirm],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(Confirm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 3: Fix settings.spec.ts — NgbActiveModal + SettingsStateService**

`Settings` injects both `NgbActiveModal` and `SettingsStateService`. `SettingsStateService` is `@Injectable()` with no `providedIn`, so it must be added to providers:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Settings } from './settings';
import { SettingsStateService } from './settings-state.service';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [NgbActiveModal, SettingsStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run tests and confirm all 14 modal specs now pass**

```bash
npm test 2>&1 | grep -E "about|add-torrent|delete-torrent|limit-torrent|limit-transfer|rename-torrent|set-torrent-category|set-torrent-location|set-torrent-tags|torrent-exists|update-available|torrent-details|confirm|settings\.spec"
```

Expected: all matching lines show `✓`.

- [ ] **Step 5: Commit**

```bash
git add \
  src/app/components/modals/about/about.spec.ts \
  src/app/components/add-torrent/add-torrent.spec.ts \
  src/app/components/modals/delete-torrent/delete-torrent.spec.ts \
  src/app/components/modals/limit-torrent-share/limit-torrent-share.spec.ts \
  src/app/components/modals/limit-transfer-rate/limit-transfer-rate.spec.ts \
  src/app/components/modals/rename-torrent/rename-torrent.spec.ts \
  src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts \
  src/app/components/modals/set-torrent-location/set-torrent-location.spec.ts \
  src/app/components/modals/set-torrent-tags/set-torrent-tags.spec.ts \
  src/app/components/modals/torrent-exists/torrent-exists.spec.ts \
  src/app/components/modals/update-available/update-available.spec.ts \
  src/app/components/modals/torrent-details/torrent-details.spec.ts \
  src/app/components/modals/confirm/confirm.spec.ts \
  src/app/pages/settings/settings.spec.ts
git commit -m "#49: add NgbActiveModal (and SettingsStateService where needed) to modal spec providers"
```

---

## Task 4: Fix remaining individual component specs

Three specs have unique provider requirements that don't fit the previous patterns.

**Files:**

- Modify: `src/app/pages/settings/server/server.spec.ts`
- Modify: `src/app/pages/main/grid/context-menu/context-menu.spec.ts`
- Modify: `src/app/components/modals/torrent-details/peers/flag-cell-renderer/flag-cell-renderer.spec.ts`

- [ ] **Step 1: Fix server.spec.ts — add SettingsStateService**

`Server` (the settings sub-page at `src/app/pages/settings/server/server.ts`) injects `SettingsStateService` which is not `providedIn: 'root'`.

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsStateService } from '../settings-state.service';
import { Server } from './server';

describe('Server', () => {
  let component: Server;
  let fixture: ComponentFixture<Server>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Server],
      providers: [SettingsStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(Server);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 2: Fix context-menu.spec.ts — provide OverlayRef mock and CONTEXT_MENU_CONFIG**

`ContextMenu` is designed to be instantiated programmatically as a CDK overlay. It injects `OverlayRef` (an instance token, not a service) and `CONTEXT_MENU_CONFIG` (a custom `InjectionToken`). Both must be mocked.

```ts
import { Overlay } from '@angular/cdk/overlay';
import { OverlayModule } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenu } from './context-menu';
import { CONTEXT_MENU_CONFIG } from './context-menu.tokens';

describe('ContextMenu', () => {
  let component: ContextMenu;
  let fixture: ComponentFixture<ContextMenu>;

  beforeEach(async () => {
    const overlayRefMock = {
      dispose: vi.fn(),
      detach: vi.fn(),
      detachments: () => ({ pipe: () => ({ subscribe: vi.fn() }) }),
    };

    await TestBed.configureTestingModule({
      imports: [ContextMenu, OverlayModule],
      providers: [
        { provide: OverlayRef, useValue: overlayRefMock },
        { provide: CONTEXT_MENU_CONFIG, useValue: { items: [] } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

Add the missing import at the top:

```ts
import { OverlayRef } from '@angular/cdk/overlay';
```

- [ ] **Step 3: Fix flag-cell-renderer.spec.ts — call agInit before detectChanges**

`FlagCellRenderer` implements `ICellRendererAngularComp`. The template binds `params.value` but `params` starts as `undefined` (declared with `!` non-null assertion). Angular throws when it tries to render `'fi-' + undefined`. Fix: call `component.agInit(...)` before `fixture.detectChanges()`.

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagCellRenderer } from './flag-cell-renderer';

describe('FlagCellRenderer', () => {
  let component: FlagCellRenderer;
  let fixture: ComponentFixture<FlagCellRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlagCellRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(FlagCellRenderer);
    component = fixture.componentInstance;
    component.agInit({ value: 'us' } as any);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run tests and confirm all 3 pass**

```bash
npm test 2>&1 | grep -E "server\.spec|context-menu|flag-cell"
```

Expected: all 3 lines show `✓`.

- [ ] **Step 5: Commit**

```bash
git add \
  src/app/pages/settings/server/server.spec.ts \
  src/app/pages/main/grid/context-menu/context-menu.spec.ts \
  src/app/components/modals/torrent-details/peers/flag-cell-renderer/flag-cell-renderer.spec.ts
git commit -m "#49: fix server, context-menu, and flag-cell-renderer specs with correct providers"
```

---

## Task 5: Fix service specs — replace `fakeAsync`/`tick` with `async`/`await`

These 3 spec files use Angular's `fakeAsync` + `tick()` helper, which requires Zone.js test support. The app is zoneless, so Zone.js testing setup is not loaded. Fix: replace `fakeAsync`/`tick` with standard `async`/`await` + a `flushPromises` helper that drains the microtask queue.

The `flushPromises` pattern works because `setTimeout(resolve, 0)` runs after all queued microtasks (Promise `.then()` callbacks). Each RxJS observable+Promise chain in these services resolves within one such round.

**Files:**

- Modify: `src/app/services/server-command-handler.service.spec.ts`
- Modify: `src/app/services/transfer-limit-command-handler.service.spec.ts`
- Modify: `src/app/services/update-command-handler.service.spec.ts`

- [ ] **Step 1: Rewrite server-command-handler.service.spec.ts**

Remove the `fakeAsync` and `tick` imports. Replace every `fakeAsync(() => { ... tick() ... })` block with `async () => { ... await flushPromises() ... }`. Add the local `flushPromises` helper at the top of the describe block.

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ServerCommandHandlerService } from './server-command-handler.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('ServerCommandHandlerService', () => {
  let service: ServerCommandHandlerService;
  let commands$: Subject<any>;
  let serverStoreRefresh: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    serverStoreRefresh = vi.fn().mockResolvedValue(undefined);
    toastSuccess = vi.fn();
    toastInfo = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ServerCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: ServerStoreService,
          useValue: {
            refresh: serverStoreRefresh,
            servers: signal([{ id: '1', name: 'Test Server' }]),
            select: vi.fn(),
          },
        },
        {
          provide: ServerService,
          useValue: { delete: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ToastService, useValue: { success: toastSuccess, info: toastInfo } },
      ],
    });

    service = TestBed.inject(ServerCommandHandlerService);
    service.start();
  });

  it('should show success toast after SERVER_ADDED', async () => {
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith('Server Test Server added!');
  });

  it('should not crash the subscription if a command throws', async () => {
    serverStoreRefresh.mockRejectedValueOnce(new Error('network error'));
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    await flushPromises();

    serverStoreRefresh.mockResolvedValueOnce(undefined);
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rewrite transfer-limit-command-handler.service.spec.ts**

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TransferLimitCommandHandlerService } from './transfer-limit-command-handler.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('TransferLimitCommandHandlerService', () => {
  let service: TransferLimitCommandHandlerService;
  let commands$: Subject<any>;
  let getAltState: ReturnType<typeof vi.fn>;
  let toggleAlt: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    getAltState = vi.fn().mockResolvedValue(false);
    toggleAlt = vi.fn().mockResolvedValue(undefined);
    toastInfo = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        TransferLimitCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: QbService,
          useValue: {
            getAlternativeSpeedLimitState: getAltState,
            toggleAlternativeSpeedLimit: toggleAlt,
          },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: ToastService, useValue: { info: toastInfo } },
      ],
    });

    service = TestBed.inject(TransferLimitCommandHandlerService);
    service.start();
  });

  it('should show info toast on toggle', async () => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalledWith('Turning alternative speed limit ON');
  });

  it('should ignore a second toggle while first is in-flight (exhaustMap)', async () => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    await flushPromises();
    expect(getAltState).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Rewrite update-command-handler.service.spec.ts**

```ts
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';
import { UpdateCommandHandlerService } from './update-command-handler.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('UpdateCommandHandlerService', () => {
  let service: UpdateCommandHandlerService;
  let commands$: Subject<any>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;
  let commandBusEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    checkForUpdate = vi.fn().mockResolvedValue({ updateAvailable: false, error: null });
    toastSuccess = vi.fn();
    toastDanger = vi.fn();
    commandBusEmit = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        UpdateCommandHandlerService,
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: commandBusEmit },
        },
        { provide: ElectronService, useValue: { checkForUpdate } },
        { provide: ToastService, useValue: { success: toastSuccess, danger: toastDanger } },
      ],
    });

    service = TestBed.inject(UpdateCommandHandlerService);
    service.start();
  });

  it('should show success toast when no update available', async () => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith('Your are on the latest version!');
  });

  it('should emit UI_UPDATE_AVAILABLE when update is found', async () => {
    const update = { updateAvailable: true, error: null, version: '2.0.0' };
    checkForUpdate.mockResolvedValueOnce(update);
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    await flushPromises();
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_UPDATE_AVAILABLE', update });
  });

  it('should ignore second check while first is in-flight (exhaustMap)', async () => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    await flushPromises();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run the 3 service specs and confirm they pass**

```bash
npm test 2>&1 | grep -E "server-command-handler|transfer-limit-command-handler|update-command-handler"
```

Expected: all 3 lines show `✓ |bitbutler|`.

- [ ] **Step 5: Run full test suite and confirm 0 failures**

```bash
npm test 2>&1 | grep "Test Files\|Tests "
```

Expected:

```
Test Files  0 failed | 63 passed (63)
      Tests  0 failed | 79 passed (79)
```

If there are remaining failures, note the error message and component name — they likely need the same treatment as a task above but with a slightly different provider combination.

- [ ] **Step 6: Commit**

```bash
git add \
  src/app/services/server-command-handler.service.spec.ts \
  src/app/services/transfer-limit-command-handler.service.spec.ts \
  src/app/services/update-command-handler.service.spec.ts
git commit -m "#49: replace fakeAsync/tick with async/flushPromises in service specs"
```
