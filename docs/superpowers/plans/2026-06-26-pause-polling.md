# Pause Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the user to click the polling-indicator widget to toggle polling pause/resume, with the ring animation stopping and the center icon switching between play and pause.

**Architecture:** The pause state lives in `QbPollingService` as an opaque `symbol` token set - callers acquire a token via `pause()` and release it via `resume(token)`. The polling observable returns `EMPTY` whenever any token is held, preserving the `rid` across the gap. `ServerState` holds one token and toggles it on click; it also drives the icon and resets the ring animation.

**Tech Stack:** Angular 20 (zoneless, signal-based), RxJS, FontAwesome, ngx-translate, Vitest via Angular test runner.

## Global Constraints

- Zero lint warnings (`npm run lint` must pass with `--max-warnings=0`)
- All tests must pass (`npm test` from repo root)
- Commit message format: `#188: short description`
- Working directory for `ng test` commands: `packages/app/`
- Run individual spec files: `npx ng test --include src/app/services/qb-polling.service.spec.ts --watch=false`
- No `BehaviorSubject` for new state - but `BehaviorSubject` is correct here as the internal token store (it needs `.value` access in `pause()`/`resume()`)
- `isPaused$` is a derived `Observable<boolean>` (not a `BehaviorSubject`) - keep public API clean

---

## File Map

| File                                                                | Change                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/app/src/app/services/qb-polling.service.ts`               | Add token-set pause API; wire into `createBackgroundPoll`; clear tokens in `stopPolling` |
| `packages/app/src/app/services/qb-polling.service.spec.ts`          | New tests for `pause`, `resume`, `isPaused$`                                             |
| `packages/app/src/app/pages/main/server-state/server-state.ts`      | Add `isPaused` signal, `_pauseToken`, `togglePolling()`, effect, icons                   |
| `packages/app/src/app/pages/main/server-state/server-state.html`    | Update `polling-indicator` case: click handler, icon, tooltip                            |
| `packages/app/src/app/pages/main/server-state/server-state.scss`    | Remove `.poll-dot`; add `.poll-icon`                                                     |
| `packages/app/src/app/pages/main/server-state/server-state.spec.ts` | Update mock; add `isPaused` and `togglePolling` tests                                    |
| `public/i18n/us.json`                                               | Update `server-polling`; add `polling-paused`                                            |
| `public/i18n/hu.json`                                               | Update `server-polling`; add `polling-paused`                                            |

---

### Task 1: Add pause API to `QbPollingService` and wire it into polling

**Files:**

- Modify: `packages/app/src/app/services/qb-polling.service.ts`
- Modify: `packages/app/src/app/services/qb-polling.service.spec.ts`

**Interfaces:**

- Produces:
  - `pollingService.pause(): symbol` — adds a token, returns it
  - `pollingService.resume(token: symbol): void` — removes the token
  - `pollingService.isPaused$: Observable<boolean>` — true when any token is held
  - `stopPolling()` clears all tokens

- [ ] **Step 1: Write failing tests**

Add these tests to the existing `describe('QbPollingService', ...)` block in `packages/app/src/app/services/qb-polling.service.spec.ts`:

```typescript
describe('pause / resume', () => {
  it('should expose isPaused$ starting as false', async () => {
    const paused = await firstValueFrom(service.isPaused$);
    expect(paused).toBe(false);
  });

  it('pause() should return a symbol', () => {
    const token = service.pause();
    expect(typeof token).toBe('symbol');
    service.resume(token);
  });

  it('isPaused$ should emit true after pause()', async () => {
    const token = service.pause();
    const paused = await firstValueFrom(service.isPaused$);
    expect(paused).toBe(true);
    service.resume(token);
  });

  it('isPaused$ should emit false after resume() of the only token', async () => {
    const token = service.pause();
    service.resume(token);
    const paused = await firstValueFrom(service.isPaused$);
    expect(paused).toBe(false);
  });

  it('isPaused$ should stay true when one of two tokens is returned', async () => {
    const t1 = service.pause();
    const t2 = service.pause();
    service.resume(t1);
    const paused = await firstValueFrom(service.isPaused$);
    expect(paused).toBe(true);
    service.resume(t2);
  });

  it('stopPolling() should clear all tokens and set isPaused$ to false', async () => {
    service.pause();
    service.pause();
    service.stopPolling();
    const paused = await firstValueFrom(service.isPaused$);
    expect(paused).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/app && npx ng test --include src/app/services/qb-polling.service.spec.ts --watch=false
```

Expected: 6 new tests fail with errors like `service.pause is not a function` and `service.isPaused$ is undefined`.

- [ ] **Step 3: Implement the pause API and wire it into `createBackgroundPoll`**

Replace the full contents of `packages/app/src/app/services/qb-polling.service.ts` with:

```typescript
import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  combineLatest,
  from,
  interval,
  of,
} from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { Maindata, QbTorrentPeersResponse } from '../models/torrent.model';
import { QbService, StreamMaindataState } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { WindowService } from './window.service';

@Injectable({ providedIn: 'root' })
export class QbPollingService {
  private qb = inject(QbService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly windowService = inject(WindowService);

  private maindataRid$ = new BehaviorSubject<number>(0);
  private peersRidByHash = new Map<string, BehaviorSubject<number>>();
  private windowState$ = toObservable(this.windowService.state);

  private readonly _isInitialLoading$ = new BehaviorSubject<boolean>(false);
  public readonly isInitialLoading$ = this._isInitialLoading$.asObservable();

  private readonly _pollingInterval$ = new BehaviorSubject<number>(2000);
  public readonly pollingInterval$ = this._pollingInterval$.asObservable();

  private readonly _onPoll$ = new Subject<void>();
  public readonly onPoll$ = this._onPoll$.asObservable();

  private readonly stopPolling$ = new Subject<void>();

  private readonly _pauseTokens$ = new BehaviorSubject<Set<symbol>>(new Set());
  public readonly isPaused$: Observable<boolean> = this._pauseTokens$.pipe(
    map((tokens) => tokens.size > 0),
    distinctUntilChanged(),
  );

  public pause(): symbol {
    const token = Symbol();
    const next = new Set(this._pauseTokens$.value);
    next.add(token);
    this._pauseTokens$.next(next);
    return token;
  }

  public resume(token: symbol): void {
    const next = new Set(this._pauseTokens$.value);
    next.delete(token);
    this._pauseTokens$.next(next);
  }

  public stopPolling(): void {
    this.stopPolling$.next();
    this._isInitialLoading$.next(false);
    this._pauseTokens$.next(new Set());
  }

  startMaindataPolling(
    serverId: string,
    sortBy?: string,
    sortDesc?: boolean,
  ): Observable<Maindata> {
    this.stopPolling();
    this.maindataRid$.next(0);
    this._isInitialLoading$.next(true);
    void this.serverSettingsService.load();

    return this.qb.sync.streamMaindata(serverId, 0, sortBy, sortDesc).pipe(
      takeUntil(this.stopPolling$),
      switchMap((state: StreamMaindataState) => {
        if (state.maindata && !state.done) {
          return of(state.maindata);
        }

        if (state.done) {
          if (typeof state.maindata?.rid === 'number') {
            this.maindataRid$.next(state.maindata.rid);
          }
          this._isInitialLoading$.next(false);

          return this.createBackgroundPoll(serverId);
        }

        return EMPTY;
      }),
      catchError((err) => {
        this._isInitialLoading$.next(false);
        console.error('Polling failed:', err);
        return EMPTY;
      }),
    );
  }

  private createBackgroundPoll(serverId: string): Observable<Maindata> {
    const settings$ = this.serverSettingsService.asObservable().pipe(startWith(null));
    const windowState$ = this.windowState$.pipe(startWith(null));

    return combineLatest([settings$, windowState$, this.isPaused$]).pipe(
      takeUntil(this.stopPolling$),
      map(([settings, windowState, isPaused]) => {
        const isMinimized = windowState?.isMinimized ?? false;
        const foreground = settings?.polling?.foreground ?? 2000;
        const background = settings?.polling?.background ?? 5000;

        return { pollMs: isMinimized ? background : foreground, isPaused };
      }),
      distinctUntilChanged((a, b) => a.pollMs === b.pollMs && a.isPaused === b.isPaused),
      tap(({ pollMs, isPaused }) => {
        if (!isPaused) this._pollingInterval$.next(pollMs);
      }),
      switchMap(({ pollMs, isPaused }) => {
        if (isPaused) return EMPTY;
        return interval(pollMs).pipe(
          startWith(0),
          tap(() => this._onPoll$.next()),
          exhaustMap(() =>
            from(this.qb.sync.maindata(serverId, this.maindataRid$.value)).pipe(
              tap((res: any) => {
                if (typeof res?.rid === 'number') this.maindataRid$.next(res.rid);
              }),
              catchError((err) => {
                if (err?.status === 401 || err?.status === 403) {
                  this.stopPolling();
                }
                console.error('[maindata] background poll failed', err);
                return EMPTY;
              }),
            ),
          ),
        );
      }),
    );
  }

  startPeersPolling(serverId: string, hash: string): Observable<QbTorrentPeersResponse> {
    const rid$ = this.getPeersRid$(hash);
    rid$.next(0);

    return this.pollingInterval$.pipe(
      takeUntil(this.stopPolling$),
      switchMap((ms) => interval(ms)),
      startWith(0),
      exhaustMap(() => from(this.qb.sync.torrentPeers(serverId, hash, rid$.value))),
      tap((res) => {
        if (typeof res?.rid === 'number') rid$.next(res.rid);
      }),
      catchError((err) => {
        console.error(
          QbPollingService.name,
          'startPeersPolling',
          `[peers] poll failed hash=${hash}`,
          err,
        );
        return EMPTY;
      }),
    );
  }

  private getPeersRid$(hash: string): BehaviorSubject<number> {
    let rid$ = this.peersRidByHash.get(hash);
    if (!rid$) {
      rid$ = new BehaviorSubject<number>(0);
      this.peersRidByHash.set(hash, rid$);
    }
    return rid$;
  }

  public getPollingInterval(): number {
    return this._pollingInterval$.value;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/app && npx ng test --include src/app/services/qb-polling.service.spec.ts --watch=false
```

Expected: All tests pass, including the 6 new ones.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: No errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/qb-polling.service.ts \
        packages/app/src/app/services/qb-polling.service.spec.ts
git commit -m "$(cat <<'EOF'
#188: add token-set pause API to QbPollingService

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update `ServerState` — signal, toggle, icons, template, SCSS

**Files:**

- Modify: `packages/app/src/app/pages/main/server-state/server-state.ts`
- Modify: `packages/app/src/app/pages/main/server-state/server-state.html`
- Modify: `packages/app/src/app/pages/main/server-state/server-state.scss`
- Modify: `packages/app/src/app/pages/main/server-state/server-state.spec.ts`

**Interfaces:**

- Consumes: `pollingService.isPaused$: Observable<boolean>`, `pollingService.pause(): symbol`, `pollingService.resume(token: symbol): void` (from Task 1)
- Produces: `component.isPaused()` signal, `component.togglePolling()` method

- [ ] **Step 1: Write failing tests**

Update `packages/app/src/app/pages/main/server-state/server-state.spec.ts`:

1. Add `BehaviorSubject` to the RxJS import at the top:

```typescript
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
```

2. Add these variables inside `describe('ServerState', ...)`, alongside the existing `let onPoll$`:

```typescript
let isPaused$: BehaviorSubject<boolean>;
let mockPauseToken: symbol;
let mockPause: ReturnType<typeof vi.fn>;
let mockResume: ReturnType<typeof vi.fn>;
```

3. Inside `beforeEach`, after `onPoll$ = new Subject<void>();`, add:

```typescript
isPaused$ = new BehaviorSubject<boolean>(false);
mockPauseToken = Symbol('test-pause-token');
mockPause = vi.fn().mockReturnValue(mockPauseToken);
mockResume = vi.fn();
```

4. Update the `QbPollingService` mock inside `providers` to add the new fields:

```typescript
{
  provide: QbPollingService,
  useValue: {
    onPoll$: onPoll$.asObservable(),
    getPollingInterval: () => 2000,
    isPaused$: isPaused$.asObservable(),
    pause: mockPause,
    resume: mockResume,
  },
},
```

5. Add a new `describe` block at the end of the file, before the closing `}`):

```typescript
describe('isPaused', () => {
  it('should start as false', () => {
    expect(component.isPaused()).toBe(false);
  });

  it('should reflect true when isPaused$ emits true', () => {
    isPaused$.next(true);
    fixture.detectChanges();
    expect(component.isPaused()).toBe(true);
  });
});

describe('togglePolling', () => {
  it('should call pollingService.pause() when not paused', () => {
    component.togglePolling();
    expect(mockPause).toHaveBeenCalledOnce();
  });

  it('should call pollingService.resume() with the stored token when paused', () => {
    component.togglePolling(); // pause — stores token
    isPaused$.next(true);
    fixture.detectChanges();
    component.togglePolling(); // resume
    expect(mockResume).toHaveBeenCalledWith(mockPauseToken);
  });

  it('should not call resume() if there is no stored token', () => {
    isPaused$.next(true); // force paused state without calling pause()
    fixture.detectChanges();
    component.togglePolling();
    expect(mockResume).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/app && npx ng test --include src/app/pages/main/server-state/server-state.spec.ts --watch=false
```

Expected: The 5 new tests fail (`component.isPaused is not a function`, `component.togglePolling is not a function`). Existing tests still pass.

- [ ] **Step 3: Update `server-state.ts`**

Replace the full contents of `packages/app/src/app/pages/main/server-state/server-state.ts` with:

```typescript
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircle,
  faClock,
  faCloudDownloadAlt,
  faCloudUploadAlt,
  faDownload,
  faHdd,
  faNetworkWired,
  faPause,
  faPlay,
  faShareAlt,
  faTachometerAlt,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { animationFrameScheduler, interval, map, switchMap } from 'rxjs';
import { QbServerState } from '../../../models/torrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridViewStoreService } from '../../../services/grid-view-store.service';
import { QbPollingService } from '../../../services/qb-polling.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';

export enum MouseClickButton {
  LEFT = 0,
  RIGHT = 2,
}

@Component({
  selector: 'app-server-state',
  standalone: true,
  imports: [FontAwesomeModule, CommonModule, FilesizePipe, NgbTooltipModule, TranslatePipe],
  templateUrl: './server-state.html',
  styleUrl: './server-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerState {
  readonly state = input<QbServerState | null>(null);

  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly gridViewStoreService = inject(GridViewStoreService);
  private readonly statusbarSettingsService = inject(StatusBarSettingsService);
  private readonly pollingService = inject(QbPollingService);
  private readonly commandBusService = inject(CommandBusService);

  public settings = toSignal(this.statusbarSettingsService.asObservable());

  @ViewChild('tipRatioGlobal') tipRatioGlobal!: TemplateRef<any>;
  @ViewChild('tipGlobalDl') tipGlobalDl!: TemplateRef<any>;
  @ViewChild('tipGlobalUl') tipGlobalUl!: TemplateRef<any>;
  @ViewChild('tipLiveDl') tipLiveDl!: TemplateRef<any>;
  @ViewChild('tipLiveUl') tipLiveUl!: TemplateRef<any>;

  public diskSpace = signal<bigint>(0n);
  public dlSpeed = signal<bigint>(0n);
  public upSpeed = signal<bigint>(0n);
  public dlLimit = signal<bigint>(0n);
  public upLimit = signal<bigint>(0n);
  public allTimeDl = signal<bigint>(0n);
  public allTimeUl = signal<bigint>(0n);
  public dhtNodes = signal<number>(0);
  public connectionStatus = signal<string>('offline');
  public sessionRatio = signal<string>('0.00');
  public globalRatio = signal<string>('0.00');
  public useAltSpeedLimits = signal(false);
  public pollProgress = signal<number>(0);
  public selectedCount = computed(() => this.selectionStoreService.selected()?.length ?? 0);
  public filteredCount = this.gridViewStoreService.filteredCount;
  public pollingInterval = signal<string>(
    (this.pollingService.getPollingInterval() / 1000).toString(),
  );

  public isPaused = toSignal(this.pollingService.isPaused$, { initialValue: false });
  private _pauseToken: symbol | null = null;

  public icons = {
    faDownload,
    faHdd,
    faUpload,
    faCloudDownloadAlt,
    faCloudUploadAlt,
    faShareAlt,
    faNetworkWired,
    faCircle,
    faTachometerAlt,
    faClock,
    faPlay,
    faPause,
  };

  constructor() {
    effect(() => {
      const patch = this.state();
      if (!patch) {
        this.reset();
        return;
      }
      this.applyIfPresentBigInt(patch, 'free_space_on_disk', this.diskSpace);
      this.applyIfPresentBigInt(patch, 'dl_info_speed', this.dlSpeed);
      this.applyIfPresentBigInt(patch, 'up_info_speed', this.upSpeed);
      this.applyIfPresentBigInt(patch, 'dl_rate_limit', this.dlLimit);
      this.applyIfPresentBigInt(patch, 'up_rate_limit', this.upLimit);
      this.applyIfPresentBigInt(patch, 'alltime_dl', this.allTimeDl);
      this.applyIfPresentBigInt(patch, 'alltime_ul', this.allTimeUl);

      if ('connection_status' in patch)
        this.connectionStatus.set(String(patch['connection_status'] || 'offline'));
      if ('dht_nodes' in patch) this.dhtNodes.set(Number(patch['dht_nodes']) || 0);
      if ('global_ratio' in patch) this.globalRatio.set(String(patch['global_ratio'] || '0.00'));
      if ('use_alt_speed_limits' in patch)
        this.useAltSpeedLimits.set(Boolean(patch['use_alt_speed_limits']));

      const sDl = Number(patch['dl_info_data'] || 0);
      const sUl = Number(patch['up_info_data'] || 0);
      this.sessionRatio.set(sDl > 0 ? (sUl / sDl).toFixed(2) : '0.00');
    });

    effect(() => {
      if (this.isPaused()) this.pollProgress.set(0);
    });

    this.pollingService.onPoll$
      .pipe(
        takeUntilDestroyed(),
        switchMap(() => {
          const startTime = Date.now();
          const duration = this.pollingService.getPollingInterval();
          return interval(0, animationFrameScheduler).pipe(
            map(() => Math.min(((Date.now() - startTime) / duration) * 100, 100)),
          );
        }),
      )
      .subscribe((progress) => this.pollProgress.set(progress));
  }

  public togglePolling(): void {
    if (this.isPaused()) {
      if (this._pauseToken) this.pollingService.resume(this._pauseToken);
      this._pauseToken = null;
    } else {
      this._pauseToken = this.pollingService.pause();
    }
  }

  public toggleAlternativeSpeedLimit(): void {
    this.commandBusService.emit({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
  }

  public setGlobalTransferLimit(): void {
    this.commandBusService.emit({ type: 'UI_LIMIT_TRANSFER', target: 'global' });
  }

  public setGlobalShareLimit(): void {
    this.commandBusService.emit({ type: 'UI_LIMIT_SHARE', target: 'global' });
  }

  private reset(): void {
    this.diskSpace.set(0n);
    this.dlSpeed.set(0n);
    this.upSpeed.set(0n);
    this.allTimeDl.set(0n);
    this.allTimeUl.set(0n);
    this.dhtNodes.set(0);
    this.connectionStatus.set('offline');
    this.sessionRatio.set('0.00');
    this.globalRatio.set('0.00');
    this.useAltSpeedLimits.set(false);
  }

  private applyIfPresentBigInt(obj: any, key: string, target: { set(v: bigint): void }): void {
    if (obj[key] != null) target.set(BigInt(Math.trunc(Number(obj[key]))));
  }
}
```

- [ ] **Step 4: Update the template — `server-state.html`**

Replace the `@case ('polling-indicator')` block (lines 156-169) with:

```html
@case ('polling-indicator') {
<div
  class="bb-widget cursor-pointer"
  [ngbTooltip]="
          isPaused()
            ? ('pages.main.server-state.polling-paused' | translate)
            : ('pages.main.server-state.server-polling' | translate: { interval: pollingInterval() })
        "
  placement="top"
  container="body"
  (click)="togglePolling()"
>
  <div class="poll-container" [style.--p]="pollProgress()">
    <fa-icon class="poll-icon" [icon]="isPaused() ? icons.faPause : icons.faPlay"></fa-icon>
  </div>
</div>
}
```

- [ ] **Step 5: Update SCSS — `server-state.scss`**

Remove the `.poll-dot` rule (lines 124-130):

```scss
.poll-dot {
  width: 4px;
  height: 4px;
  background-color: var(--bs-primary);
  border-radius: 50%;
  opacity: 0.5;
}
```

Add this rule in its place:

```scss
.poll-icon {
  font-size: 0.45rem;
  color: var(--bs-primary);
  opacity: 0.7;
}
```

- [ ] **Step 6: Run component tests to confirm they pass**

```bash
cd packages/app && npx ng test --include src/app/pages/main/server-state/server-state.spec.ts --watch=false
```

Expected: All tests pass, including the 5 new ones.

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: No errors or warnings.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/main/server-state/server-state.ts \
        packages/app/src/app/pages/main/server-state/server-state.html \
        packages/app/src/app/pages/main/server-state/server-state.scss \
        packages/app/src/app/pages/main/server-state/server-state.spec.ts
git commit -m "$(cat <<'EOF'
#188: add pause toggle to polling indicator widget

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Update i18n strings

**Files:**

- Modify: `public/i18n/us.json` (line 1215)
- Modify: `public/i18n/hu.json` (line 1215)

**Interfaces:**

- Consumes: translation key `pages.main.server-state.polling-paused` used in template (Task 2)
- Consumes: updated `pages.main.server-state.server-polling` used in template (Task 2)

- [ ] **Step 1: Update `public/i18n/us.json`**

Find line 1215 (the `server-polling` entry) and replace it, also inserting the new key after it:

Old:

```json
        "server-polling": "Server Polling ({{interval}}s)",
```

New:

```json
        "server-polling": "Server Polling ({{interval}}s) - Click to Pause",
        "polling-paused": "Polling Paused - Click to Resume",
```

- [ ] **Step 2: Update `public/i18n/hu.json`**

Find line 1215 (the `server-polling` entry) and replace it, also inserting the new key after it:

Old:

```json
        "server-polling": "Szerver lekérdezés ({{interval}}s)",
```

New:

```json
        "server-polling": "Szerver lekérdezés ({{interval}}s) - Kattints a szüneteltetéshez",
        "polling-paused": "Lekérdezés szüneteltetve - Kattints a folytatáshoz",
```

- [ ] **Step 3: Run full test suite**

From the repo root:

```bash
npm test
```

Expected: All tests pass across all workspaces.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: No errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#188: add polling-paused i18n strings

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
