# Notification Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose which notifications they see, per channel (OS level, app level) and per event category, from a new Notifications group in the general settings.

**Architecture:** A new `notifications` block in `GeneralSettings` holds the switches. A pure `NotificationPolicyService` answers "may this category show on the OS / in the app right now?" (settings, window minimized state, 5 s OS dedupe). `ToastService.showHtml` is the single routing point: it derives a category from the toast type (or takes an explicit one), asks the policy, shows the toast if the app channel allows it and sends an OS notification if the OS channel allows it. The 126 existing toast call sites do not change.

**Tech Stack:** Angular 22 (zoneless, signals, reactive forms), Vitest via `ng test`, ngx-translate, Electron IPC (`window.bitbutler.notification`).

**Spec:** `docs/superpowers/specs/2026-10-03-notification-settings-design.md` (Task 2 corrects it where the code differs from its first draft: no separate dispatcher service, update-available toast on top of the modal).

## Global Constraints

- Issue #343, branch `343-notification-settings`. Commit format `#343: short description`. Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Use `-` (hyphen), never `—` (em dash), in all text, comments, i18n strings and commit messages.
- Defaults: `os.enabled`, `os.finished`, `os.errors`, `os.updates` = `true`; `os.onlyWhenMinimized` = `false`; all `app.*` switches = `true`; `app.position` = `'bottom-right'`.
- Categories: `finished`, `errors`, `updates`, `confirmations`. `confirmations` never reaches the OS channel. Toast type `danger`/`warning` -> `errors`; every other type -> `confirmations`.
- OS dedupe: identical title and body within `OS_DEDUPE_WINDOW_MS = 5000` shows once. Applies to the OS channel only.
- Migration: stored `behavior.toastPosition` moves to `notifications.app.position`; an already stored `notifications.app.position` wins.
- Toast copy rules (CLAUDE.md): title = short Title-Case outcome; message = the variable detail only.
- Angular 22 zoneless: use signals/`computed()`, no `BehaviorSubject` for new state.
- i18n: every new string goes in both `packages/app/public/i18n/us.json` and `hu.json`.
- `npm run lint` must pass with zero warnings; Prettier formatting runs on commit (Husky).
- Do not touch `packages/docs` (user guide is updated at PR time). Do not mention spec/plan paths in the PR or issue.
- Run npm commands from the repo root `C:\dev\bitbutler`.

## Review Focus

- Stored settings from before this feature (no `notifications`, `behavior.toastPosition: 'top-left'`) keep the position and get default switches; a partially stored `notifications` block is filled from defaults (Task 1 tests).
- A connection drop produces the same error toast repeatedly while minimized: exactly one OS notification per 5 s window, a different body still shows (Task 2 tests).
- Toast HTML or `<br>` in a message must reach the OS as plain text, not markup (Task 3 test).
- A toast suppressed by the app channel returns id `''`; callers later call `dismiss('')` (the in-progress toasts) and it must not throw (Task 3 test).
- Turning a master switch off disables its children but keeps their stored values, and the disabled state is restored when saved settings load (Task 5 tests).
- `WindowService` registers the window-state listener in its constructor; it must still be constructed at startup after `app.ts` stops injecting it (Task 4 step 6 check).

---

### Task 1: Settings model and migration

**Files:**

- Create: `packages/app/src/app/models/notification.model.ts`
- Modify: `packages/app/src/app/models/general-settings.model.ts:27-61`
- Modify: `packages/app/src/app/services/base-settings.service.ts:58-63`
- Modify: `packages/app/src/app/services/general-settings.service.ts`
- Modify: `packages/app/src/app/services/toast.service.ts:41,56,60`
- Modify: `packages/app/src/app/modals/settings/general/general.ts:293-302`
- Modify: `packages/app/src/app/modals/settings/general/general.html:485-508`
- Test: `packages/app/src/app/services/general-settings.service.spec.ts`

**Interfaces:**

- Consumes: `ToastType` from `models/toast.model.ts`, `ToastPosition` from `general-settings.model.ts`.
- Produces:
  - `type NotificationCategory = 'finished' | 'errors' | 'updates' | 'confirmations'`
  - `categoryForToastType(type: ToastType): NotificationCategory`
  - `interface NotificationSettings { os: { enabled; onlyWhenMinimized; finished; errors; updates: boolean }; app: { enabled: boolean; position: ToastPosition; finished; errors; updates; confirmations: boolean } }`
  - `GeneralSettings.notifications: NotificationSettings` (and `behavior.toastPosition` is removed)
  - `BaseSettingsService.migrate(stored: Partial<T>): Partial<T>` (protected, identity by default, runs before the defaults merge on load)

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `packages/app/src/app/services/general-settings.service.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_GENERAL_SETTINGS } from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';
import { SettingsService } from './settings.service';

describe('GeneralSettingsService', () => {
  let service: GeneralSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        GeneralSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(GeneralSettingsService);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_GENERAL_SETTINGS);
  });

  it('should default every OS notification to enabled and not minimized-only', async () => {
    const { os } = (await service.load()).notifications;
    expect(os).toEqual({
      enabled: true,
      onlyWhenMinimized: false,
      finished: true,
      errors: true,
      updates: true,
    });
  });

  it('should merge stored settings over defaults', async () => {
    mockSettingsService.get.mockResolvedValue({
      notifications: { app: { position: 'top-left' } },
      behavior: { deleteTorrentFile: false, automaticUpdate: false },
    });
    const settings = await service.load();
    expect(settings.notifications.app.position).toBe('top-left');
    expect(settings.language).toEqual(DEFAULT_GENERAL_SETTINGS.language);
  });

  it('should fill missing notification keys from defaults when a partial block is stored', async () => {
    mockSettingsService.get.mockResolvedValue({ notifications: { os: { enabled: false } } });
    const { notifications } = await service.load();
    expect(notifications.os.enabled).toBe(false);
    expect(notifications.os.finished).toBe(true);
    expect(notifications.app).toEqual(DEFAULT_GENERAL_SETTINGS.notifications.app);
  });

  it('should migrate the legacy behavior.toastPosition into notifications.app.position', async () => {
    mockSettingsService.get.mockResolvedValue({
      behavior: { deleteTorrentFile: false, toastPosition: 'top-left' },
    });
    const settings = await service.load();
    expect(settings.notifications.app.position).toBe('top-left');
    expect(settings.notifications.os).toEqual(DEFAULT_GENERAL_SETTINGS.notifications.os);
    expect(settings.behavior.deleteTorrentFile).toBe(false);
    expect('toastPosition' in settings.behavior).toBe(false);
  });

  it('should prefer an already stored notifications.app.position over the legacy value', async () => {
    mockSettingsService.get.mockResolvedValue({
      behavior: { toastPosition: 'top-left' },
      notifications: { app: { position: 'bottom-left' } },
    });
    const settings = await service.load();
    expect(settings.notifications.app.position).toBe('bottom-left');
  });

  it('should save and retrieve updated settings', async () => {
    await service.save({
      ...DEFAULT_GENERAL_SETTINGS,
      notifications: {
        ...DEFAULT_GENERAL_SETTINGS.notifications,
        app: { ...DEFAULT_GENERAL_SETTINGS.notifications.app, position: 'top-right' },
      },
    });
    expect(mockSettingsService.set).toHaveBeenCalled();
    const saved = mockSettingsService.set.mock.calls[0][1];
    expect(saved.notifications.app.position).toBe('top-right');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- --include=src/app/services/general-settings.service.spec.ts`
Expected: FAIL (type errors / `notifications` undefined). If this builder rejects `--include`, run the whole suite with `npm test --workspace=packages/app`.

- [ ] **Step 3: Create the category model**

Create `packages/app/src/app/models/notification.model.ts`:

```ts
import { ToastType } from './toast.model';

export type NotificationCategory = 'finished' | 'errors' | 'updates' | 'confirmations';

// Toasts raised by the generic helpers (success(), danger(), ...) fall into a category by
// their type; only the finished and update events pass an explicit category.
export function categoryForToastType(type: ToastType): NotificationCategory {
  return type === 'danger' || type === 'warning' ? 'errors' : 'confirmations';
}
```

- [ ] **Step 4: Update the general settings model**

In `packages/app/src/app/models/general-settings.model.ts`, add above `export interface GeneralSettings`:

```ts
export interface NotificationSettings {
  os: {
    enabled: boolean;
    onlyWhenMinimized: boolean;
    finished: boolean;
    errors: boolean;
    updates: boolean;
  };
  app: {
    enabled: boolean;
    position: ToastPosition;
    finished: boolean;
    errors: boolean;
    updates: boolean;
    confirmations: boolean;
  };
}
```

In `interface GeneralSettings`, remove the line `toastPosition: ToastPosition;` from `behavior` and add `notifications: NotificationSettings;` as a new member after `savePath`. In `DEFAULT_GENERAL_SETTINGS`, remove `toastPosition: 'bottom-right',` from `behavior` and add after `savePath`:

```ts
  notifications: {
    os: {
      enabled: true,
      onlyWhenMinimized: false,
      finished: true,
      errors: true,
      updates: true,
    },
    app: {
      enabled: true,
      position: 'bottom-right',
      finished: true,
      errors: true,
      updates: true,
      confirmations: true,
    },
  },
```

- [ ] **Step 5: Add the migration hook to the base service**

In `packages/app/src/app/services/base-settings.service.ts`, change the merge line in `load()`:

```ts
const rawSettings = deepMergeDefaults(this.DEFAULT_SETTINGS, this.migrate(stored ?? {}));
```

and add next to `normalize`:

```ts
  // Runs on the stored value before it is merged over the defaults, so a renamed or moved key
  // can still be read from its old location.
  protected migrate(stored: Partial<T>): Partial<T> {
    return stored;
  }
```

- [ ] **Step 6: Implement the migration in `GeneralSettingsService`**

Replace `packages/app/src/app/services/general-settings.service.ts` with:

```ts
import { Injectable } from '@angular/core';
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  ToastPosition,
} from '../models/general-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class GeneralSettingsService extends BaseSettingsService<GeneralSettings> {
  protected readonly SETTINGS_ID = 'GeneralSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_GENERAL_SETTINGS;

  // behavior.toastPosition moved to notifications.app.position.
  protected override migrate(stored: Partial<GeneralSettings>): Partial<GeneralSettings> {
    const { toastPosition, ...behavior } = (stored.behavior ?? {}) as Partial<
      GeneralSettings['behavior']
    > & { toastPosition?: ToastPosition };

    if (!toastPosition) {
      return stored;
    }

    return {
      ...stored,
      behavior,
      notifications: {
        ...stored.notifications,
        app: { position: toastPosition, ...stored.notifications?.app },
      },
    } as Partial<GeneralSettings>;
  }
}
```

If TypeScript rejects the final `as` cast, cast through `unknown` (`as unknown as Partial<GeneralSettings>`).

- [ ] **Step 7: Repoint the existing consumers so the app still compiles**

In `packages/app/src/app/services/toast.service.ts` replace the three reads:

- line 41: `this.updatePosition(settings.notifications.app.position);`
- line 56: `this.container.position.set(this.settings?.notifications.app.position ?? 'bottom-right');`
- line 60: `const toastPosition = position ?? this.settings?.notifications.app.position ?? 'bottom-right';`

In `packages/app/src/app/modals/settings/general/general.ts`, in `generalSettingsForm` remove the `toastPosition` control from `behavior` and add this group after `savePath`:

```ts
    notifications: new FormGroup({
      os: new FormGroup({
        enabled: new FormControl(true, { nonNullable: true }),
        onlyWhenMinimized: new FormControl(false, { nonNullable: true }),
        finished: new FormControl(true, { nonNullable: true }),
        errors: new FormControl(true, { nonNullable: true }),
        updates: new FormControl(true, { nonNullable: true }),
      }),
      app: new FormGroup({
        enabled: new FormControl(true, { nonNullable: true }),
        position: new FormControl<ToastPosition>('bottom-right', { nonNullable: true }),
        finished: new FormControl(true, { nonNullable: true }),
        errors: new FormControl(true, { nonNullable: true }),
        updates: new FormControl(true, { nonNullable: true }),
        confirmations: new FormControl(true, { nonNullable: true }),
      }),
    }),
```

In `general.html` (lines 485-508, the `formGroupName="behavior"` container holding the position select), change `<div class="container" formGroupName="behavior">` to `<div class="container" formGroupName="notifications">`, change its inner `<div class="row mt-2 mb-3">` to `<div class="row mt-2 mb-3" formGroupName="app">`, and change `formControlName="toastPosition"` to `formControlName="position"`. (Task 5 moves this control into the new fieldset.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app`
Expected: PASS (whole suite, including `general.spec.ts` and `toast.service.spec.ts`).

- [ ] **Step 9: Commit**

```bash
git add packages/app/src
git commit -m "$(cat <<'EOF'
#343: add notification settings model and toastPosition migration

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: NotificationPolicyService (and spec correction)

**Files:**

- Create: `packages/app/src/app/services/notification-policy.service.ts`
- Create: `packages/app/src/app/services/notification-policy.service.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-03-notification-settings-design.md`

**Interfaces:**

- Consumes: `GeneralSettingsService.asObservable(): Observable<GeneralSettings>`, `WindowService.state()` (`isMinimized`), `NotificationCategory`, `NotificationSettings`, `DEFAULT_GENERAL_SETTINGS`.
- Produces:
  - `export const OS_DEDUPE_WINDOW_MS = 5000`
  - `NotificationPolicyService.allowApp(category: NotificationCategory): boolean`
  - `NotificationPolicyService.allowOs(category: NotificationCategory, title: string, body: string): boolean` (records the title+body for dedupe only when it returns `true`)

- [ ] **Step 1: Correct the spec**

In `docs/superpowers/specs/2026-10-03-notification-settings-design.md` replace the sections `## Dispatcher`, `## ToastService integration` and `## app.ts` with:

```markdown
## Policy service

`NotificationPolicyService` is a root service in the renderer. It holds the current notification settings (from `GeneralSettingsService`, defaults until loaded) and reads the window state from `WindowService`. It has no dependency on `ToastService`, which avoids a circular dependency.

- `allowApp(category)`: `app.enabled` and the category switch.
- `allowOs(category, title, body)`: false for `confirmations`; otherwise `os.enabled`, the category switch, and either `onlyWhenMinimized` is false or the window is minimized; finally the dedupe check.
- **Dedupe.** An identical OS notification (same title and body) within 5 s (`OS_DEDUPE_WINDOW_MS`) is shown once. Only a call that would otherwise be allowed is recorded. Dedupe applies to the OS channel only.
- The channels are independent: with both on and a visible window, the user gets an OS notification and a toast.

## ToastService routing

`ToastService.showHtml` is the single routing point; the 126 existing call sites do not change.

- The category is `opts.category`, else derived from the toast type: `danger`, `warning` -> `errors`; all other types -> `confirmations`.
- If `allowOs(category, title, plainText)` is true it sends an OS notification through `NotificationService.send` (the message HTML is reduced to plain text, `<br>` becoming a newline).
- If `allowApp(category)` is false the toast is not shown and `showHtml` returns `''`.
- The toast position is read from `notifications.app.position`.

Explicit categories: the torrent-finished event (`finished`) and a new info toast "Update Available" shown on top of the update modal whenever an update is found (`updates`).

## app.ts

The `finished$` handler becomes a single `toastService.showText(name, { title, type: 'success', category: 'finished' })` call. The `isMinimized` branching moves into the policy service.
```

In `## Testing` replace the first and last bullets with:

```markdown
- Policy service unit tests: the matrix of channel, category, master switch, `onlyWhenMinimized` and minimized state; `confirmations` never reaching the OS; dedupe within and after the window.
- `ToastService` tests: category derivation and override, gating, OS send with plain text, `dismiss('')` safety.
- `app.ts` test: the finished handler passes the `finished` category.
- Update handler test: the info toast is shown with the `updates` category when an update is found, and not for a skipped version.
```

(Keep the settings and general-settings-component bullets as they are.)

- [ ] **Step 2: Write the failing tests**

Create `packages/app/src/app/services/notification-policy.service.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  NotificationSettings,
} from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';
import { NotificationPolicyService, OS_DEDUPE_WINDOW_MS } from './notification-policy.service';
import { WindowService } from './window.service';

type NotificationOverrides = {
  os?: Partial<NotificationSettings['os']>;
  app?: Partial<NotificationSettings['app']>;
};

function settingsWith(overrides: NotificationOverrides): GeneralSettings {
  const { os, app } = DEFAULT_GENERAL_SETTINGS.notifications;
  return {
    ...DEFAULT_GENERAL_SETTINGS,
    notifications: { os: { ...os, ...overrides.os }, app: { ...app, ...overrides.app } },
  };
}

describe('NotificationPolicyService', () => {
  let service: NotificationPolicyService;
  let settings$: Subject<GeneralSettings>;
  let windowState: ReturnType<typeof signal<{ isMinimized: boolean }>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));

    settings$ = new Subject<GeneralSettings>();
    windowState = signal({ isMinimized: false });

    TestBed.configureTestingModule({
      providers: [
        NotificationPolicyService,
        { provide: GeneralSettingsService, useValue: { asObservable: () => settings$ } },
        { provide: WindowService, useValue: { state: windowState } },
      ],
    });

    service = TestBed.inject(NotificationPolicyService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('defaults (before settings load)', () => {
    it('allows every category in the app', () => {
      for (const category of ['finished', 'errors', 'updates', 'confirmations'] as const) {
        expect(service.allowApp(category)).toBe(true);
      }
    });

    it('allows finished, errors and updates on the OS while the window is visible', () => {
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
      expect(service.allowOs('errors', 'T', 'b')).toBe(true);
      expect(service.allowOs('updates', 'T', 'c')).toBe(true);
    });
  });

  it('never allows confirmations on the OS, even when everything is enabled', () => {
    expect(service.allowOs('confirmations', 'T', 'a')).toBe(false);
  });

  describe('app channel', () => {
    it('blocks every category when the app master switch is off', () => {
      settings$.next(settingsWith({ app: { enabled: false } }));
      expect(service.allowApp('finished')).toBe(false);
      expect(service.allowApp('confirmations')).toBe(false);
    });

    it('blocks only the category whose switch is off', () => {
      settings$.next(settingsWith({ app: { confirmations: false } }));
      expect(service.allowApp('confirmations')).toBe(false);
      expect(service.allowApp('errors')).toBe(true);
    });
  });

  describe('OS channel', () => {
    it('blocks every category when the OS master switch is off', () => {
      settings$.next(settingsWith({ os: { enabled: false } }));
      expect(service.allowOs('finished', 'T', 'a')).toBe(false);
    });

    it('blocks only the category whose switch is off', () => {
      settings$.next(settingsWith({ os: { errors: false } }));
      expect(service.allowOs('errors', 'T', 'a')).toBe(false);
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
    });

    it('with onlyWhenMinimized, blocks while the window is visible and allows while minimized', () => {
      settings$.next(settingsWith({ os: { onlyWhenMinimized: true } }));
      expect(service.allowOs('finished', 'T', 'a')).toBe(false);

      windowState.set({ isMinimized: true });
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
    });

    it('does not use the app channel switches', () => {
      settings$.next(settingsWith({ app: { enabled: false } }));
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
    });
  });

  describe('OS dedupe', () => {
    it('shows an identical notification once within the window', () => {
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(false);
    });

    it('shows the same notification again after the window has passed', () => {
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
      vi.advanceTimersByTime(OS_DEDUPE_WINDOW_MS);
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
    });

    it('treats a different body as a different notification', () => {
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
      expect(service.allowOs('errors', 'Failed', 'refused')).toBe(true);
    });

    it('does not record a notification that was blocked by the settings', () => {
      settings$.next(settingsWith({ os: { errors: false } }));
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(false);

      settings$.next(settingsWith({ os: { errors: true } }));
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
    });

    it('does not dedupe the app channel', () => {
      expect(service.allowApp('errors')).toBe(true);
      expect(service.allowApp('errors')).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- --include=src/app/services/notification-policy.service.spec.ts`
Expected: FAIL ("Cannot find module './notification-policy.service'").

- [ ] **Step 4: Implement the service**

Create `packages/app/src/app/services/notification-policy.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DEFAULT_GENERAL_SETTINGS, NotificationSettings } from '../models/general-settings.model';
import { NotificationCategory } from '../models/notification.model';
import { GeneralSettingsService } from './general-settings.service';
import { WindowService } from './window.service';

export const OS_DEDUPE_WINDOW_MS = 5000;

@Injectable({ providedIn: 'root' })
export class NotificationPolicyService {
  private readonly windowService = inject(WindowService);

  private settings: NotificationSettings = DEFAULT_GENERAL_SETTINGS.notifications;
  private readonly lastOsShownAt = new Map<string, number>();

  constructor() {
    inject(GeneralSettingsService)
      .asObservable()
      .pipe(takeUntilDestroyed())
      .subscribe((settings) => {
        this.settings = settings.notifications;
      });
  }

  public allowApp(category: NotificationCategory): boolean {
    const { app } = this.settings;
    return app.enabled && app[category];
  }

  public allowOs(category: NotificationCategory, title: string, body: string): boolean {
    if (category === 'confirmations') return false;

    const { os } = this.settings;
    if (!os.enabled || !os[category]) return false;
    if (os.onlyWhenMinimized && !this.windowService.state().isMinimized) return false;

    return this.registerOsShown(title, body);
  }

  private registerOsShown(title: string, body: string): boolean {
    const now = Date.now();

    for (const [key, shownAt] of this.lastOsShownAt) {
      if (now - shownAt >= OS_DEDUPE_WINDOW_MS) this.lastOsShownAt.delete(key);
    }

    const key = `${title}\u0000${body}`;
    if (this.lastOsShownAt.has(key)) return false;

    this.lastOsShownAt.set(key, now);
    return true;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app -- --include=src/app/services/notification-policy.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src docs/superpowers/specs
git commit -m "$(cat <<'EOF'
#343: add notification policy service

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Route toasts through the policy

**Files:**

- Modify: `packages/app/src/app/services/toast.service.ts`
- Modify: `packages/app/src/app/services/toast.service.spec.ts`

**Interfaces:**

- Consumes: `NotificationPolicyService.allowApp/allowOs`, `NotificationService.send(title, body, options?)`, `NotificationCategory`, `categoryForToastType`.
- Produces: `ToastService.showHtml(html, opts: { title?; type?; duration?; category?: NotificationCategory }): string` and `ToastService.showText(message, opts: { title?; type?; duration?; category?: NotificationCategory }): string`; both return `''` when the app channel blocks the toast.

- [ ] **Step 1: Update the spec setup and write the failing tests**

In `packages/app/src/app/services/toast.service.spec.ts` replace lines 1-71 (imports through the `beforeEach`) with:

```ts
import { Overlay } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { GeneralSettingsService } from './general-settings.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationService } from './notification.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

describe('ToastService - showText()', () => {
  let service: ToastService;
  let mockOverlay: any;
  let mockContainer: any;
  let settings$: Subject<any>;
  let mockGeneralSettings: any;
  let mockThemeService: any;
  let mockSanitizer: any;
  let mockTranslate: { instant: ReturnType<typeof vi.fn> };
  let mockPolicy: { allowApp: ReturnType<typeof vi.fn>; allowOs: ReturnType<typeof vi.fn> };
  let mockNotificationService: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockContainer = {
      add: vi.fn(),
      toasts: () => [],
      beginDismiss: vi.fn(),
      remove: vi.fn(),
      position: { set: vi.fn() },
    };

    mockOverlay = {
      create: vi.fn().mockReturnValue({
        attach: vi.fn().mockReturnValue({ instance: mockContainer }),
        dispose: vi.fn(),
        updatePositionStrategy: vi.fn(),
      }),
      position: vi.fn().mockReturnValue({
        global: vi.fn().mockReturnValue({
          bottom: vi.fn().mockReturnThis(),
          right: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          left: vi.fn().mockReturnThis(),
        }),
      }),
      scrollStrategies: { noop: vi.fn().mockReturnValue({}) },
    };

    settings$ = new Subject();
    mockGeneralSettings = {
      asObservable: vi.fn().mockReturnValue(settings$),
    };

    mockThemeService = {
      mode: vi.fn().mockReturnValue('dark'),
      getSystemMode: vi.fn().mockReturnValue('dark'),
    };

    mockSanitizer = {
      sanitize: vi.fn().mockImplementation((_ctx: any, html: string) => html),
    };

    mockTranslate = { instant: vi.fn((key: string) => key) };

    mockPolicy = {
      allowApp: vi.fn().mockReturnValue(true),
      allowOs: vi.fn().mockReturnValue(false),
    };

    mockNotificationService = { send: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: Overlay, useValue: mockOverlay },
        { provide: DomSanitizer, useValue: mockSanitizer },
        { provide: GeneralSettingsService, useValue: mockGeneralSettings },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: NotificationPolicyService, useValue: mockPolicy },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    });

    service = TestBed.inject(ToastService);
  });
```

Then append, before the final closing `});` of the file, this block:

```ts
describe('notification routing', () => {
  it('derives the errors category for danger toasts', () => {
    service.danger('boom', 'Failed');
    expect(mockPolicy.allowApp).toHaveBeenCalledWith('errors');
    expect(mockPolicy.allowOs).toHaveBeenCalledWith('errors', 'Failed', 'boom');
  });

  it('derives the errors category for warning toasts', () => {
    service.warning('careful', 'Heads Up');
    expect(mockPolicy.allowApp).toHaveBeenCalledWith('errors');
  });

  it('derives the confirmations category for success and info toasts', () => {
    service.success('done', 'Saved');
    service.info('fyi', 'Note');
    expect(mockPolicy.allowApp).toHaveBeenNthCalledWith(1, 'confirmations');
    expect(mockPolicy.allowApp).toHaveBeenNthCalledWith(2, 'confirmations');
  });

  it('uses an explicit category instead of the derived one', () => {
    service.showText('Movie', {
      type: 'success',
      title: 'Download Finished',
      category: 'finished',
    });
    expect(mockPolicy.allowApp).toHaveBeenCalledWith('finished');
    expect(mockPolicy.allowOs).toHaveBeenCalledWith('finished', 'Download Finished', 'Movie');
  });

  it('shows the toast when the app channel allows it', () => {
    service.showText('hello');
    expect(mockContainer.add).toHaveBeenCalledTimes(1);
  });

  it('does not show the toast and returns an empty id when the app channel blocks it', () => {
    mockPolicy.allowApp.mockReturnValue(false);
    const id = service.showText('hello');
    expect(id).toBe('');
    expect(mockContainer.add).not.toHaveBeenCalled();
  });

  it('still sends the OS notification when the app channel blocks the toast', () => {
    mockPolicy.allowApp.mockReturnValue(false);
    mockPolicy.allowOs.mockReturnValue(true);
    service.danger('boom', 'Failed');
    expect(mockNotificationService.send).toHaveBeenCalledWith('Failed', 'boom');
  });

  it('does not send an OS notification when the OS channel blocks it', () => {
    service.danger('boom', 'Failed');
    expect(mockNotificationService.send).not.toHaveBeenCalled();
  });

  it('sends the message to the OS as plain text, not markup', () => {
    mockPolicy.allowOs.mockReturnValue(true);
    service.showHtml('<b>Done</b><br>now &amp; later', { title: 'T', type: 'danger' });
    expect(mockNotificationService.send).toHaveBeenCalledWith('T', 'Done\nnow & later');
  });

  it('dismissing the empty id of a blocked toast does not throw', () => {
    mockPolicy.allowApp.mockReturnValue(false);
    const id = service.showText('hello');
    expect(() => service.dismiss(id)).not.toThrow();
  });

  it('positions the toast container from notifications.app.position', () => {
    settings$.next({ notifications: { app: { position: 'top-left' } } });
    service.showText('hello');
    expect(mockContainer.position.set).toHaveBeenCalledWith('top-left');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- --include=src/app/services/toast.service.spec.ts`
Expected: FAIL (`category` option unknown, policy never called).

- [ ] **Step 3: Implement the routing**

In `packages/app/src/app/services/toast.service.ts`:

Add imports:

```ts
import { NotificationCategory, categoryForToastType } from '../models/notification.model';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationService } from './notification.service';
```

Add fields after `destroyRef`:

```ts
  private readonly notificationPolicy = inject(NotificationPolicyService);
  private readonly notificationService = inject(NotificationService);
```

Replace `showHtml` and `showText` with:

```ts
  showHtml(
    html: string,
    opts: {
      title?: string;
      type?: ToastType;
      duration?: number;
      category?: NotificationCategory;
    } = {},
  ): string {
    const type = opts.type ?? 'info';
    const title = opts.title ?? this.translateService.instant('general.toast.notification');
    const category = opts.category ?? categoryForToastType(type);
    const safeHtml = this.sanitizeHtml(html);

    const plainText = this.htmlToText(safeHtml);
    if (this.notificationPolicy.allowOs(category, title, plainText)) {
      void this.notificationService.send(title, plainText);
    }

    if (!this.notificationPolicy.allowApp(category)) {
      return '';
    }

    this.ensureContainer();

    const toast: Toast = {
      id: crypto.randomUUID(),
      title,
      html: safeHtml,
      type,
      duration: opts.duration ?? 6000,
    };

    this.container!.add(toast);

    if (toast.duration > 0) {
      this.startTimer(toast.id, toast.duration);
    }
    return toast.id;
  }

  showText(
    message: string,
    opts: {
      title?: string;
      type?: ToastType;
      duration?: number;
      category?: NotificationCategory;
    } = {},
  ): string {
    const html = message
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\n', '<br>');
    return this.showHtml(html, opts);
  }

  private htmlToText(html: string): string {
    const withBreaks = html.replace(/<br\s*\/?>/gi, '\n');
    return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? '';
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app`
Expected: PASS (whole suite; other specs that use the real `ToastService` fall back to the root-provided policy and defaults).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src
git commit -m "$(cat <<'EOF'
#343: route toasts through the notification policy

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the finished and update events

**Files:**

- Modify: `packages/app/src/app/app.ts:17,41,58,133-143`
- Modify: `packages/app/src/app/app.spec.ts`
- Modify: `packages/app/src/app/services/update-command-handler.service.ts:50-57`
- Modify: `packages/app/src/app/services/update-command-handler.service.spec.ts`
- Modify: `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json` (`services.update-command-handler`)

**Interfaces:**

- Consumes: `ToastService.showText(message, { title, type, category })` from Task 3.
- Produces: i18n key `services.update-command-handler.info.update-available-title`.

- [ ] **Step 1: Write the failing update-handler tests**

In `update-command-handler.service.spec.ts` add a `toastShowText` mock next to `toastDanger`:

```ts
let toastShowText: ReturnType<typeof vi.fn>;
```

in `beforeEach` add `toastShowText = vi.fn();` and change the `ToastService` provider to:

```ts
        {
          provide: ToastService,
          useValue: { success: toastSuccess, danger: toastDanger, showText: toastShowText },
        },
```

Add these tests after `should emit UI_UPDATE_AVAILABLE when update is found`:

```ts
it('should show an info toast with the updates category on top of the modal when an update is found', async () => {
  checkForUpdate.mockResolvedValueOnce({
    updateAvailable: true,
    error: null,
    releases: [{ tag_name: 'v2.0.0' }],
  });
  commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
  await flushPromises();
  expect(toastShowText).toHaveBeenCalledWith('v2.0.0', {
    title: 'services.update-command-handler.info.update-available-title',
    type: 'info',
    category: 'updates',
  });
});

it('should show the update toast for a manual check as well', async () => {
  checkForUpdate.mockResolvedValueOnce({
    updateAvailable: true,
    error: null,
    releases: [{ tag_name: 'v2.0.0' }],
  });
  commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'manual' });
  await flushPromises();
  expect(toastShowText).toHaveBeenCalledTimes(1);
});

it('should not show the update toast when no update is available', async () => {
  commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
  await flushPromises();
  expect(toastShowText).not.toHaveBeenCalled();
});

it('should not show the update toast when the latest release was skipped on an automatic check', async () => {
  updateSettingsLoad.mockResolvedValue({ skippedVersion: '2.0.0' });
  checkForUpdate.mockResolvedValueOnce({
    updateAvailable: true,
    error: null,
    releases: [{ tag_name: 'v2.0.0' }],
  });
  commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
  await flushPromises();
  expect(toastShowText).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write the failing app test**

In `app.spec.ts` add imports `import { Subject } from 'rxjs';`, `import { ToastService } from './services/toast.service';` and `import { TorrentFinishedEvent } from './models/torrent.model';` (use the module that exports `TorrentFinishedEvent` in `app.ts`'s imports if it differs). Add inside `describe('App', ...)`:

```ts
it('should show the finished toast with the finished category', () => {
  const finished$ = new Subject<TorrentFinishedEvent>();
  const torrentStore = TestBed.inject(TorrentStoreService);
  Object.defineProperty(torrentStore, 'finished$', { value: finished$.asObservable() });
  const showText = vi.spyOn(TestBed.inject(ToastService), 'showText').mockReturnValue('');

  TestBed.createComponent(App);
  finished$.next({
    hash: 'abc',
    torrent: { name: 'Movie' },
    ts: Date.now(),
  } as TorrentFinishedEvent);

  expect(showText).toHaveBeenCalledWith('Movie', {
    title: 'app.success.finished-downloading',
    type: 'success',
    category: 'finished',
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- --include=src/app/app.spec.ts --include=src/app/services/update-command-handler.service.spec.ts`
Expected: FAIL (new tests only).

- [ ] **Step 4: Implement the update toast and i18n**

In `update-command-handler.service.ts` replace the `if (response.updateAvailable)` block's emit with:

```ts
this.commandBusService.emit({ type: 'UI_UPDATE_AVAILABLE', update: response });
this.toastService.showText(response.releases?.[0]?.tag_name ?? '', {
  title: this.translateService.instant(
    'services.update-command-handler.info.update-available-title',
  ),
  type: 'info',
  category: 'updates',
});
return;
```

In `us.json`, in `services.update-command-handler` add (before `"success"`):

```json
      "info": {
        "update-available-title": "Update Available"
      },
```

In `hu.json` the same with `"update-available-title": "Frissítés érhető el"`.

- [ ] **Step 5: Implement the finished handler**

In `app.ts` replace the `finished$` subscribe body (lines 135-142) with:

```ts
      .subscribe((event: TorrentFinishedEvent) => {
        this.toastService.showText(event.torrent.name, {
          title: this.translateService.instant('app.success.finished-downloading'),
          type: 'success',
          category: 'finished',
        });
      });
```

Remove `import { NotificationService } ...` (line 17) and `private readonly notificationService = inject(NotificationService);` (line 41), and the `windowService` field (line 58) and its `WindowService` import, since neither is used any more.

- [ ] **Step 6: Verify `WindowService` is still constructed at startup**

`NotificationPolicyService` injects `WindowService`, whose constructor registers the window-state listener. Run `grep -n "WindowService" packages/app/src/app/services/qb-polling.service.ts packages/app/src/app/app.ts` and confirm something that `app.ts` starts (the polling service) still injects it. If nothing does, add `inject(NotificationPolicyService)` to `app.ts` as an eager startup dependency, with a one-line comment saying why.

- [ ] **Step 7: Run the tests and lint**

Run: `npm test --workspace=packages/app` then `npm run lint`
Expected: PASS, zero lint warnings (unused imports would show here).

- [ ] **Step 8: Commit**

```bash
git add packages/app
git commit -m "$(cat <<'EOF'
#343: send finished and update events through the notification policy

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Notifications settings UI

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts`
- Modify: `packages/app/src/app/modals/settings/general/general.html`
- Modify: `packages/app/src/app/modals/settings/general/general.scss`
- Modify: `packages/app/src/app/modals/settings/general/general.spec.ts`
- Modify: `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: the `notifications` form group added in Task 1 (`os.{enabled,onlyWhenMinimized,finished,errors,updates}`, `app.{enabled,position,finished,errors,updates,confirmations}`).
- Produces: the Notifications fieldset; children of a master switch are disabled (values kept) while the master is off.

- [ ] **Step 1: Write the failing component tests**

In `general.spec.ts` add, inside `describe('General', ...)` after the `behavior form controls` block:

```ts
describe('notification form controls', () => {
  const os = () => component.generalSettingsForm.controls.notifications.controls.os;
  const app = () => component.generalSettingsForm.controls.notifications.controls.app;

  it('enables every OS and app control by default', () => {
    expect(Object.values(os().controls).every((c) => c.enabled)).toBe(true);
    expect(Object.values(app().controls).every((c) => c.enabled)).toBe(true);
  });

  it('disables the OS children but keeps their values when the OS master switch is turned off', () => {
    os().controls.enabled.setValue(false);

    expect(os().controls.onlyWhenMinimized.disabled).toBe(true);
    expect(os().controls.finished.disabled).toBe(true);
    expect(os().controls.errors.disabled).toBe(true);
    expect(os().controls.updates.disabled).toBe(true);
    expect(os().controls.enabled.enabled).toBe(true);
    expect(os().getRawValue().finished).toBe(true);
  });

  it('re-enables the OS children when the OS master switch is turned back on', () => {
    os().controls.enabled.setValue(false);
    os().controls.enabled.setValue(true);

    expect(os().controls.errors.enabled).toBe(true);
  });

  it('disables the app children, including the position, but keeps their values when the app master switch is turned off', () => {
    app().controls.position.setValue('top-left');
    app().controls.enabled.setValue(false);

    expect(app().controls.position.disabled).toBe(true);
    expect(app().controls.confirmations.disabled).toBe(true);
    expect(app().getRawValue().position).toBe('top-left');
    expect(app().getRawValue().confirmations).toBe(true);
  });

  it('does not let the OS master switch affect the app controls', () => {
    os().controls.enabled.setValue(false);
    expect(app().controls.finished.enabled).toBe(true);
  });
});
```

Add a new top-level describe at the end of the file for the load path:

```ts
describe('General - stored notification settings', () => {
  it('restores the disabled state of children when the stored master switch is off', async () => {
    const stored = {
      ...DEFAULT_GENERAL_SETTINGS,
      notifications: {
        os: { ...DEFAULT_GENERAL_SETTINGS.notifications.os, enabled: false },
        app: { ...DEFAULT_GENERAL_SETTINGS.notifications.app, enabled: false },
      },
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: SettingsStateService, useValue: { registerSave: vi.fn(), markDirty: vi.fn() } },
        { provide: ServerStoreService, useValue: { servers: signal([]) } },
        { provide: DateFormatService, useValue: { applyFromSettings: vi.fn() } },
        { provide: GeneralSettingsService, useValue: { load: () => Promise.resolve(stored) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(General);
    fixture.detectChanges();
    await fixture.whenStable();

    const { os, app } =
      fixture.componentInstance.generalSettingsForm.controls.notifications.controls;
    expect(os.controls.finished.disabled).toBe(true);
    expect(os.controls.onlyWhenMinimized.disabled).toBe(true);
    expect(app.controls.position.disabled).toBe(true);
    expect(os.controls.enabled.enabled).toBe(true);
    expect(app.controls.enabled.enabled).toBe(true);
  });
});
```

with these added imports at the top of the file:

```ts
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { GeneralSettingsService } from '../../../services/general-settings.service';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- --include=src/app/modals/settings/general/general.spec.ts`
Expected: FAIL (children are never disabled).

- [ ] **Step 3: Implement the master-switch behavior in `general.ts`**

Add `AbstractControl` to the `@angular/forms` import. Add this method to the class (next to `resetCustomPattern`):

```ts
  // A master switch disables its children without resetting them, so turning it back on
  // restores the choices the user had made.
  private applyMasterSwitch(group: FormGroup): void {
    const enabled = group.controls['enabled'].value;
    for (const [name, control] of Object.entries(group.controls) as [string, AbstractControl][]) {
      if (name === 'enabled') continue;
      if (enabled) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
  }
```

In the constructor, after the `behaviorGroup` subscription, add:

```ts
const { os, app } = this.generalSettingsForm.controls.notifications.controls;

for (const group of [os, app]) {
  group.controls.enabled.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => this.applyMasterSwitch(group));
}
```

In the `settingsLoaded` `tap`, after the `deleteTorrentFile` block, add:

```ts
const notificationGroups = this.generalSettingsForm.controls.notifications.controls;
this.applyMasterSwitch(notificationGroups.os);
this.applyMasterSwitch(notificationGroups.app);
```

- [ ] **Step 4: Replace the Appearance position control with the Notifications fieldset in `general.html`**

Delete the whole `<div class="container" formGroupName="notifications">` block that Task 1 left at the end of the Appearance fieldset (the position select). Then, after the Appearance `</fieldset>`, add:

```html
<fieldset class="bb-fieldset">
  <legend>{{ 'pages.settings.tab.general.label.notifications' | translate }}</legend>

  <div formGroupName="notifications">
    <div class="bb-options bb-options--grid bb-notification-section" formGroupName="os">
      <div class="bb-option bb-option--wide bb-option--master">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-os-enabled">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.os.enabled' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.os.enabled.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-os-enabled"
            formControlName="enabled"
          />
        </span>
      </div>
      <div class="bb-option bb-option--wide">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-os-only-when-minimized">
            {{
            'pages.settings.tab.general.general-settings-form.notifications.os.only-when-minimized'
            | translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.os.only-when-minimized.sub' |
            translate }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-os-only-when-minimized"
            formControlName="onlyWhenMinimized"
          />
        </span>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-os-finished">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.category.finished' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.finished.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-os-finished"
            formControlName="finished"
          />
        </span>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-os-errors">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.category.errors' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.errors.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-os-errors"
            formControlName="errors"
          />
        </span>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-os-updates">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.category.updates' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.updates.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-os-updates"
            formControlName="updates"
          />
        </span>
      </div>
    </div>

    <div
      class="bb-options bb-options--grid bb-notification-section bb-notification-section--app"
      formGroupName="app"
    >
      <div class="bb-option bb-option--wide bb-option--master">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-app-enabled">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.app.enabled' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.app.enabled.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-app-enabled"
            formControlName="enabled"
          />
        </span>
      </div>
      <div class="bb-option bb-option--wide">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-app-position">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.app.position' |
            translate }}
          </label>
        </div>
        <div class="bb-option__select">
          <ng-select
            labelForId="notifications-app-position"
            [items]="toastPositions()"
            [clearable]="false"
            [openOnEnter]="false"
            [clearSearchOnAdd]="true"
            [searchable]="false"
            bindLabel="label"
            bindValue="value"
            formControlName="position"
          >
          </ng-select>
        </div>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-app-finished">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.category.finished' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.finished.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-app-finished"
            formControlName="finished"
          />
        </span>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-app-errors">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.category.errors' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.errors.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-app-errors"
            formControlName="errors"
          />
        </span>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-app-updates">
            {{ 'pages.settings.tab.general.general-settings-form.notifications.category.updates' |
            translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.updates.sub' | translate
            }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-app-updates"
            formControlName="updates"
          />
        </span>
      </div>
      <div class="bb-option">
        <div class="bb-option__text">
          <label class="bb-option__label" for="notifications-app-confirmations">
            {{
            'pages.settings.tab.general.general-settings-form.notifications.category.confirmations'
            | translate }}
          </label>
          <span class="bb-option__sub"
            >{{ 'pages.settings.tab.general.popover.notifications.category.confirmations.sub' |
            translate }}</span
          >
        </div>
        <span class="bb-option__toggle form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="notifications-app-confirmations"
            formControlName="confirmations"
          />
        </span>
      </div>
    </div>
  </div>
</fieldset>
```

- [ ] **Step 5: Add the styles**

Append to `packages/app/src/app/modals/settings/general/general.scss`:

```scss
// Notification sections: the master switch reads as the section header, the two sections are
// separated, and the last row of the app grid (two category rows) drops its divider.
.bb-option--master .bb-option__label {
  font-weight: 600;
}

.bb-notification-section + .bb-notification-section {
  margin-top: 1rem;
}

.bb-notification-section--app .bb-option:nth-last-child(-n + 2) {
  border-bottom: none;
}

.bb-option__select {
  flex-shrink: 0;
  width: 16rem;
}
```

- [ ] **Step 6: Add the translations**

In `us.json`, under `pages.settings.tab.general`:

1. In `general-settings-form.behavior`, remove `"notification-position"` (fix the trailing comma on `"automatic-update"`) and add a sibling block after `behavior`:

```json
            "notifications": {
              "os": {
                "enabled": "Enable OS level notifications",
                "only-when-minimized": "Show only when the app is minimized"
              },
              "app": {
                "enabled": "Enable app level notifications",
                "position": "In-application notification position"
              },
              "category": {
                "finished": "Torrent finished",
                "errors": "Errors",
                "updates": "Update available",
                "confirmations": "Action confirmations"
              }
            },
```

2. In `label` add `"notifications": "Notifications"`.
3. In `popover` add:

```json
            "notifications": {
              "os": {
                "enabled": {
                  "sub": "Shows system notifications, even while BitButler is in the background"
                },
                "only-when-minimized": {
                  "sub": "Skips system notifications while the BitButler window is visible"
                }
              },
              "app": {
                "enabled": {
                  "sub": "Shows pop-up messages inside the BitButler window"
                }
              },
              "category": {
                "finished": { "sub": "Shown when a torrent finishes downloading" },
                "errors": { "sub": "Failed actions and connection problems" },
                "updates": { "sub": "Shown when a new version is available" },
                "confirmations": {
                  "sub": "Short messages confirming an action, such as a tag being added"
                }
              }
            },
```

Make the same edits in `hu.json` with these strings (keep the existing Hungarian `notification-position` text `"Alkalmazáson belüli értesítések helye"` as `notifications.app.position`):

- label: `"Értesítések"`
- `os.enabled`: `"Operációs rendszer szintű értesítések engedélyezése"`; sub `"Rendszerértesítéseket jelenít meg, akkor is, ha a BitButler a háttérben fut"`
- `os.only-when-minimized`: `"Csak minimalizált ablaknál jelenjen meg"`; sub `"Nem jelenít meg rendszerértesítést, amíg a BitButler ablaka látható"`
- `app.enabled`: `"Alkalmazáson belüli értesítések engedélyezése"`; sub `"Felugró üzeneteket jelenít meg a BitButler ablakában"`
- categories: `"Letöltés befejezve"`, `"Hibák"`, `"Elérhető frissítés"`, `"Művelet visszaigazolások"`; subs `"Akkor jelenik meg, amikor egy torrent letöltése befejeződött"`, `"Sikertelen műveletek és kapcsolódási hibák"`, `"Akkor jelenik meg, amikor új verzió érhető el"`, `"Rövid üzenetek egy művelet sikeréről, például egy címke hozzáadásáról"`

- [ ] **Step 7: Run the tests, lint and format check**

Run: `npm test` then `npm run lint` then `npx prettier --check "packages/app/src/**/*.{ts,html,scss}" "packages/app/public/i18n/*.json"`
Expected: all PASS, zero lint warnings, Prettier clean (run `npm run format` and re-check if not).

- [ ] **Step 8: Manual verification in the real app**

Run `npm start` and check:

- Settings > General shows the Notifications group below Appearance; the dropdown is gone from Appearance; both master switches have a description; the "Show only when the app is minimized" row is full width.
- Turning a master off greys its children and keeps their values after turning it back on; Save, close and reopen settings: values and disabled state persist.
- With defaults, finishing a torrent shows an OS notification and a toast while the window is visible; with "Show only when the app is minimized" on, only the toast; minimized, only the OS notification.
- Stopping the qBittorrent server and triggering a failing action while minimized produces one OS notification, not a burst.
- With the app channel off, no toasts appear but OS notifications still do.
- An existing profile whose saved position was not the default keeps that position after upgrading.

- [ ] **Step 9: Commit**

```bash
git add packages/app
git commit -m "$(cat <<'EOF'
#343: add notifications section to the general settings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## After the last task

Per CLAUDE.md: do one review of the whole branch (not per task), then update the user guide in `packages/docs` once the feature has stabilized (around PR creation), remove `docs/superpowers` in its own commit (`#343: removed spec and plan`) before opening the PR, and write the PR description from `.github/pull_request_template.md` with `Fixes #343` and no spec/plan references.
