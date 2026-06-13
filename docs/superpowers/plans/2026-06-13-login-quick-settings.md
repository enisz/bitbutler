# Login Quick Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three icon-only quick-settings dropdowns (Language, Theme Family, Theme Mode) below "Manage Servers" on the login screen, each applying and persisting its setting immediately.

**Architecture:** Extract the duplicated `THEME_FAMILIES` list, `getFamilyLogoUrl()` helper, and `.mode-indicator` CSS (currently only in Settings > General) into shared locations (`theme.service.ts` and global `styles.scss`), then build the login dropdowns on top of those shared pieces using `NgbDropdownModule` + the existing `.bb-toolbar-dropdown` styling.

**Tech Stack:** Angular 20 (signals, standalone components), `@ng-bootstrap/ng-bootstrap` (`NgbDropdownModule`, `NgbTooltipModule`), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest.

---

## File Structure

| File                                                       | Change                                                                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/services/theme.service.ts`           | Add exported `THEME_FAMILIES` constant and `getFamilyLogoUrl()` helper                                                                                                  |
| `packages/app/src/app/services/theme.service.spec.ts`      | Tests for the new exports                                                                                                                                               |
| `packages/app/src/app/pages/settings/general/general.ts`   | Consume shared `THEME_FAMILIES` / `getFamilyLogoUrl` instead of local copies                                                                                            |
| `packages/app/src/styles.scss`                             | Add global `.mode-indicator` block (moved from general.scss)                                                                                                            |
| `packages/app/src/app/pages/settings/general/general.scss` | Remove `.mode-indicator` block (now empty)                                                                                                                              |
| `packages/app/src/app/test-utils/translate.mock.ts`        | Add `use()` to `mockTranslateService()`                                                                                                                                 |
| `packages/app/src/app/pages/login/login.ts`                | New imports, icons, `families`/`languages`/`modes` data, `currentFamily`/`currentMode`/`currentLang`, refactored `logoUrl`, `setFamily`/`setMode`/`setLanguage` methods |
| `packages/app/src/app/pages/login/login.html`              | New right-aligned quick-settings row with 3 dropdowns                                                                                                                   |
| `packages/app/src/app/pages/login/login.scss`              | No-caret rule for `.bb-quick-setting`                                                                                                                                   |
| `packages/app/src/app/pages/login/login.spec.ts`           | New mocks + tests for the above                                                                                                                                         |

---

## Task 1: Shared `THEME_FAMILIES` constant and `getFamilyLogoUrl()` helper

**Files:**

- Modify: `packages/app/src/app/services/theme.service.ts`
- Test: `packages/app/src/app/services/theme.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/theme.service.spec.ts`, change the import on line 3 from:

```ts
import { ThemeService } from './theme.service';
```

to:

```ts
import { THEME_FAMILIES, ThemeService, getFamilyLogoUrl } from './theme.service';
```

Then add these tests at the end of the file, just before the final closing `});`:

```ts
it('should export THEME_FAMILIES with 8 entries', () => {
  expect(THEME_FAMILIES).toHaveLength(8);
  expect(THEME_FAMILIES.map((f) => f.value)).toEqual([
    'bitbutler',
    'aurora',
    'mint-green',
    'purple-haze',
    'ocean-breeze',
    'pumpkin-spice',
    'deep-sea',
    'crimson-ember',
  ]);
});

it('should label each theme family for display', () => {
  expect(THEME_FAMILIES.find((f) => f.value === 'mint-green')?.label).toBe('Mint Green');
});

describe('getFamilyLogoUrl', () => {
  it('should build a logo URL for the given family', () => {
    expect(getFamilyLogoUrl('aurora')).toBe('assets/images/bitbutler-logo-aurora.png');
  });

  it('should use the exact family name in the URL', () => {
    expect(getFamilyLogoUrl('mint-green')).toBe('assets/images/bitbutler-logo-mint-green.png');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: FAIL - TypeScript error, `THEME_FAMILIES` and `getFamilyLogoUrl` are not exported from `./theme.service`.

- [ ] **Step 3: Implement THEME_FAMILIES and getFamilyLogoUrl**

In `packages/app/src/app/services/theme.service.ts`, add the following after the `ThemeMode` type (line 13) and before `const THEME_FAMILY_KEY = 'bb-theme-family';`:

```ts
export const THEME_FAMILIES: { value: ThemeFamily; label: string }[] = [
  { value: 'bitbutler', label: 'BitButler' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'mint-green', label: 'Mint Green' },
  { value: 'purple-haze', label: 'Purple Haze' },
  { value: 'ocean-breeze', label: 'Ocean Breeze' },
  { value: 'pumpkin-spice', label: 'Pumpkin Spice' },
  { value: 'deep-sea', label: 'Deep Sea' },
  { value: 'crimson-ember', label: 'Crimson Ember' },
];

export function getFamilyLogoUrl(family: string): string {
  return `assets/images/bitbutler-logo-${family}.png`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: PASS - all `theme.service.spec.ts` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/theme.service.ts packages/app/src/app/services/theme.service.spec.ts
git commit -m "#157: export THEME_FAMILIES and getFamilyLogoUrl from theme service"
```

---

## Task 2: Refactor `general.ts` to consume the shared exports

**Files:**

- Modify: `packages/app/src/app/pages/settings/general/general.ts:36`, `:122-131`, `:157-159`
- No test changes needed - `general.spec.ts`'s existing `getFamilyLogo` tests must keep passing unchanged.

- [ ] **Step 1: Update the theme service import**

In `packages/app/src/app/pages/settings/general/general.ts`, change line 36 from:

```ts
import { ThemeFamily, ThemeMode, ThemeService } from '../../../services/theme.service';
```

to:

```ts
import {
  THEME_FAMILIES,
  ThemeFamily,
  ThemeMode,
  ThemeService,
  getFamilyLogoUrl,
} from '../../../services/theme.service';
```

- [ ] **Step 2: Replace the local `families` array**

Replace (lines 122-131):

```ts
  public families: NgSelectItem[] = [
    { value: 'bitbutler', label: 'BitButler' },
    { value: 'aurora', label: 'Aurora' },
    { value: 'mint-green', label: 'Mint Green' },
    { value: 'purple-haze', label: 'Purple Haze' },
    { value: 'ocean-breeze', label: 'Ocean Breeze' },
    { value: 'pumpkin-spice', label: 'Pumpkin Spice' },
    { value: 'deep-sea', label: 'Deep Sea' },
    { value: 'crimson-ember', label: 'Crimson Ember' },
  ];
```

with:

```ts
  public families = THEME_FAMILIES;
```

- [ ] **Step 3: Replace the local `getFamilyLogo` method**

Replace (lines 157-159):

```ts
  public getFamilyLogo(family: string): string {
    return `assets/images/bitbutler-logo-${family}.png`;
  }
```

with:

```ts
  public getFamilyLogo = getFamilyLogoUrl;
```

- [ ] **Step 4: Run the tests to verify everything still passes**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: PASS - `general.spec.ts`'s `getFamilyLogo` describe block (lines 44-54) passes unchanged, since `getFamilyLogo` now points at `getFamilyLogoUrl`, which behaves identically.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/settings/general/general.ts
git commit -m "#157: reuse shared THEME_FAMILIES and getFamilyLogoUrl in general settings"
```

---

## Task 3: Move `.mode-indicator` CSS to global styles

**Files:**

- Modify: `packages/app/src/styles.scss` (insert after line 429)
- Modify: `packages/app/src/app/pages/settings/general/general.scss` (remove all content)

- [ ] **Step 1: Add `.mode-indicator` to the global stylesheet**

In `packages/app/src/styles.scss`, the `.bb-toolbar-dropdown` block currently ends at line 429 with a closing `}`, followed by a blank line and then `ngb-typeahead-window.dropdown-menu {` on line 431. Insert the following new block between them (after line 429's `}` and its blank line, before `ngb-typeahead-window.dropdown-menu {`):

```scss
.mode-indicator {
  border-radius: 100%;
  border: solid 1px black;
  width: 25px;
  height: 25px;

  &[data-bb-theme='bitbutler'] {
    &.light {
      background-color: #f5ede3;
    }
    &.dark {
      background-color: #121213;
    }
    &.system {
      background: linear-gradient(45deg, #f5ede3 50%, #121213 50%);
    }
  }

  &[data-bb-theme='aurora'] {
    &.light {
      background-color: #f3f7ff;
    }
    &.dark {
      background-color: #0b1020;
    }
    &.system {
      background: linear-gradient(45deg, #f3f7ff 50%, #0b1020 50%);
    }
  }

  &[data-bb-theme='mint-green'] {
    &.light {
      background-color: #f0f3f0;
    }
    &.dark {
      background-color: #1a2e2b;
    }
    &.system {
      background: linear-gradient(45deg, #f0f3f0 50%, #1a2e2b 50%);
    }
  }

  &[data-bb-theme='purple-haze'] {
    &.light {
      background-color: #f3e5f5;
    }
    &.dark {
      background-color: #1a1a2e;
    }
    &.system {
      background: linear-gradient(45deg, #f3e5f5 50%, #1a1a2e 50%);
    }
  }

  &[data-bb-theme='ocean-breeze'] {
    &.light {
      background-color: #e1f5fe;
    }
    &.dark {
      background-color: #0d253f;
    }
    &.system {
      background: linear-gradient(45deg, #e1f5fe 50%, #0d253f 50%);
    }
  }

  &[data-bb-theme='pumpkin-spice'] {
    &.light {
      background-color: #fff3e0;
    }
    &.dark {
      background-color: #1f160c;
    }
    &.system {
      background: linear-gradient(45deg, #fff3e0 50%, #1f160c 50%);
    }
  }

  &[data-bb-theme='deep-sea'] {
    &.light {
      background-color: #ebf4f6;
    }
    &.dark {
      background-color: #051a21;
    }
    &.system {
      background: linear-gradient(45deg, #ebf4f6 50%, #051a21 50%);
    }
  }

  &[data-bb-theme='crimson-ember'] {
    &.light {
      background-color: #fcf2f0;
    }
    &.dark {
      background-color: #1a0604;
    }
    &.system {
      background: linear-gradient(45deg, #fcf2f0 50%, #1a0604 50%);
    }
  }
}
```

- [ ] **Step 2: Empty out `general.scss`**

Replace the entire content of `packages/app/src/app/pages/settings/general/general.scss` (all 103 lines) with nothing - the file should be empty (0 bytes / no content).

- [ ] **Step 3: Verify the build and tests still pass**

Run: `npm run lint`
Expected: PASS - SCSS compiles cleanly, no lint errors from the empty `general.scss` or the new global block.

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: PASS - `general.spec.ts` still creates the component fine with an empty `styleUrl`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/styles.scss packages/app/src/app/pages/settings/general/general.scss
git commit -m "#157: move .mode-indicator styles to global stylesheet"
```

---

## Task 4: Login data layer - icons, families, languages, modes, current\* signals, logoUrl

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`
- Modify: `packages/app/src/app/pages/login/login.spec.ts`

- [ ] **Step 1: Update test setup and write failing tests**

In `packages/app/src/app/pages/login/login.spec.ts`:

Replace the import block (lines 1-14) with:

```ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { Login } from './login';
```

Replace the `themeMock` type declaration (lines 30-33):

```ts
let themeMock: {
  family: ReturnType<typeof signal<string>>;
  effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
};
```

with:

```ts
let themeMock: {
  family: ReturnType<typeof signal<string>>;
  mode: ReturnType<typeof signal<string>>;
  effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  setFamily: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
};
```

Add a new variable declaration right after it:

```ts
let translateMock: ReturnType<typeof mockTranslateService>;
```

Replace the `themeMock` assignment (line 51):

```ts
themeMock = { family: signal('bitbutler'), effectiveMode: signal<'light' | 'dark'>('dark') };
```

with:

```ts
themeMock = {
  family: signal('bitbutler'),
  mode: signal('system'),
  effectiveMode: signal<'light' | 'dark'>('dark'),
  setFamily: vi.fn(),
  setMode: vi.fn(),
};
translateMock = mockTranslateService();
```

Add a new provider to the `providers` array (after the `{ provide: ThemeService, useValue: themeMock },` line):

```ts
        { provide: TranslateService, useValue: translateMock },
```

Finally, add these new test blocks after the existing `describe('logoUrl', ...)` block (lines 134-139):

```ts
describe('families', () => {
  it('should expose the shared THEME_FAMILIES list', () => {
    expect(component.families).toHaveLength(8);
    expect(component.families[0]).toEqual({ value: 'bitbutler', label: 'BitButler' });
  });
});

describe('languages', () => {
  it('should list the available languages', () => {
    expect(component.languages().map((l) => l.value)).toEqual(['us', 'hu']);
  });
});

describe('modes', () => {
  it('should list the available theme modes', () => {
    expect(component.modes().map((m) => m.value)).toEqual(['light', 'dark', 'system']);
  });
});

describe('currentFamily', () => {
  it('should reflect the active theme family', () => {
    themeMock.family.set('aurora');
    expect(component.currentFamily()).toBe('aurora');
  });
});

describe('currentMode', () => {
  it('should reflect the active theme mode', () => {
    themeMock.mode.set('dark');
    expect(component.currentMode()).toBe('dark');
  });
});

describe('currentLang', () => {
  it('should reflect the active language', () => {
    translateMock.getCurrentLang.mockReturnValue('hu');
    expect(component.currentLang()).toBe('hu');
  });
});

describe('getFamilyLogoUrl', () => {
  it('should build a logo URL for a given family', () => {
    expect(component.getFamilyLogoUrl('aurora')).toBe('assets/images/bitbutler-logo-aurora.png');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: FAIL - TypeScript errors, `Login` has no members `families`, `languages`, `modes`, `currentFamily`, `currentMode`, `currentLang`, `getFamilyLogoUrl`.

- [ ] **Step 3: Implement the data layer in login.ts**

Replace the import block (lines 1-30) with:

```ts
import { NgClass, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerRecord } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleHalfStroke, faLanguage, faPalette } from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgLabelTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime, firstValueFrom, fromEvent } from 'rxjs';
import { AppLoader } from '../../components/app-loader/app-loader';
import { CredentialPrompt } from '../../components/modals/credential-prompt/credential-prompt';
import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import {
  THEME_FAMILIES,
  ThemeFamily,
  ThemeMode,
  ThemeService,
  getFamilyLogoUrl,
} from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { setModalInput } from '../../utils/modal-input';
```

Replace the `imports` array in the `@Component` decorator (lines 35-42):

```ts
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    TranslatePipe,
  ],
```

with:

```ts
  imports: [
    NgOptimizedImage,
    NgClass,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgbDropdownModule,
    FontAwesomeModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    TranslatePipe,
  ],
```

Replace the `logoUrl` computed (lines 60-62):

```ts
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );
```

with:

```ts
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly logoUrl = computed(() => getFamilyLogoUrl(this.themeService.family()));

  public readonly icons = { faLanguage, faPalette, faCircleHalfStroke };

  public readonly families = THEME_FAMILIES;

  public readonly languages = computed<{ value: string; label: string }[]>(() => {
    this.languageChanged();

    return [
      { value: 'us', label: this.translateService.instant('language.us') },
      { value: 'hu', label: this.translateService.instant('language.hu') },
    ].sort((a, b) => a.label.localeCompare(b.label));
  });

  public readonly modes = computed<{ value: ThemeMode; label: string }[]>(() => {
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

  public readonly currentFamily = this.themeService.family;
  public readonly currentMode = this.themeService.mode;

  public readonly currentLang = computed(() => {
    this.languageChanged();
    return this.translateService.getCurrentLang();
  });

  public readonly getFamilyLogoUrl = getFamilyLogoUrl;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: PASS - all `login.spec.ts` tests green, including the pre-existing `logoUrl` test.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts
git commit -m "#157: add quick-settings data signals to login component"
```

---

## Task 5: Login persistence methods - setFamily, setMode, setLanguage

**Files:**

- Modify: `packages/app/src/app/test-utils/translate.mock.ts`
- Modify: `packages/app/src/app/pages/login/login.ts`
- Modify: `packages/app/src/app/pages/login/login.spec.ts`

- [ ] **Step 1: Add `use()` to the shared TranslateService mock**

In `packages/app/src/app/test-utils/translate.mock.ts`, change line 1 from:

```ts
import { EMPTY, Subject } from 'rxjs';
```

to:

```ts
import { EMPTY, Subject, of } from 'rxjs';
```

Then add `use` to the returned object (after `getFallbackLang`):

```ts
    getFallbackLang: vi.fn().mockReturnValue(null),
    use: vi.fn().mockReturnValue(of(undefined)),
```

- [ ] **Step 2: Write failing tests for the new methods**

In `packages/app/src/app/pages/login/login.spec.ts`, add a `generalSettingsMock` declaration after the `translateMock` declaration:

```ts
let generalSettingsMock: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
```

In `beforeEach`, after the `translateMock = mockTranslateService();` line, add:

```ts
generalSettingsMock = {
  load: vi.fn().mockResolvedValue({ language: { language: 'us' } }),
  save: vi.fn().mockResolvedValue(undefined),
};
```

Add the import for `GeneralSettingsService` (alongside the other service imports):

```ts
import { GeneralSettingsService } from '../../services/general-settings.service';
```

Add a provider to the `providers` array (after the `{ provide: TranslateService, useValue: translateMock },` line):

```ts
        { provide: GeneralSettingsService, useValue: generalSettingsMock },
```

Finally, add these test blocks after the `getFamilyLogoUrl` describe block added in Task 4:

```ts
describe('setFamily', () => {
  it('should delegate to themeService.setFamily', () => {
    component.setFamily('aurora');
    expect(themeMock.setFamily).toHaveBeenCalledWith('aurora');
  });
});

describe('setMode', () => {
  it('should delegate to themeService.setMode', () => {
    component.setMode('dark');
    expect(themeMock.setMode).toHaveBeenCalledWith('dark');
  });
});

describe('setLanguage', () => {
  it('should do nothing when the language is already active', async () => {
    translateMock.getCurrentLang.mockReturnValue('us');
    await component.setLanguage('us');
    expect(generalSettingsMock.load).not.toHaveBeenCalled();
    expect(translateMock.use).not.toHaveBeenCalled();
  });

  it('should persist and switch the language when it changes', async () => {
    translateMock.getCurrentLang.mockReturnValue('us');
    await component.setLanguage('hu');
    expect(generalSettingsMock.save).toHaveBeenCalledWith({ language: { language: 'hu' } });
    expect(translateMock.use).toHaveBeenCalledWith('hu');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: FAIL - TypeScript errors, `Login` has no methods `setFamily`, `setMode`, `setLanguage`.

- [ ] **Step 4: Implement the methods in login.ts**

Add the injection for `GeneralSettingsService` after the `translateService` injection (near line 58):

```ts
  private readonly generalSettingsService = inject(GeneralSettingsService);
```

Add the import (alongside the other service imports, after `ElectronService`):

```ts
import { GeneralSettingsService } from '../../services/general-settings.service';
```

Add the three new methods at the end of the class, after `goToRelease`:

```ts

  public setFamily(family: ThemeFamily): void {
    this.themeService.setFamily(family);
  }

  public setMode(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }

  public async setLanguage(lang: string): Promise<void> {
    if (this.translateService.getCurrentLang() === lang) return;

    const settings = await this.generalSettingsService.load();
    settings.language.language = lang;
    await this.generalSettingsService.save(settings);
    await firstValueFrom(this.translateService.use(lang));
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: PASS - all `login.spec.ts` tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/test-utils/translate.mock.ts packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts
git commit -m "#157: persist language, theme family and theme mode from login"
```

---

## Task 6: Login quick-settings markup and styling

**Files:**

- Modify: `packages/app/src/app/pages/login/login.html`
- Modify: `packages/app/src/app/pages/login/login.scss`
- Modify: `packages/app/src/app/pages/login/login.spec.ts`

- [ ] **Step 1: Write a failing rendering test**

In `packages/app/src/app/pages/login/login.spec.ts`, add the `By` import alongside the other Angular testing imports:

```ts
import { By } from '@angular/platform-browser';
```

Add this test block after the `setLanguage` describe block:

```ts
describe('quick settings toolbar', () => {
  it('should render three icon-only quick-setting buttons', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.bb-quick-setting'));
    expect(buttons.length).toBe(3);
  });

  it('should label each quick-setting button for accessibility', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.bb-quick-setting'));
    for (const button of buttons) {
      expect(button.attributes['aria-label']).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: FAIL - `buttons.length` is `0`, no `.bb-quick-setting` elements exist yet.

- [ ] **Step 3: Add the quick-settings row to login.html**

In `packages/app/src/app/pages/login/login.html`, insert the following new block immediately after the closing `</div>` of the `d-flex flex-column gap-3` block (after line 78, before the closing `</div>` of `.form-wrapper` on line 79):

```html
<div class="d-flex justify-content-end gap-2 mt-3">
  <div ngbDropdown container="body" placement="top-end">
    <button
      type="button"
      class="btn btn-link bb-quick-setting"
      ngbDropdownToggle
      [ngbTooltip]="'pages.settings.tab.general.label.language' | translate"
      [attr.aria-label]="'pages.settings.tab.general.label.language' | translate"
    >
      <fa-icon [icon]="icons.faLanguage" />
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">
      @for (lang of languages(); track lang.value) {
      <button
        ngbDropdownItem
        type="button"
        [class.active]="lang.value === currentLang()"
        (click)="setLanguage(lang.value)"
      >
        <span class="fi" [ngClass]="'fi-' + lang.value"></span>
        <span>{{ lang.label }}</span>
      </button>
      }
    </div>
  </div>

  <div ngbDropdown container="body" placement="top-end">
    <button
      type="button"
      class="btn btn-link bb-quick-setting"
      ngbDropdownToggle
      [ngbTooltip]="
              'pages.settings.tab.general.general-settings-form.appearance.family' | translate
            "
      [attr.aria-label]="
              'pages.settings.tab.general.general-settings-form.appearance.family' | translate
            "
    >
      <fa-icon [icon]="icons.faPalette" />
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">
      @for (fam of families; track fam.value) {
      <button
        ngbDropdownItem
        type="button"
        [class.active]="fam.value === currentFamily()"
        (click)="setFamily(fam.value)"
      >
        <img [ngSrc]="getFamilyLogoUrl(fam.value)" [alt]="fam.label" width="20" height="20" />
        <span>{{ fam.label }}</span>
      </button>
      }
    </div>
  </div>

  <div ngbDropdown container="body" placement="top-end">
    <button
      type="button"
      class="btn btn-link bb-quick-setting"
      ngbDropdownToggle
      [ngbTooltip]="
              'pages.settings.tab.general.general-settings-form.appearance.mode' | translate
            "
      [attr.aria-label]="
              'pages.settings.tab.general.general-settings-form.appearance.mode' | translate
            "
    >
      <fa-icon [icon]="icons.faCircleHalfStroke" />
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">
      @for (m of modes(); track m.value) {
      <button
        ngbDropdownItem
        type="button"
        [class.active]="m.value === currentMode()"
        (click)="setMode(m.value)"
      >
        <div
          class="mode-indicator"
          [attr.data-bb-theme]="currentFamily()"
          [ngClass]="m.value"
        ></div>
        <span>{{ m.label }}</span>
      </button>
      }
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add the no-caret rule to login.scss**

In `packages/app/src/app/pages/login/login.scss`, add the following at the end of the file:

```scss
.bb-quick-setting.dropdown-toggle::after {
  display: none;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: PASS - 3 `.bb-quick-setting` buttons found, each with an `aria-label`.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/login/login.html packages/app/src/app/pages/login/login.scss packages/app/src/app/pages/login/login.spec.ts
git commit -m "#157: add language, theme family and theme mode quick settings to login"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full lint and test suite**

Run: `npm run lint`
Expected: PASS - zero warnings/errors across `.ts` and `.html` files.

Run: `npm test`
Expected: PASS - all workspace tests green.

- [ ] **Step 2: Manual verification**

Run: `npm start`

In the running app's login screen, confirm:

- Three icon-only `btn-link` buttons (language, palette, half-circle) appear below "Manage Servers", right-aligned on one row.
- Each dropdown opens upward (`placement="top-end"`) with no caret, using the blurred `.bb-toolbar-dropdown` styling.
- Hovering each button shows a tooltip describing what it controls.
- The Language dropdown lists US/HU with flags; selecting one switches the UI language immediately and the choice is reflected in Settings > General > Language after navigating there.
- The Theme Family dropdown lists all 8 families with logo previews; selecting one updates the hero/login logo and app theme immediately, and is reflected in Settings > General > Appearance > Family.
- The Theme Mode dropdown lists light/dark/system with `.mode-indicator` swatches; selecting one updates the effective theme immediately and is reflected in Settings > General > Appearance > Mode.
- The currently active value in each dropdown is highlighted (`.dropdown-item.active`).

- [ ] **Step 3: Commit (if manual verification surfaced fixes)**

If manual verification required code fixes, commit them with an appropriate `#157: ...` message before moving on.
