# Configurable Date/Time Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let date/time display in BitButler follow the app's language automatically, use a fixed preset (ISO/US/EU), or use a fully custom Angular date-format pattern - configurable in Settings, applied everywhere dates are shown, with zero new runtime dependencies.

**Architecture:** All absolute-date formatting already funnels through one pipe (`LocalTimestampPipe`) and one service wrapper (`UiFormatService.localTimestamp`). A new signal-backed `DateFormatService` resolves `{ pattern, locale }` from `GeneralSettings` (loaded at app bootstrap via `provideAppInitializer`, same pattern as `ThemeService`) and both existing call sites delegate to it. Angular's own `formatDate()` (`@angular/common`) does the actual formatting - no new library.

**Tech Stack:** Angular 20 (zoneless, signals), `@angular/common`'s `formatDate`/`registerLocaleData`, existing `GeneralSettingsService`/`BaseSettingsService` for persistence, Vitest via `ng test` for unit tests.

## Global Constraints

- Backward compatible: default settings must produce exactly `yyyy-MM-dd HH:mm`, identical to today's hardcoded output.
- No new npm dependency - use only `@angular/common`.
- `registerLocaleData(localeHu)` must run at bootstrap - confirmed empirically that Angular's `formatDate()` throws `NG0701: Missing locale data` for `hu-HU` on **any** pattern (not just named formats) if this is skipped.
- `DateFormatService.format()` must never throw: validate the input timestamp with `Number.isFinite` before constructing a `Date` (guards `NG02311: Unable to convert "Invalid Date"`), and the try/catch fallback must use a hardcoded `'en-US'` locale, never `this._locale()` (which may itself be the broken thing).
- `formatDate()` does not throw for unusual/garbled custom pattern _text_ - verified empirically. Do not add pattern validation or an "invalid format" error state; the live preview simply shows whatever `formatDate()` produces.
- Commit format: `#213: <short description>` (this branch is `213-configurable-date-format`, tied to GitHub issue #213).
- Toast/UI copy conventions, i18n key structure (`pages.settings.tab.general.general-settings-form.*`, `pages.settings.tab.general.label.*`), and existing ng-select usage patterns in `general.ts`/`general.html` must be followed exactly - see Task 6/7.

---

### Task 1: Data model - `dateFormat` settings & `resolveDateFormat()`

**Files:**

- Modify: `packages/app/src/app/models/general-settings.model.ts`
- Test: `packages/app/src/app/models/general-settings.model.spec.ts` (create)

**Interfaces:**

- Produces: `DateFormatPreset` type, `DATE_FORMAT_PRESETS: DateFormatPreset[]` constant, `GeneralSettings.dateFormat: { preset: DateFormatPreset; customPattern: string }`, `LANGUAGE_LOCALE_MAP: Record<string, string>`, `DEFAULT_LOCALE: string`, `resolveDateFormat(settings: Pick<GeneralSettings, 'language' | 'dateFormat'>): { pattern: string; locale: string }` - all exported from `general-settings.model.ts`. Later tasks (`DateFormatService`, `general.ts`) import these.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/models/general-settings.model.spec.ts`:

```ts
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  resolveDateFormat,
} from './general-settings.model';

describe('resolveDateFormat', () => {
  const base: Pick<GeneralSettings, 'language' | 'dateFormat'> = {
    language: { language: 'us' },
    dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm' },
  };

  it('resolves the iso preset to the ISO pattern regardless of language', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'hu' } })).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      locale: 'hu-HU',
    });
  });

  it('resolves the follow-language preset to the "short" named format', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'follow-language', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'short',
      locale: 'en-US',
    });
  });

  it('resolves the us preset to a fixed US pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'us', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'MM/dd/yyyy hh:mm a',
      locale: 'en-US',
    });
  });

  it('resolves the eu preset to a fixed EU pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'eu', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'dd.MM.yyyy HH:mm',
      locale: 'en-US',
    });
  });

  it('resolves the custom preset to the stored customPattern', () => {
    expect(
      resolveDateFormat({
        ...base,
        dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm" },
      }),
    ).toEqual({ pattern: "dd/MM/yyyy 'at' HH:mm", locale: 'en-US' });
  });

  it('falls back to the ISO pattern when a custom pattern is empty', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'custom', customPattern: '' } }),
    ).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      locale: 'en-US',
    });
  });

  it('maps the hu language code to the hu-HU locale', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'hu' } }).locale).toBe('hu-HU');
  });

  it('falls back to DEFAULT_LOCALE for an unmapped language code', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'zz' } }).locale).toBe('en-US');
  });
});

describe('DEFAULT_GENERAL_SETTINGS', () => {
  it('defaults dateFormat to the iso preset with the ISO pattern as customPattern seed', () => {
    expect(DEFAULT_GENERAL_SETTINGS.dateFormat).toEqual({
      preset: 'iso',
      customPattern: 'yyyy-MM-dd HH:mm',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app -- --include='src/app/models/general-settings.model.spec.ts'`
Expected: FAIL - `resolveDateFormat` is not exported / module has no such member, and `DEFAULT_GENERAL_SETTINGS.dateFormat` is `undefined`.

- [ ] **Step 3: Implement**

In `packages/app/src/app/models/general-settings.model.ts`, add after the existing type aliases (`ToastPosition`, `SavePathInputType`):

```ts
export type DateFormatPreset = 'follow-language' | 'iso' | 'us' | 'eu' | 'custom';

export const DATE_FORMAT_PRESETS: DateFormatPreset[] = [
  'follow-language',
  'iso',
  'us',
  'eu',
  'custom',
];

export const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  us: 'en-US',
  hu: 'hu-HU',
};

export const DEFAULT_LOCALE = 'en-US';
```

Add `dateFormat` to the `GeneralSettings` interface (after `language`):

```ts
export interface GeneralSettings {
  behavior: {
    deleteTorrentFile: boolean;
    automaticUpdate: boolean;
    toastPosition: ToastPosition;
  };
  language: {
    language: string;
  };
  dateFormat: {
    preset: DateFormatPreset;
    customPattern: string;
  };
  appearance: {
    family: ThemeFamily;
    mode: ThemeMode;
  };
  startup: {
    openAtLogin: boolean;
    startMinimized: boolean;
  };
  savePath: {
    inputType: SavePathInputType;
  };
}
```

Add the matching default (after `language:` in `DEFAULT_GENERAL_SETTINGS`):

```ts
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  behavior: {
    deleteTorrentFile: true,
    automaticUpdate: true,
    toastPosition: 'bottom-right',
  },
  language: {
    language: 'us',
  },
  dateFormat: {
    preset: 'iso',
    customPattern: 'yyyy-MM-dd HH:mm',
  },
  appearance: {
    family: 'bitbutler',
    mode: 'system',
  },
  startup: {
    openAtLogin: false,
    startMinimized: false,
  },
  savePath: {
    inputType: 'select',
  },
};
```

Add `resolveDateFormat` at the bottom of the file:

```ts
export function resolveDateFormat(settings: Pick<GeneralSettings, 'language' | 'dateFormat'>): {
  pattern: string;
  locale: string;
} {
  const locale = LANGUAGE_LOCALE_MAP[settings.language.language] ?? DEFAULT_LOCALE;

  switch (settings.dateFormat.preset) {
    case 'follow-language':
      return { pattern: 'short', locale };
    case 'us':
      return { pattern: 'MM/dd/yyyy hh:mm a', locale };
    case 'eu':
      return { pattern: 'dd.MM.yyyy HH:mm', locale };
    case 'custom':
      return { pattern: settings.dateFormat.customPattern || 'yyyy-MM-dd HH:mm', locale };
    case 'iso':
    default:
      return { pattern: 'yyyy-MM-dd HH:mm', locale };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app -- --include='src/app/models/general-settings.model.spec.ts'`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/models/general-settings.model.ts packages/app/src/app/models/general-settings.model.spec.ts
git commit -m "#213: add dateFormat setting and resolveDateFormat()"
```

---

### Task 2: `DateFormatService`

**Files:**

- Create: `packages/app/src/app/services/date-format.service.ts`
- Test: `packages/app/src/app/services/date-format.service.spec.ts` (create)

**Interfaces:**

- Consumes: `GeneralSettingsService.load(): Promise<GeneralSettings>` (`packages/app/src/app/services/general-settings.service.ts`), `resolveDateFormat`, `GeneralSettings`, `LANGUAGE_LOCALE_MAP` from Task 1.
- Produces: `DateFormatService` (`providedIn: 'root'`) with `init(): Promise<void>`, `applyFromSettings(settings: GeneralSettings): void`, `format(value: number | string | undefined): string`. Task 3 calls `init()` from an app initializer; Task 4's `LocalTimestampPipe` calls `format()`; Task 6's `general.ts` calls `applyFromSettings()`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/services/date-format.service.spec.ts`:

```ts
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
} from '../models/general-settings.model';
import { DateFormatService } from './date-format.service';
import { GeneralSettingsService } from './general-settings.service';

registerLocaleData(localeHu);

describe('DateFormatService', () => {
  let service: DateFormatService;
  let generalSettingsServiceMock: { load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    generalSettingsServiceMock = {
      load: vi.fn().mockResolvedValue(DEFAULT_GENERAL_SETTINGS),
    };

    TestBed.configureTestingModule({
      providers: [
        DateFormatService,
        { provide: GeneralSettingsService, useValue: generalSettingsServiceMock },
      ],
    });

    service = TestBed.inject(DateFormatService);
  });

  it('formats using the default ISO pattern before init() resolves', () => {
    const ts = 1700000000;
    expect(service.format(ts)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('returns "" for falsy, zero, negative, and non-numeric input', () => {
    expect(service.format(0)).toBe('');
    expect(service.format(undefined)).toBe('');
    expect(service.format(-1)).toBe('');
    expect(service.format('banana')).toBe('');
  });

  it('applies the us preset pattern after init()', async () => {
    generalSettingsServiceMock.load.mockResolvedValue({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm' },
    } satisfies GeneralSettings);

    await service.init();

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('01/05/2024 01:07 PM');
  });

  it('applies the eu preset pattern via applyFromSettings()', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05.01.2024 13:07');
  });

  it('applies a custom pattern with literal text', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm" },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05/01/2024 at 13:07');
  });

  it('resolves the locale-aware "short" format for hu-HU under the follow-language preset', () => {
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      language: { language: 'hu' },
      dateFormat: { preset: 'follow-language', customPattern: 'yyyy-MM-dd HH:mm' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('2024. 01. 05. 13:07');
  });

  it('falls back to the ISO pattern in en-US when the resolved locale has no registered data', () => {
    LANGUAGE_LOCALE_MAP['zz'] = 'zz-ZZ';

    try {
      service.applyFromSettings({
        ...DEFAULT_GENERAL_SETTINGS,
        language: { language: 'zz' },
        dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm' },
      });

      const ts = 1700000000;
      expect(service.format(ts)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    } finally {
      delete LANGUAGE_LOCALE_MAP['zz'];
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app -- --include='src/app/services/date-format.service.spec.ts'`
Expected: FAIL - cannot find module `./date-format.service`.

- [ ] **Step 3: Implement**

Create `packages/app/src/app/services/date-format.service.ts`:

```ts
import { formatDate } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import {
  DEFAULT_LOCALE,
  GeneralSettings,
  resolveDateFormat,
} from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';

const ISO_FALLBACK_PATTERN = 'yyyy-MM-dd HH:mm';

@Injectable({ providedIn: 'root' })
export class DateFormatService {
  private readonly generalSettingsService = inject(GeneralSettingsService);

  private readonly _pattern = signal(ISO_FALLBACK_PATTERN);
  private readonly _locale = signal(DEFAULT_LOCALE);

  public async init(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this.applyFromSettings(settings);
  }

  public applyFromSettings(settings: GeneralSettings): void {
    const { pattern, locale } = resolveDateFormat(settings);
    this._pattern.set(pattern);
    this._locale.set(locale);
  }

  public format(value: number | string | undefined): string {
    if (!value) return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';

    const date = new Date(numeric * 1000);

    try {
      return formatDate(date, this._pattern(), this._locale());
    } catch (error) {
      console.warn('[date-format] failed to format date, falling back to ISO default', error);
      return formatDate(date, ISO_FALLBACK_PATTERN, 'en-US');
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app -- --include='src/app/services/date-format.service.spec.ts'`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/date-format.service.ts packages/app/src/app/services/date-format.service.spec.ts
git commit -m "#213: add DateFormatService"
```

---

### Task 3: App bootstrap - register `hu` locale data & initialize `DateFormatService`

**Files:**

- Modify: `packages/app/src/app/app.config.ts`

**Interfaces:**

- Consumes: `DateFormatService.init()` (Task 2).
- Produces: `hu-HU` Angular locale data registered process-wide before the app renders; `DateFormatService`'s signals populated from persisted settings before first render (mirrors `ThemeService.init()`, already wired the same way at `app.config.ts:81-84`).

- [ ] **Step 1: Manual verification plan (no automated test - this is bootstrap wiring)**

This task changes app-initialization order, which `app.spec.ts` does not exercise (it builds its own minimal providers list, not `appConfig`). Verification is via Task 2's regression suite (unaffected) plus a manual smoke check in Task 7 once the Settings UI exists. Proceed directly to implementation.

- [ ] **Step 2: Implement**

In `packages/app/src/app/app.config.ts`, add imports (alongside the existing ones):

```ts
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
```

and:

```ts
import { DateFormatService } from './services/date-format.service';
```

After the imports, before `export const appConfig`, register the locale data once at module load:

```ts
registerLocaleData(localeHu);
```

In the `providers` array, add a second `provideAppInitializer` call right after the existing `ThemeService` one:

```ts
    provideAppInitializer(() => {
      const themeService = inject(ThemeService);
      return themeService.init();
    }),
    provideAppInitializer(() => {
      const dateFormatService = inject(DateFormatService);
      return dateFormatService.init();
    }),
```

- [ ] **Step 3: Run the full app test suite to confirm nothing regressed**

Run: `npm run test --workspace=packages/app`
Expected: PASS - same pass count as before this task, since `app.spec.ts` doesn't import `appConfig` and no other spec references locale registration yet.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/app.config.ts
git commit -m "#213: register hu locale data and initialize DateFormatService at bootstrap"
```

---

### Task 4: `LocalTimestampPipe` delegates to `DateFormatService`

**Files:**

- Modify: `packages/app/src/app/pipes/local-timestamp-pipe.ts`
- Modify: `packages/app/src/app/pipes/local-timestamp-pipe.spec.ts`

**Interfaces:**

- Consumes: `DateFormatService.format()` (Task 2).
- Produces: `LocalTimestampPipe.transform(value)` - same signature as before (`number | string | undefined => string`), now delegating instead of hand-rolling. `UiFormatService.localTimestamp` (`packages/app/src/app/services/ui-format.service.ts:43-44`) already calls `this.localTimestampPipe.transform(...)` and needs no code change - it inherits the new behavior automatically.

- [ ] **Step 1: Update the existing spec to construct the pipe via `TestBed`**

Replace the full contents of `packages/app/src/app/pipes/local-timestamp-pipe.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { LocalTimestampPipe } from './local-timestamp-pipe';

describe('LocalTimestampPipe', () => {
  let pipe: LocalTimestampPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LocalTimestampPipe] });
    pipe = TestBed.inject(LocalTimestampPipe);
  });

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns "" for 0', () => {
    expect(pipe.transform(0)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('returns "" for a negative timestamp', () => {
    expect(pipe.transform(-1)).toBe('');
  });

  it('returns "" for the string "0"', () => {
    expect(pipe.transform('0')).toBe('');
  });

  it('formats a valid unix timestamp to YYYY-MM-DD HH:mm', () => {
    const ts = 1700000000;
    const result = pipe.transform(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('pads single-digit month, day, hour and minute with a leading zero', () => {
    const date = new Date(2024, 0, 5, 9, 7);
    const ts = Math.floor(date.getTime() / 1000);
    const result = pipe.transform(ts);
    expect(result).toBe('2024-01-05 09:07');
  });

  it('formats a numeric string timestamp the same as a number', () => {
    const ts = 1700000000;
    expect(pipe.transform(String(ts))).toBe(pipe.transform(ts));
  });
});
```

- [ ] **Step 2: Run the test to verify it still fails the same way as before (pipe not yet changed) - actually run to confirm current pass, since only the construction mechanism changed**

Run: `npm run test --workspace=packages/app -- --include='src/app/pipes/local-timestamp-pipe.spec.ts'`
Expected: PASS - `TestBed.inject(LocalTimestampPipe)` still resolves the _old_ hand-rolled pipe correctly since `LocalTimestampPipe` has no constructor dependencies yet. This step just confirms the test-construction change alone is safe before touching the pipe's implementation.

- [ ] **Step 3: Implement the delegation**

Replace the full contents of `packages/app/src/app/pipes/local-timestamp-pipe.ts`:

```ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DateFormatService } from '../services/date-format.service';

@Pipe({
  name: 'localTimestamp',
  standalone: true,
  pure: false,
})
export class LocalTimestampPipe implements PipeTransform {
  private readonly dateFormatService = inject(DateFormatService);

  transform(value: number | string | undefined): string {
    return this.dateFormatService.format(value);
  }
}
```

- [ ] **Step 4: Run the test to verify it still passes with the new implementation**

Run: `npm run test --workspace=packages/app -- --include='src/app/pipes/local-timestamp-pipe.spec.ts'`
Expected: PASS (8 tests) - `DateFormatService`'s default signals (`'yyyy-MM-dd HH:mm'`, `'en-US'`) reproduce the exact same output as the old hand-rolled implementation, and `DateFormatService`'s own dependency chain (`GeneralSettingsService` -> `SettingsService` -> `window.bitbutler.settings.get`) resolves via the global stub in `packages/app/src/test-setup.ts`.

- [ ] **Step 5: Run the full app test suite to catch any other spec relying on the old pipe construction**

Run: `npm run test --workspace=packages/app`
Expected: PASS. If `ui-format.service.spec.ts` or any spec using `test-providers.ts` (About, import-torrents, torrent-exists) fails, it means one of them constructs `LocalTimestampPipe` outside a DI context (e.g. `new LocalTimestampPipe()`) - grep for `new LocalTimestampPipe(` across `packages/app/src` and convert any remaining occurrence to `TestBed.inject(LocalTimestampPipe)` the same way Step 1 did.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pipes/local-timestamp-pipe.ts packages/app/src/app/pipes/local-timestamp-pipe.spec.ts
git commit -m "#213: make LocalTimestampPipe delegate to DateFormatService"
```

---

### Task 5: Grid refreshes cells when the date format changes

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.spec.ts`

**Interfaces:**

- Consumes: `DateFormatService` (Task 2), injected the same way `UiFormatService` already is (`grid.ts:69`).
- Produces: no new public API - internal behavior only (an already-open grid repaints its date columns immediately after the user changes the date format in Settings, instead of only on next natural re-render).

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/pages/main/grid/grid.spec.ts`, add a `dateFormatServiceMock` alongside the other mocks in `beforeEach` (near `themeServiceMock`):

```ts
let dateFormatServiceMock: {
  resolved: ReturnType<typeof signal<{ pattern: string; locale: string }>>;
};
```

and inside `beforeEach`, alongside `themeServiceMock = ...`:

```ts
dateFormatServiceMock = { resolved: signal({ pattern: 'yyyy-MM-dd HH:mm', locale: 'en-US' }) };
```

Add its provider to the `providers` array, next to `{ provide: ThemeService, useValue: themeServiceMock }`:

```ts
        { provide: DateFormatService, useValue: dateFormatServiceMock },
```

Add the import at the top of the file:

```ts
import { DateFormatService } from '../../../services/date-format.service';
```

Then add a new test, after the existing `ngAfterViewInit`-related tests (search the file for where `onLangChange` / `refreshColumnHeaders` behavior would be tested, or add a new `describe` block near the end):

```ts
describe('date format changes', () => {
  it('force-refreshes grid cells when the resolved date format changes', () => {
    // The shared beforeEach above already called fixture.detectChanges(), which runs
    // ngAfterViewInit() once and wires up the subscription under test - reuse that
    // component/fixture rather than creating a second one.
    const refreshCellsSpy = vi.fn();
    (component as any).api = { refreshCells: refreshCellsSpy };

    dateFormatServiceMock.resolved.set({ pattern: 'dd.MM.yyyy HH:mm', locale: 'en-US' });

    expect(refreshCellsSpy).toHaveBeenCalledWith({ force: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app -- --include='src/app/pages/main/grid/grid.spec.ts'`
Expected: FAIL - `DateFormatService` is not provided (no matching provider found) since `grid.ts` doesn't inject it yet, and `dateFormatServiceMock.resolved` doesn't exist as a public signal on the real service yet either.

- [ ] **Step 3: Expose a public `resolved` signal on `DateFormatService`**

In `packages/app/src/app/services/date-format.service.ts` (from Task 2), replace the existing `@angular/core` import line:

```ts
import { Injectable, inject, signal } from '@angular/core';
```

with:

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
```

Then add a public readonly computed signal so consumers like `grid.ts` can subscribe to format changes without reaching into private state, placed directly above `public async init()`:

```ts
  public readonly resolved = computed(() => ({ pattern: this._pattern(), locale: this._locale() }));
```

- [ ] **Step 4: Wire up the grid subscription**

In `packages/app/src/app/pages/main/grid/grid.ts`, add the injection near `uiFormatService`:

```ts
  private readonly dateFormatService = inject(DateFormatService);
```

Replace the full `ngAfterViewInit()` method (currently `grid.ts:279-296`):

```ts
  ngAfterViewInit(): void {
    this.saveGridState$.pipe(throttleTime(500, undefined, { trailing: true })).subscribe(() => {
      if (!this.api) return;
      void this.gridStateService.save(
        this.api,
        this.gridPinService.getPinnedTopHashes(),
        this.gridPinService.getPinnedBottomHashes(),
      );
    });

    (this.torrentListGridSettingsService
      .asObservable()
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => this.applyGridSettings(settings)),
      this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.refreshColumnHeaders();
      }));

    toObservable(this.dateFormatService.resolved)
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.api?.refreshCells({ force: true }));
  }
```

(only the final `toObservable(...)` block is new; everything above it is unchanged. `toObservable` and `skip` are already imported in this file - `toObservable` from `@angular/core/rxjs-interop` at line 13, `skip` from `rxjs` at line 24.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app -- --include='src/app/pages/main/grid/grid.spec.ts'`
Expected: PASS.

- [ ] **Step 6: Run the full app test suite**

Run: `npm run test --workspace=packages/app`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/services/date-format.service.ts packages/app/src/app/pages/main/grid/grid.ts packages/app/src/app/pages/main/grid/grid.spec.ts
git commit -m "#213: refresh grid cells when the date format changes"
```

---

### Task 6: Settings UI - form, live preview, save integration

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts`
- Modify: `packages/app/src/app/modals/settings/general/general.spec.ts`

**Interfaces:**

- Consumes: `DateFormatPreset`, `DATE_FORMAT_PRESETS`, `resolveDateFormat` (Task 1), `DateFormatService.applyFromSettings()` (Task 2).
- Produces: `generalSettingsForm.controls.dateFormat` (`FormGroup<{ preset: FormControl<DateFormatPreset>; customPattern: FormControl<string> }>`), `dateFormatPresets: Signal<NgSelectItem[]>`, `isCustomDateFormat: Signal<boolean>`, `customPatternPreview: Signal<string>` - all consumed by Task 7's template.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/modals/settings/general/general.spec.ts`, add imports at the top:

```ts
import { DateFormatService } from '../../../services/date-format.service';
```

Add `dateFormatServiceMock` to the top-level `beforeEach`, alongside the other mocks, and register it as a provider:

```ts
let dateFormatServiceMock: { applyFromSettings: ReturnType<typeof vi.fn> };
```

```ts
dateFormatServiceMock = { applyFromSettings: vi.fn() };
```

and in the `providers` array:

```ts
        { provide: DateFormatService, useValue: dateFormatServiceMock },
```

Add new test blocks at the end of the `describe('General', ...)` body, before the closing `});`:

```ts
describe('dateFormatPresets', () => {
  it('includes all 5 presets with a live-formatted example in the label', () => {
    const items = component.dateFormatPresets();
    expect(items.map((i) => i.value)).toEqual(['follow-language', 'iso', 'us', 'eu', 'custom']);
    const iso = items.find((i) => i.value === 'iso')!;
    expect(iso.label).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
});

describe('isCustomDateFormat', () => {
  it('is false when preset is iso', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
    expect(component.isCustomDateFormat()).toBe(false);
  });

  it('is true when preset is custom', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    expect(component.isCustomDateFormat()).toBe(true);
  });
});

describe('customPatternPreview', () => {
  it('reflects the currently typed custom pattern, including literal text', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
      "dd/MM/yyyy 'at' HH:mm",
    );
    expect(component.customPatternPreview()).toMatch(/^\d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}$/);
  });
});

describe('save', () => {
  it('persists dateFormat and applies it via DateFormatService', async () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue('dd/MM/yyyy');

    const saveCallback = stateServiceMock.registerSave.mock.calls[0][1];
    await saveCallback();

    expect(dateFormatServiceMock.applyFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy' },
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --include='src/app/modals/settings/general/general.spec.ts'`
Expected: FAIL - `component.dateFormatPresets`, `component.isCustomDateFormat`, `component.customPatternPreview` are not functions; `generalSettingsForm.controls.dateFormat` is undefined; `dateFormatServiceMock.applyFromSettings` not called.

- [ ] **Step 3: Implement**

In `packages/app/src/app/modals/settings/general/general.ts`, update imports. Replace the existing first line:

```ts
import { CommonModule, NgOptimizedImage } from '@angular/common';
```

with:

```ts
import { CommonModule, NgOptimizedImage, formatDate } from '@angular/common';
```

Then replace the existing `general-settings.model` import block:

```ts
import {
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
} from '../../../models/general-settings.model';
```

with:

```ts
import {
  DATE_FORMAT_PRESETS,
  DateFormatPreset,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
import { DateFormatService } from '../../../services/date-format.service';
```

Add the injection near the other services:

```ts
  private readonly dateFormatService = inject(DateFormatService);
```

Add the `dateFormat` form group to `generalSettingsForm`, right after `language`:

```ts
    language: new FormGroup({
      language: new FormControl('us', { nonNullable: true }),
    }),
    dateFormat: new FormGroup({
      preset: new FormControl<DateFormatPreset>('iso', { nonNullable: true }),
      customPattern: new FormControl('yyyy-MM-dd HH:mm', { nonNullable: true }),
    }),
```

Add a form-value snapshot signal, kept in sync manually (needed because the initial `patchValue` in `settingsLoaded` uses `{ emitEvent: false }`, so `valueChanges` alone would miss the loaded values):

```ts
  private readonly formSnapshot = signal(this.generalSettingsForm.getRawValue());
```

(place this near `openAtLoginValue`).

Update the constructor's existing `valueChanges` subscription (currently just calling `markDirty`) to also refresh the snapshot:

```ts
this.generalSettingsForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
  this.stateService.markDirty('general', true);
  this.formSnapshot.set(this.generalSettingsForm.getRawValue());
});
```

Update `settingsLoaded`'s `tap` callback to also refresh the snapshot after the silent `patchValue`:

```ts
      tap((settings: GeneralSettings) => {
        this.generalSettingsForm.patchValue(settings, { emitEvent: false });
        this.formSnapshot.set(this.generalSettingsForm.getRawValue());
        const openAtLogin = settings.startup?.openAtLogin ?? false;
        this.openAtLoginValue.set(openAtLogin);
        const startupGroup = this.generalSettingsForm.controls.startup;
        if (openAtLogin) {
          startupGroup.controls.startMinimized.enable({ emitEvent: false });
        }
      }),
```

Add a private preview helper and the three new public signals (place after `modes`, before `icons`):

```ts
  private previewDateFormat(preset: DateFormatPreset, language: string, customPattern: string): string {
    const { pattern, locale } = resolveDateFormat({
      language: { language },
      dateFormat: { preset, customPattern },
    });

    try {
      return formatDate(new Date(), pattern, locale);
    } catch {
      return formatDate(new Date(), 'yyyy-MM-dd HH:mm', 'en-US');
    }
  }

  public dateFormatPresets = computed<NgSelectItem[]>(() => {
    this.languageChanged();
    const snapshot = this.formSnapshot();
    const language = snapshot.language.language;
    const customPattern = snapshot.dateFormat.customPattern;

    return DATE_FORMAT_PRESETS.map((preset) => {
      const label = this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.preset.${preset}`,
      );
      const example = this.previewDateFormat(preset, language, customPattern);
      return { value: preset, label: `${label} - ${example}` };
    });
  });

  public isCustomDateFormat = computed<boolean>(() => this.formSnapshot().dateFormat.preset === 'custom');

  public customPatternPreview = computed<string>(() => {
    const snapshot = this.formSnapshot();
    return this.previewDateFormat('custom', snapshot.language.language, snapshot.dateFormat.customPattern);
  });
```

Update `save()` to apply the new date format after persisting settings (right after the existing `theme` application call):

```ts
this.themeService.applyFromSettings(settings.appearance.family, settings.appearance.mode);
this.dateFormatService.applyFromSettings(settings);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --include='src/app/modals/settings/general/general.spec.ts'`
Expected: PASS (all existing tests plus the new ones from Step 1).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.ts packages/app/src/app/modals/settings/general/general.spec.ts
git commit -m "#213: add date format form controls, live preview, and save integration"
```

---

### Task 7: Settings UI - template & translations

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: extend `packages/app/src/app/modals/settings/general/general.spec.ts` (from Task 6)

**Interfaces:**

- Consumes: `dateFormatPresets`, `isCustomDateFormat`, `customPatternPreview` (Task 6).
- Produces: rendered "Date & Time" fieldset - no new interfaces for later tasks (this is the last task).

- [ ] **Step 1: Write the failing DOM test**

Add to the bottom of `packages/app/src/app/modals/settings/general/general.spec.ts` (after the `save` describe block from Task 6):

```ts
describe('date format fieldset', () => {
  it('hides the custom pattern input when preset is iso', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#date-format-custom-pattern');
    expect(input).toBeNull();
  });

  it('shows the custom pattern input and preview when preset is custom', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#date-format-custom-pattern');
    expect(input).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app -- --include='src/app/modals/settings/general/general.spec.ts'`
Expected: FAIL - `#date-format-custom-pattern` never exists because the fieldset hasn't been added to the template yet, so the "shows... when custom" assertion fails (`input` is `null`).

- [ ] **Step 3: Add the fieldset to the template**

In `packages/app/src/app/modals/settings/general/general.html`, insert a new fieldset immediately after the closing `</fieldset>` of the existing `formGroupName="language"` block (right before `<fieldset class="bb-fieldset" formGroupName="appearance">`):

```html
<fieldset class="bb-fieldset" formGroupName="dateFormat">
  <legend>{{ 'pages.settings.tab.general.label.date-format' | translate }}</legend>

  <div class="container">
    <div class="row mb-3">
      <div class="col-6 d-flex align-items-center">
        {{ 'pages.settings.tab.general.general-settings-form.date-format.preset-label' | translate
        }}
      </div>

      <div class="col-6">
        <ng-select
          [items]="dateFormatPresets()"
          [clearable]="false"
          [openOnEnter]="false"
          [clearSearchOnAdd]="true"
          [searchable]="false"
          bindLabel="label"
          bindValue="value"
          formControlName="preset"
        >
        </ng-select>
      </div>
    </div>

    @if (isCustomDateFormat()) {
    <div class="row mb-3">
      <div class="col-6 d-flex align-items-center">
        {{ 'pages.settings.tab.general.general-settings-form.date-format.custom-pattern-label' |
        translate }}
      </div>

      <div class="col-6">
        <input
          type="text"
          class="form-control"
          id="date-format-custom-pattern"
          formControlName="customPattern"
        />
      </div>
    </div>
    <div class="row mb-3">
      <div class="col-12 text-muted">
        {{ 'pages.settings.tab.general.general-settings-form.date-format.preview' | translate }}: {{
        customPatternPreview() }}
      </div>
    </div>
    }
  </div>
</fieldset>
```

- [ ] **Step 4: Add the i18n keys**

In `public/i18n/us.json`, inside `pages.settings.tab.general.general-settings-form`, add a `date-format` sibling to `language` (after the `language` block, before `appearance`):

```json
            "language": {
              "language": "Language of the UI"
            },
            "date-format": {
              "preset-label": "Date format",
              "custom-pattern-label": "Custom pattern",
              "preview": "Preview",
              "preset": {
                "follow-language": "Follow language",
                "iso": "ISO",
                "us": "US",
                "eu": "European",
                "custom": "Custom"
              }
            },
```

In the same file, inside `pages.settings.tab.general.label`, add a `date-format` entry after `language`:

```json
          "label": {
            "behavior": "Behavior",
            "language": "Language",
            "date-format": "Date & Time",
            "appearance": "Appearance",
            "startup": "Startup",
            "save-path-input": "Save Path Input"
          },
```

In `public/i18n/hu.json`, the same two insertions with Hungarian copy - inside `general-settings-form` after `language`:

```json
            "language": {
              "language": "A felület nyelve"
            },
            "date-format": {
              "preset-label": "Dátumformátum",
              "custom-pattern-label": "Egyéni minta",
              "preview": "Előnézet",
              "preset": {
                "follow-language": "Nyelv szerint",
                "iso": "ISO",
                "us": "USA",
                "eu": "Európai",
                "custom": "Egyéni"
              }
            },
```

and inside `label` after `language`:

```json
          "label": {
            "behavior": "Viselkedés",
            "language": "Nyelv",
            "date-format": "Dátum és idő",
            "appearance": "Megjelenés",
            "startup": "Indítás",
            "save-path-input": "Mentési útvonal bevitel"
          },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app -- --include='src/app/modals/settings/general/general.spec.ts'`
Expected: PASS (all tests from Task 6 and Task 7).

- [ ] **Step 6: Run the full workspace test suite and lint**

Run: `npm test`
Expected: PASS across all workspaces.

Run: `npm run lint`
Expected: PASS with zero warnings (`--max-warnings=0`).

- [ ] **Step 7: Manually verify in the running app**

Run: `npm start`

- Open Settings -> General. Confirm the new "Date & Time" fieldset appears below "Language" with a "Date format" dropdown showing 5 options, each with a live example.
- Select "Custom", type `dd/MM/yyyy 'at' HH:mm` in the pattern field, and confirm the preview line updates live as you type.
- Save. Confirm dates in the torrent grid ("Added On" column) and in the About dialog's release-date field update immediately to the new format without needing to reopen the window.
- Switch the "Language of the UI" dropdown to Hungarian, leave "Date format" on "Follow language", and confirm the grid's dates switch to the `yyyy. MM. dd. HH:mm`-style Hungarian format after saving.
- Switch back to "ISO" and confirm dates return to `yyyy-MM-dd HH:mm`.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.html packages/app/src/app/modals/settings/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#213: add Date & Time settings fieldset and translations"
```

---

## Post-implementation cleanup

Per this repo's convention for `superpowers` specs/plans: once all tasks above are complete and verified, remove the `docs/superpowers/` folder contents added for this feature (the spec and this plan) in their own commit before opening the PR:

```bash
git rm -r docs/superpowers/specs/2026-07-10-configurable-date-format-design.md docs/superpowers/plans/2026-07-10-configurable-date-format.md
git commit -m "#213: removed spec and plan"
```

Then open the PR using `.github/pull_request_template.md` as the exact structure, with `Fixes #213` in the description.
