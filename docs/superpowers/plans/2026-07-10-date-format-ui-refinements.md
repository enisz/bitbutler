# Date & Time Settings UI Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Date & Time settings UI (split preset label/example, add a format-token reference table, add a reset-to-default control on the custom pattern input) and finish routing every date shown in the app through the configurable date format.

**Architecture:** All work is inside the existing `packages/app` Angular workspace. No new services, no new npm dependencies. `DateFormatService.format()` gains a fallback path for ISO datetime strings; `General` (settings) gains two new computed signals and one method; two other components (`torrent-details/general`, `update-available`) swap a hardcoded `DatePipe` usage for the existing `LocalTimestampPipe`.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-select/ng-select`, `@ngx-translate/core`, `@fortawesome/angular-fontawesome`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Commit format: `#213: short description` (this is issue #213, already the branch's issue).
- `npm run lint` must pass with zero warnings — run `npm run lint:fix` after any import-order or formatting nit.
- Toast copy in `CLAUDE.md`'s "Toasts" section does not apply here — none of this work touches toasts.
- Use `-` not `—` in all commit messages and any written copy.
- All user-facing strings go through `@ngx-translate` (`us.json` and `hu.json`), never hardcoded in templates.
- Run tests with `npm run test --workspace=@bitbutler/app` from the repo root after every task.

---

## File Structure

| File                                                                    | Responsibility                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/services/date-format.service.ts`                  | Add ISO-datetime-string fallback to `format()`                                                           |
| `packages/app/src/app/services/date-format.service.spec.ts`             | New test for the ISO-string fallback                                                                     |
| `packages/app/src/app/pipes/local-timestamp-pipe.spec.ts`               | New integration test for the ISO-string fallback                                                         |
| `packages/app/src/app/modals/torrent-details/general/general.ts`        | Swap `DatePipe` import for `LocalTimestampPipe`                                                          |
| `packages/app/src/app/modals/torrent-details/general/general.html`      | Swap 4 hardcoded `\| date: 'yyyy-MM-dd HH:mm:ss'` usages for `\| localTimestamp`                         |
| `packages/app/src/app/modals/torrent-details/general/general.spec.ts`   | New tests covering the migrated date fields                                                              |
| `packages/app/src/app/modals/update-available/update-available.ts`      | Add `LocalTimestampPipe` to imports                                                                      |
| `packages/app/src/app/modals/update-available/update-available.html`    | Swap `\| date: 'yyyy-MM-dd'` for `\| localTimestamp`                                                     |
| `packages/app/src/app/modals/update-available/update-available.spec.ts` | New test covering the migrated release date                                                              |
| `packages/app/src/app/modals/settings/general/general.ts`               | Split `dateFormatPresets()` into label/example; add `resetCustomPattern()`; add `dateFormatTokenGuide()` |
| `packages/app/src/app/modals/settings/general/general.html`             | ng-select item templates; reset button; token guide table                                                |
| `packages/app/src/app/modals/settings/general/general.spec.ts`          | Update/extend tests for the above                                                                        |
| `public/i18n/us.json`, `public/i18n/hu.json`                            | New translation keys for the reset button and token guide                                                |

---

### Task 1: `DateFormatService` accepts ISO datetime strings

**Files:**

- Modify: `packages/app/src/app/services/date-format.service.ts:32-45`
- Test: `packages/app/src/app/services/date-format.service.spec.ts`
- Test: `packages/app/src/app/pipes/local-timestamp-pipe.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `DateFormatService.format(value: number | string | undefined): string` now also accepts an ISO 8601 datetime string (e.g. `'2024-01-15T10:00:00Z'`) in addition to epoch-seconds numbers/numeric-strings. Signature is unchanged. `LocalTimestampPipe.transform()` (same signature) gets this for free since it delegates directly to `format()`.

- [ ] **Step 1: Write the failing test in `date-format.service.spec.ts`**

Add this test inside the existing `describe('DateFormatService', ...)` block, after the `'applies a custom pattern with literal text'` test:

```ts
it('formats an ISO datetime string using the resolved pattern', () => {
  service.applyFromSettings({
    ...DEFAULT_GENERAL_SETTINGS,
    dateFormat: { preset: 'us', customPattern: 'yyyy-MM-dd HH:mm' },
  });

  expect(service.format('2024-01-05T13:07:00')).toBe('01/05/2024 01:07 PM');
});
```

(No timezone suffix on the ISO string — a date-time string without a `Z`/offset is parsed as local time by `Date.parse`, matching how the existing `us`/`eu` preset tests build their reference dates with `new Date(2024, 0, 5, 13, 7)`, so this test is not timezone-flaky.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL on `'formats an ISO datetime string using the resolved pattern'` — actual value is `''` (today: `Number('2024-01-05T13:07:00')` is `NaN`, so the existing guard returns `''`).

- [ ] **Step 3: Implement the fallback in `date-format.service.ts`**

Replace the current `format()` method:

```ts
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
```

with:

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS. Also re-check the pre-existing test `'returns "" for falsy, zero, negative, and non-numeric input'` (`service.format('banana')` still `''`, since `Date.parse('banana')` is also `NaN`) still passes.

- [ ] **Step 5: Add the pipe-level integration test**

In `local-timestamp-pipe.spec.ts`, add after the `'formats a numeric string timestamp the same as a number'` test:

```ts
it('formats an ISO datetime string', () => {
  const result = pipe.transform('2024-01-05T13:07:00');
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});
```

- [ ] **Step 6: Run the full app test suite**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/services/date-format.service.ts packages/app/src/app/services/date-format.service.spec.ts packages/app/src/app/pipes/local-timestamp-pipe.spec.ts
git commit -m "#213: accept ISO datetime strings in DateFormatService"
```

---

### Task 2: Route torrent-details date fields through `localTimestamp`

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/general/general.ts:1-49`
- Modify: `packages/app/src/app/modals/torrent-details/general/general.html:606-615,846-911`
- Test: `packages/app/src/app/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `LocalTimestampPipe` (`packages/app/src/app/pipes/local-timestamp-pipe.ts`), unchanged, already used elsewhere in the app (About modal, torrent-exists, import-torrents).
- Produces: nothing new for later tasks — this is a leaf change.

- [ ] **Step 1: Write the failing tests in `general.spec.ts`**

Add this new `describe` block at the end of the file, right before the final closing `});` of `describe('General', ...)`:

```ts
describe('date fields use the configured date format', () => {
  function sectionValueFor(headerFragment: string): string {
    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('.bb-section'),
    ) as HTMLElement[];
    const section = sections.find((el) =>
      el.querySelector('.section-header')?.textContent?.includes(headerFragment),
    );
    return section?.querySelector('.section-value')?.textContent?.trim() ?? '';
  }

  beforeEach(() => {
    mockDataService.torrent.set({
      data: makeTorrent({ last_activity: 0, added_on: 1700000000, completion_on: 1700000000 }),
      properties: makeProperties({ creation_date: 1700000000 }),
    });
    fixture.detectChanges();
  });

  it('renders blank for last-seen-complete when last_activity is 0', () => {
    expect(sectionValueFor('last-seen-complete')).toBe('');
  });

  it('renders a configured-format date for added-on', () => {
    expect(sectionValueFor('added-on')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('renders a configured-format date for completed-on', () => {
    expect(sectionValueFor('completed-on')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('renders a configured-format date for created-on', () => {
    expect(sectionValueFor('created-on')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL —

- `'renders blank for last-seen-complete when last_activity is 0'` fails because today's template renders `1970-01-01 00:00:00` (no `> 0` guard on `last_activity`), not `''`.
- The three `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/` assertions fail because the current hardcoded pattern is `'yyyy-MM-dd HH:mm:ss'` (includes seconds), which doesn't match a pattern with no seconds.

- [ ] **Step 3: Update `general.ts` imports**

In `packages/app/src/app/modals/torrent-details/general/general.ts`, replace:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
```

with:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
```

and, in the same file, replace:

```ts
import { FileSizePerSecPipe } from '../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
```

with:

```ts
import { FileSizePerSecPipe } from '../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
```

then in the `@Component` decorator's `imports` array, replace:

```ts
  imports: [
    BbSpinner,
    DatePipe,
    TimeagoPipe,
```

with:

```ts
  imports: [
    BbSpinner,
    LocalTimestampPipe,
    TimeagoPipe,
```

- [ ] **Step 4: Update `general.html`**

In `packages/app/src/app/modals/torrent-details/general/general.html`, replace the `last-seen-complete` block (lines 606-615):

```html
<span
  class="section-value"
  [ngbTooltip]="torrent()!.data.last_activity * 1000 | date: 'yyyy-MM-dd HH:mm:ss'"
  bbTooltipOverflow
  placement="bottom"
  >{{ torrent()!.data.last_activity * 1000 | date: 'yyyy-MM-dd HH:mm:ss' }}</span
>
```

with:

```html
<span
  class="section-value"
  [ngbTooltip]="torrent()!.data.last_activity | localTimestamp"
  bbTooltipOverflow
  placement="bottom"
  >{{ torrent()!.data.last_activity | localTimestamp }}</span
>
```

Replace the `added-on` block (lines 847-853):

```html
<span
  class="section-value"
  [ngbTooltip]="torrent()!.data.added_on * 1000 | date: 'yyyy-MM-dd HH:mm:ss'"
  bbTooltipOverflow
  placement="bottom"
  >{{ torrent()!.data.added_on * 1000 | date: 'yyyy-MM-dd HH:mm:ss' }}</span
>
```

with:

```html
<span
  class="section-value"
  [ngbTooltip]="torrent()!.data.added_on | localTimestamp"
  bbTooltipOverflow
  placement="bottom"
  >{{ torrent()!.data.added_on | localTimestamp }}</span
>
```

Replace the `completed-on` block (line 876):

```html
{{ torrent()!.data.completion_on * 1000 | date: 'yyyy-MM-dd HH:mm:ss' }}
```

with:

```html
{{ torrent()!.data.completion_on | localTimestamp }}
```

Replace the `created-on` block (lines 899-905):

```html
<span
  class="section-value"
  [ngbTooltip]="torrent()!.properties.creation_date * 1000 | date: 'yyyy-MM-dd HH:mm:ss'"
  bbTooltipOverflow
  placement="bottom"
  >{{ torrent()!.properties.creation_date * 1000 | date: 'yyyy-MM-dd HH:mm:ss' }}</span
>
```

with:

```html
<span
  class="section-value"
  [ngbTooltip]="torrent()!.properties.creation_date | localTimestamp"
  bbTooltipOverflow
  placement="bottom"
  >{{ torrent()!.properties.creation_date | localTimestamp }}</span
>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All tests PASS, including the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/general/general.ts packages/app/src/app/modals/torrent-details/general/general.html packages/app/src/app/modals/torrent-details/general/general.spec.ts
git commit -m "#213: use the configured date format in torrent details"
```

---

### Task 3: Route the update-available release date through `localTimestamp`

**Files:**

- Modify: `packages/app/src/app/modals/update-available/update-available.ts:1-21`
- Modify: `packages/app/src/app/modals/update-available/update-available.html:44`
- Test: `packages/app/src/app/modals/update-available/update-available.spec.ts`

**Interfaces:**

- Consumes: `LocalTimestampPipe`, and Task 1's ISO-string fallback in `DateFormatService.format()` (this is why Task 1 comes first — `release.published_at` is an ISO string, not epoch seconds).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test in `update-available.spec.ts`**

Add this new `describe` block right after the `describe('cleanedBody', ...)` block:

```ts
describe('release date rendering', () => {
  it('renders the release date using the configured date format', () => {
    fixture.componentRef.setInput('update', {
      releases: [makeRelease({ published_at: '2024-01-15T10:00:00Z' })],
      updateAvailable: true,
    } as UpdateCheckResponse);
    fixture.detectChanges();

    const dateSpan = fixture.nativeElement.querySelector(
      '.me-3.d-flex.flex-column.justify-content-between.align-items-center span',
    );
    expect(dateSpan.textContent.trim()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL — today's template renders `2024-01-15` (date-only, via `date: 'yyyy-MM-dd'`), which doesn't match a pattern requiring `HH:mm`.

- [ ] **Step 3: Update `update-available.ts`**

Replace:

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
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    TimeagoPipe,
    TranslatePipe,
    BbBtnContent,
  ],
```

with:

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
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    LocalTimestampPipe,
    TimeagoPipe,
    TranslatePipe,
    BbBtnContent,
  ],
```

- [ ] **Step 4: Update `update-available.html`**

Replace line 44:

```html
<span>{{ release.published_at | date: 'yyyy-MM-dd' }}</span>
```

with:

```html
<span>{{ release.published_at | localTimestamp }}</span>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS.

- [ ] **Step 6: Fix import order and lint**

Run: `npm run lint:fix --workspace=@bitbutler/app`
This will likely reorder the new `LocalTimestampPipe` import alphabetically among the pipe imports — accept the reordering.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/update-available/update-available.ts packages/app/src/app/modals/update-available/update-available.html packages/app/src/app/modals/update-available/update-available.spec.ts
git commit -m "#213: use the configured date format for the release date"
```

---

### Task 4: Split the preset `ng-select` into a left-aligned label / right-aligned example

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts:30-37,52-55,174-187`
- Modify: `packages/app/src/app/modals/settings/general/general.html:230-241`
- Test: `packages/app/src/app/modals/settings/general/general.spec.ts:204-211`

**Interfaces:**

- Consumes: nothing new.
- Produces: `dateFormatPresets(): DateFormatPresetItem[]` where `DateFormatPresetItem = { value: DateFormatPreset; label: string; example: string }` — replaces the old `{ value: string; label: string }[]` shape (label used to have the example baked into the string). Later tasks (5, 6) don't depend on this shape.

- [ ] **Step 1: Update the existing test to expect the new shape**

In `general.spec.ts`, replace:

```ts
describe('dateFormatPresets', () => {
  it('includes all 5 presets with a live-formatted example in the label', () => {
    const items = component.dateFormatPresets();
    expect(items.map((i) => i.value)).toEqual(['follow-language', 'iso', 'us', 'eu', 'custom']);
    const iso = items.find((i) => i.value === 'iso')!;
    expect(iso.label).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
});
```

with:

```ts
describe('dateFormatPresets', () => {
  it('includes all 5 presets, each with a translated label and a separate live-formatted example', () => {
    const items = component.dateFormatPresets();
    expect(items.map((i) => i.value)).toEqual(['follow-language', 'iso', 'us', 'eu', 'custom']);

    const iso = items.find((i) => i.value === 'iso')!;
    expect(iso.label).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(iso.example).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it('keeps the custom example in sync with the currently typed custom pattern', () => {
    component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue('dd/MM/yyyy');
    const items = component.dateFormatPresets();
    const custom = items.find((i) => i.value === 'custom')!;
    expect(custom.example).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL — `iso.example` is `undefined` today (the field doesn't exist yet), so `undefined.toMatch` / the `expect(...).toMatch` assertion fails.

- [ ] **Step 3: Add the `DateFormatPresetItem` interface and update `dateFormatPresets()` in `general.ts`**

Replace the `NgSelectItem` interface declaration:

```ts
interface NgSelectItem {
  value: string;
  label: string;
}
```

with:

```ts
interface NgSelectItem {
  value: string;
  label: string;
}

interface DateFormatPresetItem {
  value: DateFormatPreset;
  label: string;
  example: string;
}
```

Replace the `dateFormatPresets` computed:

```ts
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
```

with:

```ts
  public dateFormatPresets = computed<DateFormatPresetItem[]>(() => {
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
  });
```

- [ ] **Step 4: Add the item templates in `general.html`**

Replace the preset `ng-select` block:

```html
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
```

with:

```html
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
    <ng-template ng-option-tmp let-item="item">
      <div class="d-flex justify-content-between align-items-center">
        <span>{{ item.label }}</span>
        <span class="text-muted ms-3">{{ item.example }}</span>
      </div>
    </ng-template>

    <ng-template ng-label-tmp let-item="item">
      <div class="d-flex justify-content-between align-items-center">
        <span>{{ item.label }}</span>
        <span class="text-muted ms-3">{{ item.example }}</span>
      </div>
    </ng-template>
  </ng-select>
</div>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.ts packages/app/src/app/modals/settings/general/general.html packages/app/src/app/modals/settings/general/general.spec.ts
git commit -m "#213: split date format preset label and example in the dropdown"
```

---

### Task 5: Reset-to-default control on the custom pattern input

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts:13-18,202-206`
- Modify: `packages/app/src/app/modals/settings/general/general.html:254-262`
- Test: `packages/app/src/app/modals/settings/general/general.spec.ts`
- Modify: `public/i18n/us.json:1346-1357`
- Modify: `public/i18n/hu.json` (matching block)

**Interfaces:**

- Consumes: `DEFAULT_GENERAL_SETTINGS` from `packages/app/src/app/models/general-settings.model.ts` (already exists — `DEFAULT_GENERAL_SETTINGS.dateFormat.customPattern` is `'yyyy-MM-dd HH:mm'`).
- Produces: `General.resetCustomPattern(): void` — sets the `customPattern` form control's value to the default. Not consumed by any other task.

- [ ] **Step 1: Write the failing tests in `general.spec.ts`**

Add this new `describe` block after the `customPatternPreview` block:

```ts
describe('resetCustomPattern', () => {
  it('restores the default custom pattern into the form control only', () => {
    const customPatternControl =
      component.generalSettingsForm.controls.dateFormat.controls.customPattern;
    customPatternControl.setValue('dd-MM');

    component.resetCustomPattern();

    expect(customPatternControl.value).toBe('yyyy-MM-dd HH:mm');
  });
});

describe('date format custom pattern reset button', () => {
  it('is rendered next to the custom pattern input when preset is custom', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bb-filter-clear')).not.toBeNull();
  });

  it('resets the input value when clicked', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    component.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue('dd-MM');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.bb-filter-clear').click();
    fixture.detectChanges();

    expect(component.generalSettingsForm.controls.dateFormat.controls.customPattern.value).toBe(
      'yyyy-MM-dd HH:mm',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL — `component.resetCustomPattern` is not a function; `.bb-filter-clear` doesn't exist in the template yet.

- [ ] **Step 3: Add the `faRotateLeft` icon import and `resetCustomPattern()` method in `general.ts`**

Replace:

```ts
import {
  IconDefinition,
  faArrowsRotate,
  faCircleQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
```

with:

```ts
import {
  IconDefinition,
  faArrowsRotate,
  faCircleQuestion,
  faRotateLeft,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
```

Replace:

```ts
import {
  DATE_FORMAT_PRESETS,
  DateFormatPreset,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
```

with:

```ts
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DateFormatPreset,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
```

Replace:

```ts
  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
    faArrowsRotate,
  };
```

with:

```ts
  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
    faArrowsRotate,
    faRotateLeft,
  };
```

Add this method right after `customPatternPreview` (after its closing `});`):

```ts
  public resetCustomPattern(): void {
    this.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
      DEFAULT_GENERAL_SETTINGS.dateFormat.customPattern,
    );
  }
```

- [ ] **Step 4: Wrap the custom pattern input and add the reset button in `general.html`**

Replace:

```html
<div class="col-6">
  <input
    type="text"
    class="form-control"
    id="date-format-custom-pattern"
    formControlName="customPattern"
  />
</div>
```

with:

```html
<div class="col-6">
  <div class="bb-filter-input">
    <input
      type="text"
      class="form-control"
      id="date-format-custom-pattern"
      formControlName="customPattern"
    />
    <button
      type="button"
      class="bb-filter-clear"
      [attr.aria-label]="
                      'pages.settings.tab.general.general-settings-form.date-format.reset-custom-pattern'
                        | translate
                    "
      (click)="resetCustomPattern()"
    >
      <fa-icon [icon]="icons['faRotateLeft']"></fa-icon>
    </button>
  </div>
</div>
```

- [ ] **Step 5: Add the translation key to `us.json` and `hu.json`**

In `public/i18n/us.json`, replace:

```json
            "date-format": {
              "preset-label": "Date format",
              "custom-pattern-label": "Custom pattern",
              "preview": "Preview",
```

with:

```json
            "date-format": {
              "preset-label": "Date format",
              "custom-pattern-label": "Custom pattern",
              "reset-custom-pattern": "Reset to default",
              "preview": "Preview",
```

In `public/i18n/hu.json`, replace:

```json
            "date-format": {
              "preset-label": "Dátumformátum",
              "custom-pattern-label": "Egyéni minta",
              "preview": "Előnézet",
```

with:

```json
            "date-format": {
              "preset-label": "Dátumformátum",
              "custom-pattern-label": "Egyéni minta",
              "reset-custom-pattern": "Visszaállítás alapértelmezettre",
              "preview": "Előnézet",
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.ts packages/app/src/app/modals/settings/general/general.html packages/app/src/app/modals/settings/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#213: add a reset-to-default control on the custom date pattern input"
```

---

### Task 6: Format token guide table

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts:1,30-37,end of class`
- Modify: `packages/app/src/app/modals/settings/general/general.html:263-270`
- Test: `packages/app/src/app/modals/settings/general/general.spec.ts`
- Modify: `public/i18n/us.json:1346-1357`
- Modify: `public/i18n/hu.json` (matching block)

**Interfaces:**

- Consumes: `formatDate` (already imported from `@angular/common`), `LANGUAGE_LOCALE_MAP` and `DEFAULT_LOCALE` from `packages/app/src/app/models/general-settings.model.ts` (both already exported there — see `general-settings.model.ts:16,21`).
- Produces: `dateFormatTokenGuide(): DateFormatTokenGuideRow[]` where `DateFormatTokenGuideRow = { token: string; description: string; example: string }`. Not consumed elsewhere.

- [ ] **Step 1: Write the failing tests in `general.spec.ts`**

Add this new `describe` block after the `resetCustomPattern` block added in Task 5:

```ts
describe('dateFormatTokenGuide', () => {
  it('includes an entry for every supported token, each with a description and a live example', () => {
    const rows = component.dateFormatTokenGuide();

    expect(rows.map((r) => r.token)).toEqual([
      'yyyy',
      'yy',
      'MMMM',
      'MMM',
      'MM',
      'M',
      'EEEE',
      'EEE',
      'dd',
      'd',
      'HH',
      'H',
      'hh',
      'h',
      'mm',
      'ss',
      'a',
    ]);

    const yyyyRow = rows.find((r) => r.token === 'yyyy')!;
    expect(yyyyRow.example).toMatch(/^\d{4}$/);
    expect(yyyyRow.description).not.toBe('');
  });
});

describe('date format token guide table', () => {
  it('is hidden when preset is not custom', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('iso');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#date-format-token-guide')).toBeNull();
  });

  it('shows one row per token when preset is custom', () => {
    component.generalSettingsForm.controls.dateFormat.controls.preset.setValue('custom');
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('#date-format-token-guide tbody tr');
    expect(rows.length).toBe(component.dateFormatTokenGuide().length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL — `component.dateFormatTokenGuide` is not a function; `#date-format-token-guide` doesn't exist in the template yet.

- [ ] **Step 3: Add `dateFormatTokenGuide()` in `general.ts`**

Replace:

```ts
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DateFormatPreset,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
```

with:

```ts
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LOCALE,
  DateFormatPreset,
  GeneralSettings,
  LANGUAGE_LOCALE_MAP,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
```

Add the token list and row interface right after the `DateFormatPresetItem` interface:

```ts
interface DateFormatTokenGuideRow {
  token: string;
  description: string;
  example: string;
}

const DATE_FORMAT_TOKENS = [
  'yyyy',
  'yy',
  'MMMM',
  'MMM',
  'MM',
  'M',
  'EEEE',
  'EEE',
  'dd',
  'd',
  'HH',
  'H',
  'hh',
  'h',
  'mm',
  'ss',
  'a',
] as const;
```

Add the computed and its private helper right after `resetCustomPattern()`:

```ts
  public dateFormatTokenGuide = computed<DateFormatTokenGuideRow[]>(() => {
    this.languageChanged();
    const snapshot = this.formSnapshot();
    const language = snapshot.language.language;

    return DATE_FORMAT_TOKENS.map((token) => ({
      token,
      description: this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.token-guide.token.${token}`,
      ),
      example: this.formatToken(token, language),
    }));
  });

  private formatToken(token: string, language: string): string {
    const locale = LANGUAGE_LOCALE_MAP[language] ?? DEFAULT_LOCALE;
    try {
      return formatDate(new Date(), token, locale);
    } catch {
      return '';
    }
  }
```

- [ ] **Step 4: Add the hint and table in `general.html`**

Replace:

```html
<div class="row mb-3">
  <div class="col-12 text-muted">
    {{ 'pages.settings.tab.general.general-settings-form.date-format.preview' | translate }}: {{
    customPatternPreview() }}
  </div>
</div>
}
```

with:

```html
<div class="row mb-3">
  <div class="col-12 text-muted">
    {{ 'pages.settings.tab.general.general-settings-form.date-format.preview' | translate }}: {{
    customPatternPreview() }}
  </div>
</div>
<div class="row mb-2">
  <div class="col-12 text-muted small">
    {{ 'pages.settings.tab.general.general-settings-form.date-format.token-guide.hint' | translate
    }}
  </div>
</div>
<div class="row mb-3">
  <div class="col-12">
    <table id="date-format-token-guide" class="table table-sm mb-0">
      <thead>
        <tr>
          <th>
            {{
            'pages.settings.tab.general.general-settings-form.date-format.token-guide.column-token'
            | translate }}
          </th>
          <th>
            {{
            'pages.settings.tab.general.general-settings-form.date-format.token-guide.column-description'
            | translate }}
          </th>
          <th>
            {{
            'pages.settings.tab.general.general-settings-form.date-format.token-guide.column-example'
            | translate }}
          </th>
        </tr>
      </thead>
      <tbody>
        @for (row of dateFormatTokenGuide(); track row.token) {
        <tr>
          <td><code>{{ row.token }}</code></td>
          <td>{{ row.description }}</td>
          <td>{{ row.example }}</td>
        </tr>
        }
      </tbody>
    </table>
  </div>
</div>
}
```

- [ ] **Step 5: Add the translation keys to `us.json`**

Replace:

```json
            "date-format": {
              "preset-label": "Date format",
              "custom-pattern-label": "Custom pattern",
              "reset-custom-pattern": "Reset to default",
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

with:

```json
            "date-format": {
              "preset-label": "Date format",
              "custom-pattern-label": "Custom pattern",
              "reset-custom-pattern": "Reset to default",
              "preview": "Preview",
              "preset": {
                "follow-language": "Follow language",
                "iso": "ISO",
                "us": "US",
                "eu": "European",
                "custom": "Custom"
              },
              "token-guide": {
                "hint": "Wrap literal text in single quotes, e.g. 'at', to include it as-is.",
                "column-token": "Token",
                "column-description": "Description",
                "column-example": "Example",
                "token": {
                  "yyyy": "4-digit year",
                  "yy": "2-digit year",
                  "MMMM": "Full month name",
                  "MMM": "Abbreviated month name",
                  "MM": "2-digit month",
                  "M": "Month number",
                  "EEEE": "Full weekday name",
                  "EEE": "Abbreviated weekday name",
                  "dd": "2-digit day of month",
                  "d": "Day of month",
                  "HH": "2-digit hour (24h)",
                  "H": "Hour (24h)",
                  "hh": "2-digit hour (12h)",
                  "h": "Hour (12h)",
                  "mm": "2-digit minute",
                  "ss": "2-digit second",
                  "a": "AM/PM marker"
                }
              }
            },
```

- [ ] **Step 6: Add the translation keys to `hu.json`**

Replace:

```json
            "date-format": {
              "preset-label": "Dátumformátum",
              "custom-pattern-label": "Egyéni minta",
              "reset-custom-pattern": "Visszaállítás alapértelmezettre",
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

with:

```json
            "date-format": {
              "preset-label": "Dátumformátum",
              "custom-pattern-label": "Egyéni minta",
              "reset-custom-pattern": "Visszaállítás alapértelmezettre",
              "preview": "Előnézet",
              "preset": {
                "follow-language": "Nyelv szerint",
                "iso": "ISO",
                "us": "USA",
                "eu": "Európai",
                "custom": "Egyéni"
              },
              "token-guide": {
                "hint": "A szó szerinti szöveget aposztrófok közé zárva (pl. 'at') változatlanul jelenítheted meg.",
                "column-token": "Jelölő",
                "column-description": "Leírás",
                "column-example": "Példa",
                "token": {
                  "yyyy": "4 jegyű év",
                  "yy": "2 jegyű év",
                  "MMMM": "Hónap neve (teljes)",
                  "MMM": "Hónap neve (rövid)",
                  "MM": "2 jegyű hónap",
                  "M": "Hónap száma",
                  "EEEE": "Hét napja (teljes)",
                  "EEE": "Hét napja (rövid)",
                  "dd": "2 jegyű nap",
                  "d": "Nap száma",
                  "HH": "2 jegyű óra (24 órás)",
                  "H": "Óra (24 órás)",
                  "hh": "2 jegyű óra (12 órás)",
                  "h": "Óra (12 órás)",
                  "mm": "2 jegyű perc",
                  "ss": "2 jegyű másodperc",
                  "a": "DE/DU jelölő"
                }
              }
            },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.ts packages/app/src/app/modals/settings/general/general.html packages/app/src/app/modals/settings/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#213: add a format token guide table to the date format settings"
```

---

## Final Verification

- [ ] **Step 1: Full lint pass**

Run: `npm run lint`
Expected: zero warnings, zero errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all workspaces PASS.

- [ ] **Step 3: Manual smoke test**

Run: `npm start`, open Settings → General, and verify:

- The date format dropdown shows the label on the left and the example on the right for every preset, both in the closed control and the open list.
- Selecting "Custom" shows the pattern input with a reset icon at its end, the preview line, a hint about quoting literal text, and the token guide table.
- Typing a pattern, clicking the reset icon restores `yyyy-MM-dd HH:mm` into the input without saving (Save button / dirty state still reflects the change until Save is clicked).
- Opening a torrent's details "General" tab shows dates matching the configured format (try switching the preset and confirm the torrent-details dates update after Save).
- Triggering the "Check for Update" flow (or otherwise opening the Update Available modal, if a newer release exists) shows the release date/time in the configured format.
