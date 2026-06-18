# Torrent Error Log in General Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the qBittorrent log entry that explains _why_ a torrent is in the `error` state, directly in the torrent-details General tab.

**Architecture:** Add a `log` namespace to `QbService` (mirroring the existing per-API-namespace structure). In the `General` component, a reactive `effect()` watches the torrent's raw state from `TorrentStoreService.torrentsMap()` and, on transition into `'error'`, fetches `/log/main` once per "error episode," filters for `Warning`/`Critical` entries mentioning the torrent's name, and keeps the most recent match. A new collapsed-by-default row (styled with the danger theme tokens) renders the short extracted reason, expandable to the full reason and raw JSON.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-bootstrap/ng-bootstrap` (`NgbCollapse`), Vitest, qBittorrent WebUI API `/api/v2/log/main` and `/api/v2/log/peers`.

**Design spec:** `docs/superpowers/specs/2026-06-18-torrent-error-log-design.md`

## Global Constraints

- Branch `167-torrent-error-log-general-tab`; every commit message must start with `#167: ` (enforced by a commit-msg hook).
- Use `-` (hyphen) instead of `—` (em dash) in all commit messages and docs.
- `npm run lint` must pass with zero warnings (`max-warnings=0`).
- No `packages/electron` changes are needed - `qbRequest` is a generic path/query/method passthrough with no path allowlist.
- The qBittorrent log API's pagination parameter is `last_known_id` (snake_case) - this must be the literal option key, not a camelCase translation, or the filter silently won't apply.
- New `QbService` methods go in a `readonly log = { ... }` namespace inserted between the existing `app` and `sync` namespaces (matches the `QbtApiName` ordering already documented in `packages/app/src/app/models/qbittorrent.model.ts:1-9`, and the namespace-per-API convention from issue #166).
- Any new i18n key must be added to both `public/i18n/us.json` and `public/i18n/hu.json`.
- Run test commands from the repo root (`C:\dev\bitbutler`) using `npm test --workspace=@bitbutler/app -- --include <path-relative-to-packages/app>`.

---

## Task 1: Add qBittorrent log models and `QbService.log` namespace

**Files:**

- Modify: `packages/app/src/app/models/qbittorrent.model.ts`
- Modify: `packages/app/src/app/services/qb.service.ts`
- Test: `packages/app/src/app/services/qb.service.spec.ts`

**Interfaces:**

- Produces: `QbLogMessageType` enum (`Normal=1, Info=2, Warning=4, Critical=8`), `QbLogEntry` interface (`{ id, message, timestamp, type }`), `QbLogPeerEntry` interface (`{ id, ip, timestamp, blocked, reason }`), `QbService.log.main(serverId, options?)` returning `Promise<QbLogEntry[]>`, `QbService.log.peers(serverId, options?)` returning `Promise<QbLogPeerEntry[]>`.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/qb.service.spec.ts`, add two new tests at the end of the existing `describe('QbService', ...)` block (right after the `'should call login with server id via maindata()'` test, before the closing `});`):

```typescript
it('should call log.main with the normal/info/warning/critical query params', async () => {
  const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    body: [],
  } as any);

  await service.log.main('server-1', {
    normal: false,
    info: false,
    warning: true,
    critical: true,
  });

  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'server-1',
      path: '/api/v2/log/main',
      query: { normal: false, info: false, warning: true, critical: true },
    }),
  );
});

it('should call log.peers with a last_known_id query param', async () => {
  const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    body: [],
  } as any);

  await service.log.peers('server-1', { last_known_id: 5 });

  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'server-1',
      path: '/api/v2/log/peers',
      query: { last_known_id: 5 },
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/services/qb.service.spec.ts`
Expected: FAIL - `TypeError: Cannot read properties of undefined (reading 'main')` (or similar), because `service.log` does not exist yet.

- [ ] **Step 3: Add the log models**

In `packages/app/src/app/models/qbittorrent.model.ts`, append to the end of the file (after the existing `export type QbSetAppPreferences = Partial<QbAppPreferences>;` on the last line):

```typescript
export enum QbLogMessageType {
  Normal = 1,
  Info = 2,
  Warning = 4,
  Critical = 8,
}

export interface QbLogEntry {
  id: number;
  message: string;
  timestamp: number;
  type: QbLogMessageType;
}

export interface QbLogPeerEntry {
  id: number;
  ip: string;
  timestamp: number;
  blocked: boolean;
  reason: string;
}
```

- [ ] **Step 4: Add the `log` namespace to `QbService`**

In `packages/app/src/app/services/qb.service.ts`, update the import block at the top of the file (lines 5-11):

```typescript
import {
  QbAppPreferences,
  QbLogEntry,
  QbLogPeerEntry,
  QbResponse,
  QbSetAppPreferences,
  QbTorrentProperties,
  QbTorrentTracker,
} from '../models/qbittorrent.model';
```

Then insert the new `log` namespace between the closing `};` of `readonly app = { ... }` and the start of `readonly sync = { ... }` (currently lines 85-87):

```typescript
  readonly log = {
    main: async (
      serverId: string,
      options: {
        normal?: boolean;
        info?: boolean;
        warning?: boolean;
        critical?: boolean;
        last_known_id?: number;
      } = {},
    ): Promise<QbLogEntry[]> => {
      const res = await this.request<QbLogEntry[]>(serverId, {
        path: '/api/v2/log/main',
        method: 'GET',
        query: { ...options },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get main log`);
    },

    peers: async (
      serverId: string,
      options: { last_known_id?: number } = {},
    ): Promise<QbLogPeerEntry[]> => {
      const res = await this.request<QbLogPeerEntry[]>(serverId, {
        path: '/api/v2/log/peers',
        method: 'GET',
        query: { ...options },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get peer log`);
    },
  };

```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/services/qb.service.spec.ts`
Expected: PASS - all 8 tests pass (the 6 existing plus the 2 new ones).

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`
Expected: no errors/warnings.

```bash
git add packages/app/src/app/models/qbittorrent.model.ts packages/app/src/app/services/qb.service.ts packages/app/src/app/services/qb.service.spec.ts
git commit -m "$(cat <<'EOF'
#167: add QbService.log namespace for /log/main and /log/peers

EOF
)"
```

---

## Task 2: Add `parseFileErrorReason` and `rawLogJson` helpers to `General`

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `QbLogEntry` from Task 1 (`packages/app/src/app/models/qbittorrent.model.ts`).
- Produces: `General.parseFileErrorReason(message: string): { reason: string; short: string }`, `General.rawLogJson(entry: QbLogEntry): string`.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`, add the import for `QbLogEntry`/`QbLogMessageType` at the top of the file (after the existing `import { Subject, of } from 'rxjs';` line):

```typescript
import { QbLogEntry, QbLogMessageType } from '../../../../models/qbittorrent.model';
```

Then add two new `describe` blocks right before the final closing `});` of the outer `describe('General', ...)` block:

```typescript
describe('parseFileErrorReason', () => {
  it('extracts the short error and full reason from a file error alert message', () => {
    const message =
      'File error alert. Torrent: "ubuntu-26.04-desktop-amd64.iso". File: "/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB". Reason: "ubuntu-26.04-desktop-amd64.iso file_open (/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB) error: Permission denied"';

    const result = component.parseFileErrorReason(message);

    expect(result.short).toBe('Permission denied');
    expect(result.reason).toBe(
      'ubuntu-26.04-desktop-amd64.iso file_open (/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB) error: Permission denied',
    );
  });

  it('falls back to the full reason when there is no "error:" segment', () => {
    const message = 'Some alert. Torrent: "My Torrent". Reason: "disk is full"';

    const result = component.parseFileErrorReason(message);

    expect(result.reason).toBe('disk is full');
    expect(result.short).toBe('disk is full');
  });

  it('falls back to the raw message when there is no Reason section', () => {
    const message = 'Added new torrent. Torrent: "My Torrent"';

    const result = component.parseFileErrorReason(message);

    expect(result.reason).toBe(message);
    expect(result.short).toBe(message);
  });
});

describe('rawLogJson', () => {
  it('formats the log entry as 4-space-indented JSON', () => {
    const entry: QbLogEntry = {
      id: 10672,
      message: 'File error alert.',
      timestamp: 1781772596,
      type: QbLogMessageType.Warning,
    };

    expect(component.rawLogJson(entry)).toBe(JSON.stringify(entry, null, 4));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/components/modals/torrent-details/general/general.spec.ts`
Expected: FAIL - `TypeError: component.parseFileErrorReason is not a function` (and similarly for `rawLogJson`).

- [ ] **Step 3: Implement the helpers**

In `packages/app/src/app/components/modals/torrent-details/general/general.ts`, update the model import (currently `import { QbTorrentProperties } from '../../../../models/qbittorrent.model';`) to:

```typescript
import { QbLogEntry, QbTorrentProperties } from '../../../../models/qbittorrent.model';
```

Then add the two new methods right after the closing `}` of `isDownloading()` (the last method in the class), before the class's final closing `}`:

```typescript

  public parseFileErrorReason(message: string): { reason: string; short: string } {
    const match = message.match(/Reason:\s*"(.*)"\s*$/);
    const reason = match ? match[1] : message;
    const errorMatch = reason.match(/error:\s*(.+)$/i);
    const short = errorMatch ? errorMatch[1] : reason;
    return { reason, short };
  }

  public rawLogJson(entry: QbLogEntry): string {
    return JSON.stringify(entry, null, 4);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/components/modals/torrent-details/general/general.spec.ts`
Expected: PASS - all previous tests plus the 4 new ones pass.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: no errors/warnings.

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts packages/app/src/app/components/modals/torrent-details/general/general.spec.ts
git commit -m "$(cat <<'EOF'
#167: add file-error log message parsing helpers to General

EOF
)"
```

---

## Task 3: Add the error-log effect and signals to `General`

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `QbService.log.main` from Task 1, `QbLogMessageType` from Task 1.
- Produces: `General.errorLog: WritableSignal<QbLogEntry | null>`, `General.errorLogExpanded: WritableSignal<boolean>`, `General.toggleErrorLog(): void`.

- [ ] **Step 1: Update test scaffolding and write the failing tests**

In `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`, replace the full top section of the file (from the imports down through the start of the `beforeEach`) with the following. This adds a mutable `torrentsMap` signal reference, a `mockLogMain` spy wired into the `QbService` mock, a `makeTorrent`/`makeLogEntry` fixture helper, and sets a non-empty `hash` input so the new tests can look up a torrent by hash:

```typescript
import { Clipboard } from '@angular/cdk/clipboard';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { QbLogEntry, QbLogMessageType } from '../../../../models/qbittorrent.model';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../../services/general-settings.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { General } from './general';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({
    name: 'My Torrent',
    hash: 'abc123',
    state: 'downloading',
    ...overrides,
  }) as Torrent;

const makeLogEntry = (overrides: Partial<QbLogEntry> = {}): QbLogEntry => ({
  id: 1,
  message:
    'File error alert. Torrent: "My Torrent". File: "/path". Reason: "x error: Permission denied"',
  timestamp: 1700000000,
  type: QbLogMessageType.Warning,
  ...overrides,
});

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;
  let torrentsMap: WritableSignal<Map<string, Torrent>>;
  let mockLogMain: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    torrentsMap = signal(new Map());
    mockLogMain = vi.fn().mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap },
        },
        {
          provide: QbService,
          useValue: {
            torrents: {
              properties: vi.fn().mockResolvedValue({}),
              files: vi.fn().mockResolvedValue([]),
              rename: vi.fn(),
              renameFile: vi.fn(),
              renameFolder: vi.fn(),
              setDownloadLimit: vi.fn(),
              setUploadLimit: vi.fn(),
              setShareLimits: vi.fn(),
              setCategory: vi.fn(),
              addTags: vi.fn(),
              removeTags: vi.fn(),
              reannounce: vi.fn(),
            },
            log: {
              main: mockLogMain,
            },
          },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ behavior: {} }),
            asObservable: vi.fn().mockReturnValue(of({ behavior: {} })),
          },
        },
        { provide: PathService, useValue: { resolveLocalPath: vi.fn().mockResolvedValue(null) } },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hash', 'abc123');
    fixture.detectChanges();
  });
```

(Leave the rest of the file - the `'should create'` test through the `parseFileErrorReason`/`rawLogJson` describes from Task 2 - unchanged.)

Now add a new `describe('errorLog effect', ...)` and `describe('toggleErrorLog', ...)` right before the final closing `});` of the outer `describe('General', ...)` block:

```typescript
describe('errorLog effect', () => {
  it('does nothing when the torrent is not in the error state', async () => {
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockLogMain).not.toHaveBeenCalled();
    expect(component.errorLog()).toBeNull();
  });

  it('fetches the main log and stores the matching warning/critical entry when the torrent errors', async () => {
    const matching = makeLogEntry({ id: 5, type: QbLogMessageType.Critical });
    const unrelated = makeLogEntry({
      id: 6,
      type: QbLogMessageType.Normal,
      message: 'Added new torrent. Torrent: "My Torrent"',
    });
    mockLogMain.mockResolvedValue([unrelated, matching]);

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockLogMain).toHaveBeenCalledWith('server-1', {
      normal: false,
      info: false,
      warning: true,
      critical: true,
    });
    expect(component.errorLog()?.id).toBe(5);
  });

  it('picks the entry with the highest id when multiple entries match', async () => {
    mockLogMain.mockResolvedValue([
      makeLogEntry({ id: 5, type: QbLogMessageType.Warning }),
      makeLogEntry({ id: 9, type: QbLogMessageType.Critical }),
      makeLogEntry({ id: 7, type: QbLogMessageType.Warning }),
    ]);

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.errorLog()?.id).toBe(9);
  });

  it('does not refetch while the torrent stays in the error state with no match', async () => {
    mockLogMain.mockResolvedValue([
      makeLogEntry({ message: 'Unrelated torrent message', type: QbLogMessageType.Critical }),
    ]);

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockLogMain).toHaveBeenCalledTimes(1);
    expect(component.errorLog()).toBeNull();

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockLogMain).toHaveBeenCalledTimes(1);
  });

  it('clears errorLog and refetches on the next error episode after leaving the error state', async () => {
    mockLogMain.mockResolvedValue([makeLogEntry({ id: 1, type: QbLogMessageType.Critical })]);
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.errorLog()?.id).toBe(1);

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.errorLog()).toBeNull();

    mockLogMain.mockResolvedValue([makeLogEntry({ id: 2, type: QbLogMessageType.Critical })]);
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockLogMain).toHaveBeenCalledTimes(2);
    expect(component.errorLog()?.id).toBe(2);
  });
});

describe('toggleErrorLog', () => {
  it('flips errorLogExpanded', () => {
    expect(component.errorLogExpanded()).toBe(false);
    component.toggleErrorLog();
    expect(component.errorLogExpanded()).toBe(true);
    component.toggleErrorLog();
    expect(component.errorLogExpanded()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/components/modals/torrent-details/general/general.spec.ts`
Expected: FAIL - `TypeError: component.toggleErrorLog is not a function` / `component.errorLog is not a function`.

- [ ] **Step 3: Implement the signals and effect**

In `packages/app/src/app/components/modals/torrent-details/general/general.ts`, update the model import from Task 2 to also bring in `QbLogMessageType`:

```typescript
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../../models/qbittorrent.model';
```

Add the two new signal fields right after `public localPath: WritableSignal<string | null> = signal(null);` (and before the `constructor()`):

```typescript
  public errorLog: WritableSignal<QbLogEntry | null> = signal(null);
  public errorLogExpanded = signal(false);
```

Inside the `constructor()`, add a second effect right after the existing `effectRef` effect's closing `});`, still before the constructor's own closing `}`:

```typescript
let hasAttemptedErrorLogFetch = false;

effect(async () => {
  const entry = this.torrentStoreService.torrentsMap().get(this.hash());
  const state = entry?.state;
  const name = entry?.name;
  const serverId = this.serverStoreService.currentServerId();

  if (state !== 'error') {
    hasAttemptedErrorLogFetch = false;
    this.errorLog.set(null);
    return;
  }

  if (hasAttemptedErrorLogFetch || !serverId || !name) return;
  hasAttemptedErrorLogFetch = true;

  try {
    const entries = await this.qbService.log.main(serverId, {
      normal: false,
      info: false,
      warning: true,
      critical: true,
    });

    const matches = entries.filter(
      (e) =>
        (e.type === QbLogMessageType.Warning || e.type === QbLogMessageType.Critical) &&
        e.message.includes(name),
    );

    if (matches.length > 0) {
      this.errorLog.set(matches.reduce((a, b) => (b.id > a.id ? b : a)));
    }
  } catch (error: any) {
    console.error(General.name, 'errorLog effect', 'Failed to fetch log entries', error);
  }
});
```

Finally, add the `toggleErrorLog()` method after `rawLogJson()` (added in Task 2), before the class's closing `}`:

```typescript

  public toggleErrorLog(): void {
    this.errorLogExpanded.update((v) => !v);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/components/modals/torrent-details/general/general.spec.ts`
Expected: PASS - all previous tests plus the 6 new ones pass.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: no errors/warnings.

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts packages/app/src/app/components/modals/torrent-details/general/general.spec.ts
git commit -m "$(cat <<'EOF'
#167: fetch and store the matching error log entry on torrent error

EOF
)"
```

---

## Task 4: Add the error row template, styling, and i18n

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.html`
- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.scss`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `General.errorLog`, `General.errorLogExpanded`, `General.toggleErrorLog()`, `General.parseFileErrorReason()`, `General.rawLogJson()` from Tasks 2-3.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`, add a new `describe('error row rendering', ...)` right before the final closing `});` of the outer `describe('General', ...)` block (after the `toggleErrorLog` describe added in Task 3):

```typescript
describe('error row rendering', () => {
  it('does not render the error row when there is no errorLog', () => {
    expect(fixture.nativeElement.querySelector('.bb-section--danger')).toBeNull();
  });

  it('renders the error row with the short reason and reflects errorLogExpanded on the icon', () => {
    component.errorLog.set(makeLogEntry());
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.bb-section--danger');
    expect(row).not.toBeNull();
    expect(row.querySelector('.section-value').textContent).toContain('Permission denied');

    const icon = row.querySelector('.error-toggle__icon');
    expect(icon.classList.contains('error-toggle__icon--expanded')).toBe(false);

    component.toggleErrorLog();
    fixture.detectChanges();

    expect(icon.classList.contains('error-toggle__icon--expanded')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/components/modals/torrent-details/general/general.spec.ts`
Expected: FAIL - both new tests fail because `.bb-section--danger` is never rendered (querySelector returns `null`, so `row.querySelector(...)` throws or the first assertion's `toBeNull()` already shows nothing renders).

- [ ] **Step 3: Add `NgbCollapse` to the component imports**

In `packages/app/src/app/components/modals/torrent-details/general/general.ts`, change:

```typescript
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
```

to:

```typescript
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
```

and add `NgbCollapse` to the `@Component` decorator's `imports` array (currently containing `NgbTooltip` among others):

```typescript
  imports: [
    BbSpinner,
    DatePipe,
    TimeagoPipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    BbProgress,
    FontAwesomeModule,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
  ],
```

- [ ] **Step 4: Add the template block**

In `packages/app/src/app/components/modals/torrent-details/general/general.html`, find the end of the "State" row - the `</div>` that closes the `<div class="col-12 bb-section">` containing the state `section-header`/`section-value`/resume-pause-force-resume buttons - immediately followed by the start of the "Category" row:

```html
          </div>
        </div>
        <div class="col-12 bb-section">
          <span class="section-header">{{
            'components.modals.torrent-details.general.category' | translate
```

Insert the new error row between those two, so it reads:

```html
          </div>
        </div>
        @if (errorLog(); as entry) {
          <div class="col-12 bb-section bb-section--danger">
            <button type="button" class="error-toggle" (click)="toggleErrorLog()">
              <span class="section-header">{{
                'components.modals.torrent-details.general.error' | translate
              }}</span>
              <span class="section-value">{{ parseFileErrorReason(entry.message).short }}</span>
              <span
                class="error-toggle__icon"
                [class.error-toggle__icon--expanded]="errorLogExpanded()"
              ></span>
            </button>

            <div [ngbCollapse]="!errorLogExpanded()">
              <div class="error-toggle__detail">
                <span class="section-header">{{
                  'components.modals.torrent-details.general.reason' | translate
                }}</span>
                <span class="section-value">{{ parseFileErrorReason(entry.message).reason }}</span>
                <pre>{{ rawLogJson(entry) }}</pre>
              </div>
            </div>
          </div>
        }
        <div class="col-12 bb-section">
          <span class="section-header">{{
            'components.modals.torrent-details.general.category' | translate
```

- [ ] **Step 5: Add the danger row styling**

In `packages/app/src/app/components/modals/torrent-details/general/general.scss`, append to the end of the file (after the existing `app-bb-progress { ... }` block):

```scss
div.bb-section.bb-section--danger {
  background-color: var(--bs-danger);

  span.section-header,
  span.section-value {
    color: var(--bb-danger-ink);
  }

  &:hover,
  &:focus-within {
    background-color: color-mix(in srgb, var(--bs-danger) 85%, black);
  }

  .error-toggle {
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .error-toggle__icon {
    position: absolute;
    right: 15px;
    top: 50%;
    width: 1.25rem;
    height: 1.25rem;
    transform: translateY(-50%);
    background-color: var(--bb-danger-ink);
    mask-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
    mask-repeat: no-repeat;
    mask-size: contain;
    transition: transform 0.2s ease-in-out;

    &--expanded {
      transform: translateY(-50%) rotate(-180deg);
    }
  }

  .error-toggle__detail {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid color-mix(in srgb, var(--bb-danger-ink) 30%, transparent);

    pre {
      margin: 8px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      background: color-mix(in srgb, black 20%, transparent);
      color: var(--bb-danger-ink);
      padding: 8px;
      border-radius: 4px;
      font-size: 0.8rem;
    }
  }
}
```

- [ ] **Step 6: Add the i18n keys**

In `public/i18n/us.json`, find:

```json
          "comment": "Comment",
          "labels": {
```

and change it to:

```json
          "comment": "Comment",
          "error": "Error",
          "reason": "Reason",
          "labels": {
```

In `public/i18n/hu.json`, find:

```json
          "comment": "Megjegyzés",
          "labels": {
```

and change it to:

```json
          "comment": "Megjegyzés",
          "error": "Hiba",
          "reason": "Indok",
          "labels": {
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- --include src/app/components/modals/torrent-details/general/general.spec.ts`
Expected: PASS - all previous tests plus the 2 new rendering tests pass.

- [ ] **Step 8: Lint and commit**

Run: `npm run lint`
Expected: no errors/warnings.

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts packages/app/src/app/components/modals/torrent-details/general/general.html packages/app/src/app/components/modals/torrent-details/general/general.scss packages/app/src/app/components/modals/torrent-details/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#167: render the torrent error row in the General tab

EOF
)"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS - all test files pass, including the modified `qb.service.spec.ts` and `general.spec.ts`.

- [ ] **Step 2: Run the full lint**

Run: `npm run lint`
Expected: no errors/warnings (zero-warnings policy).

- [ ] **Step 3: Run a production Angular build to catch any template/type errors**

Run: `npm run build`
Expected: build completes successfully with no compile errors.

- [ ] **Step 4: Manually verify in the running app**

Run: `npm start`
In the app: connect to a qBittorrent server, find or create a torrent in the `error` state (e.g. point a torrent's save path at a location without write permission and let it fail), open its details modal's General tab, and confirm:

- A red "ERROR" row appears under the "State" row, collapsed by default, showing a short reason (e.g. "Permission denied").
- Clicking the row expands it to show the "REASON" line and the raw JSON log entry in a `<pre>` block, with a chevron that flips direction.
- A torrent NOT in the `error` state shows no such row.

No commit needed for this task unless a fix is required - if any step fails, fix the underlying issue, re-run the relevant task's tests, and commit the fix with `#167: ` prefix before re-running this task's steps.

---

## Self-Review Notes

- **Spec coverage:** `QbService.log.main`/`log.peers` (Task 1) - covered. Effect-driven fetch on error transition, matching rule (Warning/Critical + name substring), most-recent-match selection, once-per-episode guard (Task 3) - covered. Message parsing into short/reason with fallbacks, raw JSON formatting (Task 2) - covered. Collapsed-by-default danger-styled row with accordion-style chevron, i18n (Task 4) - covered. `/log/peers` intentionally left unwired from any UI, per the spec's non-goals.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type consistency:** `QbLogEntry`/`QbLogMessageType` are defined once in Task 1 and reused with identical names/shapes in Tasks 2-4. `errorLog`/`errorLogExpanded`/`toggleErrorLog`/`parseFileErrorReason`/`rawLogJson` are each defined exactly once and referenced consistently across the template and tests.
