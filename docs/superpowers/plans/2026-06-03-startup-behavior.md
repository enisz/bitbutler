# Startup Behavior Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow "Start with system" to be toggled without requiring a default server, and show a contextual hint when the app will start but won't auto-login.

**Architecture:** Remove the `hasDefaultServer()` gate from the form control enable/disable logic in `General`. Bridge the reactive form and signal worlds via a private `openAtLoginValue` signal, updated from `valueChanges` and from the settings load tap. Expose `showNoDefaultHostHint` as a `computed()` combining `openAtLoginValue` and `hasDefaultServer`.

**Tech Stack:** Angular 20 (zoneless, signals), Reactive Forms, @ngx-translate, Vitest

---

## File Map

| File                                                          | Change                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/app/src/app/pages/settings/general/general.ts`      | Remove effect, simplify enable/disable, add hint signal |
| `packages/app/src/app/pages/settings/general/general.html`    | Add conditional hint row                                |
| `packages/app/src/app/pages/settings/general/general.spec.ts` | Add tests for new behaviour                             |
| `public/i18n/us.json`                                         | Add hint key, update popover description                |
| `public/i18n/hu.json`                                         | Add hint key, update popover description                |

---

## Task 1: Add i18n translation keys and update popover descriptions

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add hint key to `us.json` and update open-at-login popover**

In `public/i18n/us.json`, find the `"startup"` key under `"general-settings-form"` (around line 990):

```json
"startup": {
  "open-at-login": "Start app with the system",
  "start-minimized": "Start minimized",
  "no-default-host-hint": "No default host configured. The app will start but won't log in automatically."
},
```

Then find the `"open-at-login"` popover entry (around line 1026) and update its description:

```json
"open-at-login": {
  "title": "Start with System",
  "description": "Automatically launch BitButler when the operating system starts."
},
```

- [ ] **Step 2: Add hint key to `hu.json` and update open-at-login popover**

In `public/i18n/hu.json`, find the `"startup"` key under `"general-settings-form"` (around line 990):

```json
"startup": {
  "open-at-login": "Alkalmazás indítása a rendszerrel",
  "start-minimized": "Indítás minimalizálva",
  "no-default-host-hint": "Nincs alapértelmezett kiszolgáló beállítva. Az alkalmazás elindul, de nem fog automatikusan bejelentkezni."
},
```

Then find the `"open-at-login"` popover entry (around line 1026) and update its description:

```json
"open-at-login": {
  "title": "Indítás a rendszerrel",
  "description": "A BitButler automatikusan elindul az operációs rendszer indításakor."
},
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#122: update startup i18n keys - add hint, remove default server requirement from popover"
```

---

## Task 2: Write failing tests for the new startup behaviour

**Files:**

- Modify: `packages/app/src/app/pages/settings/general/general.spec.ts`

- [ ] **Step 1: Add `ServerStoreService` mock and new `describe` block**

Open `packages/app/src/app/pages/settings/general/general.spec.ts` and replace the full file content:

```typescript
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
import { ServerStoreService } from '../../../services/server-store.service';
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
  let serverStoreMock: { servers: ReturnType<typeof signal<any[]>> };

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    serverStoreMock = { servers: signal([]) };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
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

  describe('startup form controls', () => {
    it('openAtLogin control is enabled regardless of whether a default server exists', () => {
      serverStoreMock.servers.set([]);
      fixture.detectChanges();
      expect(component.generalSettingsForm.controls.startup.controls.openAtLogin.enabled).toBe(
        true,
      );
    });

    it('openAtLogin control is enabled when a default server exists', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
        },
      ]);
      fixture.detectChanges();
      expect(component.generalSettingsForm.controls.startup.controls.openAtLogin.enabled).toBe(
        true,
      );
    });

    it('startMinimized is disabled when openAtLogin is false', () => {
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      expect(component.generalSettingsForm.controls.startup.controls.startMinimized.disabled).toBe(
        true,
      );
    });

    it('startMinimized is enabled when openAtLogin is true', () => {
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      expect(component.generalSettingsForm.controls.startup.controls.startMinimized.enabled).toBe(
        true,
      );
    });

    it('startMinimized is enabled when openAtLogin is true even without a default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      expect(component.generalSettingsForm.controls.startup.controls.startMinimized.enabled).toBe(
        true,
      );
    });
  });

  describe('hasDefaultServer', () => {
    it('returns false when no server has auto_login', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: false,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
        },
      ]);
      fixture.detectChanges();
      expect(component.hasDefaultServer()).toBe(false);
    });

    it('returns true when at least one server has auto_login', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
        },
      ]);
      fixture.detectChanges();
      expect(component.hasDefaultServer()).toBe(true);
    });
  });

  describe('showNoDefaultHostHint', () => {
    it('is false when openAtLogin is false and no default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });

    it('is true when openAtLogin is true and no default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(true);
    });

    it('is false when openAtLogin is true and a default server exists', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
        },
      ]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });

    it('is false when openAtLogin is false even if no default server exists', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|startup form|showNoDefault|hasDefaultServer"
```

Expected: tests in `startup form controls`, `showNoDefaultHostHint`, and `hasDefaultServer` describe blocks should FAIL (the signals/methods don't exist yet or behaviour doesn't match).

---

## Task 3: Update `general.ts` — remove gate, add hint signal

**Files:**

- Modify: `packages/app/src/app/pages/settings/general/general.ts`

- [ ] **Step 1: Replace the startup-related class members and constructor logic**

The changes are:

1. Change `openAtLogin` FormControl from `disabled: true` to enabled
2. Add `private readonly openAtLoginValue = signal(false)`
3. Add `public readonly showNoDefaultHostHint = computed(...)`
4. Remove the `effect()` entirely
5. Simplify the `valueChanges` subscription (remove `hasDefaultServer()` check, add `openAtLoginValue.set()`)
6. Update `settingsLoaded` tap (remove `hasDefaultServer()` check, add `openAtLoginValue.set()`)
7. Update `save()` (remove the `!hasDefaultServer()` guard)

Replace the relevant sections in `packages/app/src/app/pages/settings/general/general.ts`:

**Form group definition** (around line 156) — change `openAtLogin` from disabled to enabled:

```typescript
startup: new FormGroup({
  openAtLogin: new FormControl(false, { nonNullable: true }),
  startMinimized: new FormControl({ value: false, disabled: true }, { nonNullable: true }),
}),
```

**Class-level signals** — add after `hasDefaultServer` (around line 76):

```typescript
private readonly openAtLoginValue = signal(false);
public readonly showNoDefaultHostHint = computed(
  () => this.openAtLoginValue() && !this.hasDefaultServer(),
);
```

**Constructor** — replace the `effect()` and `valueChanges` subscription (around lines 178–206):

Remove the entire `effect(() => { ... })` block.

Replace the `startupGroup.controls.openAtLogin.valueChanges` subscription with:

```typescript
startupGroup.controls.openAtLogin.valueChanges
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((value) => {
    this.openAtLoginValue.set(value);
    const ctrl = startupGroup.controls.startMinimized;
    if (value) {
      ctrl.enable({ emitEvent: false });
    } else {
      ctrl.setValue(false, { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    }
  });
```

**`settingsLoaded`** (around line 215) — update the tap to remove `hasDefaultServer()` checks and set `openAtLoginValue`:

```typescript
public readonly settingsLoaded = toSignal(
  from(this.generalSettingsService.load()).pipe(
    tap((settings: GeneralSettings) => {
      this.generalSettingsForm.patchValue(settings, { emitEvent: false });
      const openAtLogin = settings.startup?.openAtLogin ?? false;
      this.openAtLoginValue.set(openAtLogin);
      const startupGroup = this.generalSettingsForm.controls.startup;
      if (openAtLogin) {
        startupGroup.controls.startMinimized.enable({ emitEvent: false });
      }
    }),
  ),
  { initialValue: null },
);
```

**`save()` method** (around line 228) — remove the `hasDefaultServer()` guard:

```typescript
private async save(): Promise<void> {
  const settings = this.generalSettingsForm.getRawValue();

  if (!settings.startup.openAtLogin) settings.startup.startMinimized = false;

  const newLang = settings.language.language;
  const currentLang = this.translateService.getCurrentLang();

  await this.generalSettingsService.save(settings);
  await window.bitbutler.electron.setLoginItem({ openAtLogin: settings.startup.openAtLogin });

  if (newLang !== currentLang) {
    await firstValueFrom(this.translateService.use(newLang));
  }

  this.themeService.applyFromSettings(settings.appearance.family, settings.appearance.mode);
}
```

Also remove the unused `signal` import if `signal` was only used in the `effect` that was removed — but we're adding `signal` back for `openAtLoginValue`, so keep it. Remove the `effect` import if it's no longer used anywhere in the file.

- [ ] **Step 2: Run lint to catch import issues**

```bash
npm run lint 2>&1 | grep -E "general\.ts|ERROR|WARNING"
```

Expected: no errors. Fix any unused import warnings (e.g. `effect` if removed).

- [ ] **Step 3: Run the tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|startup form|showNoDefault|hasDefaultServer"
```

Expected: all tests in `startup form controls`, `showNoDefaultHostHint`, and `hasDefaultServer` should now PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/settings/general/general.ts packages/app/src/app/pages/settings/general/general.spec.ts
git commit -m "#122: remove default server gate from startup settings, add no-default-host hint signal"
```

---

## Task 4: Update `general.html` — add conditional hint row

**Files:**

- Modify: `packages/app/src/app/pages/settings/general/general.html`

- [ ] **Step 1: Add the hint row after the `startMinimized` switch**

In `packages/app/src/app/pages/settings/general/general.html`, find the closing `</div>` of the `startMinimized` row (around line 63) and add the hint block immediately after it, before the closing `</div>` of the fieldset container:

```html
@if (showNoDefaultHostHint()) {
<div class="row mb-3">
  <div class="col-12">
    <small class="text-warning">
      {{ 'pages.settings.tab.general.startup.no-default-host-hint' | translate }}
    </small>
  </div>
</div>
}
```

The full startup fieldset container should look like this after the change:

```html
<div class="container">
  <div class="row mb-3">
    <div class="col-12">
      <div class="form-check form-switch">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="open-at-login"
          formControlName="openAtLogin"
        />
        <label class="form-check-label" for="open-at-login">
          {{ 'pages.settings.tab.general.general-settings-form.startup.open-at-login' | translate }}
          <bb-popover
            [subject]="'pages.settings.tab.general.popover.open-at-login.title' | translate"
            [description]="
                      'pages.settings.tab.general.popover.open-at-login.description' | translate
                    "
          ></bb-popover>
        </label>
      </div>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-12">
      <div class="form-check form-switch">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="start-minimized"
          formControlName="startMinimized"
        />
        <label class="form-check-label" for="start-minimized">
          {{ 'pages.settings.tab.general.general-settings-form.startup.start-minimized' | translate
          }}
          <bb-popover
            [subject]="
                      'pages.settings.tab.general.popover.start-minimized.title' | translate
                    "
            [description]="
                      'pages.settings.tab.general.popover.start-minimized.description' | translate
                    "
          ></bb-popover>
        </label>
      </div>
    </div>
  </div>
  @if (showNoDefaultHostHint()) {
  <div class="row mb-3">
    <div class="col-12">
      <small class="text-warning">
        {{ 'pages.settings.tab.general.startup.no-default-host-hint' | translate }}
      </small>
    </div>
  </div>
  }
</div>
```

- [ ] **Step 2: Run lint**

```bash
npm run lint 2>&1 | grep -E "general\.html|ERROR|WARNING"
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/settings/general/general.html
git commit -m "#122: add no-default-host hint to startup settings UI"
```

---

## Self-Review

**Spec coverage:**

- `openAtLogin` always enabled - covered in Task 3 (effect removed, FormControl starts enabled)
- `startMinimized` still gated by `openAtLogin` - covered in Task 3 (`valueChanges` subscription)
- No third toggle - nothing added
- Hint text shown when `openAtLogin` on and no `auto_login` server - covered in Tasks 3 and 4
- Hint hidden when default server exists - covered by `computed` logic and tests
- Hint hidden when `openAtLogin` off - covered by `computed` logic and tests
- i18n keys added - Task 1
- Popover description updated to remove stale "requires default server" text - Task 1

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `showNoDefaultHostHint` defined in Task 3, used in Task 4 template as `showNoDefaultHostHint()`. Matches.
