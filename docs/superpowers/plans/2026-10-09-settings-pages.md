# Settings Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app settings and qBittorrent settings modals with two routed full pages built on one shared shell (sidebar, pane header, card content area, sticky Save/Discard bar).

**Architecture:** A presentational `SettingsShell` takes a page config and renders the layout. Two thin page components (`SettingsPage`, `QbSettingsPage`) provide a page-scoped state service, feed the shell, and handle save, discard and load. All panes of a page stay mounted and the `:pane` route parameter selects the visible one, so the six components that own local forms are reused untouched. General and Server settings, whose single forms span several panes, move into page-scoped form services with thin pane components bound to them.

**Tech Stack:** Angular 22 (zoneless, signals, standalone, OnPush), Angular Router, ngx-translate, Reactive Forms, FontAwesome, ng-select, Vitest via `ng test`.

**Spec:** `docs/superpowers/specs/2026-10-09-settings-pages-design.md` (read it first; this plan implements it).

## Global Constraints

- Work on branch `353-settings-pages`. Every commit message starts with `#353: ` and ends with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Use `-` (hyphen), never `—` (em dash), in code comments, strings, docs and commit messages.
- Zero lint warnings: `npm run lint` must pass (max-warnings=0). Pre-commit hooks run lint-staged and prettier; let them reformat and re-stage.
- New code: standalone components, `ChangeDetectionStrategy.OnPush`, `inject()`, `input()`/`output()`, signals for new state. No `BehaviorSubject` for new state.
- All user-visible strings go through ngx-translate keys in both `packages/app/public/i18n/us.json` and `hu.json`.
- Toasts: title is a short Title-Case outcome ("Settings Saved", "Failed to Save Settings"); message is the raw error or one short sentence ending in a period. The existing `pages.settings.success.*`, `pages.settings.error.*`, `pages.qb-settings.success.*` and `pages.qb-settings.error.*` keys already follow this.
- Colors come from existing CSS variables (`--bs-body-bg`, `--bs-card-bg`, `--bs-card-cap-bg`, `--bs-border-color`, `--bb-accent`, `--bb-control-bg`, `--bb-control-border`, `--bb-control-radius`, `--bb-control-placeholder`, `--bb-black`). No hardcoded hex values in the new styles.
- Run a single spec with: `cd packages/app && npx ng test --watch=false --include "<glob relative to packages/app>"`. Run everything with `npm test` from the repo root. Spec files use Vitest globals (`vi`, `describe`, `it`, `expect`) without imports; `src/test-setup.ts` provides a fake `window.bitbutler`.
- Do not reference the spec or plan paths in PR or issue descriptions. Before opening the PR, remove the `docs` folder in its own commit `#353: removed spec and plan`.

## Review Focus

Failure modes the spec implies but that no happy-path test would exercise. Each has a test in the owning task.

1. Editing in one pane, switching to another and back must not lose the edit (the reason panes stay mounted). Task 3 test "keeps panes mounted when the active pane changes".
2. One form failing to save must not clear the other forms' dirty flags or hide the failure. Task 1 test "keeps a failed form dirty".
3. A bad or missing `:pane` in the URL must land on the first pane, not a blank page. Task 7 test "falls back to the first pane".
4. A forced logout (401/403) while the page is dirty must leave without the unsaved-changes prompt, but a normal Disconnect must still prompt. Task 2 tests.
5. Discard and Save must never show stale values: qBittorrent preferences are re-fetched after Save and Discard, then panes are rebuilt. Task 8 tests "refetches preferences after save" and "refetches preferences on discard".
6. qBittorrent preferences failing to load shows an error with Retry, and Retry recovers. Task 8 tests.
7. Opening settings while a modal is open must not navigate away from that modal. Task 7 test "ignores UI_OPEN_SETTINGS while a modal is open".

## File Structure

Moved (history kept with `git mv`):

- `packages/app/src/app/modals/settings/` -> `packages/app/src/app/pages/settings/`
- `packages/app/src/app/modals/qb-settings/` -> `packages/app/src/app/pages/qb-settings/`

Created:

| File                                                                                 | Responsibility                                                                      |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `pages/settings-shell/pane-state.service.ts` (+spec)                                 | Generic dirty tracking and `allSettled` save-all, base class of both state services |
| `pages/settings-shell/settings-shell.model.ts`                                       | `SettingsPageConfig`, `SettingsNavGroup`, `SettingsPaneDef`, `SettingsPageStatus`   |
| `pages/settings-shell/settings-shell.{ts,html,scss}` (+spec)                         | Presentational layout: sidebar, header, pane host, footer                           |
| `guards/unsaved-changes.guard.ts` (+spec)                                            | `canDeactivate` guard, force-leave flag                                             |
| `pages/settings/general-settings-form.service.ts` (+spec)                            | The single General form: load, discard, save, master switches                       |
| `pages/settings/server-settings-form.service.ts` (+spec)                             | The Server form (polling and path mappings): load, save                             |
| `pages/settings/{appearance,startup,notifications}/`                                 | New thin panes bound to the General form                                            |
| `pages/settings/{polling,path-mappings}/`                                            | New thin panes bound to the Server form (replace `server/`)                         |
| `pages/settings/settings-page.{ts,html}`, `settings-page.config.ts` (+spec)          | App settings page                                                                   |
| `pages/qb-settings/qb-settings-page.{ts,html}`, `qb-settings-page.config.ts` (+spec) | qBittorrent settings page                                                           |

Rewritten: `pages/settings/general/` (now Torrent handling + Language + Date format panes content), `settings-state.service.ts`, `qb-settings-state.service.ts`, `settings.interface.ts`, `qb-settings.interface.ts`.

Deleted: the `Settings` and `QbSettings` modal components (`settings.ts/.html/.scss/.spec.ts`, `qb-settings.ts/.html/.scss/.spec.ts`), `pages/settings/server/`.

Edited: `app.routes.ts`, `models/command.model.ts`, `services/ui-command-handler.service.ts` (+spec), `services/qb.service.ts`, `modals/import-torrents/import-torrents.{ts,html}`, `styles.scss`, `public/i18n/{us,hu}.json`, `CLAUDE.md`.

---

### Task 1: Move the settings code under pages and add the generic pane state service

**Files:**

- Move: `packages/app/src/app/modals/settings` -> `packages/app/src/app/pages/settings`, `packages/app/src/app/modals/qb-settings` -> `packages/app/src/app/pages/qb-settings`
- Create: `packages/app/src/app/pages/settings-shell/pane-state.service.ts`, `pane-state.service.spec.ts`
- Modify: `pages/settings/settings-state.service.ts`, `pages/settings/settings.interface.ts`, `pages/qb-settings/qb-settings-state.service.ts`, `pages/qb-settings/qb-settings.interface.ts`, `models/command.model.ts`, `services/ui-command-handler.service.ts`, `modals/import-torrents/import-torrents.ts`

**Interfaces:**

- Produces: `abstract class PaneStateService<TFormId extends string>` with `isDirty: Signal<boolean>`, `isDirtyMap: Signal<Record<TFormId, boolean>>`, `markDirty(id, dirty)`, `registerSave(id, fn)`, `resetDirty()`, `saveAll(): Promise<void>`. `SettingsStateService extends PaneStateService<SettingsFormId>`; `QbSettingsStateService extends PaneStateService<QbSettingsTabId>` plus `preferences` and `setPreferences`.
- Produces types: `SETTINGS_FORM_IDS`, `SettingsFormId`, `SettingsPaneId`, `NgSelectItem` in `settings.interface.ts`; `QbSettingsPaneId` in `qb-settings.interface.ts`.

- [ ] **Step 1: Move the two directories and fix path references**

The two directories sit at the same depth under `app/`, so their relative imports keep working. Only absolute-looking references to the old locations need updating.

```bash
cd packages/app/src/app
git mv modals/settings pages/settings
git mv modals/qb-settings pages/qb-settings
grep -rln "modals/settings\|modals/qb-settings" . | xargs sed -i 's#modals/settings/#pages/settings/#g; s#modals/qb-settings/#pages/qb-settings/#g'
sed -i "s#'../qb-settings/qb-settings'#'../../pages/qb-settings/qb-settings'#" modals/import-torrents/import-torrents.ts
cd ../../../..
npx tsc -p packages/app/tsconfig.app.json --noEmit
```

Expected: no TypeScript errors. (The import-torrents reference is deleted in Task 9; it only needs to compile until then.)

- [ ] **Step 2: Commit the move**

```bash
git add -A packages/app/src
git commit -m "#353: move settings components under pages"
```

- [ ] **Step 3: Write the failing spec for `PaneStateService`**

Create `packages/app/src/app/pages/settings-shell/pane-state.service.spec.ts`:

```ts
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaneStateService } from './pane-state.service';

type TestFormId = 'a' | 'b';

@Injectable()
class TestStateService extends PaneStateService<TestFormId> {
  constructor() {
    super(['a', 'b']);
  }
}

describe('PaneStateService', () => {
  let service: TestStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TestStateService] });
    service = TestBed.inject(TestStateService);
  });

  it('starts clean', () => {
    expect(service.isDirty()).toBe(false);
    expect(service.isDirtyMap()).toEqual({ a: false, b: false });
  });

  it('is dirty after a form is marked dirty and clean once it is unmarked', () => {
    service.markDirty('a', true);
    expect(service.isDirty()).toBe(true);
    expect(service.isDirtyMap()).toEqual({ a: true, b: false });

    service.markDirty('a', false);
    expect(service.isDirty()).toBe(false);
  });

  it('resetDirty clears every flag', () => {
    service.markDirty('a', true);
    service.markDirty('b', true);

    service.resetDirty();

    expect(service.isDirtyMap()).toEqual({ a: false, b: false });
  });

  it('saveAll runs only the dirty forms save functions and clears their flags', async () => {
    const saveA = vi.fn().mockResolvedValue(undefined);
    const saveB = vi.fn().mockResolvedValue(undefined);
    service.registerSave('a', saveA);
    service.registerSave('b', saveB);
    service.markDirty('a', true);

    await service.saveAll();

    expect(saveA).toHaveBeenCalledOnce();
    expect(saveB).not.toHaveBeenCalled();
    expect(service.isDirty()).toBe(false);
  });

  it('keeps a failed form dirty, clears the one that saved, and rethrows the failure', async () => {
    const failure = new Error('boom');
    service.registerSave('a', vi.fn().mockResolvedValue(undefined));
    service.registerSave('b', vi.fn().mockRejectedValue(failure));
    service.markDirty('a', true);
    service.markDirty('b', true);

    await expect(service.saveAll()).rejects.toBe(failure);

    expect(service.isDirtyMap()).toEqual({ a: false, b: true });
  });

  it('treats a dirty form without a registered save function as saved', async () => {
    service.markDirty('a', true);

    await service.saveAll();

    expect(service.isDirty()).toBe(false);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings-shell/pane-state.service.spec.ts"`
Expected: FAIL (cannot resolve `./pane-state.service`).

- [ ] **Step 5: Implement `PaneStateService`**

Create `packages/app/src/app/pages/settings-shell/pane-state.service.ts`:

```ts
import { Signal, WritableSignal, computed, signal } from '@angular/core';

/**
 * Dirty tracking and save orchestration shared by both settings pages. A "form" is one
 * independently saved unit; several panes can be bound to the same form.
 */
export abstract class PaneStateService<TFormId extends string> {
  private readonly dirtyFlags: WritableSignal<Record<TFormId, boolean>>;
  private readonly saveFns = new Map<TFormId, () => Promise<void>>();

  public readonly isDirty: Signal<boolean>;
  public readonly isDirtyMap: Signal<Record<TFormId, boolean>>;

  protected constructor(private readonly formIds: readonly TFormId[]) {
    this.dirtyFlags = signal(this.cleanFlags());
    this.isDirty = computed(() => Object.values(this.dirtyFlags()).some(Boolean));
    this.isDirtyMap = this.dirtyFlags.asReadonly();
  }

  public markDirty(id: TFormId, dirty: boolean): void {
    this.dirtyFlags.update((flags) => ({ ...flags, [id]: dirty }));
  }

  public registerSave(id: TFormId, fn: () => Promise<void>): void {
    this.saveFns.set(id, fn);
  }

  public resetDirty(): void {
    this.dirtyFlags.set(this.cleanFlags());
  }

  /**
   * Saves every dirty form. Forms that save are marked clean even when another form fails;
   * the first failure is rethrown so the caller can report it.
   */
  public async saveAll(): Promise<void> {
    const dirtyIds = this.formIds.filter((id) => this.dirtyFlags()[id]);
    const results = await Promise.allSettled(
      dirtyIds.map((id) => this.saveFns.get(id)?.() ?? Promise.resolve()),
    );

    const failures: unknown[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.markDirty(dirtyIds[index], false);
      } else {
        failures.push(result.reason);
      }
    });

    if (failures.length > 0) throw failures[0];
  }

  private cleanFlags(): Record<TFormId, boolean> {
    return Object.fromEntries(this.formIds.map((id) => [id, false])) as Record<TFormId, boolean>;
  }
}
```

- [ ] **Step 6: Run the spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings-shell/pane-state.service.spec.ts"`
Expected: PASS (6 tests).

- [ ] **Step 7: Rebase the two state services and their interface files on it**

Replace `packages/app/src/app/pages/settings/settings.interface.ts`:

```ts
import { Type } from '@angular/core';

export const SETTINGS_FORM_IDS = ['general', 'server', 'torrent-list-grid', 'status-bar'] as const;
export type SettingsFormId = (typeof SETTINGS_FORM_IDS)[number];

export const SETTINGS_PANE_IDS = [
  'general',
  'appearance',
  'startup',
  'notifications',
  'polling',
  'path-mappings',
  'torrent-list-grid',
  'status-bar',
] as const;
export type SettingsPaneId = (typeof SETTINGS_PANE_IDS)[number];

export interface NgSelectItem {
  value: string;
  label: string;
}

// Kept until the Settings modal is deleted in Task 7.
export type SettingsTabId = SettingsFormId;

export interface Tab {
  id: SettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<SettingsTabComponent>>;
}

export type SettingsTabComponent = object;
```

Replace `packages/app/src/app/pages/settings/settings-state.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { PaneStateService } from '../settings-shell/pane-state.service';
import { SETTINGS_FORM_IDS, SettingsFormId } from './settings.interface';

@Injectable()
export class SettingsStateService extends PaneStateService<SettingsFormId> {
  constructor() {
    super(SETTINGS_FORM_IDS);
  }
}
```

Replace `packages/app/src/app/pages/qb-settings/qb-settings.interface.ts`:

```ts
import { Type } from '@angular/core';

export const QB_SETTINGS_TAB_IDS = [
  'bandwidth',
  'storage',
  'queue-limits',
  'seeding-ratios',
] as const;
export type QbSettingsTabId = (typeof QB_SETTINGS_TAB_IDS)[number];

// Each qBittorrent pane is its own form, so pane ids and form ids are the same set.
export type QbSettingsPaneId = QbSettingsTabId;

// Kept until the QbSettings modal is deleted in Task 8.
export interface QbSettingsTab {
  id: QbSettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<QbSettingsTabComponent>>;
}

export type QbSettingsTabComponent = object;
```

Replace `packages/app/src/app/pages/qb-settings/qb-settings-state.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';
import { QbAppPreferences } from '../../models/qbittorrent.model';
import { PaneStateService } from '../settings-shell/pane-state.service';
import { QB_SETTINGS_TAB_IDS, QbSettingsTabId } from './qb-settings.interface';

@Injectable()
export class QbSettingsStateService extends PaneStateService<QbSettingsTabId> {
  private readonly _preferences = signal<QbAppPreferences | null>(null);

  public readonly preferences = this._preferences.asReadonly();

  constructor() {
    super(QB_SETTINGS_TAB_IDS);
  }

  public setPreferences(prefs: QbAppPreferences): void {
    this._preferences.set(prefs);
  }
}
```

- [ ] **Step 8: Run the existing state-service specs and the type check**

```bash
cd packages/app
npx ng test --watch=false --include "src/app/pages/settings/settings-state.service.spec.ts" --include "src/app/pages/qb-settings/qb-settings-state.service.spec.ts"
cd ../.. && npx tsc -p packages/app/tsconfig.app.json --noEmit
```

Expected: PASS and no type errors. If an existing `saveAll` assertion encodes the old `Promise.all` behavior (a rejection leaving every form dirty), update it to the new semantics: forms that saved are clean, failed forms stay dirty, and the first failure is rethrown.

- [ ] **Step 9: Commit**

```bash
git add -A packages/app/src
git commit -m "#353: add pane state service and rebase settings state services on it"
```

---

### Task 2: Unsaved-changes guard and forced-logout flag

**Files:**

- Create: `packages/app/src/app/guards/unsaved-changes.guard.ts`, `packages/app/src/app/guards/unsaved-changes.guard.spec.ts`
- Modify: `packages/app/src/app/services/qb.service.ts` (`forceLogout`, around line 838-851)

**Interfaces:**

- Produces: `FORCE_LEAVE_STATE_KEY = 'bbForceLeave'`, `interface UnsavedChangesGuardable { readonly basePath: string; readonly stateService: { isDirty(): boolean; resetDirty(): void } }`, `const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesGuardable>`.

- [ ] **Step 1: Write the failing spec**

Create `packages/app/src/app/guards/unsaved-changes.guard.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '../services/confirm.service';
import {
  FORCE_LEAVE_STATE_KEY,
  UnsavedChangesGuardable,
  unsavedChangesGuard,
} from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const dirty = signal(false);
  let resetDirty: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  let navigationState: Record<string, unknown> | undefined;
  let page: UnsavedChangesGuardable;

  const run = (nextUrl: string) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        page,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        { url: nextUrl } as RouterStateSnapshot,
      ),
    );

  beforeEach(() => {
    dirty.set(false);
    resetDirty = vi.fn();
    confirm = vi.fn().mockResolvedValue(false);
    navigationState = undefined;
    page = {
      basePath: '/pages/settings',
      stateService: { isDirty: dirty, resetDirty },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfirmService, useValue: { confirm } },
        {
          provide: Router,
          useValue: { currentNavigation: () => ({ extras: { state: navigationState } }) },
        },
      ],
    });
  });

  it('allows leaving without a prompt when nothing is dirty', async () => {
    expect(await run('/pages/torrent-list')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not prompt when only the pane changes inside the same page', async () => {
    dirty.set(true);

    expect(await run('/pages/settings/appearance')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(resetDirty).not.toHaveBeenCalled();
  });

  it('prompts when leaving the page dirty and stays when the user declines', async () => {
    dirty.set(true);
    confirm.mockResolvedValue(false);

    expect(await run('/pages/torrent-list')).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );
    expect(resetDirty).not.toHaveBeenCalled();
  });

  it('leaves and resets the dirty state when the user confirms', async () => {
    dirty.set(true);
    confirm.mockResolvedValue(true);

    expect(await run('/pages/torrent-list')).toBe(true);
    expect(resetDirty).toHaveBeenCalledOnce();
  });

  it('leaves without a prompt when the navigation carries the force-leave flag', async () => {
    dirty.set(true);
    navigationState = { [FORCE_LEAVE_STATE_KEY]: true };

    expect(await run('/login')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(resetDirty).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/guards/unsaved-changes.guard.spec.ts"`
Expected: FAIL (cannot resolve `./unsaved-changes.guard`).

- [ ] **Step 3: Implement the guard**

Create `packages/app/src/app/guards/unsaved-changes.guard.ts`:

```ts
import { inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { ConfirmService } from '../services/confirm.service';

/** Navigation state key set by a forced logout so the page leaves without the prompt. */
export const FORCE_LEAVE_STATE_KEY = 'bbForceLeave';

export interface UnsavedChangesGuardable {
  /** Route prefix of the page, e.g. `/pages/settings`. Navigating inside it never prompts. */
  readonly basePath: string;
  readonly stateService: { isDirty(): boolean; resetDirty(): void };
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesGuardable> = async (
  page,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const router = inject(Router);
  const confirmService = inject(ConfirmService);
  const { stateService, basePath } = page;

  if (!stateService.isDirty()) return true;

  // Switching panes only changes the `:pane` segment, so the next URL is still under basePath.
  if (nextState.url.startsWith(`${basePath}/`)) return true;

  // An expired session cannot be saved into, so do not ask the user to stay on this page.
  if (router.currentNavigation()?.extras.state?.[FORCE_LEAVE_STATE_KEY]) {
    stateService.resetDirty();
    return true;
  }

  const confirmed = await confirmService.confirm(
    'components.modals.guard.unsaved-title',
    'components.modals.guard.unsaved-message',
    'components.modals.guard.btn-leave',
    'components.modals.guard.btn-stay',
  );

  if (confirmed) stateService.resetDirty();

  return confirmed;
};
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/guards/unsaved-changes.guard.spec.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Set the flag on forced logout**

In `packages/app/src/app/services/qb.service.ts` add the import (next to the other relative imports) and change the final line of `forceLogout`:

```ts
import { FORCE_LEAVE_STATE_KEY } from '../guards/unsaved-changes.guard';
```

```ts
this.router.navigate(['/login'], { state: { [FORCE_LEAVE_STATE_KEY]: true } });
```

- [ ] **Step 6: Run the qb service specs**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/services/qb.service*.spec.ts"`
Expected: PASS. If a spec asserts `router.navigate` was called with exactly `['/login']` for the forced-logout path, update that assertion to `toHaveBeenCalledWith(['/login'], { state: { bbForceLeave: true } })`. The `UI_DISCONNECT` path in `ui-command-handler.service.ts` stays unchanged on purpose: a deliberate Disconnect must still prompt.

- [ ] **Step 7: Commit**

```bash
git add -A packages/app/src
git commit -m "#353: add unsaved-changes guard with forced-logout bypass"
```

---

### Task 3: Settings shell component

**Files:**

- Create: `packages/app/src/app/pages/settings-shell/settings-shell.model.ts`, `settings-shell.ts`, `settings-shell.html`, `settings-shell.scss`, `settings-shell.spec.ts`

**Interfaces:**

- Consumes: `ElectronService.getBitButlerVersion(): string | null`, `BbLogo`, `BbSpinner`, `BbBtnContent`.
- Produces: `SettingsShell` (selector `app-settings-shell`) with inputs `config` (required), `activePaneId` (required), `status` (default `'ready'`), `isDirty`, `dirtyMap`, `paneVersion`, `subtitle`, `errorKey`; outputs `save`, `discard`, `back`, `retry`. Model types below.

- [ ] **Step 1: Create the model**

`packages/app/src/app/pages/settings-shell/settings-shell.model.ts`:

```ts
import { Type } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface SettingsPaneDef {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: IconDefinition;
  /** Key into the page's dirty map; several panes can share a form. */
  formId: string;
  loadComponent: () => Promise<Type<unknown>>;
}

export interface SettingsNavGroup {
  labelKey: string;
  panes: SettingsPaneDef[];
}

export interface SettingsPageConfig {
  /** Route prefix without a trailing slash, e.g. `/pages/settings`. */
  basePath: string;
  titleKey: string;
  footerNoteKey: string;
  groups: SettingsNavGroup[];
}

export type SettingsPageStatus = 'loading' | 'ready' | 'error';
```

- [ ] **Step 2: Write the failing spec**

`packages/app/src/app/pages/settings-shell/settings-shell.spec.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { faBell, faGear } from '@fortawesome/free-solid-svg-icons';
import { ElectronService } from '../../services/electron.service';
import { SettingsShell } from './settings-shell';
import { SettingsPageConfig } from './settings-shell.model';

let created = 0;

@Component({
  selector: 'app-test-pane',
  template: 'pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPane {
  constructor() {
    created++;
  }
}

const config: SettingsPageConfig = {
  basePath: '/pages/test',
  titleKey: 'test.title',
  footerNoteKey: 'test.footer',
  groups: [
    {
      labelKey: 'test.group.one',
      panes: [
        {
          id: 'one',
          labelKey: 'test.pane.one',
          descriptionKey: 'test.pane.one.description',
          icon: faGear,
          formId: 'form-a',
          loadComponent: () => Promise.resolve(TestPane),
        },
        {
          id: 'two',
          labelKey: 'test.pane.two',
          descriptionKey: 'test.pane.two.description',
          icon: faBell,
          formId: 'form-b',
          loadComponent: () => Promise.resolve(TestPane),
        },
      ],
    },
  ],
};

describe('SettingsShell', () => {
  let fixture: ComponentFixture<SettingsShell>;

  const root = () => fixture.nativeElement as HTMLElement;
  const query = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const queryAll = (selector: string) => Array.from(root().querySelectorAll(selector));

  const setInputs = async (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    created = 0;

    await TestBed.configureTestingModule({
      imports: [SettingsShell],
      providers: [
        provideRouter([]),
        { provide: ElectronService, useValue: { getBitButlerVersion: () => '1.2.3' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsShell);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('activePaneId', 'one');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the title, group label, nav items and version', () => {
    expect(root().textContent).toContain('test.title');
    expect(root().textContent).toContain('test.group.one');
    expect(queryAll('.bb-settings__nav-item')).toHaveLength(2);
    expect(root().textContent).toContain('v1.2.3');
  });

  it('marks the active pane in the nav and shows its title and description', () => {
    const items = queryAll('.bb-settings__nav-item');
    expect(items[0].classList.contains('active')).toBe(true);
    expect(items[1].classList.contains('active')).toBe(false);
    expect(query('.bb-settings__pane-title')?.textContent).toContain('test.pane.one');
    expect(query('.bb-settings__pane-description')?.textContent).toContain(
      'test.pane.one.description',
    );
  });

  it('shows an unsaved marker only on nav items whose form is dirty', async () => {
    await setInputs({ dirtyMap: { 'form-a': false, 'form-b': true } });

    const dots = queryAll('.bb-settings__dirty-dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].closest('.bb-settings__nav-item')).toBe(queryAll('.bb-settings__nav-item')[1]);
  });

  it('disables Save and Discard and hides the pill while clean', () => {
    expect(query<HTMLButtonElement>('.bb-settings__save')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>('.bb-settings__discard')?.disabled).toBe(true);
    expect(query('.bb-settings__pill')).toBeNull();
  });

  it('enables Save and Discard and shows the pill while dirty, and emits their events', async () => {
    await setInputs({ isDirty: true });
    const saved = vi.fn();
    const discarded = vi.fn();
    fixture.componentInstance.save.subscribe(saved);
    fixture.componentInstance.discard.subscribe(discarded);

    query<HTMLButtonElement>('.bb-settings__save')?.click();
    query<HTMLButtonElement>('.bb-settings__discard')?.click();

    expect(query('.bb-settings__pill')).not.toBeNull();
    expect(saved).toHaveBeenCalledOnce();
    expect(discarded).toHaveBeenCalledOnce();
  });

  it('emits back from the back button', () => {
    const back = vi.fn();
    fixture.componentInstance.back.subscribe(back);

    query<HTMLButtonElement>('.bb-settings__back')?.click();

    expect(back).toHaveBeenCalledOnce();
  });

  it('mounts every pane but shows only the active one', () => {
    const panes = queryAll('.bb-settings__pane');
    expect(panes).toHaveLength(2);
    expect(panes.filter((pane) => !pane.classList.contains('d-none'))).toHaveLength(1);
  });

  it('keeps panes mounted when the active pane changes', async () => {
    expect(created).toBe(2);

    await setInputs({ activePaneId: 'two' });

    expect(created).toBe(2);
    expect(query('.bb-settings__pane-title')?.textContent).toContain('test.pane.two');
  });

  it('rebuilds the panes when the pane version changes', async () => {
    await setInputs({ paneVersion: 1 });

    expect(created).toBe(4);
  });

  it('shows a spinner instead of panes while loading', async () => {
    await setInputs({ status: 'loading' });

    expect(query('app-bb-spinner')).not.toBeNull();
    expect(queryAll('.bb-settings__pane')).toHaveLength(0);
  });

  it('shows the error message with a Retry button that emits retry', async () => {
    await setInputs({ status: 'error', errorKey: 'test.error' });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    expect(root().textContent).toContain('test.error');
    query<HTMLButtonElement>('.bb-settings__retry')?.click();

    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows the subtitle when one is given', async () => {
    await setInputs({ subtitle: 'My Server' });

    expect(query('.bb-settings__subtitle')?.textContent).toContain('My Server');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings-shell/settings-shell.spec.ts"`
Expected: FAIL (cannot resolve `./settings-shell`).

- [ ] **Step 4: Implement the component**

`packages/app/src/app/pages/settings-shell/settings-shell.ts`:

```ts
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Type,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronLeft, faFloppyDisk, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbLogo } from '../../components/bb-logo/bb-logo';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { ElectronService } from '../../services/electron.service';
import { SettingsPageConfig, SettingsPageStatus, SettingsPaneDef } from './settings-shell.model';

/**
 * Layout for a settings page: sidebar nav, pane header, pane host and the Save/Discard bar.
 * Presentational only; the page component owns state, saving and navigation.
 *
 * Every pane of the page stays mounted and only the active one is shown, so edits made in a
 * pane survive switching to another pane.
 */
@Component({
  selector: 'app-settings-shell',
  imports: [
    NgComponentOutlet,
    RouterLink,
    FontAwesomeModule,
    TranslatePipe,
    BbBtnContent,
    BbLogo,
    BbSpinner,
  ],
  templateUrl: './settings-shell.html',
  styleUrl: './settings-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShell {
  public readonly config = input.required<SettingsPageConfig>();
  public readonly activePaneId = input.required<string>();
  public readonly status = input<SettingsPageStatus>('ready');
  public readonly isDirty = input(false);
  public readonly dirtyMap = input<Record<string, boolean>>({});
  /** Bumping this value rebuilds every pane, so they re-read their persisted values. */
  public readonly paneVersion = input(0);
  public readonly subtitle = input<string | null>(null);
  public readonly errorKey = input('');

  public readonly save = output<void>();
  public readonly discard = output<void>();
  public readonly back = output<void>();
  public readonly retry = output<void>();

  public readonly version = inject(ElectronService).getBitButlerVersion();
  public readonly icons = { faChevronLeft, faFloppyDisk, faRotateLeft };

  public readonly panes = computed<SettingsPaneDef[]>(() =>
    this.config().groups.flatMap((group) => group.panes),
  );
  public readonly activePane = computed(
    () => this.panes().find((pane) => pane.id === this.activePaneId()) ?? this.panes()[0],
  );
  public readonly loadedComponents = signal<ReadonlyMap<string, Type<unknown>>>(new Map());

  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  constructor() {
    effect(() => {
      void this.loadPanes(this.panes());
    });

    effect(() => {
      this.activePane();
      const element = this.content()?.nativeElement;
      if (element) element.scrollTop = 0;
    });
  }

  private async loadPanes(panes: SettingsPaneDef[]): Promise<void> {
    const entries = await Promise.all(
      panes.map(async (pane) => [pane.id, await pane.loadComponent()] as const),
    );
    this.loadedComponents.set(new Map(entries));
  }
}
```

`packages/app/src/app/pages/settings-shell/settings-shell.html`:

```html
<div class="bb-settings">
  <aside class="bb-settings__sidebar">
    <div class="bb-settings__sidebar-top">
      <button
        type="button"
        class="bb-settings__icon-btn bb-settings__back"
        [attr.aria-label]="'pages.settings.nav.back' | translate"
        (click)="back.emit()"
      >
        <fa-icon [icon]="icons.faChevronLeft"></fa-icon>
      </button>
      <div class="bb-settings__title-block">
        <h1 class="bb-settings__title">{{ config().titleKey | translate }}</h1>
        @if (subtitle()) {
        <div class="bb-settings__subtitle">{{ subtitle() }}</div>
        }
      </div>
    </div>

    <nav class="bb-settings__nav">
      @for (group of config().groups; track group.labelKey) {
      <div class="bb-settings__group">
        <div class="bb-settings__group-label">{{ group.labelKey | translate }}</div>
        @for (pane of group.panes; track pane.id) {
        <a
          class="bb-settings__nav-item"
          [class.active]="pane.id === activePane().id"
          [routerLink]="[config().basePath, pane.id]"
        >
          <fa-icon [icon]="pane.icon" [fixedWidth]="true"></fa-icon>
          <span class="bb-settings__nav-label">{{ pane.labelKey | translate }}</span>
          @if (dirtyMap()[pane.formId]) {
          <span
            class="bb-settings__dirty-dot"
            [title]="'components.modals.guard.unsaved-indicator' | translate"
          ></span>
          }
        </a>
        }
      </div>
      }
    </nav>

    <div class="bb-settings__sidebar-footer">
      <app-bb-logo [size]="26"></app-bb-logo>
      <div class="bb-settings__app">
        <div class="bb-settings__app-name">BitButler</div>
        @if (version) {
        <div class="bb-settings__app-version">v{{ version }}</div>
        }
      </div>
    </div>
  </aside>

  <section class="bb-settings__main">
    <header class="bb-settings__header">
      <div>
        <h2 class="bb-settings__pane-title">{{ activePane().labelKey | translate }}</h2>
        <p class="bb-settings__pane-description">{{ activePane().descriptionKey | translate }}</p>
      </div>
      @if (isDirty()) {
      <span class="bb-settings__pill">
        {{ 'components.modals.guard.unsaved-indicator' | translate }}
      </span>
      }
    </header>

    <div #content class="bb-settings__content">
      @switch (status()) { @case ('loading') {
      <app-bb-spinner></app-bb-spinner>
      } @case ('error') {
      <div class="bb-settings__error">
        <p>{{ errorKey() | translate }}</p>
        <button type="button" class="btn btn-sm bb-settings__retry" (click)="retry.emit()">
          {{ 'general.button.retry' | translate }}
        </button>
      </div>
      } @default { @if (loadedComponents().size > 0) {
      <!-- A one-item loop keyed on paneVersion: changing the version rebuilds every pane. -->
      @for (paneKey of [paneVersion()]; track paneKey) { @for (pane of panes(); track pane.id) {
      <div class="bb-settings__pane" [class.d-none]="pane.id !== activePane().id">
        <ng-container *ngComponentOutlet="loadedComponents().get(pane.id) ?? null" />
      </div>
      } } } @else {
      <app-bb-spinner></app-bb-spinner>
      } } }
    </div>

    <footer class="bb-settings__footer">
      <span class="bb-settings__footer-note">{{ config().footerNoteKey | translate }}</span>
      <div class="bb-settings__actions">
        <button
          type="button"
          class="btn btn-sm btn-split bb-settings__discard"
          [disabled]="!isDirty()"
          (click)="discard.emit()"
        >
          <bb-btn-content
            [icon]="icons.faRotateLeft"
            [text]="'general.button.discard' | translate"
            position="end"
          ></bb-btn-content>
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm btn-split bb-settings__save"
          [disabled]="!isDirty()"
          (click)="save.emit()"
        >
          <bb-btn-content
            [icon]="icons.faFloppyDisk"
            [text]="'general.button.save' | translate"
            position="end"
          ></bb-btn-content>
        </button>
      </div>
    </footer>
  </section>
</div>
```

`packages/app/src/app/pages/settings-shell/settings-shell.scss`:

```scss
:host {
  display: block;
}

.bb-settings {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  font-size: 0.84rem;
}

.bb-settings__sidebar {
  flex: 0 0 268px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: color-mix(in srgb, var(--bs-body-bg) 90%, var(--bb-black));
  border-right: 1px solid var(--bs-border-color);
}

.bb-settings__sidebar-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 20px 16px;
}

.bb-settings__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  color: var(--bb-control-placeholder);
  background: transparent;
  border: 1px solid var(--bb-control-border);
  border-radius: var(--bb-control-radius);

  &:hover {
    color: var(--bs-body-color);
    background-color: var(--bs-card-cap-bg);
  }
}

.bb-settings__title {
  margin: 0;
  font-size: 1.06rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.bb-settings__subtitle {
  margin-top: 2px;
  font-size: 0.75rem;
  color: var(--bb-control-placeholder);
}

.bb-settings__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 12px 16px;
}

.bb-settings__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bb-settings__group-label {
  padding: 0 8px 6px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bb-control-placeholder);
}

.bb-settings__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  font-weight: 500;
  color: color-mix(in srgb, var(--bs-body-color) 70%, transparent);
  text-decoration: none;

  &:hover {
    color: var(--bs-body-color);
    background-color: color-mix(in srgb, var(--bb-accent) 8%, transparent);
  }

  &.active {
    font-weight: 600;
    color: var(--bb-accent);
    background-color: color-mix(in srgb, var(--bb-accent) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bb-accent) 22%, transparent);
  }
}

.bb-settings__nav-label {
  flex: 1;
  min-width: 0;
}

.bb-settings__dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background-color: var(--bb-accent);
}

.bb-settings__sidebar-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 64px;
  padding: 0 20px;
  border-top: 1px solid var(--bs-border-color);
}

.bb-settings__app-name {
  font-size: 0.72rem;
  font-weight: 600;
}

.bb-settings__app-version {
  font-size: 0.66rem;
  color: var(--bb-control-placeholder);
}

.bb-settings__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.bb-settings__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 34px 18px;
  border-bottom: 1px solid var(--bs-border-color);
}

.bb-settings__pane-title {
  margin: 0;
  font-size: 1.38rem;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.bb-settings__pane-description {
  max-width: 640px;
  margin: 4px 0 0;
  color: color-mix(in srgb, var(--bs-body-color) 70%, transparent);
}

.bb-settings__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--bb-accent);
  background-color: color-mix(in srgb, var(--bb-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--bb-accent) 30%, transparent);

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background-color: var(--bb-accent);
  }
}

.bb-settings__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 34px 40px;
  // The card grid reacts to the width of this area, not the viewport, because the sidebar
  // takes a fixed 268px of it.
  container-type: inline-size;
  container-name: bb-settings-content;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--bs-body-color) 16%, transparent);
    border-radius: 99px;
  }
}

.bb-settings__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  color: var(--bs-danger);
}

.bb-settings__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 64px;
  padding: 0 34px;
  background-color: color-mix(in srgb, var(--bs-body-bg) 90%, var(--bb-black));
  border-top: 1px solid var(--bs-border-color);
}

.bb-settings__footer-note {
  font-size: 0.72rem;
  color: var(--bb-control-placeholder);
}

.bb-settings__actions {
  display: flex;
  gap: 12px;
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings-shell/settings-shell.spec.ts"`
Expected: PASS (12 tests). If `NG8113` (unused standalone import) is reported by `npx tsc`/build, remove the unused import from the component.

- [ ] **Step 6: Commit**

```bash
git add -A packages/app/src
git commit -m "#353: add settings shell component"
```

---

### Task 4: Translation keys

**Files:**

- Modify: `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json`

**Produces keys:** `pages.settings.nav.{back,footer-note}`, `pages.settings.nav.group.{application,server,interface}`, `pages.settings.nav.pane.{appearance,startup,notifications,polling,path-mappings}.description`, `pages.settings.tab.general.label.{date-format,notifications-os,notifications-app}`, `pages.qb-settings.nav.group.preferences`, `pages.qb-settings.nav.footer-note`, `pages.qb-settings.error.load-failed`, `general.button.discard`. The existing `pages.settings.tab.general.label.language` is reused as the Language card legend.

- [ ] **Step 1: Add the keys with a script**

Create the script in the scratchpad directory (not in the repo) as `add-i18n.cjs`, then run it from the repo root with `node <scratchpad>/add-i18n.cjs`:

```js
const fs = require('fs');

const dir = 'packages/app/public/i18n';

const additions = {
  us: {
    general: { button: { discard: 'Discard' } },
    pages: {
      settings: {
        nav: {
          back: 'Back',
          'footer-note': 'Changes apply to this device only.',
          group: { application: 'Application', server: 'Server', interface: 'Interface' },
          pane: {
            appearance: { description: 'Theme family and light/dark mode for the application.' },
            startup: { description: 'How BitButler behaves when your system starts.' },
            notifications: { description: 'Which events notify you, and how.' },
            polling: {
              description:
                'Server level settings. These are handled separately for each added server.',
            },
            'path-mappings': {
              description:
                'Map remote server paths to local paths so files resolve on this device.',
            },
          },
        },
        tab: {
          general: {
            label: {
              'date-format': 'Date Format',
              'notifications-os': 'System Notifications',
              'notifications-app': 'In-app Notifications',
            },
          },
        },
      },
      'qb-settings': {
        nav: {
          group: { preferences: 'Preferences' },
          'footer-note': 'Changes are saved on the connected qBittorrent server.',
        },
        error: { 'load-failed': 'The qBittorrent preferences could not be loaded.' },
      },
    },
  },
  hu: {
    general: { button: { discard: 'Elvetés' } },
    pages: {
      settings: {
        nav: {
          back: 'Vissza',
          'footer-note': 'A módosítások csak erre az eszközre vonatkoznak.',
          group: { application: 'Alkalmazás', server: 'Kiszolgáló', interface: 'Felület' },
          pane: {
            appearance: {
              description: 'Az alkalmazás témacsaládja és világos/sötét módja.',
            },
            startup: { description: 'A BitButler viselkedése a rendszer indulásakor.' },
            notifications: { description: 'Mely eseményekről és hogyan kapsz értesítést.' },
            polling: {
              description:
                'Kiszolgálószintű beállítások. Minden hozzáadott kiszolgálóra külön érvényesek.',
            },
            'path-mappings': {
              description:
                'Rendeld a távoli kiszolgáló útvonalait helyi útvonalakhoz, hogy a fájlok ezen az eszközön elérhetők legyenek.',
            },
          },
        },
        tab: {
          general: {
            label: {
              'date-format': 'Dátumformátum',
              'notifications-os': 'Rendszerértesítések',
              'notifications-app': 'Alkalmazáson belüli értesítések',
            },
          },
        },
      },
      'qb-settings': {
        nav: {
          group: { preferences: 'Beállítások' },
          'footer-note': 'A módosítások a csatlakoztatott qBittorrent kiszolgálón mentődnek.',
        },
        error: { 'load-failed': 'A qBittorrent beállításait nem sikerült betölteni.' },
      },
    },
  },
};

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object') {
      target[key] = target[key] && typeof target[key] === 'object' ? target[key] : {};
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

for (const lang of ['us', 'hu']) {
  const file = `${dir}/${lang}.json`;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  merge(json, additions[lang]);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}
```

- [ ] **Step 2: Format and verify only additions were made**

```bash
npx prettier --write packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git diff --stat packages/app/public/i18n
git diff packages/app/public/i18n | grep '^-' | grep -v '^---' | head
```

Expected: both files show only insertions; the last command prints nothing (no removed or reordered lines). If it prints lines, the files were not stored in canonical JSON order or formatting; restore with `git checkout packages/app/public/i18n` and re-apply the additions by hand at the matching places instead.

- [ ] **Step 3: Verify both languages have the same key set**

```bash
node -e '
const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"?flat(v,p+k+"."):[p+k]);
const a=new Set(flat(require("./packages/app/public/i18n/us.json")));
const b=new Set(flat(require("./packages/app/public/i18n/hu.json")));
const only=(x,y)=>[...x].filter(k=>!y.has(k));
console.log("only us:",only(a,b),"only hu:",only(b,a));'
```

Expected: both lists empty for the keys added here (if either list shows keys that were already mismatched before this task, leave those alone and confirm none of them start with the prefixes listed above).

- [ ] **Step 4: Commit**

```bash
git add packages/app/public/i18n
git commit -m "#353: add settings page translation keys"
```

---

### Task 5: General settings form service and the four General panes

**Files:**

- Create: `pages/settings/general-settings-form.service.ts`, `general-settings-form.service.spec.ts`, `pages/settings/appearance/{appearance.ts,appearance.html,appearance.spec.ts}`, `pages/settings/startup/{startup.ts,startup.html,startup.scss,startup.spec.ts}`, `pages/settings/notifications/{notifications.ts,notifications.html,notifications.scss,notifications.spec.ts}`
- Rewrite: `pages/settings/general/{general.ts,general.html,general.scss,general.spec.ts}`
- (all paths relative to `packages/app/src/app/`)

**Interfaces:**

- Consumes: `SettingsStateService` (`markDirty`, `registerSave`), `NgSelectItem` from `settings.interface.ts`, `GeneralSettingsService.load()/save()`, `ThemeService.applyFromSettings`, `DateFormatService.applyFromSettings`.
- Produces: `GeneralSettingsFormService` with `form` (the existing `generalSettingsForm` FormGroup), `formSnapshot: WritableSignal<ReturnType<form.getRawValue>>`, `openAtLoginValue: WritableSignal<boolean>`, `loaded: WritableSignal<boolean>`, `load(): Promise<void>`, `discard(): Promise<void>`, `save(): Promise<void>`. Panes `General`, `Appearance`, `Startup`, `Notifications` (selectors `app-general`, `app-appearance`, `app-startup`, `app-notifications`), each exposing `generalSettingsForm` and `settingsLoaded`.

The current template of `general/general.html` is split by line range (verified against the file at `HEAD`): Startup fieldset 7-87, Notifications fieldset 89-360 (OS group 93-211, app group 213-358), Torrent handling fieldset 362-463, Localization fieldset 465-673 (Language container 468-501, Date format container 503-672), Appearance fieldset 675-757.

- [ ] **Step 1: Write the failing service spec**

Create `pages/settings/general-settings-form.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_GENERAL_SETTINGS, GeneralSettings } from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { ThemeService } from '../../services/theme.service';
import { GeneralSettingsFormService } from './general-settings-form.service';
import { SettingsStateService } from './settings-state.service';

describe('GeneralSettingsFormService', () => {
  let service: GeneralSettingsFormService;
  let stateMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let settingsServiceMock: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let dateFormatMock: { applyFromSettings: ReturnType<typeof vi.fn> };
  let themeMock: { applyFromSettings: ReturnType<typeof vi.fn> };
  let persisted: GeneralSettings;

  beforeEach(async () => {
    persisted = structuredClone(DEFAULT_GENERAL_SETTINGS);
    stateMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    settingsServiceMock = {
      load: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(persisted))),
      save: vi.fn().mockResolvedValue(undefined),
    };
    dateFormatMock = { applyFromSettings: vi.fn() };
    themeMock = { applyFromSettings: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: stateMock },
        { provide: GeneralSettingsService, useValue: settingsServiceMock },
        { provide: DateFormatService, useValue: dateFormatMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    });
    service = TestBed.inject(GeneralSettingsFormService);
    await service.load();
  });

  it('registers one save function for the general form', () => {
    expect(stateMock.registerSave).toHaveBeenCalledWith('general', expect.any(Function));
  });

  it('is not loaded before load() resolves and loaded afterwards', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: stateMock },
        { provide: GeneralSettingsService, useValue: settingsServiceMock },
        { provide: DateFormatService, useValue: dateFormatMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    });
    const fresh = TestBed.inject(GeneralSettingsFormService);
    expect(fresh.loaded()).toBe(false);

    await fresh.load();

    expect(fresh.loaded()).toBe(true);
  });

  it('patches the persisted values into the form without marking it dirty', async () => {
    persisted.appearance.family = 'aurora';
    stateMock.markDirty.mockClear();

    await service.load();

    expect(service.form.getRawValue().appearance.family).toBe('aurora');
    expect(stateMock.markDirty).not.toHaveBeenCalled();
  });

  it('marks the general form dirty when a control changes', () => {
    service.form.controls.language.controls.language.setValue('hu');

    expect(stateMock.markDirty).toHaveBeenCalledWith('general', true);
  });

  it('keeps startMinimized disabled until openAtLogin is on', () => {
    const { openAtLogin, startMinimized } = service.form.controls.startup.controls;

    expect(startMinimized.disabled).toBe(true);
    openAtLogin.setValue(true);
    expect(startMinimized.enabled).toBe(true);
    openAtLogin.setValue(false);
    expect(startMinimized.disabled).toBe(true);
    expect(startMinimized.value).toBe(false);
  });

  it('save writes the whole settings object once and applies theme and date format', async () => {
    service.form.controls.dateFormat.controls.preset.setValue('custom');
    service.form.controls.dateFormat.controls.customPattern.setValue('dd/MM/yyyy');

    await service.save();

    expect(settingsServiceMock.save).toHaveBeenCalledOnce();
    expect(settingsServiceMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy', firstDayOfWeek: 'auto' },
      }),
    );
    expect(dateFormatMock.applyFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy', firstDayOfWeek: 'auto' },
      }),
    );
    expect(themeMock.applyFromSettings).toHaveBeenCalledWith(
      persisted.appearance.family,
      persisted.appearance.mode,
    );
  });

  it('save forces startMinimized off when openAtLogin is off', async () => {
    service.form.controls.startup.controls.openAtLogin.setValue(false);

    await service.save();

    expect(settingsServiceMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        startup: expect.objectContaining({ openAtLogin: false, startMinimized: false }),
      }),
    );
  });

  it('discard restores the persisted values and clears the dirty flag', async () => {
    service.form.controls.language.controls.language.setValue('hu');
    stateMock.markDirty.mockClear();

    await service.discard();

    expect(service.form.controls.language.controls.language.value).toBe(
      persisted.language.language,
    );
    expect(stateMock.markDirty).toHaveBeenLastCalledWith('general', false);
  });

  it('discard re-applies the master-switch state of the persisted notification groups', async () => {
    persisted.notifications.os.enabled = false;

    await service.discard();

    expect(service.form.controls.notifications.controls.os.controls.finished.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/general-settings-form.service.spec.ts"`
Expected: FAIL (cannot resolve `./general-settings-form.service`).

- [ ] **Step 3: Implement the form service**

Create `pages/settings/general-settings-form.service.ts`. The form definition, the constructor subscriptions, `applyMasterSwitch` and the `save` body are moved from the current `general/general.ts`. Print the original with `git show HEAD:packages/app/src/app/pages/settings/general/general.ts` and find each piece by name (`generalSettingsForm = new FormGroup`, the `constructor`, `applyMasterSwitch`, `private async save`); copy them exactly, changing only what is shown:

```ts
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  DateFormatPreset,
  FirstDayOfWeek,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
} from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { ThemeFamily, ThemeMode, ThemeService } from '../../services/theme.service';
import { SettingsStateService } from './settings-state.service';

/**
 * Owns the single General settings form. Several panes (General, Appearance, Startup,
 * Notifications) bind to slices of it, so it lives at page level and outlives pane switches.
 */
@Injectable()
export class GeneralSettingsFormService {
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly dateFormatService = inject(DateFormatService);
  private readonly stateService = inject(SettingsStateService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly form = new FormGroup({
    // PASTE the `behavior`, `language`, `dateFormat`, `appearance`, `startup`, `savePath` and
    // `notifications` groups verbatim from `generalSettingsForm` in the old general.ts.
  });

  public readonly formSnapshot = signal(this.form.getRawValue());
  public readonly openAtLoginValue = signal(false);
  public readonly loaded = signal(false);

  constructor() {
    // PASTE the three valueChanges subscriptions from the old constructor (openAtLogin ->
    // startMinimized, deleteTorrentFile -> deleteTorrentFileOnDuplicate, and the os/app
    // master switches), unchanged, using `this.form.controls...` instead of
    // `this.generalSettingsForm.controls...`.

    this.stateService.registerSave('general', () => this.save());

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.stateService.markDirty('general', true);
      this.formSnapshot.set(this.form.getRawValue());
    });

    void this.load();
  }

  public async load(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this.form.patchValue(settings, { emitEvent: false });
    this.formSnapshot.set(this.form.getRawValue());
    this.applyDependentControlStates(settings);
    this.loaded.set(true);
  }

  public async discard(): Promise<void> {
    await this.load();
    this.stateService.markDirty('general', false);
  }

  public async save(): Promise<void> {
    // PASTE the body of the old private `save()` unchanged, replacing
    // `this.generalSettingsForm` with `this.form`.
  }

  // A master switch disables its children without resetting them, so turning it back on
  // restores the choices the user had made.
  private applyMasterSwitch(group: FormGroup): void {
    // PASTE the old `applyMasterSwitch` body unchanged.
  }

  private applyDependentControlStates(settings: GeneralSettings): void {
    const { startup, behavior, notifications } = this.form.controls;

    const openAtLogin = settings.startup?.openAtLogin ?? false;
    this.openAtLoginValue.set(openAtLogin);
    if (openAtLogin) {
      startup.controls.startMinimized.enable({ emitEvent: false });
    } else {
      startup.controls.startMinimized.setValue(false, { emitEvent: false });
      startup.controls.startMinimized.disable({ emitEvent: false });
    }

    const deleteTorrentFile = settings.behavior?.deleteTorrentFile ?? false;
    if (deleteTorrentFile) {
      behavior.controls.deleteTorrentFileOnDuplicate.enable({ emitEvent: false });
    } else {
      behavior.controls.deleteTorrentFileOnDuplicate.disable({ emitEvent: false });
    }

    this.applyMasterSwitch(notifications.controls.os);
    this.applyMasterSwitch(notifications.controls.app);
  }
}
```

The `PASTE` comments mark verbatim moves of existing code, located by name as described above; replace each comment with the moved code. Remove the now-unused imports (`AbstractControl` only if `applyMasterSwitch` no longer needs it, `TranslateService`/`firstValueFrom` are used by `save`).

- [ ] **Step 4: Run the service spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/general-settings-form.service.spec.ts"`
Expected: PASS (9 tests). If the "not loaded before load()" test is flaky because the constructor already triggers `load()`, assert `fresh.loaded()` before `await` of the first microtask by reading it synchronously right after `TestBed.inject` (as written) and keep it.

- [ ] **Step 5: Build the four pane templates from the old template**

Run this from `packages/app/src/app/pages/settings` **before** touching `general/general.html` (it reads the original from `HEAD`). First confirm the line ranges still match the file, then extract:

```bash
ORIG=$(mktemp)
git show HEAD:packages/app/src/app/pages/settings/general/general.html > "$ORIG"
# Each line printed must be the fieldset/group boundary named in its comment.
sed -n '7p;87p' "$ORIG"      # <fieldset ...> / </fieldset>  (Startup)
sed -n '93p;211p' "$ORIG"    # <div ... formGroupName="os"> ... / </div>
sed -n '213p;358p' "$ORIG"   # <div ... (app group opens) / </div>
sed -n '362p;463p;465p;673p;675p;757p' "$ORIG"
mkdir -p appearance startup notifications

# General pane: Torrent handling + Language + Date format cards
{
cat <<'EOF'
@if (settingsLoaded()) {
  <form [formGroup]="generalSettingsForm" class="bb-cards">
EOF
sed -n '362,463p' "$ORIG"
cat <<'EOF'

    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.settings.tab.general.label.language' | translate }}</legend>
EOF
sed -n '468,501p' "$ORIG"
cat <<'EOF'
    </fieldset>

    <fieldset class="bb-fieldset bb-card--wide">
      <legend>{{ 'pages.settings.tab.general.label.date-format' | translate }}</legend>
EOF
sed -n '503,672p' "$ORIG"
cat <<'EOF'
    </fieldset>
  </form>
} @else {
  <app-bb-spinner></app-bb-spinner>
}
EOF
} > general/general.html

# Startup pane
{
cat <<'EOF'
@if (settingsLoaded()) {
  <form [formGroup]="generalSettingsForm" class="bb-cards">
EOF
sed -n '7,87p' "$ORIG"
cat <<'EOF'
  </form>
} @else {
  <app-bb-spinner></app-bb-spinner>
}
EOF
} > startup/startup.html

# Notifications pane: OS and in-app groups become two cards
{
cat <<'EOF'
@if (settingsLoaded()) {
  <form [formGroup]="generalSettingsForm" class="bb-cards">
    <div class="bb-cards__group" formGroupName="notifications">
      <fieldset class="bb-fieldset">
        <legend>{{ 'pages.settings.tab.general.label.notifications-os' | translate }}</legend>
EOF
sed -n '93,211p' "$ORIG"
cat <<'EOF'
      </fieldset>

      <fieldset class="bb-fieldset">
        <legend>{{ 'pages.settings.tab.general.label.notifications-app' | translate }}</legend>
EOF
sed -n '213,358p' "$ORIG"
cat <<'EOF'
      </fieldset>
    </div>
  </form>
} @else {
  <app-bb-spinner></app-bb-spinner>
}
EOF
} > notifications/notifications.html

# Appearance pane
{
cat <<'EOF'
@if (settingsLoaded()) {
  <form [formGroup]="generalSettingsForm" class="bb-cards">
EOF
sed -n '675,757p' "$ORIG"
cat <<'EOF'
  </form>
} @else {
  <app-bb-spinner></app-bb-spinner>
}
EOF
} > appearance/appearance.html

rm "$ORIG"
```

`bb-cards` and `bb-card--wide` are styled in Task 10. `bb-cards__group` is a pass-through wrapper (`display: contents`, also Task 10) so the two notification fieldsets are direct grid items of the form.

Notes on the extraction: the OS and app groups are `<div ... formGroupName="os">` and `<div ... formGroupName="app">` blocks that already sit inside the `notifications` group, so the wrapper `<div class="bb-cards__group" formGroupName="notifications">` keeps their form path intact. Run `npx prettier --write` on the four new templates afterwards.

- [ ] **Step 6: Write the four pane components**

`general/general.ts` (replace the whole file; the computed values and helpers are moved from the old class unchanged, found by name in `git show HEAD:.../general/general.ts`: `languageChanged`, `languages`, `previewDateFormat`, `dateFormatPresets`, `firstDayOfWeekOptions`, `isCustomDateFormat`, `customPatternPreview`, `resetCustomPattern`, `dateFormatTokenGuide`, `formatToken`, `icons`, `tokenGuideExpanded`, `toggleTokenGuide`, plus the module-level `DateFormatPresetItem`, `DateFormatTokenGuideRow` interfaces and `DATE_FORMAT_TOKENS`):

```ts
import { CommonModule, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faChevronDown,
  faChevronUp,
  faCircleQuestion,
  faRotateLeft,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LOCALE,
  DateFormatPreset,
  FIRST_DAY_OF_WEEK_OPTIONS,
  LANGUAGE_LOCALE_MAP,
  resolveDateFormat,
} from '../../../models/general-settings.model';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { NgSelectItem, SettingsTabComponent } from '../settings.interface';

// DateFormatPresetItem, DateFormatTokenGuideRow and DATE_FORMAT_TOKENS: moved unchanged.

@Component({
  selector: 'app-general',
  imports: [
    CommonModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    TranslatePipe,
    SavePathSelect,
    BbBtnContent,
    NgbCollapse,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements SettingsTabComponent {
  private readonly translateService = inject(TranslateService);
  private readonly formService = inject(GeneralSettingsFormService);

  private languageChanged = toSignal(this.translateService.onLangChange);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
  private readonly formSnapshot = this.formService.formSnapshot;

  // languages, previewDateFormat, dateFormatPresets, firstDayOfWeekOptions,
  // isCustomDateFormat, customPatternPreview, resetCustomPattern, dateFormatTokenGuide,
  // formatToken, icons, tokenGuideExpanded, toggleTokenGuide: moved unchanged from the old
  // General class.
}
```

`appearance/appearance.ts`:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbLogo } from '../../../components/bb-logo/bb-logo';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { THEME_FAMILIES } from '../../../services/theme.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { NgSelectItem, SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-appearance',
  imports: [
    CommonModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    ReactiveFormsModule,
    BbSpinner,
    BbLogo,
    TranslatePipe,
  ],
  templateUrl: './appearance.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Appearance implements SettingsTabComponent {
  private readonly translateService = inject(TranslateService);
  private readonly formService = inject(GeneralSettingsFormService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
  public readonly families = THEME_FAMILIES;

  public readonly modes = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'light',
        label: this.translateService.instant('pages.settings.tab.general.mode.light'),
      },
      {
        value: 'dark',
        label: this.translateService.instant('pages.settings.tab.general.mode.dark'),
      },
      {
        value: 'system',
        label: this.translateService.instant('pages.settings.tab.general.mode.system'),
      },
    ];
  });
}
```

`startup/startup.ts`:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { ServerStoreService } from '../../../services/server-store.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-startup',
  imports: [CommonModule, ReactiveFormsModule, BbSpinner, TranslatePipe],
  templateUrl: './startup.html',
  styleUrl: './startup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Startup implements SettingsTabComponent {
  private readonly formService = inject(GeneralSettingsFormService);
  private readonly serverStoreService = inject(ServerStoreService);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;

  public readonly hasDefaultServer = computed(() =>
    this.serverStoreService.servers().some((s) => s.auto_login),
  );

  public readonly showNoDefaultHostHint = computed(
    () => this.formService.openAtLoginValue() && !this.hasDefaultServer(),
  );
}
```

`notifications/notifications.ts`:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { NgSelectItem, SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, NgSelectComponent, ReactiveFormsModule, BbSpinner, TranslatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications implements SettingsTabComponent {
  private readonly translateService = inject(TranslateService);
  private readonly formService = inject(GeneralSettingsFormService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;

  public readonly toastPositions = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'top-left',
        label: this.translateService.instant('pages.settings.tab.general.position.top-left'),
      },
      {
        value: 'top-right',
        label: this.translateService.instant('pages.settings.tab.general.position.top-right'),
      },
      {
        value: 'bottom-right',
        label: this.translateService.instant('pages.settings.tab.general.position.bottom-right'),
      },
      {
        value: 'bottom-left',
        label: this.translateService.instant('pages.settings.tab.general.position.bottom-left'),
      },
    ];
  });
}
```

Split `general/general.scss` (the old file, `HEAD`) by which class each rule styles; copy a rule into a pane's scss only if that class appears in the pane's template (check with `grep -l`):

- `.bb-startup-grid ...` -> `startup/startup.scss`
- `.bb-select-selected-value-example` -> `general/general.scss`
- `.bb-option--master`, `.bb-notification-section*`, `.bb-notification-hint` -> `notifications/notifications.scss`
- `.bb-option__select` -> every pane scss whose template uses it (`grep -rn "bb-option__select" pages/settings/*/*.html`)

Panes with no scss rules need no `styleUrl` (drop the `styleUrl` line and the file for them).

- [ ] **Step 7: Build to find unresolved members and unused imports**

Run: `npx tsc -p packages/app/tsconfig.app.json --noEmit` then `cd packages/app && npx ng build --configuration development`
Expected: build succeeds. Fix every error by moving the named member into the pane whose template uses it (members used per template: General: `languages`, date format members, `icons`, `tokenGuideExpanded`, `toggleTokenGuide`, `resetCustomPattern`; Appearance: `families`, `modes`; Startup: `showNoDefaultHostHint`; Notifications: `toastPositions`) and remove any import reported as unused (NG8113).

- [ ] **Step 8: Port the old General spec**

The old `general/general.spec.ts` (503 lines at `HEAD`) is rewritten in four places. Use the old file as the source and move each `describe` block as listed, replacing `component.generalSettingsForm` with `service.form` (service spec) or leaving it (pane specs, where `generalSettingsForm` is still a pane member):

- Into `general-settings-form.service.spec.ts` (add after the existing tests, using `service.form`): `startup form controls`, `behavior form controls`, `notification form controls`, the `restores the disabled state of children when the stored master switch is off` test, `save`, `save with firstDayOfWeek`.
- Into `startup/startup.spec.ts`: `hasDefaultServer`, `showNoDefaultHostHint`. Provide `SettingsStateService` (mock with `registerSave`/`markDirty`), `ServerStoreService` (mock with a `servers` signal) and `DateFormatService`, as the old spec did, plus a real `GeneralSettingsFormService` in `providers`.
- Into `general/general.spec.ts` (rewritten): `behavior fieldset template` (the `#delete-torrent-on-duplicate` checks), `dateFormatPresets`, `isCustomDateFormat`, `customPatternPreview`, `resetCustomPattern`, `dateFormatTokenGuide`, `date format token guide table`, `date format custom pattern reset button`, `date format fieldset`, `firstDayOfWeekOptions`. Use the same `beforeEach` as the old spec (mocks for `SettingsStateService`, `ServerStoreService`, `DateFormatService`) with `GeneralSettingsFormService` listed in `providers`, and change `registerSave`-based tests to call through the form service.
- Into `appearance/appearance.spec.ts` and `notifications/notifications.spec.ts`: one smoke spec each: creates, and renders the expected fieldsets. For Notifications, assert two `fieldset.bb-fieldset` elements and the presence of `#notifications-os-enabled` and `#notifications-app-enabled`. For Appearance, assert one fieldset.

Each pane spec provides `GeneralSettingsFormService` (listed in `providers` of the TestBed) so the pane resolves it.

- [ ] **Step 9: Run the General specs**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/general-settings-form.service.spec.ts" --include "src/app/pages/settings/general/**/*.spec.ts" --include "src/app/pages/settings/appearance/**/*.spec.ts" --include "src/app/pages/settings/startup/**/*.spec.ts" --include "src/app/pages/settings/notifications/**/*.spec.ts"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npx prettier --write "packages/app/src/app/pages/settings/**/*.{ts,html,scss}"
git add -A packages/app/src
git commit -m "#353: split general settings into a form service and four panes"
```

(The page does not yet provide `GeneralSettingsFormService`; it is wired up in Task 7. The old modal still compiles until then only if it is not instantiated, which the type check in Step 7 confirms.)

---

### Task 6: Server settings form service, Polling pane and Path Mappings pane

**Files:**

- Create: `pages/settings/server-settings-form.service.ts`, `server-settings-form.service.spec.ts`, `pages/settings/polling/{polling.ts,polling.html,polling.spec.ts}`, `pages/settings/path-mappings/{path-mappings.ts,path-mappings.html,path-mappings.spec.ts}`
- Delete: `pages/settings/server/`
- (paths relative to `packages/app/src/app/`)

**Interfaces:**

- Consumes: `ServerSettingsService.reload()/save()`, `ServerStoreService.currentServerId`, `QbService.app.preferences(serverId)`, `SettingsStateService`.
- Produces: `ServerSettingsFormService` with `form` (the old `serverSettingsForm`), `defaultRemotePath: WritableSignal<string>`, `loaded: WritableSignal<boolean>`, `load(): Promise<void>`, `save(): Promise<void>`. Panes `Polling` (`app-polling`) and `PathMappings` (`app-path-mappings`) each exposing `serverSettingsForm` and `settingsLoaded`.

- [ ] **Step 1: Write the failing service spec**

`pages/settings/server-settings-form.service.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QbService } from '../../services/qb.service';
import { ServerSettingsService } from '../../services/server-settings.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SettingsStateService } from './settings-state.service';

describe('ServerSettingsFormService', () => {
  let service: ServerSettingsFormService;
  let currentServerId: ReturnType<typeof signal<string | null>>;
  let stateMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let serverSettingsMock: {
    reload: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  const settings = (foreground: number) => ({
    polling: { foreground, background: 5000 },
    pathMappings: [{ remote: '/downloads', local: 'C:\\dl' }],
  });

  const flush = async () => {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  };

  beforeEach(async () => {
    currentServerId = signal<string | null>('s1');
    stateMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    serverSettingsMock = {
      reload: vi.fn().mockResolvedValue(settings(2000)),
      save: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        ServerSettingsFormService,
        { provide: SettingsStateService, useValue: stateMock },
        { provide: ServerSettingsService, useValue: serverSettingsMock },
        { provide: ServerStoreService, useValue: { currentServerId } },
        {
          provide: QbService,
          useValue: { app: { preferences: vi.fn().mockResolvedValue({ save_path: '/data' }) } },
        },
      ],
    });
    service = TestBed.inject(ServerSettingsFormService);
    await flush();
  });

  it('registers one save function for the server form', () => {
    expect(stateMock.registerSave).toHaveBeenCalledWith('server', expect.any(Function));
  });

  it('loads the polling intervals and path mappings into the form', () => {
    expect(service.loaded()).toBe(true);
    expect(service.form.controls.polling.controls.foreground.value).toBe(2000);
    expect(service.form.controls.pathMappings.length).toBe(1);
    expect(service.form.controls.pathMappings.at(0).getRawValue()).toEqual({
      remote: '/downloads',
      local: 'C:\\dl',
    });
  });

  it('adds one empty mapping row when the server has no mappings', async () => {
    serverSettingsMock.reload.mockResolvedValue({ ...settings(2000), pathMappings: [] });

    await service.load();

    expect(service.form.controls.pathMappings.length).toBe(1);
    expect(service.form.controls.pathMappings.at(0).getRawValue()).toEqual({
      remote: null,
      local: '',
    });
  });

  it('exposes the default remote path of the server', () => {
    expect(service.defaultRemotePath()).toBe('/data');
  });

  it('marks the server form dirty when a control changes', () => {
    service.form.controls.polling.controls.foreground.setValue(3000);

    expect(stateMock.markDirty).toHaveBeenCalledWith('server', true);
  });

  it('save fills an empty remote path with the default remote path', async () => {
    service.form.controls.pathMappings.at(0).patchValue({ remote: null, local: 'D:\\x' });

    await service.save();

    expect(serverSettingsMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pathMappings: [{ remote: '/data', local: 'D:\\x' }],
      }),
    );
  });

  it('reloads and clears the dirty flag when the current server changes', async () => {
    serverSettingsMock.reload.mockResolvedValue(settings(4000));
    stateMock.markDirty.mockClear();

    currentServerId.set('s2');
    await flush();

    expect(service.form.controls.polling.controls.foreground.value).toBe(4000);
    expect(stateMock.markDirty).toHaveBeenLastCalledWith('server', false);
  });

  it('ignores the result of an outdated load when a newer one started', async () => {
    let resolveOld!: (value: unknown) => void;
    serverSettingsMock.reload
      .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
      .mockResolvedValueOnce(settings(9000));

    const first = service.load();
    const second = service.load();
    await second;
    resolveOld(settings(1000));
    await first;

    expect(service.form.controls.polling.controls.foreground.value).toBe(9000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/server-settings-form.service.spec.ts"`
Expected: FAIL (cannot resolve `./server-settings-form.service`).

- [ ] **Step 3: Implement the service**

The form definition, `save()` and the load logic are moved from the old `server/server.ts` (`git show HEAD:packages/app/src/app/pages/settings/server/server.ts`: `serverSettingsForm`, `save`, and the `tap` inside `settings$`); the code below is the result, adapted to the service:

```ts
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { from, switchMap } from 'rxjs';
import { ServerSettings } from '../../models/server-settings.model';
import { QbService } from '../../services/qb.service';
import { ServerSettingsService } from '../../services/server-settings.service';
import { ServerStoreService } from '../../services/server-store.service';
import { SettingsStateService } from './settings-state.service';

/**
 * Owns the per-server form shared by the Polling and Path Mappings panes. It reloads (and
 * clears its dirty flag) whenever the current server changes.
 */
@Injectable()
export class ServerSettingsFormService {
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly stateService = inject(SettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly destroyRef = inject(DestroyRef);

  private loadToken = 0;

  public readonly defaultRemotePath = signal('');
  public readonly loaded = signal(false);

  public readonly form = new FormGroup({
    polling: new FormGroup({
      foreground: new FormControl(2000, { nonNullable: true }),
      background: new FormControl(5000, { nonNullable: true }),
    }),
    pathMappings: new FormArray([
      new FormGroup({
        remote: new FormControl<string | null>(null),
        local: new FormControl('', { nonNullable: true }),
      }),
    ]),
  });

  constructor() {
    this.stateService.registerSave('server', () => this.save());

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('server', true));

    toObservable(this.serverStoreService.currentServerId)
      .pipe(
        switchMap(() => from(this.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public async load(): Promise<void> {
    const token = ++this.loadToken;
    const settings: ServerSettings = await this.serverSettingsService.reload();
    if (token !== this.loadToken) return;

    const { pathMappings, ...rest } = settings;
    this.form.patchValue(rest, { emitEvent: false });

    const mappingsArray = this.form.controls.pathMappings;
    mappingsArray.clear({ emitEvent: false });
    const mappings = pathMappings?.length ? pathMappings : [{ remote: '', local: '' }];
    mappings.forEach((mapping) => {
      mappingsArray.push(
        new FormGroup({
          remote: new FormControl<string | null>(mapping.remote || null),
          local: new FormControl(mapping.local, { nonNullable: true }),
        }),
        { emitEvent: false },
      );
    });

    this.loaded.set(true);
    this.stateService.markDirty('server', false);
    this.loadDefaultRemotePath();
  }

  public async save(): Promise<void> {
    const raw = this.form.getRawValue() as ServerSettings;
    const settings: ServerSettings = {
      ...raw,
      pathMappings: raw.pathMappings.map((m) => ({
        remote: m.remote || this.defaultRemotePath(),
        local: m.local,
      })),
    };
    await this.serverSettingsService.save(settings);
  }

  private loadDefaultRemotePath(): void {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    this.qbService.app
      .preferences(serverId)
      .then((prefs) => {
        if (prefs.save_path) this.defaultRemotePath.set(prefs.save_path);
      })
      .catch(() => {});
  }
}
```

- [ ] **Step 4: Run the service spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/server-settings-form.service.spec.ts"`
Expected: PASS (8 tests).

- [ ] **Step 5: Build the two pane templates and components**

From `packages/app/src/app/pages/settings`, using the original template from `HEAD` (do this before deleting `server/`):

```bash
ORIG=$(mktemp)
git show HEAD:packages/app/src/app/pages/settings/server/server.html > "$ORIG"
grep -n "ng-template\|backgroundPollingPopover\|pathMappingsPopover" "$ORIG"
```

The `grep` shows which fieldset references each popover template. Then (line ranges verified at `HEAD`: Polling fieldset 9-127, Path Mappings fieldset 129-240):

```bash
mkdir -p polling path-mappings
{
cat <<'EOF'
@if (settingsLoaded()) {
  <form [formGroup]="serverSettingsForm" class="bb-cards">
EOF
sed -n '9,127p' "$ORIG"
cat <<'EOF'
  </form>
} @else {
  <app-bb-spinner></app-bb-spinner>
}

EOF
# the <ng-template #backgroundPollingPopover> block (lines from the grep above)
} > polling/polling.html

{
cat <<'EOF'
@if (settingsLoaded()) {
  <form [formGroup]="serverSettingsForm" class="bb-cards">
EOF
sed -n '129,240p' "$ORIG" | sed 's#<fieldset class="bb-fieldset">#<fieldset class="bb-fieldset bb-card--wide">#'
cat <<'EOF'
  </form>
} @else {
  <app-bb-spinner></app-bb-spinner>
}

EOF
# the <ng-template #pathMappingsPopover> block (lines from the grep above)
} > path-mappings/path-mappings.html
rm "$ORIG"
```

Append each `<ng-template ...>...</ng-template>` block to the pane whose fieldset references it (the grep output tells you which; `backgroundPollingPopover` belongs to Polling, `pathMappingsPopover` to Path Mappings). Delete the old description row (`<div class="row"><div class="col-12">...description...</div></div>`) - it is not copied by these ranges.

`polling/polling.ts`:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { ServerSettingsFormService } from '../server-settings-form.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-polling',
  imports: [CommonModule, ReactiveFormsModule, NgbTooltip, BbSpinner, BbPopover, TranslatePipe],
  templateUrl: './polling.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Polling implements SettingsTabComponent {
  private readonly formService = inject(ServerSettingsFormService);

  public readonly serverSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
}
```

`path-mappings/path-mappings.ts` (the row-manipulating methods `addPathMapping`, `removePathMapping`, `testMapping`, `onBrowse` and the `icons` map are moved unchanged from the old `Server` class; they use `this.pathMappings`, which now reads the form service):

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, NgZone, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faFolderOpen,
  faMinus,
  faPlus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { ElectronService } from '../../../services/electron.service';
import { ServerSettingsFormService } from '../server-settings-form.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-path-mappings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    NgbTooltip,
    BbSpinner,
    BbPopover,
    TranslatePipe,
    SavePathSelect,
    BbBtnContent,
  ],
  templateUrl: './path-mappings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathMappings implements SettingsTabComponent {
  private readonly electronService = inject(ElectronService);
  private readonly zone = inject(NgZone);
  private readonly formService = inject(ServerSettingsFormService);

  public readonly serverSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
  public readonly defaultRemotePath = this.formService.defaultRemotePath;

  public icons: Record<string, IconDefinition> = {
    faPlus,
    faMinus,
    faTriangleExclamation,
    faFolderOpen,
  };

  get pathMappings(): FormArray {
    return this.serverSettingsForm.controls.pathMappings;
  }

  // addPathMapping, testMapping, removePathMapping, onBrowse: moved unchanged from the old
  // Server class (find them by name in `git show HEAD:.../server/server.ts`).
}
```

Then delete the old directory: `git rm -r pages/settings/server`.

- [ ] **Step 6: Port the old Server spec**

Move the `server.spec.ts` (143 lines at `HEAD`) tests: form-loading and `save` tests that exercised the old component go into the service spec (already covered by the new tests above; add any that assert behavior not listed there), and the path-mapping row tests (`addPathMapping`, `removePathMapping`, `onBrowse`) go into `path-mappings/path-mappings.spec.ts`. Add one smoke test to `polling/polling.spec.ts`: creates and renders the Polling fieldset. Each pane spec lists `ServerSettingsFormService` in `providers`, with `ServerSettingsService`, `ServerStoreService`, `QbService` and `SettingsStateService` mocked as in the new service spec, and `ElectronService`/`NgZone` as the old spec provided them.

- [ ] **Step 7: Build, run the specs, commit**

```bash
npx tsc -p packages/app/tsconfig.app.json --noEmit
cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/server-settings-form.service.spec.ts" --include "src/app/pages/settings/polling/**/*.spec.ts" --include "src/app/pages/settings/path-mappings/**/*.spec.ts"
cd ../.. && npx prettier --write "packages/app/src/app/pages/settings/**/*.{ts,html,scss}"
git add -A packages/app/src
git commit -m "#353: split server settings into a form service and two panes"
```

Expected: no type errors; specs PASS.

---

### Task 7: App settings page, routes and command handling

**Files:**

- Create: `pages/settings/settings-page.ts`, `settings-page.html`, `settings-page.config.ts`, `settings-page.spec.ts`
- Modify: `app.routes.ts`, `models/command.model.ts`, `services/ui-command-handler.service.ts`, `services/ui-command-handler.service.spec.ts`, `pages/settings/settings.interface.ts`
- Delete: `pages/settings/settings.ts`, `settings.html`, `settings.scss`, `settings.spec.ts`
- (paths relative to `packages/app/src/app/`)

**Interfaces:**

- Consumes: `SettingsShell`, `SettingsPageConfig`, `SettingsStateService`, `GeneralSettingsFormService.discard()`, `ServerSettingsFormService.load()`, `unsavedChangesGuard`, `UnsavedChangesGuardable`.
- Produces: `SettingsPage` (`basePath = '/pages/settings'`, `stateService`, `config`, `activePaneId`, `paneVersion`, `onSave()`, `onDiscard()`, `onBack()`); command `{ type: 'UI_OPEN_SETTINGS'; pane?: SettingsPaneId }`.

- [ ] **Step 1: Write the page config**

`pages/settings/settings-page.config.ts`:

```ts
import {
  faBell,
  faGear,
  faPalette,
  faPowerOff,
  faRightLeft,
  faRotate,
  faTableList,
  faWindowMinimize,
} from '@fortawesome/free-solid-svg-icons';
import { SettingsPageConfig } from '../settings-shell/settings-shell.model';

export const SETTINGS_PAGE_BASE_PATH = '/pages/settings';

export const SETTINGS_PAGE_CONFIG: SettingsPageConfig = {
  basePath: SETTINGS_PAGE_BASE_PATH,
  titleKey: 'pages.settings.title',
  footerNoteKey: 'pages.settings.nav.footer-note',
  groups: [
    {
      labelKey: 'pages.settings.nav.group.application',
      panes: [
        {
          id: 'general',
          labelKey: 'pages.settings.tab.general.title',
          descriptionKey: 'pages.settings.tab.general.description',
          icon: faGear,
          formId: 'general',
          loadComponent: () => import('./general/general').then((m) => m.General),
        },
        {
          id: 'appearance',
          labelKey: 'pages.settings.tab.general.label.appearance',
          descriptionKey: 'pages.settings.nav.pane.appearance.description',
          icon: faPalette,
          formId: 'general',
          loadComponent: () => import('./appearance/appearance').then((m) => m.Appearance),
        },
        {
          id: 'startup',
          labelKey: 'pages.settings.tab.general.label.startup',
          descriptionKey: 'pages.settings.nav.pane.startup.description',
          icon: faPowerOff,
          formId: 'general',
          loadComponent: () => import('./startup/startup').then((m) => m.Startup),
        },
        {
          id: 'notifications',
          labelKey: 'pages.settings.tab.general.label.notifications',
          descriptionKey: 'pages.settings.nav.pane.notifications.description',
          icon: faBell,
          formId: 'general',
          loadComponent: () => import('./notifications/notifications').then((m) => m.Notifications),
        },
      ],
    },
    {
      labelKey: 'pages.settings.nav.group.server',
      panes: [
        {
          id: 'polling',
          labelKey: 'pages.settings.tab.server.label.polling',
          descriptionKey: 'pages.settings.nav.pane.polling.description',
          icon: faRotate,
          formId: 'server',
          loadComponent: () => import('./polling/polling').then((m) => m.Polling),
        },
        {
          id: 'path-mappings',
          labelKey: 'pages.settings.tab.server.label.path-mappings',
          descriptionKey: 'pages.settings.nav.pane.path-mappings.description',
          icon: faRightLeft,
          formId: 'server',
          loadComponent: () => import('./path-mappings/path-mappings').then((m) => m.PathMappings),
        },
      ],
    },
    {
      labelKey: 'pages.settings.nav.group.interface',
      panes: [
        {
          id: 'torrent-list-grid',
          labelKey: 'pages.settings.tab.torrent-list-grid.title',
          descriptionKey: 'pages.settings.tab.torrent-list-grid.description',
          icon: faTableList,
          formId: 'torrent-list-grid',
          loadComponent: () =>
            import('./torrent-list-grid/torrent-list-grid').then((m) => m.TorrentListGrid),
        },
        {
          id: 'status-bar',
          labelKey: 'pages.settings.tab.status-bar.title',
          descriptionKey: 'pages.settings.tab.status-bar.description',
          icon: faWindowMinimize,
          formId: 'status-bar',
          loadComponent: () => import('./status-bar/status-bar').then((m) => m.StatusBar),
        },
      ],
    },
  ],
};
```

- [ ] **Step 2: Write the failing page spec**

`pages/settings/settings-page.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { GeneralSettingsFormService } from './general-settings-form.service';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SettingsPage } from './settings-page';
import { SETTINGS_PAGE_CONFIG } from './settings-page.config';
import { SettingsStateService } from './settings-state.service';
import { SETTINGS_PANE_IDS } from './settings.interface';

describe('SettingsPage', () => {
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let generalForm: { discard: ReturnType<typeof vi.fn> };
  let serverForm: { load: ReturnType<typeof vi.fn> };
  let state: SettingsStateService;

  const createPage = (pane: string | null): SettingsPage => {
    paramMap$.next(convertToParamMap(pane ? { pane } : {}));
    return TestBed.runInInjectionContext(() => new SettingsPage());
  };

  beforeEach(() => {
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn().mockResolvedValue(true);
    toast = { success: vi.fn(), danger: vi.fn() };
    generalForm = { discard: vi.fn().mockResolvedValue(undefined) };
    serverForm = { load: vi.fn().mockResolvedValue(undefined) };
    state = new SettingsStateService();

    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsStateService, useValue: state },
        { provide: GeneralSettingsFormService, useValue: generalForm },
        { provide: ServerSettingsFormService, useValue: serverForm },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('config lists exactly the pane ids of the id union', () => {
    const configured = SETTINGS_PAGE_CONFIG.groups.flatMap((g) => g.panes.map((p) => p.id));
    expect(configured.sort()).toEqual([...SETTINGS_PANE_IDS].sort());
  });

  it('uses the pane from the route', () => {
    const page = createPage('appearance');

    expect(page.activePaneId()).toBe('appearance');
  });

  it('falls back to the first pane and rewrites the URL when the pane is unknown', () => {
    const page = createPage('nope');
    TestBed.tick();

    expect(page.activePaneId()).toBe('general');
    expect(navigate).toHaveBeenCalledWith(['/pages/settings', 'general'], { replaceUrl: true });
  });

  it('does not rewrite the URL when the pane is valid', () => {
    createPage('startup');
    TestBed.tick();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('save persists every dirty form and shows a success toast', async () => {
    const page = createPage('general');
    const saveAll = vi.spyOn(state, 'saveAll').mockResolvedValue(undefined);

    await page.onSave();

    expect(saveAll).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      'pages.settings.success.saved',
      'pages.settings.success.saved-title',
    );
  });

  it('save shows the raw error in a danger toast and keeps the page dirty on failure', async () => {
    const page = createPage('general');
    vi.spyOn(state, 'saveAll').mockRejectedValue(new Error('disk full'));
    state.markDirty('general', true);

    await page.onSave();

    expect(toast.danger).toHaveBeenCalledWith(
      'disk full',
      'pages.settings.error.save-failed-title',
    );
    expect(state.isDirty()).toBe(true);
  });

  it('discard reloads both forms, clears dirty and rebuilds the panes', async () => {
    const page = createPage('general');
    state.markDirty('general', true);
    const before = page.paneVersion();

    await page.onDiscard();

    expect(generalForm.discard).toHaveBeenCalledOnce();
    expect(serverForm.load).toHaveBeenCalledOnce();
    expect(state.isDirty()).toBe(false);
    expect(page.paneVersion()).toBe(before + 1);
  });

  it('back navigates to the torrent list', () => {
    const page = createPage('general');

    page.onBack();

    expect(navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
  });

  it('exposes the base path and state service the leave guard needs', () => {
    const page = createPage('general');

    expect(page.basePath).toBe('/pages/settings');
    expect(page.stateService).toBe(state);
  });
});
```

The translate mock note: `TranslateService.instant` in the global test providers returns the key itself, which is what the toast assertions rely on.

- [ ] **Step 3: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/settings-page.spec.ts"`
Expected: FAIL (cannot resolve `./settings-page`).

- [ ] **Step 4: Implement the page**

`pages/settings/settings-page.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { UnsavedChangesGuardable } from '../../guards/unsaved-changes.guard';
import { ToastService } from '../../services/toast.service';
import { SettingsShell } from '../settings-shell/settings-shell';
import { GeneralSettingsFormService } from './general-settings-form.service';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SETTINGS_PAGE_BASE_PATH, SETTINGS_PAGE_CONFIG } from './settings-page.config';
import { SettingsStateService } from './settings-state.service';
import { SETTINGS_PANE_IDS, SettingsPaneId } from './settings.interface';

@Component({
  selector: 'app-settings-page',
  imports: [SettingsShell],
  providers: [SettingsStateService, GeneralSettingsFormService, ServerSettingsFormService],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements UnsavedChangesGuardable {
  public readonly basePath = SETTINGS_PAGE_BASE_PATH;
  public readonly config = SETTINGS_PAGE_CONFIG;
  public readonly stateService = inject(SettingsStateService);

  private readonly generalForm = inject(GeneralSettingsFormService);
  private readonly serverForm = inject(ServerSettingsFormService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly paneVersion = signal(0);

  private readonly paneParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('pane'))), {
    initialValue: null,
  });

  public readonly activePaneId = computed<SettingsPaneId>(() => {
    const id = this.paneParam();
    return SETTINGS_PANE_IDS.find((paneId) => paneId === id) ?? SETTINGS_PANE_IDS[0];
  });

  constructor() {
    // An unknown or missing :pane lands on the first pane, with the URL corrected to match.
    effect(() => {
      if (this.paneParam() !== this.activePaneId()) {
        void this.router.navigate([this.basePath, this.activePaneId()], { replaceUrl: true });
      }
    });
  }

  public async onSave(): Promise<void> {
    try {
      await this.stateService.saveAll();
      this.toastService.success(
        this.translateService.instant('pages.settings.success.saved'),
        this.translateService.instant('pages.settings.success.saved-title'),
      );
    } catch (err: unknown) {
      const message =
        (err instanceof Error ? err.message : undefined) ??
        this.translateService.instant('pages.settings.error.save-failed');
      this.toastService.danger(
        message,
        this.translateService.instant('pages.settings.error.save-failed-title'),
      );
    }
  }

  public async onDiscard(): Promise<void> {
    await Promise.all([this.generalForm.discard(), this.serverForm.load()]);
    this.stateService.resetDirty();
    // Panes that own their form (grid, status bar) re-read their persisted values on rebuild.
    this.paneVersion.update((version) => version + 1);
  }

  public onBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }
}
```

`pages/settings/settings-page.html`:

```html
<app-settings-shell
  [config]="config"
  [activePaneId]="activePaneId()"
  [isDirty]="stateService.isDirty()"
  [dirtyMap]="stateService.isDirtyMap()"
  [paneVersion]="paneVersion()"
  (save)="onSave()"
  (discard)="onDiscard()"
  (back)="onBack()"
/>
```

- [ ] **Step 5: Run the page spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/settings-page.spec.ts"`
Expected: PASS (9 tests).

- [ ] **Step 6: Add the route**

Replace `packages/app/src/app/app.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

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
      { path: 'settings', pathMatch: 'full', redirectTo: 'settings/general' },
      {
        path: 'settings/:pane',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((mod) => mod.SettingsPage),
        canDeactivate: [unsavedChangesGuard],
      },
      // QBITTORRENT_ROUTES
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
```

(`// QBITTORRENT_ROUTES` is replaced in Task 8 Step 6; remove the comment there.)

- [ ] **Step 7: Update the command model and the handler**

In `models/command.model.ts` change the import and the two members:

```ts
import { SettingsPaneId } from '../pages/settings/settings.interface';
```

```ts
  | { type: 'UI_OPEN_SETTINGS'; pane?: SettingsPaneId }
```

(`UI_OPEN_QB_SETTINGS` is changed in Task 8.)

In `services/ui-command-handler.service.ts` replace the `UI_OPEN_SETTINGS` case (currently opening the modal) with:

```ts
        case 'UI_OPEN_SETTINGS': {
          // Navigating would tear down an open dialog and whatever unsaved state it holds.
          if (this.modalService.hasOpenModals()) break;
          await this.router.navigate(['/pages', 'settings', command.pane ?? 'general']);
          break;
        }
```

- [ ] **Step 8: Update the handler spec**

In `services/ui-command-handler.service.spec.ts`: add `hasOpenModals: vi.fn().mockReturnValue(false)` to `mockModalService` (next to `activeInstances`/`open`), then replace the test `should open Settings modal for UI_OPEN_SETTINGS` with:

```ts
it('navigates to the default settings pane for UI_OPEN_SETTINGS', async () => {
  commands$.next({ type: 'UI_OPEN_SETTINGS' });
  await flushPromises();

  expect(routerNavigate).toHaveBeenCalledWith(['/pages', 'settings', 'general']);
  expect(mockModalService.open).not.toHaveBeenCalled();
});

it('navigates to the requested pane for UI_OPEN_SETTINGS', async () => {
  commands$.next({ type: 'UI_OPEN_SETTINGS', pane: 'notifications' });
  await flushPromises();

  expect(routerNavigate).toHaveBeenCalledWith(['/pages', 'settings', 'notifications']);
});

it('ignores UI_OPEN_SETTINGS while a modal is open', async () => {
  mockModalService.hasOpenModals.mockReturnValue(true);

  commands$.next({ type: 'UI_OPEN_SETTINGS' });
  await flushPromises();

  expect(routerNavigate).not.toHaveBeenCalled();
});
```

- [ ] **Step 9: Delete the old Settings modal and its leftovers**

```bash
git rm packages/app/src/app/pages/settings/settings.ts packages/app/src/app/pages/settings/settings.html packages/app/src/app/pages/settings/settings.scss packages/app/src/app/pages/settings/settings.spec.ts
```

In `pages/settings/settings.interface.ts` delete the transitional `SettingsTabId` alias and the `Tab` interface (and the now-unused `Type` import); keep `SettingsTabComponent`. Fix any remaining reference reported by `npx tsc -p packages/app/tsconfig.app.json --noEmit` (the six unchanged panes import `SettingsStateService` and `SettingsTabComponent`, which still exist).

- [ ] **Step 10: Run the affected specs and type check**

```bash
npx tsc -p packages/app/tsconfig.app.json --noEmit
cd packages/app && npx ng test --watch=false --include "src/app/pages/settings/**/*.spec.ts" --include "src/app/services/ui-command-handler.service.spec.ts"
```

Expected: no type errors; PASS.

- [ ] **Step 11: Commit**

```bash
npx prettier --write "packages/app/src/app/pages/settings/**/*.{ts,html,scss}" packages/app/src/app/app.routes.ts
git add -A packages/app/src
git commit -m "#353: add the app settings page and route"
```

---

### Task 8: qBittorrent settings page, route and command handling

**Files:**

- Create: `pages/qb-settings/qb-settings-page.ts`, `qb-settings-page.html`, `qb-settings-page.config.ts`, `qb-settings-page.spec.ts`
- Modify: `app.routes.ts`, `models/command.model.ts`, `services/ui-command-handler.service.ts`, `services/ui-command-handler.service.spec.ts`, `pages/qb-settings/qb-settings.interface.ts`
- Delete: `pages/qb-settings/qb-settings.ts`, `qb-settings.html`, `qb-settings.scss`, `qb-settings.spec.ts`
- (paths relative to `packages/app/src/app/`)

**Interfaces:**

- Consumes: everything from Task 7's shape, plus `QbService.app.preferences(serverId)`, `ServerStoreService.currentServerId`/`currentServer`, `QbSettingsStateService.setPreferences/preferences`.
- Produces: `QbSettingsPage` (`basePath = '/pages/qb-settings'`, `stateService`, `status`, `paneVersion`, `onSave()`, `onDiscard()`, `onRetry()`, `onBack()`); command `{ type: 'UI_OPEN_QB_SETTINGS'; pane?: QbSettingsPaneId }`.

- [ ] **Step 1: Write the page config**

`pages/qb-settings/qb-settings-page.config.ts`:

```ts
import { faGauge, faHardDrive, faListOl, faPercent } from '@fortawesome/free-solid-svg-icons';
import { SettingsPageConfig } from '../settings-shell/settings-shell.model';

export const QB_SETTINGS_PAGE_BASE_PATH = '/pages/qb-settings';

export const QB_SETTINGS_PAGE_CONFIG: SettingsPageConfig = {
  basePath: QB_SETTINGS_PAGE_BASE_PATH,
  titleKey: 'pages.qb-settings.title',
  footerNoteKey: 'pages.qb-settings.nav.footer-note',
  groups: [
    {
      labelKey: 'pages.qb-settings.nav.group.preferences',
      panes: [
        {
          id: 'bandwidth',
          labelKey: 'pages.qb-settings.tab.bandwidth.title',
          descriptionKey: 'pages.qb-settings.tab.bandwidth.description',
          icon: faGauge,
          formId: 'bandwidth',
          loadComponent: () => import('./bandwidth/bandwidth').then((m) => m.Bandwidth),
        },
        {
          id: 'storage',
          labelKey: 'pages.qb-settings.tab.storage.title',
          descriptionKey: 'pages.qb-settings.tab.storage.description',
          icon: faHardDrive,
          formId: 'storage',
          loadComponent: () => import('./storage/storage').then((m) => m.Storage),
        },
        {
          id: 'queue-limits',
          labelKey: 'pages.qb-settings.tab.queue-limits.title',
          descriptionKey: 'pages.qb-settings.tab.queue-limits.description',
          icon: faListOl,
          formId: 'queue-limits',
          loadComponent: () => import('./queue-limits/queue-limits').then((m) => m.QueueLimits),
        },
        {
          id: 'seeding-ratios',
          labelKey: 'pages.qb-settings.tab.seeding-ratios.title',
          descriptionKey: 'pages.qb-settings.tab.seeding-ratios.description',
          icon: faPercent,
          formId: 'seeding-ratios',
          loadComponent: () =>
            import('./seeding-ratios/seeding-ratios').then((m) => m.SeedingRatios),
        },
      ],
    },
  ],
};
```

- [ ] **Step 2: Write the failing page spec**

`pages/qb-settings/qb-settings-page.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettingsPage } from './qb-settings-page';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QB_SETTINGS_TAB_IDS } from './qb-settings.interface';

describe('QbSettingsPage', () => {
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let preferences: ReturnType<typeof vi.fn>;
  let currentServerId: ReturnType<typeof signal<string | null>>;
  let state: QbSettingsStateService;

  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  const createPage = async (pane: string | null = 'bandwidth'): Promise<QbSettingsPage> => {
    paramMap$.next(convertToParamMap(pane ? { pane } : {}));
    const page = TestBed.runInInjectionContext(() => new QbSettingsPage());
    await page.ngOnInit();
    return page;
  };

  beforeEach(() => {
    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn().mockResolvedValue(true);
    toast = { success: vi.fn(), danger: vi.fn() };
    preferences = vi.fn().mockResolvedValue({ save_path: '/data' });
    currentServerId = signal<string | null>('s1');
    state = new QbSettingsStateService();

    TestBed.configureTestingModule({
      providers: [
        { provide: QbSettingsStateService, useValue: state },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: ToastService, useValue: toast },
        { provide: QbService, useValue: { app: { preferences } } },
        {
          provide: ServerStoreService,
          useValue: { currentServerId, currentServer: signal({ id: 's1', name: 'Home' }) },
        },
      ],
    });
  });

  it('loads the preferences before it reports ready', async () => {
    const page = await createPage();

    expect(preferences).toHaveBeenCalledWith('s1');
    expect(state.preferences()).toEqual({ save_path: '/data' });
    expect(page.status()).toBe('ready');
  });

  it('is loading until the preferences arrive', () => {
    preferences.mockReturnValue(new Promise(() => {}));
    paramMap$.next(convertToParamMap({ pane: 'bandwidth' }));
    const page = TestBed.runInInjectionContext(() => new QbSettingsPage());
    void page.ngOnInit();

    expect(page.status()).toBe('loading');
  });

  it('shows the error state when the preferences fail to load, and Retry recovers', async () => {
    preferences.mockRejectedValueOnce(new Error('offline'));
    const page = await createPage();
    expect(page.status()).toBe('error');

    await page.onRetry();

    expect(page.status()).toBe('ready');
  });

  it('shows the error state when no server is selected', async () => {
    currentServerId.set(null);

    const page = await createPage();

    expect(page.status()).toBe('error');
    expect(preferences).not.toHaveBeenCalled();
  });

  it('falls back to the first pane and rewrites the URL when the pane is unknown', async () => {
    const page = await createPage('nope');
    TestBed.tick();

    expect(page.activePaneId()).toBe(QB_SETTINGS_TAB_IDS[0]);
    expect(navigate).toHaveBeenCalledWith(['/pages/qb-settings', 'bandwidth'], {
      replaceUrl: true,
    });
  });

  it('refetches preferences after save so a later discard never shows stale values', async () => {
    const page = await createPage();
    vi.spyOn(state, 'saveAll').mockResolvedValue(undefined);
    preferences.mockClear();
    preferences.mockResolvedValue({ save_path: '/new' });
    const before = page.paneVersion();

    await page.onSave();

    expect(preferences).toHaveBeenCalledOnce();
    expect(state.preferences()).toEqual({ save_path: '/new' });
    expect(page.paneVersion()).toBe(before + 1);
    expect(toast.success).toHaveBeenCalledWith(
      'pages.qb-settings.success.saved',
      'pages.qb-settings.success.saved-title',
    );
  });

  it('save failure shows the raw error, keeps the page dirty and does not refetch', async () => {
    const page = await createPage();
    vi.spyOn(state, 'saveAll').mockRejectedValue(new Error('rejected by qBittorrent'));
    state.markDirty('storage', true);
    preferences.mockClear();

    await page.onSave();

    expect(toast.danger).toHaveBeenCalledWith(
      'rejected by qBittorrent',
      'pages.qb-settings.error.save-failed-title',
    );
    expect(preferences).not.toHaveBeenCalled();
    expect(state.isDirty()).toBe(true);
  });

  it('refetches preferences on discard, clears dirty and rebuilds the panes', async () => {
    const page = await createPage();
    state.markDirty('bandwidth', true);
    preferences.mockClear();
    const before = page.paneVersion();

    await page.onDiscard();

    expect(preferences).toHaveBeenCalledOnce();
    expect(state.isDirty()).toBe(false);
    expect(page.paneVersion()).toBe(before + 1);
  });

  it('back navigates to the torrent list', async () => {
    const page = await createPage();
    await flush();

    page.onBack();

    expect(navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
  });

  it('exposes the base path and state service the leave guard needs', async () => {
    const page = await createPage();

    expect(page.basePath).toBe('/pages/qb-settings');
    expect(page.stateService).toBe(state);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/qb-settings/qb-settings-page.spec.ts"`
Expected: FAIL (cannot resolve `./qb-settings-page`).

- [ ] **Step 4: Implement the page**

`pages/qb-settings/qb-settings-page.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { UnsavedChangesGuardable } from '../../guards/unsaved-changes.guard';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { SettingsShell } from '../settings-shell/settings-shell';
import { SettingsPageStatus } from '../settings-shell/settings-shell.model';
import { QB_SETTINGS_PAGE_BASE_PATH, QB_SETTINGS_PAGE_CONFIG } from './qb-settings-page.config';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QB_SETTINGS_TAB_IDS, QbSettingsPaneId } from './qb-settings.interface';

@Component({
  selector: 'app-qb-settings-page',
  imports: [SettingsShell],
  providers: [QbSettingsStateService],
  templateUrl: './qb-settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QbSettingsPage implements OnInit, UnsavedChangesGuardable {
  public readonly basePath = QB_SETTINGS_PAGE_BASE_PATH;
  public readonly config = QB_SETTINGS_PAGE_CONFIG;
  public readonly stateService = inject(QbSettingsStateService);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);

  public readonly currentServer = this.serverStoreService.currentServer;
  public readonly status = signal<SettingsPageStatus>('loading');
  public readonly paneVersion = signal(0);

  private readonly paneParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('pane'))), {
    initialValue: null,
  });

  public readonly activePaneId = computed<QbSettingsPaneId>(() => {
    const id = this.paneParam();
    return QB_SETTINGS_TAB_IDS.find((paneId) => paneId === id) ?? QB_SETTINGS_TAB_IDS[0];
  });

  constructor() {
    // An unknown or missing :pane lands on the first pane, with the URL corrected to match.
    effect(() => {
      if (this.paneParam() !== this.activePaneId()) {
        void this.router.navigate([this.basePath, this.activePaneId()], { replaceUrl: true });
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    await this.loadPreferences();
  }

  public async onRetry(): Promise<void> {
    this.status.set('loading');
    await this.loadPreferences();
  }

  public async onSave(): Promise<void> {
    try {
      await this.stateService.saveAll();
    } catch (err: unknown) {
      const message =
        (err instanceof Error ? err.message : undefined) ??
        this.translateService.instant('pages.qb-settings.error.save-failed');
      this.toastService.danger(
        message,
        this.translateService.instant('pages.qb-settings.error.save-failed-title'),
      );
      return;
    }

    this.toastService.success(
      this.translateService.instant('pages.qb-settings.success.saved'),
      this.translateService.instant('pages.qb-settings.success.saved-title'),
    );
    // Panes read preferences once when built, so rebuild them from the saved values.
    await this.loadPreferences();
  }

  public async onDiscard(): Promise<void> {
    this.stateService.resetDirty();
    await this.loadPreferences();
  }

  public onBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }

  private async loadPreferences(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) {
      this.status.set('error');
      return;
    }

    try {
      this.stateService.setPreferences(await this.qbService.app.preferences(serverId));
      this.paneVersion.update((version) => version + 1);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
```

`pages/qb-settings/qb-settings-page.html`:

```html
<app-settings-shell
  [config]="config"
  [activePaneId]="activePaneId()"
  [status]="status()"
  [errorKey]="'pages.qb-settings.error.load-failed'"
  [subtitle]="currentServer()?.name ?? null"
  [isDirty]="stateService.isDirty()"
  [dirtyMap]="stateService.isDirtyMap()"
  [paneVersion]="paneVersion()"
  (save)="onSave()"
  (discard)="onDiscard()"
  (back)="onBack()"
  (retry)="onRetry()"
/>
```

Note on `paneVersion`: `loadPreferences` bumps it on every successful load. The first load moves it from 0 to 1 before any pane exists, which is harmless, and every later load (save, discard, retry) rebuilds the panes from fresh preferences.

- [ ] **Step 5: Run the spec to verify it passes**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/pages/qb-settings/qb-settings-page.spec.ts"`
Expected: PASS (10 tests). The "is loading until the preferences arrive" test leaves a pending promise by design; it does not need cleanup.

- [ ] **Step 6: Add the route, command and handler changes**

In `app.routes.ts` replace the `// QBITTORRENT_ROUTES` comment with:

```ts
      { path: 'qb-settings', pathMatch: 'full', redirectTo: 'qb-settings/bandwidth' },
      {
        path: 'qb-settings/:pane',
        loadComponent: () =>
          import('./pages/qb-settings/qb-settings-page').then((mod) => mod.QbSettingsPage),
        canDeactivate: [unsavedChangesGuard],
      },
```

In `models/command.model.ts` add the import and change the member:

```ts
import { QbSettingsPaneId } from '../pages/qb-settings/qb-settings.interface';
```

```ts
  | { type: 'UI_OPEN_QB_SETTINGS'; pane?: QbSettingsPaneId }
```

In `services/ui-command-handler.service.ts` replace the `UI_OPEN_QB_SETTINGS` case with:

```ts
        case 'UI_OPEN_QB_SETTINGS': {
          if (this.modalService.hasOpenModals()) break;
          await this.router.navigate(['/pages', 'qb-settings', command.pane ?? 'bandwidth']);
          break;
        }
```

- [ ] **Step 7: Update the handler spec**

In `services/ui-command-handler.service.spec.ts` replace `should open QbSettings modal for UI_OPEN_QB_SETTINGS` with:

```ts
it('navigates to the default qBittorrent settings pane for UI_OPEN_QB_SETTINGS', async () => {
  commands$.next({ type: 'UI_OPEN_QB_SETTINGS' });
  await flushPromises();

  expect(routerNavigate).toHaveBeenCalledWith(['/pages', 'qb-settings', 'bandwidth']);
  expect(mockModalService.open).not.toHaveBeenCalled();
});

it('navigates to the requested pane for UI_OPEN_QB_SETTINGS', async () => {
  commands$.next({ type: 'UI_OPEN_QB_SETTINGS', pane: 'storage' });
  await flushPromises();

  expect(routerNavigate).toHaveBeenCalledWith(['/pages', 'qb-settings', 'storage']);
});

it('ignores UI_OPEN_QB_SETTINGS while a modal is open', async () => {
  mockModalService.hasOpenModals.mockReturnValue(true);

  commands$.next({ type: 'UI_OPEN_QB_SETTINGS' });
  await flushPromises();

  expect(routerNavigate).not.toHaveBeenCalled();
});
```

The "command serialization" test `should still process a later command after an earlier one throws` uses `UI_OPEN_QB_SETTINGS` as its second command and expects `open` to be called twice; change that second command to `{ type: 'UI_OPEN_ABOUT' }` so it still opens a modal.

- [ ] **Step 8: Delete the old QbSettings modal**

```bash
git rm packages/app/src/app/pages/qb-settings/qb-settings.ts packages/app/src/app/pages/qb-settings/qb-settings.html packages/app/src/app/pages/qb-settings/qb-settings.scss packages/app/src/app/pages/qb-settings/qb-settings.spec.ts
```

In `pages/qb-settings/qb-settings.interface.ts` delete the transitional `QbSettingsTab` interface and the now-unused `Type` import (keep `QbSettingsTabComponent`). `modals/import-torrents/import-torrents.ts` still imports the deleted `QbSettings`; Task 9 removes it, so do Task 9 before running the type check in the next step.

- [ ] **Step 9: Run Task 9 now, then type check and test**

Complete Task 9 (it deletes the last reference to `QbSettings`), then:

```bash
npx tsc -p packages/app/tsconfig.app.json --noEmit
cd packages/app && npx ng test --watch=false --include "src/app/pages/qb-settings/**/*.spec.ts" --include "src/app/services/ui-command-handler.service.spec.ts"
```

Expected: no type errors; PASS.

- [ ] **Step 10: Commit**

```bash
npx prettier --write "packages/app/src/app/pages/qb-settings/**/*.{ts,html,scss}" packages/app/src/app/app.routes.ts
git add -A packages/app/src
git commit -m "#353: add the qBittorrent settings page and route"
```

---

### Task 9: Remove the Import Torrents link to qBittorrent settings

**Files:**

- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.ts`, `import-torrents.html`, `import-torrents.spec.ts` (only if it references the removed method), `packages/app/public/i18n/us.json`, `hu.json`

- [ ] **Step 1: Write the failing spec**

In `import-torrents.spec.ts`, add (inside the existing `describe`, using the spec's existing fixture setup and whichever step/state it uses to reach the category path mapping section; if the callout is only rendered in a specific state, set that state exactly as the nearest existing test does):

```ts
it('renders the category path mapping note without a link to qBittorrent settings', () => {
  const callout = fixture.nativeElement.querySelector('bb-callout');

  expect(callout).not.toBeNull();
  expect(callout.querySelector('button')).toBeNull();
  expect(callout.querySelector('span.mt-3')).not.toBeNull();
});
```

(The `bb-callout` element is the one wrapping `note-prefix` in `import-torrents.html`. If the existing spec uses `NO_ERRORS_SCHEMA`, the callout's projected content is still in the DOM, so the assertions hold.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/app && npx ng test --watch=false --include "src/app/modals/import-torrents/import-torrents.spec.ts"`
Expected: FAIL on the new test (the link button still exists).

- [ ] **Step 3: Remove the link and reword the note**

In `import-torrents.html` replace the callout body (the `<span ... note-prefix>` plus the `<button ... openQbSettings()>` and the trailing `.`) with a single span that carries the whole sentence:

```html
<span
  class="mt-3"
  [innerHTML]="
                  'components.modals.import-torrents.category-path-mapping.note-prefix'
                    | translate
                      : {
                          location:
                            ('pages.qb-settings.title' | translate) +
                            ' - ' +
                            ('pages.qb-settings.tab.storage.title' | translate),
                        }
                "
></span>
```

In `import-torrents.ts` delete the `openQbSettings()` method (lines 657-667 at `HEAD`) and, if nothing else in the file uses it, the `setModalInput` import.

In `us.json` and `hu.json` change `components.modals.import-torrents.category-path-mapping.note-prefix` so it ends with the named location instead of "... in " (keep the rest of each string exactly as it is):

- us: replace the ending `You can review this setting in ` with `You can review this setting in <strong>{{location}}</strong>.`
- hu: replace the ending `Ezt a beállítást itt találod: ` with `Ezt a beállítást itt találod: <strong>{{location}}</strong>.`

The note text is rendered through `[innerHTML]` with a translate parameter; `{{location}}` is ngx-translate interpolation.

- [ ] **Step 4: Run the spec to verify it passes, then commit**

```bash
cd packages/app && npx ng test --watch=false --include "src/app/modals/import-torrents/**/*.spec.ts"
cd ../.. && npx prettier --write packages/app/src/app/modals/import-torrents packages/app/public/i18n
git add -A packages/app
git commit -m "#353: remove the qBittorrent settings link from the import dialog"
```

Expected: PASS. (If you came here from Task 8 Step 9, return to that step now.)

---

### Task 10: Card grid, theming pass and documentation

**Files:**

- Modify: `packages/app/src/styles.scss`, the root element of the six unchanged panes' templates (`pages/settings/torrent-list-grid/torrent-list-grid.html`, `pages/settings/status-bar/status-bar.html`, `pages/qb-settings/{bandwidth,storage,queue-limits,seeding-ratios}/*.html`), `CLAUDE.md`

- [ ] **Step 1: Add the global card grid next to `.bb-fieldset`**

In `packages/app/src/styles.scss`, directly after the existing `.bb-fieldset { ... }` block (around line 1130-1160), add:

```scss
// Settings page card grid. The grid reacts to the width of the settings content area
// (container queries), not the viewport, because the sidebar takes a fixed 268px of it.
.bb-cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 1.5rem;
  max-width: 1800px;

  > .bb-fieldset,
  > .bb-cards__group > .bb-fieldset {
    margin: 0;
  }

  // Lets a wrapper keep a form path (formGroupName) without becoming a grid item itself.
  > .bb-cards__group {
    display: contents;
  }

  > .bb-card--wide {
    grid-column: 1 / -1;
  }
}

// Content width at which cards go from one column to two. One tunable value.
$bb-cards-two-column-min: 1500px;

@container bb-settings-content (min-width: #{$bb-cards-two-column-min}) {
  .bb-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 2: Put the six unchanged panes on the grid and drop their duplicate descriptions**

For each of the six templates, add `class="bb-cards"` to the root element (the `<form>` or the outermost wrapper; if the root is an `@if (...) { <form ...> ... }` block, put it on that form; if a pane has no single root, wrap its fieldsets in `<div class="bb-cards">`), and delete the leading description row:

```html
<div class="row">
  <div class="col-12">{{ '...description' | translate }}</div>
</div>
```

(the shell header already shows each pane's description). Mark cards that must span both columns with `bb-card--wide` on the fieldset: in Torrent List Grid the **Columns** fieldset (its Order/Pool layout needs the width) and the Status Bar widget pool fieldsets. Leave the other fieldsets at the default width.

- [ ] **Step 3: Verify in the running app**

Run: `npm start` (Angular dev server plus Electron). For each theme in Settings > Appearance (BitButler, Aurora, Crimson Ember, Deep Sea, Mint Green, Ocean Breeze, Pumpkin Spice, Purple Haze) in both light and dark mode, open the app settings page and the qBittorrent settings page and check:

- the sidebar, nav hover and active states, pill, footer and scrollbar are readable and use the theme's accent;
- at a window width where the content area is under 1500px every pane is one column, and at a wider window the narrow cards sit two per row while the wide cards span both;
- switching panes keeps unsaved edits (change a grid column, switch to General, switch back);
- Save disables the buttons and clears the "Unsaved changes" pill, Discard restores the saved values, and leaving with unsaved changes asks for confirmation (Back button and the menu "Disconnect");
- Ctrl+, and Ctrl+. open the pages, the Settings menu is absent when logged out, and the Import Torrents note shows the location text with no link.

Tune `$bb-cards-two-column-min` if a common laptop width gets two columns that look cramped. Record the final value in the commit message.

- [ ] **Step 4: Update `CLAUDE.md`**

In `CLAUDE.md` replace the "Routing & pages" paragraph (`Three lazy-loaded routes: login, main (torrent grid), settings...`) with:

```markdown
### Routing & pages

Lazy-loaded routes: `login`, `pages/torrent-list` (torrent grid), and two settings pages that share one `SettingsShell` layout: `pages/settings/:pane` (app settings) and `pages/qb-settings/:pane` (qBittorrent preferences). Every pane of a settings page stays mounted and the `:pane` parameter only selects which one is visible. The router navigates to `login` on 401/403 from the qBittorrent API.
```

- [ ] **Step 5: Commit**

```bash
npx prettier --write packages/app/src/styles.scss CLAUDE.md
git add -A packages/app CLAUDE.md
git commit -m "#353: add settings card grid and update routing docs"
```

---

### Task 11: Final verification

- [ ] **Step 1: Lint, tests and builds**

```bash
npm run lint
npm test
npm run build
npm run build:electron
```

Expected: lint passes with zero warnings; all workspace tests pass; both builds succeed with no unused-import warnings (NG8113). Fix anything reported, commit as `#353: fix <short description>`.

- [ ] **Step 2: Check the spec requirements one by one**

Re-read `docs/superpowers/specs/2026-10-09-settings-pages-design.md` and confirm each section against the app: routes and deep links (`#/pages/settings/notifications`, `#/pages/qb-settings/storage`), unknown pane redirect, back button, guard prompts and the forced-logout bypass (stop the qBittorrent server or invalidate the session while the page is dirty), save/discard behavior, loading/error/Retry on the qBittorrent page, and the modals-open no-op (open Add Torrent, press Ctrl+,).

- [ ] **Step 3: Review the whole branch**

Request one review of the full branch diff (`git diff main...353-settings-pages`) against the spec, using superpowers:requesting-code-review. Apply accepted findings as separate `#353:` commits.

- [ ] **Step 4: Remove the spec and plan before the PR**

```bash
git rm -r docs
git commit -m "#353: removed spec and plan"
```

Then open the PR per `.github/pull_request_template.md` (read it first and use it as the exact body structure) with `Fixes #353` and a clean title (no issue id), with no attribution lines in the description.
