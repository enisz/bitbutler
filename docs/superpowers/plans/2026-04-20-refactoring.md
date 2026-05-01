# BitButler Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix async anti-patterns in command handlers, eliminate code duplication, migrate FilterService to signals, clean up modal dismiss handling, and extract keyboard navigation and row pinning out of the Grid component into focused local services.

**Architecture:** Five independent refactors applied in dependency order: small self-contained fixes first (Tasks 1–3), FilterService signal migration before touching Grid consumers (Task 4), then Grid service extraction last (Tasks 5–6). No new features — pure structural improvement.

**Tech Stack:** Angular 20 (zoneless, signals), RxJS, ag-Grid, TypeScript, Karma/Jasmine tests (`npm test`), ESLint (`npm run lint`).

---

## File Map

| File                                                         | Action                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/app/services/server-command-handler.service.ts`         | Modify — replace `async subscribe` with `concatMap`                                      |
| `src/app/services/transfer-limit-command-handler.service.ts` | Modify — replace `async subscribe` with `exhaustMap`                                     |
| `src/app/services/update-command-handler.service.ts`         | Modify — replace `async subscribe` with `exhaustMap`                                     |
| `src/app/utils/tracker.utils.ts`                             | Create — `getTrackers` and `normalizeTracker` functions                                  |
| `src/app/utils/tracker.utils.spec.ts`                        | Create — unit tests for tracker utils                                                    |
| `src/app/pages/main/grid/grid.ts`                            | Modify — import from tracker.utils; later: add local providers, delegate to new services |
| `src/app/pages/main/status/status.ts`                        | Modify — import from tracker.utils; later: consume FilterService signals directly        |
| `src/app/models/command.model.ts`                            | Modify — remove `TORRENT_DELETE_CANCEL` from `TorrentCommand`                            |
| `src/app/services/torrent-command-handler.service.ts`        | Modify — remove no-op `TORRENT_DELETE_CANCEL` case                                       |
| `src/app/services/ui-command-handler.service.ts`             | Modify — remove cancel emit from DeleteTorrent result handler                            |
| `src/app/services/filter.service.ts`                         | Modify — replace BehaviorSubject with two signals                                        |
| `src/app/pages/main/grid/grid-keyboard-nav.service.ts`       | Create — keyboard nav logic extracted from Grid                                          |
| `src/app/pages/main/grid/grid-pin.service.ts`                | Create — row pinning logic extracted from Grid                                           |

---

## Task 1: Fix `async` inside `subscribe()` in ServerCommandHandlerService

**Files:**

- Modify: `src/app/services/server-command-handler.service.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/services/server-command-handler.service.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ServerCommandHandlerService } from './server-command-handler.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

describe('ServerCommandHandlerService', () => {
  let service: ServerCommandHandlerService;
  let commands$: Subject<any>;
  let serverStoreRefresh: jasmine.Spy;
  let toastSuccess: jasmine.Spy;
  let toastInfo: jasmine.Spy;

  beforeEach(() => {
    commands$ = new Subject();
    serverStoreRefresh = jasmine.createSpy('refresh').and.returnValue(Promise.resolve());
    toastSuccess = jasmine.createSpy('success');
    toastInfo = jasmine.createSpy('info');

    TestBed.configureTestingModule({
      providers: [
        ServerCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: ServerStoreService,
          useValue: {
            refresh: serverStoreRefresh,
            servers: signal([{ id: '1', name: 'Test Server' }]),
            select: jasmine.createSpy('select'),
          },
        },
        {
          provide: ServerService,
          useValue: { delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()) },
        },
        { provide: ToastService, useValue: { success: toastSuccess, info: toastInfo } },
      ],
    });

    service = TestBed.inject(ServerCommandHandlerService);
    service.start();
  });

  it('should show success toast after SERVER_ADDED', fakeAsync(() => {
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    tick();
    expect(toastSuccess).toHaveBeenCalledWith('Server Test Server added!');
  }));

  it('should not crash the subscription if a command throws', fakeAsync(() => {
    serverStoreRefresh.and.returnValue(Promise.reject(new Error('network error')));
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    tick();
    // subscription must still be alive
    serverStoreRefresh.and.returnValue(Promise.resolve());
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    tick();
    expect(toastInfo).toHaveBeenCalled();
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --include="**/server-command-handler.service.spec.ts"
```

Expected: second `it` fails because `async subscribe` kills the subscription on rejection.

- [ ] **Step 3: Rewrite `ServerCommandHandlerService` to use `concatMap`**

Replace the entire content of `src/app/services/server-command-handler.service.ts`:

```typescript
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, from } from 'rxjs';
import { catchError, concatMap, filter } from 'rxjs/operators';
import { AppCommand, ServerCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class ServerCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly serverService = inject(ServerService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd: AppCommand): cmd is ServerCommand => cmd.type.startsWith('SERVER_')),
        concatMap((command) =>
          from(this.handleCommand(command)).pipe(
            catchError((err) => {
              console.error(ServerCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: ServerCommand): Promise<void> {
    switch (command.type) {
      case 'SERVER_ADDED':
        await this.handleServerAdded(command.id);
        break;
      case 'SERVER_UPDATED':
        await this.handleServerUpdated(command.id);
        break;
      case 'SERVER_DELETED':
        await this.handleServerDeleted(command.id);
        break;
    }
  }

  private async handleServerAdded(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    this.toastService.success(`Server ${server?.name || 'New Host'} added!`);
    this.serverStoreService.select(id);
  }

  private async handleServerUpdated(id: string): Promise<void> {
    await this.serverStoreService.refresh();
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    this.toastService.info(`Server ${server?.name} updated!`);
  }

  private async handleServerDeleted(id: string): Promise<void> {
    const server = this.serverStoreService.servers().find((s) => s.id === id);
    await this.serverService.delete(id);
    await this.serverStoreService.refresh();
    this.toastService.info(`Server ${server?.name} deleted.`);
  }
}
```

- [ ] **Step 4: Run tests and lint**

```bash
npm test -- --include="**/server-command-handler.service.spec.ts"
npm run lint
```

Expected: both tests pass, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/server-command-handler.service.ts src/app/services/server-command-handler.service.spec.ts
git commit -m "refactor: replace async subscribe with concatMap in ServerCommandHandlerService"
```

---

## Task 2: Fix `async` inside `subscribe()` in TransferLimitCommandHandlerService

**Files:**

- Modify: `src/app/services/transfer-limit-command-handler.service.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/services/transfer-limit-command-handler.service.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TransferLimitCommandHandlerService } from './transfer-limit-command-handler.service';

describe('TransferLimitCommandHandlerService', () => {
  let service: TransferLimitCommandHandlerService;
  let commands$: Subject<any>;
  let getAltState: jasmine.Spy;
  let toggleAlt: jasmine.Spy;
  let toastInfo: jasmine.Spy;

  beforeEach(() => {
    commands$ = new Subject();
    getAltState = jasmine
      .createSpy('getAlternativeSpeedLimitState')
      .and.returnValue(Promise.resolve(false));
    toggleAlt = jasmine.createSpy('toggleAlternativeSpeedLimit').and.returnValue(Promise.resolve());
    toastInfo = jasmine.createSpy('info');

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

  it('should show info toast on toggle', fakeAsync(() => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    tick();
    expect(toastInfo).toHaveBeenCalledWith('Turning alternative speed limit ON');
  }));

  it('should ignore a second toggle while first is in-flight (exhaustMap)', fakeAsync(() => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    tick();
    expect(getAltState).toHaveBeenCalledTimes(1);
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --include="**/transfer-limit-command-handler.service.spec.ts"
```

Expected: second `it` fails — async subscribe runs both concurrently.

- [ ] **Step 3: Rewrite `TransferLimitCommandHandlerService` to use `exhaustMap`**

Replace the entire content of `src/app/services/transfer-limit-command-handler.service.ts`:

```typescript
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, from } from 'rxjs';
import { catchError, exhaustMap, filter } from 'rxjs/operators';
import { AppCommand, TransferLimitCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TransferLimitCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter(this.transferLimitCommandGuard),
        exhaustMap((command: TransferLimitCommand) =>
          from(this.handleCommand(command)).pipe(
            catchError((err) => {
              console.error(TransferLimitCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCommand(command: TransferLimitCommand): Promise<void> {
    switch (command.type) {
      case 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE':
        await this.handleToggle();
        break;
      default:
        console.warn(
          TransferLimitCommandHandlerService.name,
          'handleCommand',
          'Unhandled command',
          command,
        );
    }
  }

  private async handleToggle(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    const state = await this.qbService.getAlternativeSpeedLimitState(serverId);
    this.toastService.info('Turning alternative speed limit ' + (state ? 'OFF' : 'ON'));
    this.qbService.toggleAlternativeSpeedLimit(serverId);
  }

  private transferLimitCommandGuard(cmd: AppCommand): cmd is TransferLimitCommand {
    return cmd.type.startsWith('TRANSFER_');
  }
}
```

- [ ] **Step 4: Run tests and lint**

```bash
npm test -- --include="**/transfer-limit-command-handler.service.spec.ts"
npm run lint
```

Expected: both tests pass, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/transfer-limit-command-handler.service.ts src/app/services/transfer-limit-command-handler.service.spec.ts
git commit -m "refactor: replace async subscribe with exhaustMap in TransferLimitCommandHandlerService"
```

---

## Task 3: Fix `async` inside `subscribe()` in UpdateCommandHandlerService

**Files:**

- Modify: `src/app/services/update-command-handler.service.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/services/update-command-handler.service.spec.ts`:

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';
import { UpdateCommandHandlerService } from './update-command-handler.service';

describe('UpdateCommandHandlerService', () => {
  let service: UpdateCommandHandlerService;
  let commands$: Subject<any>;
  let checkForUpdate: jasmine.Spy;
  let toastSuccess: jasmine.Spy;
  let toastDanger: jasmine.Spy;
  let commandBusEmit: jasmine.Spy;

  beforeEach(() => {
    commands$ = new Subject();
    checkForUpdate = jasmine
      .createSpy('checkForUpdate')
      .and.returnValue(Promise.resolve({ updateAvailable: false, error: null }));
    toastSuccess = jasmine.createSpy('success');
    toastDanger = jasmine.createSpy('danger');
    commandBusEmit = jasmine.createSpy('emit');

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

  it('should show success toast when no update available', fakeAsync(() => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    tick();
    expect(toastSuccess).toHaveBeenCalledWith('Your are on the latest version!');
  }));

  it('should emit UI_UPDATE_AVAILABLE when update is found', fakeAsync(() => {
    const update = { updateAvailable: true, error: null, version: '2.0.0' };
    checkForUpdate.and.returnValue(Promise.resolve(update));
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    tick();
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_UPDATE_AVAILABLE', update });
  }));

  it('should ignore second check while first is in-flight (exhaustMap)', fakeAsync(() => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    tick();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --include="**/update-command-handler.service.spec.ts"
```

Expected: exhaustMap test fails.

- [ ] **Step 3: Rewrite `UpdateCommandHandlerService` to use `exhaustMap`**

Replace the entire content of `src/app/services/update-command-handler.service.ts`:

```typescript
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, from } from 'rxjs';
import { catchError, exhaustMap, filter } from 'rxjs/operators';
import { AppCommand, UpdateCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class UpdateCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly electronService = inject(ElectronService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  public start(): void {
    this.commandBusService.commands$
      .pipe(
        filter((cmd: AppCommand): cmd is UpdateCommand => cmd.type === 'UPDATE_CHECK_FOR_UPDATE'),
        exhaustMap(() =>
          from(this.handleCheckForUpdate()).pipe(
            catchError((err) => {
              console.error(UpdateCommandHandlerService.name, 'start', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private async handleCheckForUpdate(): Promise<void> {
    const response = await this.electronService.checkForUpdate();

    if (response.error) {
      this.toastService.danger(response.error, 'Update Check Failed');
      return;
    }

    if (response.updateAvailable) {
      this.commandBusService.emit({ type: 'UI_UPDATE_AVAILABLE', update: response });
    } else {
      this.toastService.success('Your are on the latest version!');
    }
  }
}
```

- [ ] **Step 4: Run tests and lint**

```bash
npm test -- --include="**/update-command-handler.service.spec.ts"
npm run lint
```

Expected: all three tests pass, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/update-command-handler.service.ts src/app/services/update-command-handler.service.spec.ts
git commit -m "refactor: replace async subscribe with exhaustMap in UpdateCommandHandlerService"
```

---

## Task 4: Extract duplicated tracker utility

**Files:**

- Create: `src/app/utils/tracker.utils.ts`
- Create: `src/app/utils/tracker.utils.spec.ts`
- Modify: `src/app/pages/main/grid/grid.ts`
- Modify: `src/app/pages/main/status/status.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils/tracker.utils.spec.ts`:

```typescript
import { Torrent } from '../models/torrent.model';
import { getTrackers, normalizeTracker } from './tracker.utils';

describe('getTrackers', () => {
  it('should split tracker field by newline and filter empty strings', () => {
    const t = { tracker: 'udp://tracker1.com\nudp://tracker2.com\n' } as Torrent;
    expect(getTrackers(t)).toEqual(['udp://tracker1.com', 'udp://tracker2.com']);
  });

  it('should return empty array when tracker is null', () => {
    expect(getTrackers({ tracker: null } as any)).toEqual([]);
  });

  it('should return empty array when tracker is undefined', () => {
    expect(getTrackers({} as Torrent)).toEqual([]);
  });
});

describe('normalizeTracker', () => {
  it('should return (none) for empty string', () => {
    expect(normalizeTracker('')).toBe('(none)');
  });

  it('should return (none) for null', () => {
    expect(normalizeTracker(null)).toBe('(none)');
  });

  it('should return (none) for undefined', () => {
    expect(normalizeTracker(undefined)).toBe('(none)');
  });

  it('should extract host from a valid URL', () => {
    expect(normalizeTracker('udp://tracker.example.com:6969/announce')).toBe(
      'tracker.example.com:6969',
    );
  });

  it('should return raw string for non-URL values', () => {
    expect(normalizeTracker('not-a-url')).toBe('not-a-url');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --include="**/tracker.utils.spec.ts"
```

Expected: FAIL — file does not exist.

- [ ] **Step 3: Create `tracker.utils.ts`**

Create `src/app/utils/tracker.utils.ts`:

```typescript
import { Torrent } from '../models/torrent.model';

export function getTrackers(t: Torrent): string[] {
  return (t.tracker ?? '').split('\n').filter(Boolean);
}

export function normalizeTracker(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return '(none)';
  try {
    const u = new URL(s);
    return u.host || u.hostname || s;
  } catch {
    return s;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --include="**/tracker.utils.spec.ts"
```

Expected: all tests pass.

- [ ] **Step 5: Replace private methods in `grid.ts` with imports**

In `src/app/pages/main/grid/grid.ts`:

Add import at the top:

```typescript
import { getTrackers, normalizeTracker } from '../../../utils/tracker.utils';
```

Delete the two private methods (lines ~415–428):

```typescript
// DELETE these:
private getTrackers(t: Torrent): string[] { ... }
private normalizeTracker(raw?: string | null): string { ... }
```

Update the two references in the `getGridOptions` call (in the constructor, inside the `opts` object):

```typescript
normalizeTracker: (raw) => normalizeTracker(raw),
getTrackers: (t) => getTrackers(t),
```

- [ ] **Step 6: Replace private methods in `status.ts` with imports**

In `src/app/pages/main/status/status.ts`, grep for `normalizeTracker` and `getTrackers`. Add import:

```typescript
import { getTrackers, normalizeTracker } from '../../../utils/tracker.utils';
```

Delete the private `getTrackers` and `normalizeTracker` methods. All call sites reference them the same way, so no other changes needed.

- [ ] **Step 7: Run lint and full test suite**

```bash
npm run lint
npm test
```

Expected: lint clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/utils/tracker.utils.ts src/app/utils/tracker.utils.spec.ts src/app/pages/main/grid/grid.ts src/app/pages/main/status/status.ts
git commit -m "refactor: extract getTrackers and normalizeTracker into shared tracker.utils"
```

---

## Task 5: Remove `TORRENT_DELETE_CANCEL` (normalise modal dismiss handling)

**Files:**

- Modify: `src/app/models/command.model.ts`
- Modify: `src/app/services/torrent-command-handler.service.ts`
- Modify: `src/app/services/ui-command-handler.service.ts`

- [ ] **Step 1: Remove `TORRENT_DELETE_CANCEL` from the command model**

In `src/app/models/command.model.ts`, remove this line from `TorrentCommand`:

```typescript
| { type: 'TORRENT_DELETE_CANCEL' }
```

- [ ] **Step 2: Remove the no-op case from `TorrentCommandHandlerService`**

In `src/app/services/torrent-command-handler.service.ts`, delete:

```typescript
case 'TORRENT_DELETE_CANCEL':
  break;
```

- [ ] **Step 3: Remove the cancel emit from `UiCommandHandlerService`**

In `src/app/services/ui-command-handler.service.ts`, find the `DeleteTorrent` result handler (around line 55). Replace:

```typescript
deleteModalRef.result
  .then(({ removeFiles }) =>
    this.commandBusService.emit({ type: 'TORRENT_DELETE_CONFIRM', removeFiles }),
  )
  .catch(() => this.commandBusService.emit({ type: 'TORRENT_DELETE_CANCEL' }));
```

With:

```typescript
deleteModalRef.result
  .then(({ removeFiles }) =>
    this.commandBusService.emit({ type: 'TORRENT_DELETE_CONFIRM', removeFiles }),
  )
  .catch(() => {});
```

- [ ] **Step 4: Run lint and full test suite**

```bash
npm run lint
npm test
```

Expected: lint clean, all tests pass (TypeScript will catch any remaining references to `TORRENT_DELETE_CANCEL`).

- [ ] **Step 5: Commit**

```bash
git add src/app/models/command.model.ts src/app/services/torrent-command-handler.service.ts src/app/services/ui-command-handler.service.ts
git commit -m "refactor: remove no-op TORRENT_DELETE_CANCEL command and normalise modal dismiss handling"
```

---

## Task 6: Migrate `FilterService` from `BehaviorSubject` to signals

**Files:**

- Modify: `src/app/services/filter.service.ts`
- Modify: `src/app/pages/main/grid/grid.ts`
- Modify: `src/app/pages/main/status/status.ts`

- [ ] **Step 1: Write tests against the current FilterService API that must still pass**

Create `src/app/services/filter.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { FilterService } from './filter.service';

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FilterService] });
    service = TestBed.inject(FilterService);
  });

  it('should initialise with empty external filter', () => {
    expect(service.external().search).toBe('');
    expect(service.external().states.size).toBe(0);
  });

  it('should update search', () => {
    service.setSearch('test');
    expect(service.external().search).toBe('test');
  });

  it('should not emit when search value is unchanged', () => {
    service.setSearch('test');
    let count = 0;
    // read the signal to establish a baseline - re-reads after each set
    const before = service.external().search;
    service.setSearch('test');
    const after = service.external().search;
    expect(before).toBe(after);
  });

  it('should update states', () => {
    service.setStates(['downloading', 'paused']);
    expect(service.external().states.has('downloading')).toBeTrue();
  });

  it('should clear states', () => {
    service.setStates(['downloading']);
    service.clearStates();
    expect(service.external().states.size).toBe(0);
  });

  it('should update column model', () => {
    service.setColumnModel({ name: { filterType: 'text' } });
    expect(service.columns()['name']).toBeDefined();
  });

  it('should reset all filters', () => {
    service.setSearch('test');
    service.setColumnModel({ name: { filterType: 'text' } });
    service.resetAll();
    expect(service.external().search).toBe('');
    expect(Object.keys(service.columns()).length).toBe(0);
  });

  it('should expose snapshot matching signal values', () => {
    service.setSearch('hello');
    expect(service.snapshot.external.search).toBe('hello');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (signal API not yet present)**

```bash
npm test -- --include="**/filter.service.spec.ts"
```

Expected: FAIL — `service.external()` and `service.columns()` do not exist yet.

- [ ] **Step 3: Rewrite `FilterService` using signals**

Replace the entire content of `src/app/services/filter.service.ts`:

```typescript
import { Injectable, signal } from '@angular/core';
import type { FilterModel } from 'ag-grid-community';
import { TorrentState } from '../models/torrent.model';

export type GridExternalFilterParams = {
  search: string;
  states: Set<TorrentState>;
  trackers: Set<string>;
  savePaths: Set<string>;
  categories: Set<string>;
  tags: Set<string>;
};

export type GridFilterState = {
  external: GridExternalFilterParams;
  columns: FilterModel;
};

export const GRID_FILTER_INITIAL: GridFilterState = {
  external: {
    search: '',
    states: new Set<TorrentState>(),
    trackers: new Set<string>(),
    savePaths: new Set<string>(),
    categories: new Set<string>(),
    tags: new Set<string>(),
  },
  columns: {},
};

function shallowEqualSets<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function shallowEqualExternal(a: GridExternalFilterParams, b: GridExternalFilterParams): boolean {
  return (
    a.search === b.search &&
    shallowEqualSets(a.states, b.states) &&
    shallowEqualSets(a.trackers, b.trackers) &&
    shallowEqualSets(a.savePaths, b.savePaths) &&
    shallowEqualSets(a.categories, b.categories) &&
    shallowEqualSets(a.tags, b.tags)
  );
}

function shallowEqualFilterModel(a: FilterModel, b: FilterModel): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly _external = signal<GridExternalFilterParams>(GRID_FILTER_INITIAL.external, {
    equal: shallowEqualExternal,
  });
  private readonly _columns = signal<FilterModel>(GRID_FILTER_INITIAL.columns, {
    equal: shallowEqualFilterModel,
  });

  readonly external = this._external.asReadonly();
  readonly columns = this._columns.asReadonly();

  public get snapshot(): GridFilterState {
    return { external: this._external(), columns: this._columns() };
  }

  public get activeStates(): ReadonlySet<TorrentState> {
    return this._external().states;
  }

  public setSearch(search: string): void {
    const value = (search ?? '').trim();
    this._external.update((prev) => ({ ...prev, search: value }));
  }

  public clearSearch(): void {
    this.setSearch('');
  }

  public setStates(states: Iterable<TorrentState>): void {
    this._external.update((prev) => ({ ...prev, states: new Set<TorrentState>(states) }));
  }

  public clearStates(): void {
    this.setStates([]);
  }

  public setTrackers(trackers: Iterable<string>): void {
    const next = new Set<string>(Array.from(trackers, (t) => (t ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, trackers: next }));
  }

  public clearTrackers(): void {
    this.setTrackers([]);
  }

  public setSavePaths(paths: Iterable<string>): void {
    const next = new Set<string>(Array.from(paths, (p) => (p ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, savePaths: next }));
  }

  public clearSavePaths(): void {
    this.setSavePaths([]);
  }

  public setCategories(categories: Iterable<string>): void {
    const next = new Set<string>(Array.from(categories, (c) => (c ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, categories: next }));
  }

  public clearCategories(): void {
    this.setCategories([]);
  }

  public setTags(tags: Iterable<string>): void {
    const next = new Set<string>(Array.from(tags, (t) => (t ?? '').trim()).filter(Boolean));
    this._external.update((prev) => ({ ...prev, tags: next }));
  }

  public clearTags(): void {
    this.setTags([]);
  }

  public setColumnModel(model: FilterModel): void {
    this._columns.set(model ?? {});
  }

  public setColumnFilter(colId: string, filter: unknown): void {
    const id = (colId ?? '').trim();
    if (!id) return;
    this._columns.update((prev) => {
      const next: FilterModel = { ...(prev ?? {}) };
      if (filter == null) delete next[id];
      else (next as any)[id] = filter;
      return next;
    });
  }

  public clearColumnFilter(colId: string): void {
    this.setColumnFilter(colId, null);
  }

  public clearAllColumnFilters(): void {
    this._columns.set({});
  }

  public resetAll(): void {
    this._external.set({
      search: '',
      states: new Set<TorrentState>(),
      trackers: new Set<string>(),
      savePaths: new Set<string>(),
      categories: new Set<string>(),
      tags: new Set<string>(),
    });
    this._columns.set({});
  }
}
```

- [ ] **Step 4: Run FilterService tests**

```bash
npm test -- --include="**/filter.service.spec.ts"
```

Expected: all tests pass.

- [ ] **Step 5: Update `grid.ts` to consume the signal API**

In `src/app/pages/main/grid/grid.ts`:

1. Add `toObservable` to the `@angular/core/rxjs-interop` import.

2. In `ngAfterViewInit`, replace:

```typescript
this.filterService.external$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(this.onExternalFilterChange);

this.filterService.columnModel$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(this.onColumnFilterChange);
```

With:

```typescript
toObservable(this.filterService.external)
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(this.onExternalFilterChange);

toObservable(this.filterService.columns)
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(this.onColumnFilterChange);
```

3. In the `getGridOptions` call in the constructor, replace:

```typescript
getLatestFilters: () => this.filterService.snapshot.external,
```

With:

```typescript
getLatestFilters: () => this.filterService.external(),
```

- [ ] **Step 6: Update `status.ts` to consume the signal directly**

In `src/app/pages/main/status/status.ts`:

Replace:

```typescript
private readonly filtersSig = toSignal(this.filterService.external$, { requireSync: true });
```

With:

```typescript
private readonly filtersSig = this.filterService.external;
```

Remove `toSignal` from the `@angular/core/rxjs-interop` import if it is no longer used elsewhere in the file. Remove `TranslateService` import if `languageChanged` still needs it — check, keep if used.

- [ ] **Step 7: Run lint and full test suite**

```bash
npm run lint
npm test
```

Expected: lint clean, all tests pass. TypeScript will report any remaining consumers of the old observable API (`external$`, `columnModel$`, `state$`, `search$`) as errors — fix any that appear.

- [ ] **Step 8: Commit**

```bash
git add src/app/services/filter.service.ts src/app/services/filter.service.spec.ts src/app/pages/main/grid/grid.ts src/app/pages/main/status/status.ts
git commit -m "refactor: migrate FilterService from BehaviorSubject to signals"
```

---

## Task 7: Extract `GridKeyboardNavService`

**Files:**

- Create: `src/app/pages/main/grid/grid-keyboard-nav.service.ts`
- Modify: `src/app/pages/main/grid/grid.ts`

- [ ] **Step 1: Create `GridKeyboardNavService`**

Create `src/app/pages/main/grid/grid-keyboard-nav.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import type { GridApi } from 'ag-grid-community';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';

@Injectable()
export class GridKeyboardNavService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly modalService = inject(NgbModal);

  private api: GridApi<Torrent> | null = null;
  private _anchorIndex: number | null = null;
  private _leadIndex: number | null = null;

  get anchorIndex(): number | null {
    return this._anchorIndex;
  }
  set anchorIndex(v: number | null) {
    this._anchorIndex = v;
  }

  get leadIndex(): number | null {
    return this._leadIndex;
  }
  set leadIndex(v: number | null) {
    this._leadIndex = v;
  }

  init(api: GridApi<Torrent>): void {
    this.api = api;
  }

  onKeyUp(event: KeyboardEvent): void {
    const { shiftKey, code, target } = event;
    if (code === 'Delete' && !this.isTypingTarget(target)) {
      this.commandBusService.emit({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: shiftKey,
      });
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.modalService.hasOpenModals()) return;
    this.handleGridSelectAll(event);
    this.handleGridKeyboardSelection(event);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
  }

  private handleGridSelectAll(event: KeyboardEvent): void {
    const { ctrlKey, code } = event;
    if (!(ctrlKey && code === 'KeyA') || this.isTypingTarget(event.target)) return;
    event.preventDefault();
    this.api?.forEachNodeAfterFilter((node) => {
      if (node.displayed) node.setSelected(true, false);
    });
  }

  private handleGridKeyboardSelection(event: KeyboardEvent): void {
    const { code, shiftKey, ctrlKey } = event;
    const isNavKey = [
      'ArrowDown',
      'ArrowUp',
      'Home',
      'End',
      'PageDown',
      'PageUp',
      'Enter',
    ].includes(code);
    if (!isNavKey || this.isTypingTarget(event.target)) return;

    const api = this.api;
    if (!api) return;

    const selectedNodes = api.getSelectedNodes();
    let leadIndex =
      this._leadIndex ??
      (selectedNodes.length ? selectedNodes[selectedNodes.length - 1].rowIndex : null);
    if (leadIndex == null) return;

    const nextIndex = this.computeNextDisplayedIndex(api, code, leadIndex);
    if (nextIndex == null || nextIndex === leadIndex) return;

    const nextNode = api.getDisplayedRowAtIndex(nextIndex);
    if (!nextNode) return;

    event.preventDefault();
    const colId = api.getAllDisplayedColumns()?.[0]?.getColId();

    if (shiftKey) {
      if (this._anchorIndex == null) this._anchorIndex = leadIndex;
      this._leadIndex = nextIndex;
      const start = Math.min(this._anchorIndex, this._leadIndex);
      const end = Math.max(this._anchorIndex, this._leadIndex);
      if (!ctrlKey) api.deselectAll();
      for (let i = start; i <= end; i++) api.getDisplayedRowAtIndex(i)?.setSelected(true);
    } else if (!ctrlKey) {
      api.deselectAll();
      nextNode.setSelected(true, true);
      this._anchorIndex = nextIndex;
      this._leadIndex = nextIndex;
    }

    if (colId) api.setFocusedCell(nextIndex, colId);
    api.ensureIndexVisible(nextIndex);
  }

  private computeNextDisplayedIndex(api: GridApi, code: string, leadIndex: number): number | null {
    const rowCount = api.getDisplayedRowCount();
    if (rowCount <= 0) return null;
    const clamp = (i: number) => Math.max(0, Math.min(i, rowCount - 1));
    switch (code) {
      case 'ArrowDown':
        return clamp(leadIndex + 1);
      case 'ArrowUp':
        return clamp(leadIndex - 1);
      case 'Home':
        return 0;
      case 'End':
        return rowCount - 1;
      case 'PageDown':
        return clamp(leadIndex + this.getApproxPageSize(api));
      case 'PageUp':
        return clamp(leadIndex - this.getApproxPageSize(api));
      default:
        return null;
    }
  }

  private getApproxPageSize(api: any): number {
    const rowHeight = 32;
    const viewportHeight = api.gridBodyCtrl?.eBodyViewport?.clientHeight ?? 400;
    return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
  }
}
```

- [ ] **Step 2: Update `grid.ts` to use `GridKeyboardNavService`**

In `src/app/pages/main/grid/grid.ts`:

1. Add to imports at top of file:

```typescript
import { GridKeyboardNavService } from './grid-keyboard-nav.service';
```

2. Add to the `@Component` `providers` array:

```typescript
providers: [GridStateService, GridContextMenuService, GridKeyboardNavService],
```

3. Add injection (remove `NgbModal` injection at the same time):

```typescript
private readonly keyboardNavService = inject(GridKeyboardNavService);
```

Remove:

```typescript
private readonly modalService = inject(NgbModal);
```

4. Remove `NgbModal` from the import at the top of the file.

5. Remove these private fields (they move to the service):

```typescript
private selectionAnchorIndex: number | null = null;
private selectionLeadIndex: number | null = null;
```

6. Replace `@HostListener` methods with delegates:

```typescript
@HostListener('window:keyup', ['$event'])
public onKeyUp(event: KeyboardEvent): void {
  this.keyboardNavService.onKeyUp(event);
}

@HostListener('window:keydown', ['$event'])
public onKeyDown(event: KeyboardEvent): void {
  this.keyboardNavService.onKeyDown(event);
}
```

7. In the `onApiReady` callback inside `getGridOptions`, add the service init call at the top and update anchor/lead references:

```typescript
onApiReady: (api) => {
  this.api = api;
  this.keyboardNavService.init(api);

  api.setGridOption('onRowClicked', (event) => {
    const mouseEvent = event.event as MouseEvent;
    if (event.rowIndex !== null && !mouseEvent?.shiftKey) {
      this.keyboardNavService.anchorIndex = event.rowIndex;
      this.keyboardNavService.leadIndex = event.rowIndex;
    }
  });

  api.setGridOption('onCellClicked', (event) => {
    const mouseEvent = event.event as MouseEvent;
    if (mouseEvent?.shiftKey && this.keyboardNavService.anchorIndex !== null && event.rowIndex !== null) {
      const start = Math.min(this.keyboardNavService.anchorIndex, event.rowIndex);
      const end = Math.max(this.keyboardNavService.anchorIndex, event.rowIndex);
      api.deselectAll();
      for (let i = start; i <= end; i++) {
        api.getDisplayedRowAtIndex(i)?.setSelected(true);
      }
    }
  });
},
```

8. Update the getter/setter callbacks in the `opts` object passed to `getGridOptions`:

```typescript
getSelectionAnchorIndex: () => this.keyboardNavService.anchorIndex,
getSelectionLeadIndex: () => this.keyboardNavService.leadIndex,
setSelectionAnchorIndex: (v) => (this.keyboardNavService.anchorIndex = v),
setSelectionLeadIndex: (v) => (this.keyboardNavService.leadIndex = v),
```

- [ ] **Step 3: Run lint and full test suite**

```bash
npm run lint
npm test
```

Expected: lint clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/main/grid/grid-keyboard-nav.service.ts src/app/pages/main/grid/grid.ts
git commit -m "refactor: extract GridKeyboardNavService from Grid component"
```

---

## Task 8: Extract `GridPinService`

**Files:**

- Create: `src/app/pages/main/grid/grid-pin.service.ts`
- Modify: `src/app/pages/main/grid/grid.ts`

- [ ] **Step 1: Create `GridPinService`**

Create `src/app/pages/main/grid/grid-pin.service.ts`:

```typescript
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { GridApi } from 'ag-grid-community';
import { filter } from 'rxjs';
import { UiCommand } from '../../../models/command.model';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridStateService } from '../../../services/grid-state.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Injectable()
export class GridPinService {
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly gridStateService = inject(GridStateService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly destroyRef = inject(DestroyRef);

  private api: GridApi<Torrent> | null = null;
  private readonly pinnedTopHashes = signal<Set<string>>(new Set());
  private readonly pinnedBottomHashes = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      const torrents = this.torrentStore.torrentsArray();
      const topHashes = this.pinnedTopHashes();
      const bottomHashes = this.pinnedBottomHashes();
      if (!this.api) return;

      const pinnedTop = torrents.filter((t) => topHashes.has(t.hash));
      const pinnedBottom = torrents.filter((t) => bottomHashes.has(t.hash));
      const mainRows = torrents.filter((t) => !topHashes.has(t.hash) && !bottomHashes.has(t.hash));

      this.api.setGridOption('rowData', mainRows);
      this.api.setGridOption('pinnedTopRowData', pinnedTop);
      this.api.setGridOption('pinnedBottomRowData', pinnedBottom);
    });

    this.commandBusService.commands$
      .pipe(
        filter(
          (cmd): cmd is UiCommand =>
            cmd.type === 'UI_TORRENT_PIN_TOP' ||
            cmd.type === 'UI_TORRENT_PIN_BOTTOM' ||
            cmd.type === 'UI_TORRENT_UNPIN',
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cmd) => {
        const hashes = this.selectionStore.selected().map((t) => t.hash);
        const hashSet = new Set(hashes);

        if (cmd.type === 'UI_TORRENT_UNPIN') {
          this.pinnedTopHashes.set(
            new Set([...this.pinnedTopHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedBottomHashes.set(
            new Set([...this.pinnedBottomHashes()].filter((h) => !hashSet.has(h))),
          );
        } else if (cmd.type === 'UI_TORRENT_PIN_TOP') {
          this.pinnedBottomHashes.set(
            new Set([...this.pinnedBottomHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedTopHashes.set(new Set([...this.pinnedTopHashes(), ...hashes]));
        } else {
          this.pinnedTopHashes.set(
            new Set([...this.pinnedTopHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedBottomHashes.set(new Set([...this.pinnedBottomHashes(), ...hashes]));
        }

        if (this.api) {
          void this.gridStateService.save(
            this.api,
            [...this.pinnedTopHashes()],
            [...this.pinnedBottomHashes()],
          );
        }
      });
  }

  init(api: GridApi<Torrent>): void {
    this.api = api;
  }

  applyPinnedState(top: string[], bottom: string[]): void {
    this.pinnedTopHashes.set(new Set(top));
    this.pinnedBottomHashes.set(new Set(bottom));
  }

  getPinnedTopHashes(): string[] {
    return [...this.pinnedTopHashes()];
  }

  getPinnedBottomHashes(): string[] {
    return [...this.pinnedBottomHashes()];
  }
}
```

- [ ] **Step 2: Update `grid.ts` to use `GridPinService`**

In `src/app/pages/main/grid/grid.ts`:

1. Add import:

```typescript
import { GridPinService } from './grid-pin.service';
```

2. Add to the `@Component` `providers` array:

```typescript
providers: [GridStateService, GridContextMenuService, GridKeyboardNavService, GridPinService],
```

3. Add injection (remove `TorrentStoreService` at the same time):

```typescript
private readonly gridPinService = inject(GridPinService);
```

Remove:

```typescript
private readonly torrentStore = inject(TorrentStoreService);
```

Remove the `TorrentStoreService` import from the top of the file.

4. Remove these private fields:

```typescript
private readonly pinnedTopHashes = signal<Set<string>>(new Set());
private readonly pinnedBottomHashes = signal<Set<string>>(new Set());
```

5. Remove the first `effect()` in the constructor (the one that calls `api.setGridOption('rowData', ...)`) — it now lives in `GridPinService`.

6. Remove the entire `commandBusService.commands$` subscription for pin commands from the constructor — it now lives in `GridPinService`.

7. In the `onApiReady` callback, add after `this.keyboardNavService.init(api)`:

```typescript
this.gridPinService.init(api);
```

8. In `applyGridSettings`, replace:

```typescript
this.pinnedTopHashes.set(new Set(settings.pinnedTopHashes ?? []));
this.pinnedBottomHashes.set(new Set(settings.pinnedBottomHashes ?? []));
```

With:

```typescript
this.gridPinService.applyPinnedState(
  settings.pinnedTopHashes ?? [],
  settings.pinnedBottomHashes ?? [],
);
```

9. In `ngAfterViewInit`, replace the two `queueSave` usages that pass pinned hashes:

```typescript
void this.gridStateService.save(
  this.api,
  [...this.pinnedTopHashes()],
  [...this.pinnedBottomHashes()],
);
```

With:

```typescript
void this.gridStateService.save(
  this.api,
  this.gridPinService.getPinnedTopHashes(),
  this.gridPinService.getPinnedBottomHashes(),
);
```

- [ ] **Step 3: Run lint and full test suite**

```bash
npm run lint
npm test
```

Expected: lint clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/main/grid/grid-pin.service.ts src/app/pages/main/grid/grid.ts
git commit -m "refactor: extract GridPinService from Grid component"
```

---

## Final Verification

- [ ] **Run full lint + test**

```bash
npm run lint
npm test
```

Expected: zero lint warnings, all tests pass.

- [ ] **Manual smoke test**

Start the app with `npm start` and verify:

1. Keyboard navigation works in the torrent grid (arrow keys, Shift+click range, Ctrl+A, Delete)
2. Pin top / Pin bottom / Unpin works and persists across restart
3. FilterService changes: status panel filters apply correctly to the grid
4. Opening a `.torrent` file from the OS on a fresh login correctly checks if the torrent already exists before showing the add modal
5. Server add/edit/delete shows correct toasts
6. Toggle alternative speed limit works (single click, rapid double-click is ignored)
7. Update check works
