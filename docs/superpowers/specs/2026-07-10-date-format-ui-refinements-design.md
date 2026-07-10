# Date & Time Settings UI Refinements - Design

Fixes #213

## Problem

The Date & Time fieldset added to General Settings (`packages/app/src/app/modals/settings/general/`)
works, but has four rough edges:

1. The preset `ng-select` renders each option as one concatenated string
   (`"ISO - 2026-07-10 14:32"`), so the label and the live example aren't
   visually distinguished.
2. When "Custom" is selected, there's no reference for what tokens
   (`yyyy`, `MM`, `HH`, ...) the pattern input accepts - a user has to
   already know Angular's `formatDate` syntax.
3. The custom pattern input has no way to revert to the shipped default
   short of retyping it by hand.
4. Not every date shown in the app goes through the new configurable
   formatting yet.

## Current state

- `general.ts` builds `dateFormatPresets()` as a flat
  `{ value, label }[]` where `label` already has the example baked in via
  string concatenation.
- `previewDateFormat(preset, language, customPattern)` (in `general.ts`)
  resolves a preset to a pattern/locale via `resolveDateFormat()` and
  formats "now" with it - this is the one place that knows how to render an
  example for a given preset, and is reused for both the dropdown examples
  and the custom-pattern preview line.
- `.bb-filter-input` / `.bb-filter-clear` (`packages/app/src/styles.scss:1204-1227`)
  is an existing, already-reused pattern (filter-group, manage-tags,
  manage-categories, manage-servers, save-path-select) for a text input with
  a small trailing icon button: `position: relative` wrapper + absolutely
  positioned button at `right: 0.4rem`, `top: 50%`. It is not
  filter-specific despite the name - it's the app's general "input with a
  trailing icon action" pattern.
- All absolute-date rendering funnels through `LocalTimestampPipe` /
  `UiFormatService.localTimestamp`, **except**:
  - `torrent-details/general.html` - four fields (`last_activity`,
    `added_on`, `completion_on`, `properties.creation_date`) still use a
    hardcoded `| date: 'yyyy-MM-dd HH:mm:ss'` with a manual `* 1000`.
  - `update-available.html` - `release.published_at | date: 'yyyy-MM-dd'`.
    This value is a GitHub API ISO datetime **string**, not epoch seconds,
    so `DateFormatService.format()` (which does `Number(value) * 1000`)
    can't handle it as-is.

## Goals

- Preset dropdown: label left-aligned, live example right-aligned, in both
  the open list and the closed/selected value.
- A compact, always-available reference table of supported format tokens,
  shown under the custom-pattern preview when "Custom" is selected.
- A reset control on the custom-pattern input that restores
  `DEFAULT_GENERAL_SETTINGS.dateFormat.customPattern` into the form control
  only (not saved until the user hits Save).
- Every date shown anywhere in the app - including torrent details and the
  update-available release list - renders through the user's configured
  format.

## Non-goals

- No changes to the set of presets or the resolution logic
  (`resolveDateFormat`) itself.
- No per-field format overrides.
- No new date library.

## 1. Preset `ng-select` item template

`dateFormatPresets()` changes from `{ value, label }[]` to
`{ value, label, example }[]`:

```ts
public dateFormatPresets = computed<{ value: DateFormatPreset; label: string; example: string }[]>(
  () => {
    this.languageChanged();
    const snapshot = this.formSnapshot();
    const language = snapshot.language.language;
    const customPattern = snapshot.dateFormat.customPattern;

    return DATE_FORMAT_PRESETS.map((preset) => ({
      value: preset,
      label: this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.preset.${preset}`,
      ),
      example: this.previewDateFormat(preset, language, customPattern),
    }));
  },
);
```

The `ng-select` in `general.html` gets `ng-option-tmp` and `ng-label-tmp`
templates (same shape as the existing `language` select's templates),
rendering:

```html
<div class="d-flex justify-content-between align-items-center">
  <span>{{ item.label }}</span>
  <span class="text-muted ms-3">{{ item.example }}</span>
</div>
```

`example` for the `custom` row uses the same `previewDateFormat('custom', ...)`
call already used for the preview line below the input, so it stays in sync
with whatever the user has typed.

## 2. Format token guide table

Shown only when `isCustomDateFormat()` is true, directly below the existing
preview line. A static list of tokens, each rendered with a live example
(via `previewDateFormat`-style formatting of a single token against "now"
and the current locale):

| Token  | Meaning                  |
| ------ | ------------------------ |
| `yyyy` | 4-digit year             |
| `yy`   | 2-digit year             |
| `MMMM` | Full month name          |
| `MMM`  | Abbreviated month name   |
| `MM`   | 2-digit month            |
| `M`    | Month number             |
| `EEEE` | Full weekday name        |
| `EEE`  | Abbreviated weekday name |
| `dd`   | 2-digit day of month     |
| `d`    | Day of month             |
| `HH`   | 2-digit hour (24h)       |
| `H`    | Hour (24h)               |
| `hh`   | 2-digit hour (12h)       |
| `h`    | Hour (12h)               |
| `mm`   | 2-digit minute           |
| `ss`   | 2-digit second           |
| `a`    | AM/PM marker             |

A new computed `dateFormatTokenGuide()` in `general.ts` builds this list
(token + translated description key + example formatted with
`formatDate(new Date(), token, locale)`, guarded the same way
`previewDateFormat` already guards invalid patterns). A short line above the
table notes that literal text can be escaped in single quotes (e.g.
`'at'`), since that's already-supported, tested behavior
(`date-format.service.spec.ts`) that isn't otherwise discoverable.

New translation keys under
`pages.settings.tab.general.general-settings-form.date-format.token-guide.*`
for the table's heading and each token's description, in both `us.json` and
`hu.json`.

## 3. Reset icon on the custom pattern input

Wrap the existing custom-pattern `<input>` the same way `.bb-filter-input`
wraps other inputs, and add a trailing button using `.bb-filter-clear`
styling with a `faRotateLeft` icon (not `faXmark` - this restores a default,
it doesn't clear to empty) and an `ngbTooltip`/aria-label translated as
"Reset to default":

```html
<div class="bb-filter-input">
  <input type="text" class="form-control" formControlName="customPattern" />
  <button
    type="button"
    class="bb-filter-clear"
    [ngbTooltip]="'...reset-tooltip' | translate"
    (click)="resetCustomPattern()"
  >
    <fa-icon [icon]="icons['faRotateLeft']"></fa-icon>
  </button>
</div>
```

```ts
public resetCustomPattern(): void {
  this.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
    DEFAULT_GENERAL_SETTINGS.dateFormat.customPattern,
  );
}
```

The button is always visible (not conditional on the field being dirty) -
it's a fixed action, not a per-value affordance, and unconditional is
simpler and still harmless to click when already at the default.

## 4. App-wide date audit

Every other date-rendering call site was checked. Two gaps, both fixed by
routing through the existing `localTimestamp` pipe:

### `torrent-details/general.html`

Four fields change from `{{ x * 1000 | date: 'yyyy-MM-dd HH:mm:ss' }}` (and
matching `ngbTooltip` bindings) to `{{ x | localTimestamp }}` /
`[ngbTooltip]="x | localTimestamp"`. `DatePipe` import is dropped from the
component; `LocalTimestampPipe` is added.

Behavioral side effects, both desired:

- These fields now honor the user's configured format instead of a fixed
  ISO-with-seconds pattern.
- `last_activity` (which can be `0` for a torrent that has never been
  active) now renders blank instead of `1970-01-01 00:00:00`, since
  `LocalTimestampPipe` already treats `<= 0` as "no value" - matching how
  `completion_on` is already guarded in the same template.

### `update-available.html`

`release.published_at` is a GitHub API ISO datetime string, not epoch
seconds. `DateFormatService.format()` currently does
`Number(value) * 1000`, which yields `NaN` for a string like
`"2024-01-15T10:00:00Z"`.

Extend `format()` to fall back to `Date.parse()` when the value isn't a
positive finite number:

```ts
public format(value: number | string | undefined): string {
  if (!value) return '';

  let date: Date;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    date = new Date(numeric * 1000);
  } else if (typeof value === 'string') {
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
```

This is additive - existing behavior for numeric epoch-seconds input
(including the `'banana'` -> `''` non-numeric-string test) is unchanged,
since `Date.parse('banana')` is also `NaN`.

`update-available.html` then changes
`{{ release.published_at | date: 'yyyy-MM-dd' }}` to
`{{ release.published_at | localTimestamp }}`. Note this now includes
time-of-day (previously date-only) - intentional, for consistency with
every other date in the app using the same configured format.
`update-available.ts` adds `LocalTimestampPipe` to its `imports`;
`CommonModule` is left in place since nothing else in the template depends
on removing it.

## Testing

- `general.spec.ts` (settings): cover the new `dateFormatPresets()` shape
  (`label`/`example` separated), `resetCustomPattern()`, and
  `dateFormatTokenGuide()`.
- `date-format.service.spec.ts`: add cases for ISO-string input (valid and
  invalid) to `format()`.
- `torrent-details/general.spec.ts`: no assertions currently pin the exact
  rendered date string, so no test changes are required beyond ensuring the
  component still compiles with the pipe swap.
- `update-available.spec.ts`: check if it asserts on the rendered date
  string; update if so.
