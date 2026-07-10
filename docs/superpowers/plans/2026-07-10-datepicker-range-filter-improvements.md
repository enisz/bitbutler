# Datepicker Range Filter Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the dead `DatepickerFilter` component and improve the `DatepickerRangeFilter` calendar popup: date-format-aware date chips, a pill-shaped range selection, icon-right buttons, a fix for the popup closing itself on date selection, and a new "first day of week" general setting.

**Architecture:** Extend the existing `resolveDateFormat()` pure function (in `general-settings.model.ts`) with a derived date-only pattern, add a parallel `resolveFirstDayOfWeek()` pure function backed by the native `Intl.Locale(...).getWeekInfo()` API, thread both through `DateFormatService.resolved()` (already the single source of truth `DatepickerRangeFilter` and other consumers read from), and consume them in `DatepickerRangeFilter`. The popup auto-close bug is fixed by stopping `mousedown`/`touchstart` propagation at the popup's root so it never reaches the `document`-level listener ag-grid's `PopupService` uses to detect outside clicks.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-bootstrap/ng-bootstrap` (`NgbDatepicker`), `ag-grid-community` 35, `@ngx-translate/core`, Vitest (via `ng test`).

## Global Constraints

- Commit format: `#213: <short description>` (this branch, `213-configurable-date-format`, continues issue #213).
- `npm run lint` must pass with zero warnings (`max-warnings=0`); Prettier formatting is auto-applied by the pre-commit hook - if it reformats staged files during a commit, that's expected, not a failure.
- Run app-package tests with: `npm test --workspace=@bitbutler/app` (from the repo root `C:\dev\bitbutler`). Baseline before this plan: 132 test files / 1729 tests, all passing.
- `ngb-datepicker`'s `firstDayOfWeek` input and `Intl.Locale(...).getWeekInfo().firstDay` use the same numbering: `1`=Monday ... `7`=Sunday. Verified directly: `Intl.Locale('en-US').getWeekInfo().firstDay === 7`, `Intl.Locale('hu-HU').getWeekInfo().firstDay === 1`.
- Do not add a dedicated "Close" button to the filter popup - confirmed no other column filter in this app has one; only the auto-close-on-select bug is being fixed, closing remains outside-click-only like every other filter.
- Every step below shows the exact code to write - no placeholder steps.

---

### Task 1: Remove the unused `DatepickerFilter` component

**Files:**

- Delete: `packages/app/src/app/components/datepicker-filter/datepicker-filter.html`
- Delete: `packages/app/src/app/components/datepicker-filter/datepicker-filter.ts`
- Delete: `packages/app/src/app/components/datepicker-filter/datepicker-filter.scss`
- Delete: `packages/app/src/app/components/datepicker-filter/datepicker-filter.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing - this is a pure deletion with no later task depending on it.

- [ ] **Step 1: Confirm nothing else references `DatepickerFilter`**

Run: `grep -rn "DatepickerFilter" packages/app/src --include=*.ts --include=*.html -l`

Expected: only the four files being deleted are listed (i.e. only paths under `packages/app/src/app/components/datepicker-filter/`).

- [ ] **Step 2: Delete the component folder**

```bash
git rm -r packages/app/src/app/components/datepicker-filter
```

- [ ] **Step 3: Run the app test suite to confirm no regressions**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass (one fewer test file than the 132-file baseline, no failures).

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
#213: removed unused DatepickerFilter component

EOF
)"
```

---

### Task 2: Derive a date-only pattern in `resolveDateFormat()`

**Files:**

- Modify: `packages/app/src/app/models/general-settings.model.ts:75-94`
- Modify: `packages/app/src/app/models/general-settings.model.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `resolveDateFormat(settings): { pattern: string; datePattern: string; locale: string }` - the `datePattern` field is new; `pattern`/`locale` are unchanged. Task 4 (`DateFormatService`) reads `datePattern` from this return value.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `packages/app/src/app/models/general-settings.model.spec.ts` with:

```typescript
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  resolveDateFormat,
} from './general-settings.model';

describe('resolveDateFormat', () => {
  const base: Pick<GeneralSettings, 'language' | 'dateFormat'> = {
    language: { language: 'us' },
    dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
  };

  it('resolves the iso preset to the ISO pattern regardless of language', () => {
    expect(resolveDateFormat({ ...base, language: { language: 'hu' } })).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      datePattern: 'yyyy-MM-dd',
      locale: 'hu-HU',
    });
  });

  it('resolves the follow-language preset to the "short" named format', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'follow-language', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'short',
      datePattern: 'shortDate',
      locale: 'en-US',
    });
  });

  it('resolves the us preset to a fixed US pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'us', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'MM/dd/yyyy hh:mm a',
      datePattern: 'MM/dd/yyyy',
      locale: 'en-US',
    });
  });

  it('resolves the eu preset to a fixed EU pattern', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'eu', customPattern: 'x' } }),
    ).toEqual({
      pattern: 'dd.MM.yyyy HH:mm',
      datePattern: 'dd.MM.yyyy',
      locale: 'en-US',
    });
  });

  it('resolves the custom preset to the stored customPattern, with time tokens stripped for datePattern', () => {
    expect(
      resolveDateFormat({
        ...base,
        dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm" },
      }),
    ).toEqual({
      pattern: "dd/MM/yyyy 'at' HH:mm",
      datePattern: "dd/MM/yyyy 'at'",
      locale: 'en-US',
    });
  });

  it('keeps a quoted literal segment intact while stripping time tokens around it', () => {
    expect(
      resolveDateFormat({
        ...base,
        dateFormat: { preset: 'custom', customPattern: "'Added:' dd/MM/yyyy HH:mm" },
      }).datePattern,
    ).toBe("'Added:' dd/MM/yyyy");
  });

  it('falls back to the ISO date pattern when a custom pattern strips down to nothing', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'custom', customPattern: 'HH:mm' } })
        .datePattern,
    ).toBe('yyyy-MM-dd');
  });

  it('falls back to the ISO pattern when a custom pattern is empty', () => {
    expect(
      resolveDateFormat({ ...base, dateFormat: { preset: 'custom', customPattern: '' } }),
    ).toEqual({
      pattern: 'yyyy-MM-dd HH:mm',
      datePattern: 'yyyy-MM-dd',
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
  it('defaults dateFormat to the iso preset, ISO customPattern seed, and auto first day of week', () => {
    expect(DEFAULT_GENERAL_SETTINGS.dateFormat).toEqual({
      preset: 'iso',
      customPattern: 'yyyy-MM-dd HH:mm',
      firstDayOfWeek: 'auto',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `resolveDateFormat` tests report `datePattern` as `undefined` (return value doesn't have that property yet), and the `DEFAULT_GENERAL_SETTINGS` test fails because `firstDayOfWeek` isn't in `dateFormat` yet (this second failure is expected here and gets fixed in Task 3 - for now confirm the failure is specifically about the missing fields, not a syntax/import error).

- [ ] **Step 3: Implement `datePattern` derivation**

In `packages/app/src/app/models/general-settings.model.ts`, replace the existing `resolveDateFormat` function (currently lines 75-94) with:

```typescript
const TIME_TOKEN_PATTERN = /HH|hh|H|h|mm|ss|a/g;
const SEPARATOR_TRIM_PATTERN = /^[\s,./:-]+|[\s,./:-]+$/g;

function toDateOnlyPattern(pattern: string): string {
  const segments = pattern.match(/'[^']*'|[^']+/g) ?? [];
  const stripped = segments
    .map((segment) => (segment.startsWith("'") ? segment : segment.replace(TIME_TOKEN_PATTERN, '')))
    .join('')
    .replace(SEPARATOR_TRIM_PATTERN, '');

  return stripped || 'yyyy-MM-dd';
}

export function resolveDateFormat(settings: {
  language: Pick<GeneralSettings['language'], 'language'>;
  dateFormat: Pick<GeneralSettings['dateFormat'], 'preset' | 'customPattern'>;
}): {
  pattern: string;
  datePattern: string;
  locale: string;
} {
  const locale = LANGUAGE_LOCALE_MAP[settings.language.language] ?? DEFAULT_LOCALE;

  switch (settings.dateFormat.preset) {
    case 'follow-language':
      return { pattern: 'short', datePattern: 'shortDate', locale };
    case 'us':
      return { pattern: 'MM/dd/yyyy hh:mm a', datePattern: 'MM/dd/yyyy', locale };
    case 'eu':
      return { pattern: 'dd.MM.yyyy HH:mm', datePattern: 'dd.MM.yyyy', locale };
    case 'custom': {
      const pattern = settings.dateFormat.customPattern || 'yyyy-MM-dd HH:mm';
      return { pattern, datePattern: toDateOnlyPattern(pattern), locale };
    }
    case 'iso':
    default:
      return { pattern: 'yyyy-MM-dd HH:mm', datePattern: 'yyyy-MM-dd', locale };
  }
}
```

- [ ] **Step 4: Run the tests to verify the `resolveDateFormat` tests pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: all `resolveDateFormat` tests pass. The `DEFAULT_GENERAL_SETTINGS` test still fails (fixed in Task 3) - confirm no other failures appeared.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/models/general-settings.model.ts packages/app/src/app/models/general-settings.model.spec.ts
git commit -m "$(cat <<'EOF'
#213: derive a date-only pattern in resolveDateFormat

EOF
)"
```

---

### Task 3: Add `firstDayOfWeek` to the settings model and form

**Files:**

- Modify: `packages/app/src/app/models/general-settings.model.ts`
- Modify: `packages/app/src/app/models/general-settings.model.spec.ts`
- Modify: `packages/app/src/app/modals/settings/general/general.ts`
- Modify: `packages/app/src/app/modals/settings/general/general.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `FirstDayOfWeek = 'auto' | 'sunday' | 'monday' | 'saturday'` (exported type).
  - `FIRST_DAY_OF_WEEK_OPTIONS: FirstDayOfWeek[]` (exported const, used by Task 6's dropdown).
  - `resolveFirstDayOfWeek(settings): number` (exported function, `1`-`7`; consumed by Task 4).
  - `GeneralSettings.dateFormat.firstDayOfWeek: FirstDayOfWeek` (new required field).
  - `generalSettingsForm.controls.dateFormat.controls.firstDayOfWeek: FormControl<FirstDayOfWeek>` (new form control, not yet exposed in the template - Task 6 adds the UI).

- [ ] **Step 1: Write the failing tests**

Append to `packages/app/src/app/models/general-settings.model.spec.ts` (after the closing `});` of the `DEFAULT_GENERAL_SETTINGS` describe block, i.e. at the end of the file):

```typescript
describe('resolveFirstDayOfWeek', () => {
  it('maps an explicit sunday override to 7', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'sunday' },
      }),
    ).toBe(7);
  });

  it('maps an explicit monday override to 1', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'monday' },
      }),
    ).toBe(1);
  });

  it('maps an explicit saturday override to 6', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'saturday' },
      }),
    ).toBe(6);
  });

  it('derives Sunday (7) for the us language under auto', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'us' },
        dateFormat: { firstDayOfWeek: 'auto' },
      }),
    ).toBe(7);
  });

  it('derives Monday (1) for the hu language under auto', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'hu' },
        dateFormat: { firstDayOfWeek: 'auto' },
      }),
    ).toBe(1);
  });

  it('derives Sunday (7) via the DEFAULT_LOCALE fallback for an unmapped language under auto', () => {
    expect(
      resolveFirstDayOfWeek({
        language: { language: 'zz' },
        dateFormat: { firstDayOfWeek: 'auto' },
      }),
    ).toBe(7);
  });

  it('falls back to Monday (1) when the resolved locale tag is malformed', () => {
    LANGUAGE_LOCALE_MAP['bad'] = 'not a locale!!';

    try {
      expect(
        resolveFirstDayOfWeek({
          language: { language: 'bad' },
          dateFormat: { firstDayOfWeek: 'auto' },
        }),
      ).toBe(1);
    } finally {
      delete LANGUAGE_LOCALE_MAP['bad'];
    }
  });
});
```

Also update the import at the top of the same file to include the new symbols:

```typescript
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
  resolveDateFormat,
  resolveFirstDayOfWeek,
} from './general-settings.model';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `resolveFirstDayOfWeek is not a function` / `LANGUAGE_LOCALE_MAP` import error, plus the still-outstanding `DEFAULT_GENERAL_SETTINGS` failure from Task 2.

- [ ] **Step 3: Implement `FirstDayOfWeek` and `resolveFirstDayOfWeek`**

In `packages/app/src/app/models/general-settings.model.ts`:

1. Add the new type and options list right after the existing `DATE_FORMAT_PRESETS` block (after line 14, before `export const LANGUAGE_LOCALE_MAP`):

```typescript
export type FirstDayOfWeek = 'auto' | 'sunday' | 'monday' | 'saturday';

export const FIRST_DAY_OF_WEEK_OPTIONS: FirstDayOfWeek[] = ['auto', 'sunday', 'monday', 'saturday'];
```

2. Update the `GeneralSettings.dateFormat` field and `DEFAULT_GENERAL_SETTINGS.dateFormat`:

Replace:

```typescript
dateFormat: {
  preset: DateFormatPreset;
  customPattern: string;
}
```

with:

```typescript
dateFormat: {
  preset: DateFormatPreset;
  customPattern: string;
  firstDayOfWeek: FirstDayOfWeek;
}
```

Replace:

```typescript
  dateFormat: {
    preset: 'iso',
    customPattern: 'yyyy-MM-dd HH:mm',
  },
```

with:

```typescript
  dateFormat: {
    preset: 'iso',
    customPattern: 'yyyy-MM-dd HH:mm',
    firstDayOfWeek: 'auto',
  },
```

3. Add `resolveFirstDayOfWeek` at the end of the file, after `resolveDateFormat`:

```typescript
const FIXED_FIRST_DAY_OF_WEEK: Record<Exclude<FirstDayOfWeek, 'auto'>, number> = {
  sunday: 7,
  monday: 1,
  saturday: 6,
};

export function resolveFirstDayOfWeek(settings: {
  language: Pick<GeneralSettings['language'], 'language'>;
  dateFormat: Pick<GeneralSettings['dateFormat'], 'firstDayOfWeek'>;
}): number {
  const { firstDayOfWeek } = settings.dateFormat;

  if (firstDayOfWeek !== 'auto') {
    return FIXED_FIRST_DAY_OF_WEEK[firstDayOfWeek];
  }

  const locale = LANGUAGE_LOCALE_MAP[settings.language.language] ?? DEFAULT_LOCALE;

  try {
    // Intl.Locale#getWeekInfo isn't in TS's bundled lib.d.ts yet; the runtime supports it (Electron 39 / Chromium).
    const localeInfo = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
    };
    const weekInfo = localeInfo.getWeekInfo?.();
    if (weekInfo && Number.isInteger(weekInfo.firstDay)) {
      return weekInfo.firstDay;
    }
  } catch {
    // Malformed locale tag - fall through to the Monday default below.
  }

  return 1;
}
```

- [ ] **Step 4: Run the tests to verify the model tests pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests in `general-settings.model.spec.ts` pass, including `DEFAULT_GENERAL_SETTINGS`. Other suites (e.g. `general.spec.ts`) will now fail to compile/run because `GeneralSettings` requires `firstDayOfWeek` but `general.ts`'s form doesn't provide it yet - continue to Step 5 to fix that in the same task.

- [ ] **Step 5: Add the form control (no visible UI yet)**

In `packages/app/src/app/modals/settings/general/general.ts`:

1. Update the import from `../../../models/general-settings.model` to include `FirstDayOfWeek`:

```typescript
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LOCALE,
  DateFormatPreset,
  FirstDayOfWeek,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
```

2. Add the control to the `dateFormat` `FormGroup`:

Replace:

```typescript
    dateFormat: new FormGroup({
      preset: new FormControl<DateFormatPreset>('iso', { nonNullable: true }),
      customPattern: new FormControl('yyyy-MM-dd HH:mm', { nonNullable: true }),
    }),
```

with:

```typescript
    dateFormat: new FormGroup({
      preset: new FormControl<DateFormatPreset>('iso', { nonNullable: true }),
      customPattern: new FormControl('yyyy-MM-dd HH:mm', { nonNullable: true }),
      firstDayOfWeek: new FormControl<FirstDayOfWeek>('auto', { nonNullable: true }),
    }),
```

- [ ] **Step 6: Fix the existing `save` test's exact-match expectation**

In `packages/app/src/app/modals/settings/general/general.spec.ts`, in the `describe('save', ...)` block, replace:

```typescript
expect(dateFormatServiceMock.applyFromSettings).toHaveBeenCalledWith(
  expect.objectContaining({
    dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy' },
  }),
);
```

with:

```typescript
expect(dateFormatServiceMock.applyFromSettings).toHaveBeenCalledWith(
  expect.objectContaining({
    dateFormat: { preset: 'custom', customPattern: 'dd/MM/yyyy', firstDayOfWeek: 'auto' },
  }),
);
```

- [ ] **Step 7: Run the full app test suite to verify everything passes**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass, no failures.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/models/general-settings.model.ts packages/app/src/app/models/general-settings.model.spec.ts packages/app/src/app/modals/settings/general/general.ts packages/app/src/app/modals/settings/general/general.spec.ts
git commit -m "$(cat <<'EOF'
#213: add firstDayOfWeek to the settings model and form

EOF
)"
```

---

### Task 4: Wire `datePattern` and `firstDayOfWeek` into `DateFormatService`

**Files:**

- Modify: `packages/app/src/app/services/date-format.service.ts`
- Modify: `packages/app/src/app/services/date-format.service.spec.ts`

**Interfaces:**

- Consumes: `resolveDateFormat()` and `resolveFirstDayOfWeek()` from Tasks 2-3.
- Produces: `DateFormatService.resolved(): { pattern: string; datePattern: string; locale: string; firstDayOfWeek: number }`. Task 5 (`DatepickerRangeFilter`) reads `datePattern`, `locale`, and `firstDayOfWeek` from this.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/date-format.service.spec.ts`, update every `dateFormat: { ... }` object literal to include `firstDayOfWeek: 'auto'` so they keep satisfying the `GeneralSettings` type once Task 3's field is required. Apply these six replacements:

Replace:

```typescript
generalSettingsServiceMock.load.mockResolvedValue({
  ...DEFAULT_GENERAL_SETTINGS,
  dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm' },
} satisfies GeneralSettings);
```

with:

```typescript
generalSettingsServiceMock.load.mockResolvedValue({
  ...DEFAULT_GENERAL_SETTINGS,
  dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
} satisfies GeneralSettings);
```

Replace:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05.01.2024 13:07');
  });
```

with:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05.01.2024 13:07');
  });
```

Replace:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm" },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05/01/2024 at 13:07');
  });
```

with:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'custom', customPattern: "dd/MM/yyyy 'at' HH:mm", firstDayOfWeek: 'auto' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('05/01/2024 at 13:07');
  });
```

Replace:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm' },
    });

    expect(service.format('2024-01-05T13:07:00')).toBe('01/05/2024 01:07 PM');
  });
```

with:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    expect(service.format('2024-01-05T13:07:00')).toBe('01/05/2024 01:07 PM');
  });
```

Replace:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      language: { language: 'hu' },
      dateFormat: { preset: 'follow-language', customPattern: 'yyyy-MM-dd HH:mm' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('2024. 01. 05. 13:07');
  });
```

with:

```typescript
    service.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      language: { language: 'hu' },
      dateFormat: { preset: 'follow-language', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    const ts = Math.floor(new Date(2024, 0, 5, 13, 7).getTime() / 1000);
    expect(service.format(ts)).toBe('2024. 01. 05. 13:07');
  });
```

Replace:

```typescript
service.applyFromSettings({
  ...DEFAULT_GENERAL_SETTINGS,
  language: { language: 'zz' },
  dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm' },
});

const ts = 1700000000;
expect(service.format(ts)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
```

with:

```typescript
service.applyFromSettings({
  ...DEFAULT_GENERAL_SETTINGS,
  language: { language: 'zz' },
  dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
});

const ts = 1700000000;
expect(service.format(ts)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
```

Then append these new tests at the end of the file, just before the final closing `});` of the outer `describe('DateFormatService', ...)` block:

```typescript
it('defaults firstDayOfWeek to Monday (1) before init() resolves', () => {
  expect(service.resolved().firstDayOfWeek).toBe(1);
});

it('exposes the derived datePattern alongside pattern and locale via resolved()', () => {
  service.applyFromSettings({
    ...DEFAULT_GENERAL_SETTINGS,
    dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
  });

  expect(service.resolved().datePattern).toBe('dd.MM.yyyy');
});

it('exposes firstDayOfWeek resolved from the auto setting and language', () => {
  service.applyFromSettings({
    ...DEFAULT_GENERAL_SETTINGS,
    language: { language: 'hu' },
    dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
  });

  expect(service.resolved().firstDayOfWeek).toBe(1);
});

it('exposes an explicit firstDayOfWeek override regardless of language', () => {
  service.applyFromSettings({
    ...DEFAULT_GENERAL_SETTINGS,
    language: { language: 'hu' },
    dateFormat: { preset: 'iso', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'sunday' },
  });

  expect(service.resolved().firstDayOfWeek).toBe(7);
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `service.resolved().datePattern` and `service.resolved().firstDayOfWeek` are `undefined`.

- [ ] **Step 3: Implement the service changes**

Replace the entire contents of `packages/app/src/app/services/date-format.service.ts` with:

```typescript
import { formatDate } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_LOCALE,
  GeneralSettings,
  resolveDateFormat,
  resolveFirstDayOfWeek,
} from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';

const ISO_FALLBACK_PATTERN = 'yyyy-MM-dd HH:mm';
const ISO_FALLBACK_DATE_PATTERN = 'yyyy-MM-dd';

@Injectable({ providedIn: 'root' })
export class DateFormatService {
  private readonly generalSettingsService = inject(GeneralSettingsService);

  private readonly _pattern = signal(ISO_FALLBACK_PATTERN);
  private readonly _datePattern = signal(ISO_FALLBACK_DATE_PATTERN);
  private readonly _locale = signal(DEFAULT_LOCALE);
  private readonly _firstDayOfWeek = signal(1);

  public readonly resolved = computed(() => ({
    pattern: this._pattern(),
    datePattern: this._datePattern(),
    locale: this._locale(),
    firstDayOfWeek: this._firstDayOfWeek(),
  }));

  public async init(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this.applyFromSettings(settings);
  }

  public applyFromSettings(settings: GeneralSettings): void {
    const { pattern, datePattern, locale } = resolveDateFormat(settings);
    this._pattern.set(pattern);
    this._datePattern.set(datePattern);
    this._locale.set(locale);
    this._firstDayOfWeek.set(resolveFirstDayOfWeek(settings));
  }

  public format(value: number | string | undefined): string {
    if (!value) return '';

    let date: Date;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      // If it's a finite number, use it only if > 0
      if (numeric <= 0) return '';
      date = new Date(numeric * 1000);
    } else if (typeof value === 'string') {
      // Only try ISO parse if the numeric parse gave NaN
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed)) return '';
      date = new Date(parsed);
    } else {
      return '';
    }

    try {
      return formatDate(date, this._pattern(), this._locale());
    } catch (error) {
      console.warn('[date-format] failed to format date, falling back to ISO default', error);
      return formatDate(date, ISO_FALLBACK_PATTERN, 'en-US');
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/date-format.service.ts packages/app/src/app/services/date-format.service.spec.ts
git commit -m "$(cat <<'EOF'
#213: expose datePattern and firstDayOfWeek from DateFormatService

EOF
)"
```

---

### Task 5: Update `DatepickerRangeFilter` - date format, first day of week, pill shape, popup close fix, button icons

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`

**Interfaces:**

- Consumes: `DateFormatService.resolved()` from Task 4 (`datePattern`, `locale`, `firstDayOfWeek`).
- Produces: nothing consumed by later tasks - this is the leaf component.

- [ ] **Step 1: Write the failing tests**

Append to `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`, just before the final closing `});` of the outer `describe('DatepickerRangeFilter', ...)` block:

```typescript
describe('fmt with a non-default date format', () => {
  it('formats using the eu preset date-only pattern from DateFormatService', () => {
    const dateFormatService = TestBed.inject(DateFormatService);
    dateFormatService.applyFromSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
    });

    expect(component.fmt(new NgbDate(2024, 3, 5))).toBe('05.03.2024');
  });
});

describe('isRangeStart', () => {
  it('is false when no date is selected', () => {
    component.fromDate = null;
    component.toDate = null;
    expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(false);
  });

  it('is false for a single selected date with no hover and no toDate', () => {
    component.fromDate = new NgbDate(2024, 1, 10);
    component.toDate = null;
    component.hoveredDate = null;
    expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(false);
  });

  it('is true for the fromDate once a toDate is set', () => {
    component.fromDate = new NgbDate(2024, 1, 10);
    component.toDate = new NgbDate(2024, 1, 20);
    expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(true);
  });

  it('is true for the fromDate while hovering past it with no toDate yet', () => {
    component.fromDate = new NgbDate(2024, 1, 10);
    component.toDate = null;
    component.hoveredDate = new NgbDate(2024, 1, 15);
    expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(true);
  });

  it('is false for a date other than fromDate', () => {
    component.fromDate = new NgbDate(2024, 1, 10);
    component.toDate = new NgbDate(2024, 1, 20);
    expect(component.isRangeStart(new NgbDate(2024, 1, 15))).toBe(false);
  });
});
```

Add these imports at the top of the same file, alongside the existing ones:

```typescript
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `component.isRangeStart is not a function`.

- [ ] **Step 3: Update the component class**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`:

1. Add imports (alongside the existing ones at the top):

```typescript
import { formatDate } from '@angular/common';
import { DateFormatService } from '../../services/date-format.service';
```

2. Inject the service (add next to the existing `private readonly i18n = inject(NgbDatepickerI18n);` line):

```typescript
  private readonly dateFormatService = inject(DateFormatService);
```

3. Replace the `fmt` method:

Replace:

```typescript
  fmt(d: NgbDate) {
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  }
```

with:

```typescript
  fmt(d: NgbDate): string {
    const { datePattern, locale } = this.dateFormatService.resolved();
    return formatDate(new Date(d.year, d.month - 1, d.day), datePattern, locale);
  }
```

4. Replace `isHovered` and add `isRangeStart` / `hasActiveHoverRange`:

Replace:

```typescript
  isHovered(date: NgbDate) {
    return (
      this.fromDate &&
      !this.toDate &&
      this.hoveredDate &&
      date.after(this.fromDate) &&
      date.before(this.hoveredDate)
    );
  }
```

with:

```typescript
  isHovered(date: NgbDate) {
    return this.hasActiveHoverRange() && date.after(this.fromDate!) && date.before(this.hoveredDate!);
  }
  isRangeStart(date: NgbDate): boolean {
    return !!this.isFrom(date) && (!!this.toDate || this.hasActiveHoverRange());
  }
  private hasActiveHoverRange(): boolean {
    return !!(
      this.fromDate &&
      !this.toDate &&
      this.hoveredDate &&
      this.hoveredDate.after(this.fromDate)
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass.

- [ ] **Step 5: Update the template**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`:

1. Stop `mousedown`/`touchstart` from reaching `document` (fixes the popup auto-closing on date selection - ag-grid's `PopupService` closes modal popups via a `document`-level `mousedown`/`touchstart` listener; stopping propagation here means that listener never sees clicks inside this popup, while outside clicks - which never touch this element - still close it normally):

Replace:

```html
<div class="bb-datefilter p-2"></div>
```

with:

```html
<div
  class="bb-datefilter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
></div>
```

2. Bind `firstDayOfWeek` on the calendar:

Replace:

```html
<ngb-datepicker
  #dp
  [displayMonths]="2"
  [dayTemplate]="t"
  [outsideDays]="'collapsed'"
  [navigation]="'none'"
  (navigate)="onNavigate($event)"
  (dateSelect)="onSelect($event)"
>
</ngb-datepicker>
```

with:

```html
<ngb-datepicker
  #dp
  [displayMonths]="2"
  [dayTemplate]="t"
  [outsideDays]="'collapsed'"
  [navigation]="'none'"
  [firstDayOfWeek]="dateFormatService.resolved().firstDayOfWeek"
  (navigate)="onNavigate($event)"
  (dateSelect)="onSelect($event)"
>
</ngb-datepicker>
```

3. Add the pill-shape modifier class to the day template:

Replace:

```html
<span
  class="bb-day"
  [class.bb-day--from]="isFrom(date)"
  [class.bb-day--to]="isTo(date)"
  [class.bb-day--between]="isInside(date) || isHovered(date)"
  [class.bb-day--today]="isToday(date)"
  (mouseenter)="hoveredDate = date"
  (mouseleave)="hoveredDate = null"
></span>
```

with:

```html
<span
  class="bb-day"
  [class.bb-day--from]="isFrom(date)"
  [class.bb-day--from-range]="isRangeStart(date)"
  [class.bb-day--to]="isTo(date)"
  [class.bb-day--between]="isInside(date) || isHovered(date)"
  [class.bb-day--today]="isToday(date)"
  (mouseenter)="hoveredDate = date"
  (mouseleave)="hoveredDate = null"
></span>
```

4. Move the icons to the end of the Today/Clear buttons:

Replace:

```html
<bb-btn-content
  [icon]="icons.faCalendarDay"
  [text]="'general.button.today' | translate"
></bb-btn-content>
```

with:

```html
<bb-btn-content
  [icon]="icons.faCalendarDay"
  [text]="'general.button.today' | translate"
  [position]="'end'"
></bb-btn-content>
```

Replace:

```html
<button class="btn btn-sm btn-outline-secondary btn-split" type="button" (click)="clear()">
  <bb-btn-content
    [icon]="icons.faEraser"
    [text]="'general.button.clear' | translate"
  ></bb-btn-content>
</button>
```

with:

```html
<button class="btn btn-sm btn-outline-secondary btn-split" type="button" (click)="clear()">
  <bb-btn-content
    [icon]="icons.faEraser"
    [text]="'general.button.clear' | translate"
    [position]="'end'"
  ></bb-btn-content>
</button>
```

- [ ] **Step 6: Update the pill-shape CSS**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss`, replace:

```scss
  &--from,
  &--to {
    background-color: var(--bb-dp-accent) !important;
    color: var(--bb-dp-accent-ink) !important;
    border-radius: 50% !important;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 2;
  }

  &--between {
```

with:

```scss
  &--from,
  &--to {
    background-color: var(--bb-dp-accent) !important;
    color: var(--bb-dp-accent-ink) !important;
    border-radius: 50% !important;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 2;
  }

  &--from.bb-day--from-range {
    border-radius: 50% 0 0 50% !important;
  }

  &--to {
    border-radius: 0 50% 50% 0 !important;
  }

  &--between {
```

- [ ] **Step 7: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass.

- [ ] **Step 8: Run lint**

Run: `npm run lint`
Expected: zero errors, zero warnings.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter
git commit -m "$(cat <<'EOF'
#213: date-format-aware chips, pill selection shape, first day of week, and popup auto-close fix

EOF
)"
```

---

### Task 6: Add the "First day of week" dropdown to General settings

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts`
- Modify: `packages/app/src/app/modals/settings/general/general.html`
- Modify: `packages/app/src/app/modals/settings/general/general.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: `FIRST_DAY_OF_WEEK_OPTIONS` from Task 3, `generalSettingsForm.controls.dateFormat.controls.firstDayOfWeek` (already added in Task 3).
- Produces: `General.firstDayOfWeekOptions(): { value: FirstDayOfWeek; label: string }[]` - not consumed elsewhere, this is the leaf UI task.

- [ ] **Step 1: Write the failing tests**

Append to `packages/app/src/app/modals/settings/general/general.spec.ts`, just before the final closing `});` of the outer `describe('General', ...)` block:

```typescript
describe('firstDayOfWeekOptions', () => {
  it('includes auto plus the three explicit weekday choices, each with a translated label', () => {
    const items = component.firstDayOfWeekOptions();
    expect(items.map((i) => i.value)).toEqual(['auto', 'sunday', 'monday', 'saturday']);
    expect(items.every((i) => i.label.length > 0)).toBe(true);
  });
});

describe('save with firstDayOfWeek', () => {
  it('persists the selected firstDayOfWeek value', async () => {
    component.generalSettingsForm.controls.dateFormat.controls.firstDayOfWeek.setValue('sunday');

    const saveCallback = stateServiceMock.registerSave.mock.calls[0][1];
    await saveCallback();

    expect(dateFormatServiceMock.applyFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFormat: expect.objectContaining({ firstDayOfWeek: 'sunday' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `component.firstDayOfWeekOptions is not a function`.

- [ ] **Step 3: Add the computed options list**

In `packages/app/src/app/modals/settings/general/general.ts`:

1. Update the import to include `FIRST_DAY_OF_WEEK_OPTIONS`:

```typescript
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LOCALE,
  DateFormatPreset,
  FIRST_DAY_OF_WEEK_OPTIONS,
  FirstDayOfWeek,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
```

2. Add the computed signal right before `public isCustomDateFormat`:

Replace:

```typescript
  public isCustomDateFormat = computed<boolean>(
    () => this.formSnapshot().dateFormat.preset === 'custom',
  );
```

with:

```typescript
  public firstDayOfWeekOptions = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return FIRST_DAY_OF_WEEK_OPTIONS.map((value) => ({
      value,
      label: this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.first-day-of-week.${value}`,
      ),
    }));
  });

  public isCustomDateFormat = computed<boolean>(
    () => this.formSnapshot().dateFormat.preset === 'custom',
  );
```

- [ ] **Step 4: Add the translations**

In `public/i18n/us.json`, replace:

```json
              "preview": "Preview",
              "preset": {
```

with:

```json
              "preview": "Preview",
              "first-day-of-week-label": "First day of week",
              "first-day-of-week": {
                "auto": "Auto",
                "sunday": "Sunday",
                "monday": "Monday",
                "saturday": "Saturday"
              },
              "preset": {
```

In `public/i18n/hu.json`, replace:

```json
              "preview": "Előnézet",
              "preset": {
```

with:

```json
              "preview": "Előnézet",
              "first-day-of-week-label": "A hét első napja",
              "first-day-of-week": {
                "auto": "Automatikus",
                "sunday": "Vasárnap",
                "monday": "Hétfő",
                "saturday": "Szombat"
              },
              "preset": {
```

- [ ] **Step 5: Add the dropdown to the template**

In `packages/app/src/app/modals/settings/general/general.html`, replace:

```html
            </div>
          </div>

          @if (isCustomDateFormat()) {
```

with:

```html
            </div>
          </div>

          <div class="row mb-3">
            <div class="col-6 d-flex align-items-center">
              {{
                'pages.settings.tab.general.general-settings-form.date-format.first-day-of-week-label'
                  | translate
              }}
            </div>

            <div class="col-6">
              <ng-select
                [items]="firstDayOfWeekOptions()"
                [clearable]="false"
                [openOnEnter]="false"
                [clearSearchOnAdd]="true"
                [searchable]="false"
                bindLabel="label"
                bindValue="value"
                formControlName="firstDayOfWeek"
              >
              </ng-select>
            </div>
          </div>

          @if (isCustomDateFormat()) {
```

- [ ] **Step 6: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: zero errors, zero warnings.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/settings/general public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#213: add a first day of week dropdown to General settings

EOF
)"
```

---

### Task 7: Manual verification in the running app

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the app**

Run: `npm start`
Expected: Angular dev server, `tsc --watch`, and Electron all start; the Electron window opens to the login page (or main grid if a default server is configured).

- [ ] **Step 2: Verify the date chip formatting**

In Settings > General > Date & Time, set the preset to each of ISO / US / European / Custom in turn. For each, open the filter popup on the "Added On" column (or another date column) and confirm the `from`/`to` chips at the bottom-left show a date-only value matching that preset's convention (no time-of-day component), e.g. `2026-07-10` for ISO, `07/10/2026` for US, `10.07.2026` for European.

- [ ] **Step 3: Verify selection visuals**

In the same filter popup, click a single day and confirm it renders as a full circle. Click a second, later day and confirm the first day becomes rounded-left/square-right, the days between are flat, and the second day is square-left/rounded-right - reading as one continuous pill shape.

- [ ] **Step 4: Verify the popup stays open through selection and closes only outside**

Click a first date - confirm the popup stays open. Click a second date - confirm it still stays open. Click anywhere outside the popup (e.g. a grid row) - confirm it now closes.

- [ ] **Step 5: Verify the button row**

Confirm "Today" and "Clear" now show their icon after the label text.

- [ ] **Step 6: Verify first day of week**

With language set to English (US), open the filter popup and confirm the calendar's week starts on Sunday. Switch language to Hungarian, reopen the popup, confirm the week now starts on Monday. In Settings > General > Date & Time > First day of week, explicitly pick "Saturday" and confirm the calendar reflects that regardless of language.

- [ ] **Step 7: Report results**

If any check in Steps 2-6 fails, note exactly which one and the observed vs. expected behavior before proceeding further.
