# Configurable Date/Time Format - Design

Fixes #213

## Problem

Every date/time shown in the app (grid columns, torrent details, import/exists
modals, About) is rendered by a single hardcoded formatter that always
produces `yyyy-MM-dd HH:mm`, regardless of the user's language or preference.
There is no way to make dates follow locale conventions (day/month order, 12h
vs 24h, separators) or to pick a specific layout.

## Current state

All absolute-date formatting in the app already funnels through one place:
`LocalTimestampPipe` (`packages/app/src/app/pipes/local-timestamp-pipe.ts`).
It is used directly in three templates (`about`, `import-torrents`,
`torrent-exists`) and wrapped by `UiFormatService.localTimestamp`, which four
AG Grid columns use as their `valueFormatter` (`grid.lib.ts`). No date
library (date-fns/dayjs/moment) is installed anywhere in the repo.

`GeneralSettings` (`packages/app/src/app/models/general-settings.model.ts`)
already has a `language.language` field (`'us' | 'hu'`), persisted through
`GeneralSettingsService` (a `BaseSettingsService` backed by IPC/sqlite). These
codes are app-internal, not real BCP-47 locale tags.

## Goals

- Dates follow the app's language/locale automatically by default option, or
  a fixed preset (ISO/US/EU), or a fully custom user-typed pattern.
- Backward compatible: existing installs must keep showing exactly today's
  format (`yyyy-MM-dd HH:mm`) after upgrade, until the user opts into
  something else.
- No new runtime dependency - use Angular's own `formatDate()` /
  `DatePipe` machinery (`@angular/common`), which already supports this exact
  pattern syntax, accepts a locale parameter, and has locale-aware
  predefined formats (`'short'`, `'medium'`, ...).
- A custom pattern is never rejected. `formatDate()` was verified empirically
  (see "Verified `formatDate()` behavior" below) to be extremely permissive
  about pattern _text_ - it does not throw for unrecognized token letters or
  malformed-looking strings, it just substitutes whatever those letters mean
  per Angular's rules (which may look surprising if the literal text happens
  to contain letters like `y`/`M`/`d`/`a`). This is exactly what was asked
  for: the user can type anything and see exactly what they get, with no
  artificial validation in the way.
- What `formatDate()` _does_ throw on - an unregistered locale (`NG0701`)
  and an actually-invalid `Date` object (`NG02311`) - must never reach the
  user. `DateFormatService` guards both: it only ever passes known-registered
  locales, and it validates the input timestamp before constructing a `Date`.
  A defensive try/catch around the format call still falls back to the ISO
  pattern with a hardcoded `en-US` locale, purely as a safety net (e.g. a
  future language added without registering its Angular locale data).

## Non-goals

- Relative/humanized durations (`HumanizeDurationPipe`) are untouched - out
  of scope.
- No arbitrary new date library; no attempt to support every possible CLDR
  pattern token beyond what Angular's `formatDate` already supports.
- No per-field overrides (e.g. different format for the grid vs. modals) -
  one global setting applies everywhere `LocalTimestampPipe` is used.

## Data model

Add a `dateFormat` section to `GeneralSettings`:

```ts
export type DateFormatPreset = 'follow-language' | 'iso' | 'us' | 'eu' | 'custom';

export interface GeneralSettings {
  // ...existing fields
  dateFormat: {
    preset: DateFormatPreset;
    customPattern: string;
  };
}
```

Default (backward-compatible):

```ts
dateFormat: {
  preset: 'iso',
  customPattern: 'yyyy-MM-dd HH:mm',
},
```

`customPattern` always holds a value (seeded with the ISO pattern) so
switching the dropdown to "Custom" starts from a valid, non-empty string
rather than blank.

### Presets

Each preset except `follow-language` maps to a fixed Angular date-format
pattern string. `follow-language` uses Angular's locale-aware `'short'`
predefined format, resolved against the locale mapped from the current
language setting.

| Preset            | Pattern                    | Example (en-US)     | Example (hu-HU)     |
| ----------------- | -------------------------- | ------------------- | ------------------- |
| `follow-language` | `'short'`                  | 7/10/26, 2:30 PM    | 2026. 07. 10. 14:30 |
| `iso` (default)   | `'yyyy-MM-dd HH:mm'`       | 2026-07-10 14:30    | 2026-07-10 14:30    |
| `us`              | `'MM/dd/yyyy hh:mm a'`     | 07/10/2026 02:30 PM | 07/10/2026 02:30 PM |
| `eu`              | `'dd.MM.yyyy HH:mm'`       | 10.07.2026 14:30    | 10.07.2026 14:30    |
| `custom`          | `dateFormat.customPattern` | user-defined        | user-defined        |

### Locale mapping

```ts
export const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  us: 'en-US',
  hu: 'hu-HU',
};
export const DEFAULT_LOCALE = 'en-US';
```

Lookup falls back to `DEFAULT_LOCALE` for any language code not present in
the map, so forgetting to update this map when a new app language is added
degrades safely (the `follow-language` preset silently uses US formatting
for that language) instead of throwing.

Adding a new app language already requires several coordinated additions (a
new `i18n/xx.json`, a new entry in `general.ts`'s `languages` list, a flag
icon class); adding one line to `LANGUAGE_LOCALE_MAP` follows the same
pattern.

## Verified `formatDate()` behavior

Confirmed by running probes through the project's actual `ng test` builder
(not just reading docs) against the installed `@angular/common@20.3.22`:

| Input                                                                                                           | Result                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'not[[a valid pattern'`                                                                                        | `'not[[PM vPMli5 pPMttern'` (no throw - letters that happen to match token codes like `a`/`d` get substituted, everything else passes through literally) |
| `'yyyyyyyyyy'`, `'xyz123'`, `'{{{}}}'`, unterminated `'quote`, empty string                                     | All format without throwing, producing "weird but deterministic" output                                                                                  |
| Invalid `Date` object (e.g. `new Date(NaN)`) with any pattern                                                   | Throws `NG02311: Unable to convert "Invalid Date" into a date`                                                                                           |
| A locale with no registered CLDR data (e.g. `'zz-ZZ'`, or `'hu-HU'` before `registerLocaleData(localeHu)` runs) | Throws `NG0701: Missing locale data for the locale "..."` - for **any** pattern, not just named formats like `'short'`                                   |
| `'short'` with `hu-HU` once `registerLocaleData(localeHu)` has run                                              | `'2024. 01. 05. 13:07'` (vs. `'1/5/24, 1:07 PM'` for `en-US`) - confirms the `follow-language` preset works as intended                                  |

Practical consequence: `registerLocaleData(localeHu)` at bootstrap is not
an accuracy nicety, it is required - without it, _every_ date display
would throw for users on the `hu` language, regardless of preset.

## Format resolution

A pure function, colocated with the model
(`packages/app/src/app/models/general-settings.model.ts` or a new
`date-format.model.ts`):

```ts
function resolveDateFormat(settings: GeneralSettings): { pattern: string; locale: string } {
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

## `DateFormatService`

New `packages/app/src/app/services/date-format.service.ts`, modeled on the
existing `ThemeService` (`packages/app/src/app/services/theme.service.ts`):
signal-backed, loaded via `provideAppInitializer` in `app.config.ts` so it is
resolved before the app's first render (same as `ThemeService.init()` today).

```ts
@Injectable({ providedIn: 'root' })
export class DateFormatService {
  private readonly _pattern = signal('yyyy-MM-dd HH:mm');
  private readonly _locale = signal(DEFAULT_LOCALE);

  private readonly generalSettingsService = inject(GeneralSettingsService);

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
      return formatDate(date, 'yyyy-MM-dd HH:mm', 'en-US');
    }
  }
}
```

`Number.isFinite(numeric)` (rather than the original `Number(value) <= 0`
check alone) guards against non-numeric input such as `"banana"`, where
`Number("banana")` is `NaN` and `NaN <= 0` is `false` - so the old check
would have let it through to construct an `Invalid Date`, which
`formatDate()` throws on. The fallback branch hardcodes `'en-US'` rather
than reusing `this._locale()`, because if the _locale_ is what's broken
(e.g. missing registration), re-using it in the fallback would throw again,
uncaught. `en-US` is Angular's built-in default and always available.

`app.config.ts` additions:

- `registerLocaleData(localeHu)` (from `@angular/common/locales/hu`) at
  bootstrap - required for Angular's `'short'` format and any locale month
  names to resolve correctly for Hungarian. `en-US` is Angular's built-in
  default and needs no registration.
- `provideAppInitializer(() => inject(DateFormatService).init())`, alongside
  the existing `ThemeService` initializer.

## Pipe & grid integration

`LocalTimestampPipe` becomes a thin delegator:

```ts
@Pipe({ name: 'localTimestamp', standalone: true, pure: false })
export class LocalTimestampPipe implements PipeTransform {
  private readonly dateFormatService = inject(DateFormatService);

  transform(value: number | string | undefined): string {
    return this.dateFormatService.format(value);
  }
}
```

Marking it `pure: false` matches Angular's own built-in `DatePipe`, which
does the same thing for exactly this reason: a pure pipe only re-runs when
its bound input changes, so it would otherwise never notice the format
setting changing behind the scenes. Because the app is zoneless
(signal-driven change detection), the added cost of an impure pipe is
negligible - CD only runs when something actually changed.

`UiFormatService.localTimestamp` (used as the AG Grid `valueFormatter` for 4
columns) delegates to the same `DateFormatService.format()` and needs no
further change - AG Grid already calls the formatter fresh on every render
pass.

`grid.ts` currently refreshes column headers on language change
(`grid.ts:293`, `translateService.onLangChange` -> `refreshColumnHeaders()`).
Add a parallel subscription to `DateFormatService`'s resolved format (via
`toObservable`) that calls `this.api?.refreshCells({ force: true })`, so an
already-open grid updates immediately when the user changes the date format
in Settings, without needing to reopen or re-navigate.

## Settings UI

New "Date & Time" fieldset in
`packages/app/src/app/modals/settings/general/general.html`, placed after
the existing "Language" fieldset (the `follow-language` preset and AM/PM
spelling depend on the resolved language).

Form group added to `generalSettingsForm` in `general.ts`:

```ts
dateFormat: new FormGroup({
  preset: new FormControl<DateFormatPreset>('iso', { nonNullable: true }),
  customPattern: new FormControl('yyyy-MM-dd HH:mm', { nonNullable: true }),
}),
```

- An `ng-select` dropdown lists the 5 presets, reusing the existing
  option/label template pattern already used for Language/Appearance in this
  file. Each option's translated label includes a live example next to it
  (e.g. "ISO - 2026-07-10 14:30"), computed via a signal that recalculates
  on language change and on any `dateFormat` form value change (same
  `languageChanged`-driven pattern already used for `languages()`/`modes()`
  in `general.ts`).
- When `preset === 'custom'`, a text input for `customPattern` appears below
  the dropdown, with a live preview line underneath showing the _current
  unsaved_ form value formatted against "now", via the same `resolveDateFormat`
  - `formatDate` path `DateFormatService` uses. Per the verified behavior
    above, this preview will not reject or flag most "unusual" input - typing
    `'my format'` shows exactly what that produces (letters that happen to
    collide with tokens get substituted), which is the intended behavior: no
    artificial validation, what you type is what you get. The preview call is
    still wrapped in try/catch as defense in depth (falls back to showing the
    ISO-formatted value with a translated "Preview unavailable" note) for the
    pathological case of a runtime error unrelated to the pattern text itself.
- The Save button is never blocked - any `customPattern` string can be saved
  as-is, since there is no validity concept to block on for pattern text.
- On save, `general.ts`'s existing `save()` method calls
  `dateFormatService.applyFromSettings(settings)`, the same way it already
  calls `themeService.applyFromSettings(...)`.

## i18n

New translation keys in `public/i18n/us.json` and `public/i18n/hu.json`
under `pages.settings.tab.general`: fieldset legend, the 5 preset labels,
custom-pattern input label/placeholder, and the "Preview unavailable"
fallback message.

## Testing

- Unit tests for `resolveDateFormat()`: all 5 presets x both languages,
  plus an unmapped-language fallback case.
- Unit tests for `DateFormatService.format()`: empty/undefined/zero/non-numeric
  input all return `''` (existing behavior preserved, plus the
  `Number.isFinite` fix for non-numeric strings), a custom pattern with
  ordinary separators formats as typed, a custom pattern whose letters
  collide with format tokens formats per Angular's substitution rules
  (locking in the verified behavior so it's not mistaken for a bug later),
  and a request for an unregistered locale falls back to the ISO pattern
  in `en-US` instead of throwing.
- Update `local-timestamp-pipe.spec.ts` to construct the pipe via `TestBed`
  instead of `new LocalTimestampPipe()`, since it now injects
  `DateFormatService`. `ui-format.service.spec.ts` already uses `TestBed`
  and needs no changes - `DateFormatService`'s own dependency chain resolves
  through the existing global `window.bitbutler.settings.get` test stub.
- Update `grid.spec.ts` mocks to account for the new service dependency and
  the `refreshCells` call on format change.
- New `general.spec.ts` cases: selecting "Custom" reveals the pattern input
  and live preview, saving persists `dateFormat` and calls
  `dateFormatService.applyFromSettings`.
