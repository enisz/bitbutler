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
  pattern syntax, accepts a locale parameter, has locale-aware predefined
  formats (`'short'`, `'medium'`, ...), and throws on an invalid pattern
  (catchable).
- An invalid custom pattern must never break the visible app - it degrades
  to the ISO default everywhere except the Settings preview, where the error
  is shown so the user can fix it. Saving is never blocked by an invalid
  pattern.

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
    if (!value || Number(value) <= 0) return '';
    const date = new Date(Number(value) * 1000);

    try {
      return formatDate(date, this._pattern(), this._locale());
    } catch (error) {
      console.warn('[date-format] invalid pattern, falling back to ISO default', error);
      return formatDate(date, 'yyyy-MM-dd HH:mm', this._locale());
    }
  }
}
```

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
  unsaved_ form value formatted against "now". If `formatDate()` throws for
  that value, the preview line shows a translated "Invalid format" message
  instead of a date.
- The Save button is never blocked by an invalid custom pattern - it can be
  saved as-is. `DateFormatService.format()`'s try/catch fallback means it
  just won't visibly take effect anywhere until corrected; the live preview
  in Settings is the only place the error surfaces.
- On save, `general.ts`'s existing `save()` method calls
  `dateFormatService.applyFromSettings(settings)`, the same way it already
  calls `themeService.applyFromSettings(...)`.

## i18n

New translation keys in `public/i18n/us.json` and `public/i18n/hu.json`
under `pages.settings.tab.general`: fieldset legend, the 5 preset labels,
custom-pattern input label/placeholder, and the "Invalid format" message.

## Testing

- Unit tests for `resolveDateFormat()`: all 5 presets x both languages,
  plus an unmapped-language fallback case.
- Unit tests for `DateFormatService.format()`: empty/undefined/zero input
  (existing behavior preserved), valid custom pattern, invalid custom
  pattern falls back to ISO, preset switching updates output.
- Update `local-timestamp-pipe.spec.ts` and `ui-format.service.spec.ts` to
  provide a fake/mock `DateFormatService`.
- Update `grid.spec.ts` mocks to account for the new service dependency and
  the `refreshCells` call on format change.
- New `general.spec.ts` cases: selecting "Custom" reveals the pattern input
  and preview, an invalid pattern shows the error state but does not disable
  Save, saving persists `dateFormat` and calls
  `dateFormatService.applyFromSettings`.
