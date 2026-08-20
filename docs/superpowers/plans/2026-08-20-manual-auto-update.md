# Manual Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button-triggered ("Update Now") in-app update flow to the existing `UpdateAvailable` modal, using `electron-updater`, that downloads and installs an update fully automatically once clicked - with zero update-related network calls before that click.

**Architecture:** `electron-updater`'s `autoUpdater` singleton lives in a new main-process module (`packages/electron/src/updater.ts`) with `autoDownload`/`autoInstallOnAppQuit` forced off. Two IPC endpoints - one to report whether this install can self-update, one to kick off `checkForUpdates()` - drive an event chain (`update-available` -> `downloadUpdate()` -> `update-downloaded` -> delayed `quitAndInstall()`) whose progress is forwarded to the renderer over a single `updater:event` channel. The renderer's `UpdaterService` turns that event stream into signals that the `UpdateAvailable` modal's footer reads directly. The existing GitHub-REST "is there an update" check and changelog UI are untouched.

**Tech Stack:** Electron main process (TypeScript, vitest), `electron-updater`, Angular 20 zoneless (signals), `@ng-bootstrap/ng-bootstrap` modal, `@bitbutler/shared` IPC contract, `@ngx-translate/core`.

**Spec:** `docs/superpowers/specs/2026-08-20-manual-auto-update-design.md`

## Global Constraints

- `autoUpdater.autoDownload = false` and `autoUpdater.autoInstallOnAppQuit = false` must be set explicitly - no silent/background update behavior.
- Zero update-related network calls happen without an explicit "Update Now" click (the existing automatic changelog check on startup is unchanged and out of scope).
- Windows capability check: `supported` only if `Update.exe` exists next to `process.execPath` (covers both the portable exe and a zip extraction, which lack that file).
- Linux capability check: `supported` only if `process.env.APPIMAGE` is set.
- Dev mode (`!app.isPackaged`): `supported` is always `false`.
- `build.publish` in root `package.json`: `{ "provider": "github", "owner": "enisz", "repo": "bitbutler" }`.
- `electron-updater` is a root `dependencies` entry (matching where `axios`/`better-sqlite3` already live), not a `packages/electron` dependency.
- CI packaging step needs `--publish never`; the release-asset upload step needs `latest.yml`, `latest-linux.yml`, and `*.exe.blockmap` added to its file globs.
- Toasts follow the project convention: Title-Case outcome title, message is the variable detail only.
- Use `-` not `—` in all written output (commit messages, code comments, UI copy).
- Commits use the format `#267: short description` (this work stays on the current `267-claude-inspired-ui-refresh-v2` branch, per user instruction).

---

### Task 1: Shared updater types

**Files:**

- Create: `packages/shared/src/models/updater.model.ts`
- Modify: `packages/shared/src/ipc.types.ts:1-4` (imports), `packages/shared/src/ipc.types.ts:183-194` (add `updater` to `BitButlerAPI`)
- Modify: `packages/shared/src/index.ts:1-8` (export the new model), `packages/shared/src/index.ts:17-46` (add new type names to the `ipc.types.js` export list - not needed here since the new types live in `updater.model.ts`, not `ipc.types.ts`)

**Interfaces:**

- Produces: `UpdateCapability { supported: boolean }`, `UpdaterEvent` tagged union (`checking` / `downloading` / `downloaded` / `error`), and `BitButlerAPI.updater` (`getCapability(): Promise<UpdateCapability>`, `updateNow(): Promise<void>`, `onEvent(callback: (event: UpdaterEvent) => void): () => void`). Tasks 2, 3, and 4 all consume these exact names.

- [ ] **Step 1: Create the updater model file**

```ts
// packages/shared/src/models/updater.model.ts
export interface UpdateCapability {
  supported: boolean;
}

export type UpdaterEvent =
  | { status: 'checking' }
  | { status: 'downloading'; percent: number; transferred: number; total: number }
  | { status: 'downloaded' }
  | { status: 'error'; message: string };
```

- [ ] **Step 2: Export the new model from the package index**

In `packages/shared/src/index.ts`, add a new export block right after the existing `electron.model.js` export (after line 8):

```ts
export type { UpdateCapability, UpdaterEvent } from './models/updater.model.js';
```

- [ ] **Step 3: Add the `updater` namespace to `BitButlerAPI`**

In `packages/shared/src/ipc.types.ts`, add the import at the top of the file (alongside the existing model imports, before line 5):

```ts
import type { UpdateCapability, UpdaterEvent } from './models/updater.model.js';
```

Then add a new `updater` block to the `BitButlerAPI` interface, right after the closing brace of `electron: { ... };` (currently ipc.types.ts:194) and before `server: {`:

```ts
  updater: {
    getCapability(): Promise<UpdateCapability>;
    updateNow(): Promise<void>;
    onEvent(callback: (event: UpdaterEvent) => void): () => void;
  };
```

- [ ] **Step 4: Verify the workspace still typechecks**

Run: `npm run build --workspace=packages/electron && npm run build --workspace=packages/app`
Expected: both builds succeed (no test suite exists for `@bitbutler/shared` - it is types-only, so a successful build of its two consumers is the verification).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/updater.model.ts packages/shared/src/index.ts packages/shared/src/ipc.types.ts
git commit -m "#267: add shared types for the updater IPC contract"
```

---

### Task 2: Main-process updater module (capability detection + IPC + event forwarding)

**Files:**

- Create: `packages/electron/src/updater.ts`
- Create: `packages/electron/src/updater.spec.ts`
- Modify: `packages/electron/src/main.ts:1-19` (import), `packages/electron/src/main.ts:34-44` (register call)
- Modify: `packages/electron/src/preload.ts:1-16` (import), `packages/electron/src/preload.ts:43-54` (add `updater` namespace)

**Interfaces:**

- Consumes: `UpdateCapability`, `UpdaterEvent` from `@bitbutler/shared` (Task 1). `getMainWindow` from `./main.js` (existing, returns `Electron.BrowserWindow | null`).
- Produces: `registerUpdaterIpcHandlers(): void`, IPC channels `updater:get-capability`, `updater:update-now`, and outbound `updater:event`. Task 3 consumes these channel names via the preload API this task also wires up.

- [ ] **Step 1: Write the failing tests for `updater.ts`**

```ts
// packages/electron/src/updater.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const updaterListeners = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockAutoUpdater = vi.hoisted(() => ({
  autoDownload: true,
  autoInstallOnAppQuit: true,
  on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
    updaterListeners.set(event, handler);
  }),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
}));
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockSend = vi.hoisted(() => vi.fn());
const mockGetMainWindow = vi.hoisted(() => vi.fn(() => ({ webContents: { send: mockSend } })));
const mockAppIsPackaged = vi.hoisted(() => ({ value: true }));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockAppIsPackaged.value;
    },
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));
vi.mock('electron-updater', () => ({ autoUpdater: mockAutoUpdater }));
vi.mock('node:fs', () => ({ existsSync: mockExistsSync }));
vi.mock('./main.js', () => ({ getMainWindow: mockGetMainWindow }));

describe('updater IPC handlers', () => {
  const originalPlatform = process.platform;
  const originalExecPath = process.execPath;
  const originalAppimageEnv = process.env.APPIMAGE;

  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    updaterListeners.clear();
    mockAppIsPackaged.value = true;
    Object.defineProperty(process, 'execPath', {
      value: 'C:/Program Files/BitButler/BitButler.exe',
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    if (originalAppimageEnv === undefined) {
      delete process.env.APPIMAGE;
    } else {
      process.env.APPIMAGE = originalAppimageEnv;
    }
  });

  async function registerAndGetHandlers() {
    const { registerUpdaterIpcHandlers } = await import('./updater.js');
    registerUpdaterIpcHandlers();
    return ipcHandlers;
  }

  it('forces autoDownload and autoInstallOnAppQuit off', async () => {
    await registerAndGetHandlers();
    expect(mockAutoUpdater.autoDownload).toBe(false);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(false);
  });

  describe('updater:get-capability', () => {
    it('is unsupported when the app is not packaged (dev mode)', async () => {
      mockAppIsPackaged.value = false;
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: false });
    });

    it('is supported on Windows when Update.exe exists next to the executable', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExistsSync.mockReturnValue(true);
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: true });
      expect(mockExistsSync).toHaveBeenCalledWith('C:\\Program Files\\BitButler\\Update.exe');
    });

    it('is unsupported on Windows when Update.exe is missing (portable/zip)', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExistsSync.mockReturnValue(false);
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: false });
    });

    it('is supported on Linux when APPIMAGE is set', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      process.env.APPIMAGE = '/tmp/BitButler.AppImage';
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: true });
    });

    it('is unsupported on Linux when APPIMAGE is unset (deb/rpm/snap/tar.gz)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      delete process.env.APPIMAGE;
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: false });
    });
  });

  describe('updater:update-now', () => {
    it('calls autoUpdater.checkForUpdates()', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined);
      const handlers = await registerAndGetHandlers();
      await handlers.get('updater:update-now')!(null);
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it('sends a sanitized error event when checkForUpdates() rejects', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'));
      const handlers = await registerAndGetHandlers();
      await handlers.get('updater:update-now')!(null);
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'error',
        message: 'offline',
      });
    });
  });

  describe('autoUpdater event forwarding', () => {
    it('forwards checking-for-update as a checking event', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('checking-for-update')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'checking' });
    });

    it('starts the download when update-available fires', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('update-available')!();
      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled();
    });

    it('sends a friendly error when update-not-available fires', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('update-not-available')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'error',
        message: 'No update is currently available.',
      });
    });

    it('forwards download-progress as a downloading event', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('download-progress')!({ percent: 42.5, transferred: 1000, total: 2000 });
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'downloading',
        percent: 42.5,
        transferred: 1000,
        total: 2000,
      });
    });

    it('sends a downloaded event then quits and installs after a delay', async () => {
      vi.useFakeTimers();
      await registerAndGetHandlers();
      updaterListeners.get('update-downloaded')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'downloaded' });
      expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1200);
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('forwards a raw Error from the error event as a sanitized message', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('error')!(new Error('network down'));
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'error',
        message: 'network down',
      });
    });

    it('stringifies a non-Error value from the error event', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('error')!('boom');
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'error', message: 'boom' });
    });

    it('does nothing when there is no main window to send to', async () => {
      mockGetMainWindow.mockReturnValueOnce(null);
      await registerAndGetHandlers();
      expect(() => updaterListeners.get('checking-for-update')!()).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/electron -- updater.spec.ts`
Expected: FAIL - `Cannot find module './updater.js'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `updater.ts`**

```ts
// packages/electron/src/updater.ts
import type { UpdateCapability, UpdaterEvent } from '@bitbutler/shared';
import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getMainWindow } from './main.js';

const QUIT_AND_INSTALL_DELAY_MS = 1200;

export function registerUpdaterIpcHandlers(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent({ status: 'checking' });
  });

  autoUpdater.on('update-available', () => {
    void autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdaterEvent({ status: 'error', message: 'No update is currently available.' });
  });

  // NSIS installers are unsigned until SignPath Foundation signing lands, so
  // Windows Defender SmartScreen can still block or delay the downloaded
  // update installer even though quitAndInstall() launches it programmatically
  // rather than via a user double-click. A stalled or failed automatic
  // install on Windows is an expected risk here, not necessarily a bug.
  autoUpdater.on(
    'download-progress',
    (progress: { percent: number; transferred: number; total: number }) => {
      sendUpdaterEvent({
        status: 'downloading',
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      });
    },
  );

  autoUpdater.on('update-downloaded', () => {
    sendUpdaterEvent({ status: 'downloaded' });
    setTimeout(() => autoUpdater.quitAndInstall(), QUIT_AND_INSTALL_DELAY_MS);
  });

  autoUpdater.on('error', (error: unknown) => {
    sendUpdaterEvent({ status: 'error', message: sanitizeError(error) });
  });

  ipcMain.handle('updater:get-capability', async () => getUpdateCapability());

  ipcMain.handle('updater:update-now', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      sendUpdaterEvent({ status: 'error', message: sanitizeError(error) });
    }
  });
}

function getUpdateCapability(): UpdateCapability {
  if (!app.isPackaged) {
    return { supported: false };
  }

  if (process.platform === 'linux') {
    return { supported: Boolean(process.env.APPIMAGE) };
  }

  if (process.platform === 'win32') {
    // Use path.win32 explicitly (not the bare dirname/join re-exports) so this
    // resolves the same Windows-style path deterministically no matter which
    // OS actually runs the code - Node's default path module picks its
    // posix/win32 implementation from the real host platform, not the
    // process.platform value checked above.
    const updateExePath = path.win32.join(path.win32.dirname(process.execPath), 'Update.exe');
    return { supported: existsSync(updateExePath) };
  }

  return { supported: false };
}

function sendUpdaterEvent(event: UpdaterEvent): void {
  getMainWindow()?.webContents.send('updater:event', event);
}

function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/electron -- updater.spec.ts`
Expected: PASS (all cases from Step 1).

- [ ] **Step 5: Register the new handlers in `main.ts`**

In `packages/electron/src/main.ts`, add the import alphabetically between the `torrent.js` and `window.js` imports (currently lines 15-16):

```ts
import { registerTorrentIpcHandlers } from './ipc/torrent.js';
import { handleSecondInstanceArgv, registerWindowIpcHandlers } from './ipc/window.js';
import { registerUpdaterIpcHandlers } from './updater.js';
```

Then add the call inside `registerAppIpcHandlers()` (currently main.ts:34-44), after `registerElectronIpcHandlers();`:

```ts
registerElectronIpcHandlers();
registerUpdaterIpcHandlers();
registerExportIpcHandlers();
```

- [ ] **Step 6: Wire the `updater` namespace into the preload script**

In `packages/electron/src/preload.ts`, add the type import (currently lines 1-16) alongside the other `@bitbutler/shared` imports:

```ts
import type {
  BbeMetadata,
  BbeServerInfo,
  BitButlerAPI,
  BitButlerSyncStreamResponse,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ExportTorrentFileItem,
  ExportTorrentFilesResult,
  ImportProgressEvent,
  ImportStartPayload,
  MenuClickPayload,
  TorrentDraft,
  UpdaterEvent,
  WindowState,
} from '@bitbutler/shared';
```

Then add the `updater` namespace to the `api` object (currently preload.ts:43-54), right after the closing brace of `electron: { ... },`:

```ts
  updater: {
    getCapability: () => ipcRenderer.invoke('updater:get-capability'),
    updateNow: () => ipcRenderer.invoke('updater:update-now'),
    onEvent: (callback) =>
      makeIpcSubscription('updater:event', (e) => e as UpdaterEvent, callback),
  },
```

- [ ] **Step 7: Rebuild electron and re-run the full electron test suite**

Run: `npm run build --workspace=packages/electron && npm run test --workspace=packages/electron`
Expected: build succeeds, all tests (including the new `updater.spec.ts`) pass.

- [ ] **Step 8: Commit**

```bash
git add packages/electron/src/updater.ts packages/electron/src/updater.spec.ts packages/electron/src/main.ts packages/electron/src/preload.ts
git commit -m "#267: add main-process updater module with manual update-now IPC"
```

---

### Task 3: Angular `UpdaterService`

**Files:**

- Create: `packages/app/src/app/services/updater.service.ts`
- Create: `packages/app/src/app/services/updater.service.spec.ts`
- Modify: `packages/app/src/test-setup.ts:58-69` (add the global `window.bitbutler.updater` stub)

**Interfaces:**

- Consumes: `window.bitbutler.updater` (Task 2's preload API), `UpdateCapability`/`UpdaterEvent` from `@bitbutler/shared` (Task 1).
- Produces: `UpdaterService` with `capability: Signal<UpdateCapability | null>`, `status: Signal<'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'>`, `progress: Signal<number>`, `errorMessage: Signal<string | null>`, `updateNow(): void`, `reset(): void`. Task 4 consumes all of these exact names.

- [ ] **Step 1: Add the global test stub for `window.bitbutler.updater`**

In `packages/app/src/test-setup.ts`, add a new block right after the `electron: { ... },` block closes (currently line 69) and before `server: {` (currently line 70):

```ts
  updater: {
    getCapability: () => Promise.resolve({ supported: false }),
    updateNow: noopAsync,
    onEvent: noopSubscription,
  },
```

- [ ] **Step 2: Write the failing test for `UpdaterService`**

```ts
// packages/app/src/app/services/updater.service.spec.ts
import { TestBed } from '@angular/core/testing';
import type { UpdateCapability, UpdaterEvent } from '@bitbutler/shared';
import { UpdaterService } from './updater.service';

describe('UpdaterService', () => {
  let service: UpdaterService;
  let emit: (event: UpdaterEvent) => void;
  let updateNowSpy: ReturnType<typeof vi.fn>;
  let getCapabilitySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateNowSpy = vi.fn().mockResolvedValue(undefined);
    getCapabilitySpy = vi.fn().mockResolvedValue({ supported: false } as UpdateCapability);

    vi.spyOn(window.bitbutler.updater, 'onEvent').mockImplementation((callback) => {
      emit = callback;
      return () => {};
    });
    vi.spyOn(window.bitbutler.updater, 'getCapability').mockImplementation(getCapabilitySpy);
    vi.spyOn(window.bitbutler.updater, 'updateNow').mockImplementation(updateNowSpy);

    TestBed.configureTestingModule({ providers: [UpdaterService] });
    service = TestBed.inject(UpdaterService);
  });

  it('starts idle with no capability, zero progress, and no error', () => {
    expect(service.status()).toBe('idle');
    expect(service.progress()).toBe(0);
    expect(service.errorMessage()).toBeNull();
  });

  it('loads capability from window.bitbutler.updater.getCapability() on construction', async () => {
    await Promise.resolve();
    expect(getCapabilitySpy).toHaveBeenCalled();
  });

  it('sets capability once getCapability() resolves', async () => {
    getCapabilitySpy.mockResolvedValue({ supported: true });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [UpdaterService] });
    vi.spyOn(window.bitbutler.updater, 'getCapability').mockResolvedValue({ supported: true });
    const freshService = TestBed.inject(UpdaterService);
    await Promise.resolve();
    expect(freshService.capability()).toEqual({ supported: true });
  });

  it('sets status to checking on a checking event', () => {
    emit({ status: 'checking' });
    expect(service.status()).toBe('checking');
  });

  it('sets status to downloading and tracks percent on a downloading event', () => {
    emit({ status: 'downloading', percent: 37, transferred: 370, total: 1000 });
    expect(service.status()).toBe('downloading');
    expect(service.progress()).toBe(37);
  });

  it('sets status to downloaded on a downloaded event', () => {
    emit({ status: 'downloaded' });
    expect(service.status()).toBe('downloaded');
  });

  it('sets status to error and records the message on an error event', () => {
    emit({ status: 'error', message: 'offline' });
    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('offline');
  });

  it('updateNow() resets status/progress/error and calls the preload API', () => {
    emit({ status: 'error', message: 'offline' });
    service.updateNow();
    expect(service.status()).toBe('checking');
    expect(service.progress()).toBe(0);
    expect(service.errorMessage()).toBeNull();
    expect(updateNowSpy).toHaveBeenCalled();
  });

  it('reset() returns to idle with no progress or error', () => {
    emit({ status: 'error', message: 'offline' });
    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.progress()).toBe(0);
    expect(service.errorMessage()).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app -- updater.service.spec.ts`
Expected: FAIL - `Cannot find module './updater.service'`.

- [ ] **Step 4: Implement `UpdaterService`**

```ts
// packages/app/src/app/services/updater.service.ts
import { Injectable, signal } from '@angular/core';
import type { UpdateCapability, UpdaterEvent } from '@bitbutler/shared';

export type UpdaterStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

@Injectable({ providedIn: 'root' })
export class UpdaterService {
  private readonly _capability = signal<UpdateCapability | null>(null);
  private readonly _status = signal<UpdaterStatus>('idle');
  private readonly _progress = signal<number>(0);
  private readonly _errorMessage = signal<string | null>(null);

  readonly capability = this._capability.asReadonly();
  readonly status = this._status.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();

  constructor() {
    window.bitbutler.updater.onEvent((event: UpdaterEvent) => this.applyEvent(event));
    window.bitbutler.updater.getCapability().then((capability) => this._capability.set(capability));
  }

  public updateNow(): void {
    this.reset();
    this._status.set('checking');
    void window.bitbutler.updater.updateNow();
  }

  public reset(): void {
    this._status.set('idle');
    this._progress.set(0);
    this._errorMessage.set(null);
  }

  private applyEvent(event: UpdaterEvent): void {
    switch (event.status) {
      case 'checking':
        this._status.set('checking');
        break;
      case 'downloading':
        this._status.set('downloading');
        this._progress.set(event.percent);
        break;
      case 'downloaded':
        this._status.set('downloaded');
        break;
      case 'error':
        this._status.set('error');
        this._errorMessage.set(event.message);
        break;
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app -- updater.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/updater.service.ts packages/app/src/app/services/updater.service.spec.ts packages/app/src/test-setup.ts
git commit -m "#267: add UpdaterService wrapping the update-now preload API"
```

---

### Task 4: "Update Now" in the `UpdateAvailable` modal

**Files:**

- Modify: `packages/app/src/app/modals/update-available/update-available.ts` (full file, see below)
- Modify: `packages/app/src/app/modals/update-available/update-available.html:103-118` (footer)
- Modify: `packages/app/src/app/modals/update-available/update-available.scss` (append)
- Modify: `packages/app/src/app/modals/update-available/update-available.spec.ts` (add provider + new describe blocks)
- Modify: `public/i18n/us.json:799-809`, `public/i18n/hu.json:799-809`

**Interfaces:**

- Consumes: `UpdaterService` (Task 3) - `capability()`, `status()`, `progress()`, `errorMessage()`, `updateNow()`, `reset()`.

- [ ] **Step 1: Add the new translation keys (English)**

In `public/i18n/us.json`, replace the existing `update-available` block (lines 799-809) with:

```json
      "update-available": {
        "title": "Update Available",
        "subtitle": "You're on v{{ current_version }}, {{ count }} versions behind the latest (v{{ latest_version }}).",
        "download-for": "Download for {{ os_name }}",
        "available-downloads": "Available Downloads",
        "footnote": "Releases aren't code-signed, so downloads must be installed manually.",
        "view-all-releases": "View all releases",
        "smartscreen-warning": "Windows may show a SmartScreen warning during installation, since BitButler isn't code-signed yet. If the update doesn't finish automatically, download and run the installer manually below.",
        "button": {
          "skip-versions": "Skip these versions",
          "update-now": "Update Now"
        },
        "status": {
          "checking": "Checking for the update...",
          "downloading": "Downloading update... {{ percent }}%",
          "restarting": "Restarting to install..."
        },
        "toast": {
          "update-failed-title": "Update Failed"
        }
      },
```

- [ ] **Step 2: Add the new translation keys (Hungarian)**

In `public/i18n/hu.json`, replace the existing `update-available` block (lines 799-809) with:

```json
      "update-available": {
        "title": "Frissítés elérhető",
        "subtitle": "Jelenleg a v{{ current_version }} verziót használod, {{ count }} verzióval vagy lemaradva a legújabbtól (v{{ latest_version }}).",
        "download-for": "Letöltés {{ os_name }} rendszerre",
        "available-downloads": "Elérhető letöltések",
        "footnote": "A kiadások nincsenek kódaláírással ellátva, így a letöltéseket manuálisan kell telepíteni.",
        "view-all-releases": "Összes kiadás megtekintése",
        "smartscreen-warning": "Windows rendszeren SmartScreen figyelmeztetés jelenhet meg telepítés közben, mivel a BitButler még nincs kódaláírással ellátva. Ha a frissítés nem fejeződik be automatikusan, töltsd le és futtasd manuálisan a telepítőt alább.",
        "button": {
          "skip-versions": "Ezen verziók kihagyása",
          "update-now": "Frissítés most"
        },
        "status": {
          "checking": "Frissítés keresése...",
          "downloading": "Frissítés letöltése... {{ percent }}%",
          "restarting": "Újraindítás a telepítéshez..."
        },
        "toast": {
          "update-failed-title": "Frissítés sikertelen"
        }
      },
```

- [ ] **Step 3: Write the failing tests for the new modal behavior**

Add these `describe` blocks to `packages/app/src/app/modals/update-available/update-available.spec.ts`, and add the `UpdaterService`/`ToastService`/`TranslateService` providers to the existing `beforeEach`. Replace the current `beforeEach` body with:

```ts
let mockUpdaterService: {
  capability: ReturnType<typeof signal<UpdateCapability | null>>;
  status: ReturnType<typeof signal<'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'>>;
  progress: ReturnType<typeof signal<number>>;
  errorMessage: ReturnType<typeof signal<string | null>>;
  updateNow: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};
let toastDanger: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  activeModal = { close: vi.fn(), dismiss: vi.fn() };
  updateSettingsSave = vi.fn().mockResolvedValue(undefined);
  openExternalUrl = vi.fn();
  toastDanger = vi.fn();
  mockUpdaterService = {
    capability: signal<UpdateCapability | null>(null),
    status: signal<'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'>('idle'),
    progress: signal(0),
    errorMessage: signal<string | null>(null),
    updateNow: vi.fn(),
    reset: vi.fn(),
  };

  await TestBed.configureTestingModule({
    imports: [UpdateAvailable],
    providers: [
      { provide: NgbActiveModal, useValue: activeModal },
      {
        provide: ElectronService,
        useValue: {
          openExternalUrl,
          getPlatform: vi.fn().mockResolvedValue('win32'),
        },
      },
      { provide: UpdateSettingsService, useValue: { save: updateSettingsSave } },
      { provide: UpdaterService, useValue: mockUpdaterService },
      { provide: ToastService, useValue: { danger: toastDanger } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      provideMarkdown({
        markedOptions: {
          provide: MARKED_OPTIONS,
          useFactory: markedOptionsFactory,
        },
      }),
    ],
  }).compileComponents();

  fixture = TestBed.createComponent(UpdateAvailable);
  component = fixture.componentInstance;
  fixture.componentRef.setInput('update', {
    releases: [],
    updateAvailable: false,
  } as UpdateCheckResponse);
  fixture.detectChanges();
});
```

Add the corresponding imports at the top of the file:

```ts
import { signal } from '@angular/core';
import type {
  Release,
  ReleaseAsset,
  UpdateCapability,
  UpdateCheckResponse,
} from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../services/toast.service';
import { UpdaterService } from '../../services/updater.service';
```

Then append these new `describe` blocks at the end of the file, before the final closing `});`:

```ts
describe('showUpdateNow', () => {
  it('is false when capability has not loaded yet', () => {
    expect(component.showUpdateNow()).toBe(false);
  });

  it('is false when the platform reports unsupported', () => {
    mockUpdaterService.capability.set({ supported: false });
    expect(component.showUpdateNow()).toBe(false);
  });

  it('is true when the platform reports supported', () => {
    mockUpdaterService.capability.set({ supported: true });
    expect(component.showUpdateNow()).toBe(true);
  });
});

describe('showSmartScreenWarning', () => {
  it('is false when update-now is not shown', () => {
    mockUpdaterService.capability.set({ supported: false });
    expect(component.showSmartScreenWarning()).toBe(false);
  });

  it('is true when update-now is shown and platform is win32', async () => {
    mockUpdaterService.capability.set({ supported: true });
    component.platform.set('win32');
    expect(component.showSmartScreenWarning()).toBe(true);
  });

  it('is false when update-now is shown but platform is linux', () => {
    mockUpdaterService.capability.set({ supported: true });
    component.platform.set('linux');
    expect(component.showSmartScreenWarning()).toBe(false);
  });
});

describe('footerLocked', () => {
  it.each(['checking', 'downloading', 'downloaded'] as const)(
    'is true while status is %s',
    (status) => {
      mockUpdaterService.status.set(status);
      expect(component.footerLocked()).toBe(true);
    },
  );

  it.each(['idle', 'error'] as const)('is false while status is %s', (status) => {
    mockUpdaterService.status.set(status);
    expect(component.footerLocked()).toBe(false);
  });
});

describe('updateNow', () => {
  it('delegates to UpdaterService.updateNow()', () => {
    component.updateNow();
    expect(mockUpdaterService.updateNow).toHaveBeenCalled();
  });
});

describe('error toast', () => {
  it('shows a danger toast with the error message when status becomes error', () => {
    mockUpdaterService.status.set('error');
    mockUpdaterService.errorMessage.set('offline');
    fixture.detectChanges();
    expect(toastDanger).toHaveBeenCalledWith(
      'offline',
      'components.modals.update-available.toast.update-failed-title',
    );
  });

  it('does not show a toast while status is idle', () => {
    fixture.detectChanges();
    expect(toastDanger).not.toHaveBeenCalled();
  });
});

describe('construction', () => {
  it('resets the updater service state', () => {
    expect(mockUpdaterService.reset).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests to verify the new ones fail**

Run: `npm run test --workspace=packages/app -- update-available.spec.ts`
Expected: FAIL - `component.showUpdateNow is not a function` (and similar) since the component doesn't have these members yet.

- [ ] **Step 5: Implement the component changes**

Replace the full contents of `packages/app/src/app/modals/update-available/update-available.ts` with:

```ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { HostPlatform, Release, ReleaseAsset, UpdateCheckResponse } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCloudArrowDown,
  faDownload,
  faForward,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbCallout } from '../../components/bb-callout/bb-callout';
import { BbProgress } from '../../components/bb-progress/bb-progress';
import { normalizeVersionTag } from '../../models/update-settings.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ToastService } from '../../services/toast.service';
import { UpdateSettingsService } from '../../services/update-settings.service';
import { UpdaterService } from '../../services/updater.service';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    LocalTimestampPipe,
    TimeagoPipe,
    TranslatePipe,
    BbBtnContent,
    BbCallout,
    BbProgress,
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  public readonly icons = {
    faDownload,
    faForward,
    faXmark,
    faCloudArrowDown,
    faTriangleExclamation,
  };
  public readonly update = input.required<UpdateCheckResponse>();
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
  private readonly updateSettingsService = inject(UpdateSettingsService);
  public readonly updaterService = inject(UpdaterService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public activeReleaseId = signal<string | null>(null);
  public readonly platform = signal<HostPlatform | null>(null);

  private readonly platformExtensions: Partial<Record<HostPlatform, string[]>> = {
    win32: ['.exe', '.zip'],
    linux: ['.appimage', '.deb', '.rpm', '.snap', '.tar.gz'],
  };

  private readonly osLabels: Partial<Record<HostPlatform, string>> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
  };

  public readonly osLabel = computed<string | null>(() => {
    const platform = this.platform();
    return platform ? (this.osLabels[platform] ?? null) : null;
  });

  public readonly currentVersion = computed<string | null>(() => {
    const version = this.update().currentVersion;
    return version ? normalizeVersionTag(version) : null;
  });

  public readonly behindCount = computed(() => this.update().releases?.length ?? 0);

  public readonly filteredAssets = computed<ReleaseAsset[]>(() => {
    const assets = this.latestRelease?.assets ?? [];
    const platform = this.platform();
    const extensions = platform ? this.platformExtensions[platform] : undefined;
    if (!extensions) {
      return assets;
    }

    const matched = assets.filter((asset) =>
      extensions.some((ext) => asset.name.toLowerCase().endsWith(ext)),
    );
    return matched.length > 0 ? matched : assets;
  });

  public readonly showUpdateNow = computed(
    () => this.updaterService.capability()?.supported === true,
  );

  public readonly showSmartScreenWarning = computed(
    () => this.showUpdateNow() && this.platform() === 'win32',
  );

  public readonly isUpdating = computed(() => {
    const status = this.updaterService.status();
    return status === 'checking' || status === 'downloading';
  });

  public readonly footerLocked = computed(() => {
    const status = this.updaterService.status();
    return status === 'checking' || status === 'downloading' || status === 'downloaded';
  });

  public readonly progressLabel = computed(() => Math.round(this.updaterService.progress()));

  constructor() {
    this.updaterService.reset();

    effect(() => {
      const first = this.update().releases?.[0]?.id;
      if (first !== undefined && this.activeReleaseId() === null) {
        this.activeReleaseId.set(this.itemId(first));
      }
    });

    effect(() => {
      if (this.updaterService.status() !== 'error') {
        return;
      }
      const message = this.updaterService.errorMessage();
      if (!message) {
        return;
      }
      this.toastService.danger(
        message,
        this.translateService.instant(
          'components.modals.update-available.toast.update-failed-title',
        ),
      );
    });

    this.electronService.getPlatform().then((platform) => this.platform.set(platform));
  }

  get latestRelease(): Release | undefined {
    return this.update().releases?.[0];
  }

  public itemId(id: number): string {
    return `release-${id}`;
  }

  public cleanedBody(release: Release): string {
    const body = release.body || '';
    return body.replace(/^#+\s*What's\s*Changed\s*\r?\n/i, '').trim();
  }

  public getVersion(version: string): string {
    return normalizeVersionTag(version);
  }

  public toMs(dateStr: string | null | undefined): number {
    const ms = dateStr ? new Date(dateStr).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  }

  public downloadAsset(url: string): void {
    this.electronService.openExternalUrl(url);
  }

  public viewAllReleases(): void {
    this.electronService.openExternalUrl('https://github.com/enisz/bitbutler/releases');
  }

  public updateNow(): void {
    this.updaterService.updateNow();
  }

  public async skipVersions(): Promise<void> {
    const release = this.latestRelease;
    if (release) {
      await this.updateSettingsService.save({
        skippedVersion: normalizeVersionTag(release.tag_name),
      });
    }
    this.activeModal.close('skip');
  }
}
```

- [ ] **Step 6: Implement the template changes**

In `packages/app/src/app/modals/update-available/update-available.html`, replace the `modal-footer` block (currently lines 103-118) with:

```html
<div class="modal-footer">
  @if (showSmartScreenWarning()) {
  <bb-callout
    variant="warning"
    [icon]="icons.faTriangleExclamation"
    [message]="'components.modals.update-available.smartscreen-warning' | translate"
    class="bb-ua-smartscreen-warning"
  ></bb-callout>
  }

  <div class="bb-ua-footer-row">
    <div class="bb-ua-update-now">
      @if (showUpdateNow()) { @if (isUpdating()) {
      <div class="bb-ua-update-progress">
        <span class="bb-ua-update-progress__label">
          {{ (updaterService.status() === 'checking' ?
          'components.modals.update-available.status.checking' :
          'components.modals.update-available.status.downloading' ) | translate: { percent:
          progressLabel() } }}
        </span>
        <app-bb-progress
          mode="compact"
          [progress]="updaterService.progress()"
          variant="primary"
        ></app-bb-progress>
      </div>
      } @else if (updaterService.status() === 'downloaded') {
      <span class="bb-ua-update-progress__label">
        {{ 'components.modals.update-available.status.restarting' | translate }}
      </span>
      } @else {
      <button type="button" class="btn btn-sm btn-split btn-primary" (click)="updateNow()">
        <bb-btn-content
          [icon]="icons.faCloudArrowDown"
          [text]="'components.modals.update-available.button.update-now' | translate"
          position="end"
        ></bb-btn-content>
      </button>
      } }
    </div>

    <div class="bb-ua-footer-actions">
      <button
        type="button"
        class="btn btn-sm btn-split"
        [disabled]="footerLocked()"
        (click)="skipVersions()"
      >
        <bb-btn-content
          [icon]="icons.faForward"
          [text]="'components.modals.update-available.button.skip-versions' | translate"
          position="end"
        ></bb-btn-content>
      </button>
      <button
        type="button"
        class="btn btn-sm btn-split"
        [disabled]="footerLocked()"
        (click)="activeModal.close('close')"
        autofocus
      >
        <bb-btn-content
          [icon]="icons.faXmark"
          [text]="'general.button.close' | translate"
          position="end"
        ></bb-btn-content>
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 7: Add the supporting styles**

Append to `packages/app/src/app/modals/update-available/update-available.scss`:

```scss
.bb-ua-smartscreen-warning {
  display: block;
  width: 100%;
  margin-bottom: 0.75rem;
}

.bb-ua-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.75rem;
}

.bb-ua-footer-actions {
  display: flex;
  gap: 0.5rem;
}

.bb-ua-update-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;

  &__label {
    font-size: 0.75rem;
    color: var(--bb-control-placeholder);
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- update-available.spec.ts`
Expected: PASS (both the pre-existing tests and the new ones from Step 3).

- [ ] **Step 9: Lint and full app test suite**

Run: `npm run lint && npm run test --workspace=packages/app`
Expected: no lint errors, all app tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/modals/update-available/update-available.ts packages/app/src/app/modals/update-available/update-available.html packages/app/src/app/modals/update-available/update-available.scss packages/app/src/app/modals/update-available/update-available.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#267: add Update Now button, progress, and SmartScreen callout to the update modal"
```

---

### Task 5: `electron-updater` dependency and `electron-builder` publish config

**Files:**

- Modify: `package.json:62` (`build.publish`), `package.json` dependencies (new `electron-updater` entry)

**Interfaces:**

- Consumes: none.
- Produces: the `electron-updater` package available to `packages/electron/src/updater.ts` (Task 2 already imports it - this task is what makes that import resolve at install time); the `publish` config electron-updater's `checkForUpdates()` reads at runtime to locate `latest.yml`/`latest-linux.yml`.

- [ ] **Step 1: Install `electron-updater`**

Run: `npm install electron-updater`
Expected: `package.json`'s `dependencies` gains an `electron-updater` entry (npm resolves and pins the current published version), and the root lockfile updates.

- [ ] **Step 2: Set the GitHub publish config**

In `package.json`, change line 62 from:

```json
    "publish": null,
```

to:

```json
    "publish": {
      "provider": "github",
      "owner": "enisz",
      "repo": "bitbutler"
    },
```

- [ ] **Step 3: Verify the manifest is still valid and formatted**

Run: `npx prettier --check package.json`
Expected: PASS (no formatting diff). If it fails, run `npx prettier --write package.json` and re-check.

- [ ] **Step 4: Verify electron still builds with the new dependency present**

Run: `npm run build:electron`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "#267: add electron-updater dependency and GitHub publish config"
```

---

### Task 6: CI release workflow - generate and upload update feed files

**Files:**

- Modify: `.github/workflows/release.yml:171` (packaging step), `.github/workflows/release.yml:248-259` (asset upload step)

**Interfaces:**

- Consumes: the `publish` config from Task 5 (electron-builder only emits `latest.yml`/`latest-linux.yml` when a `publish` config is present).
- Produces: `latest.yml`, `latest-linux.yml`, and `*.exe.blockmap` present in the published GitHub Release, which is what `autoUpdater.checkForUpdates()` (Task 2) needs at runtime to find and download updates.

- [ ] **Step 1: Stop electron-builder from attempting to self-publish**

In `.github/workflows/release.yml`, change the "Package Electron app" step (currently line 171) from:

```yaml
- name: Package Electron app
  run: npx electron-builder ${{ matrix.target }}
```

to:

```yaml
- name: Package Electron app
  run: npx electron-builder ${{ matrix.target }} --publish never
```

- [ ] **Step 2: Upload the update feed files alongside the installers**

In `.github/workflows/release.yml`, change the "Upload release assets" step's `files:` list (currently lines 248-259) from:

```yaml
- name: Upload release assets
  uses: softprops/action-gh-release@v3
  with:
    tag_name: ${{ needs.bump-version.outputs.raw_version }}
    files: |
      dist-electron/*.exe
      dist-electron/*.zip
      dist-electron/*.deb
      dist-electron/*.AppImage
      dist-electron/*.rpm
      dist-electron/*.snap
      dist-electron/*.tar.gz
```

to:

```yaml
- name: Upload release assets
  uses: softprops/action-gh-release@v3
  with:
    tag_name: ${{ needs.bump-version.outputs.raw_version }}
    files: |
      dist-electron/*.exe
      dist-electron/*.exe.blockmap
      dist-electron/*.zip
      dist-electron/*.deb
      dist-electron/*.AppImage
      dist-electron/*.rpm
      dist-electron/*.snap
      dist-electron/*.tar.gz
      dist-electron/latest.yml
      dist-electron/latest-linux.yml
```

- [ ] **Step 3: Review the full diff for YAML correctness**

Run: `git diff .github/workflows/release.yml`
Expected: only the two changes above; indentation matches the surrounding YAML (2-space, list items aligned under `files: |`).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "#267: publish update feed files in the release workflow"
```

Note: this step cannot be exercised locally - it is only verified by the next real `workflow_dispatch` release run. Flag this to the user as the same kind of end-to-end verification the design spec's Testing section already calls out.

---

## Final verification

- [ ] Run the full test matrix once more from the repo root: `npm run lint && npm test`
- [ ] Manually smoke-test in dev mode: launch the app, open the update-available modal (e.g. via a temporarily-forced `UPDATE_CHECK_FOR_UPDATE` emit or by lowering the local version), and confirm the "Update Now" button does **not** appear (dev mode capability is always `false` per the Global Constraints) while the existing manual "Download" buttons still work.
