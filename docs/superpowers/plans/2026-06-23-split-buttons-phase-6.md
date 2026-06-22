# Split Buttons - Phase 6: Remaining Toggle Group + Filters + Misc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the final 7 Bootstrap `.btn`s and the design's last remaining toggle group (2 `<label>`s) across `add-torrent/general`, `datepicker-filter`, `datepicker-range-filter`, `settings/general`, `settings/server`, and `status` to the `.btn-split`/`bb-btn-content` pattern shipped in Phase 0 and proven out in Phases 1-5. This is the **last phase** of the split-buttons rollout (issue #180) - after this phase every in-scope Bootstrap `.btn` in the app has been retrofitted, and the branch is ready for a whole-branch merge review.

**Architecture:** Each task touches one existing component (`.ts` + `.html`) independently. `add-torrent/general.ts`, `datepicker-filter.ts`, and `datepicker-range-filter.ts` get an `icons` object change (the first two creating one fresh, the third extending its existing one); `settings/general.ts` and `settings/server.ts` extend their existing `Record<string, IconDefinition>`-typed `icons` objects; `status.ts` extends its existing singular `icon` object (matching its own pre-existing convention, like several Phase 4 files). `settings/server.html` already has `icons['faFolderOpen']` imported and uses bracket-notation property access in its template (`icons['faFolderOpen']`, `icons['faMinus']`, `icons['faPlus']`) for its existing icon-only buttons - this task's new `bb-btn-content` binding matches that file's own established bracket-notation style rather than switching to dot notation. The `add-torrent/general` toggle group (Input mode: File/Link) is this design's last remaining toggle group - same `<label class="btn ...">`/`<input class="btn-check">` sibling pattern Phase 5 established, with no count suffix (plain `'key' | translate`, like Phase 5's After-import mode toggle).

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Consumes only Phase 0's primitives - no CSS or shared-component changes in this phase: `.btn-split`/`.btn-icon`/`.btn-text` classes (`packages/app/src/styles.scss`) and `BbBtnContent` (`packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`, selector `bb-btn-content`, inputs `icon: IconDefinition` required, `text: string` required, `position: 'start' | 'end' = 'start'`).
- Call-site markup pattern for regular buttons: keep the host element's tag and existing Bootstrap classes, add `btn-split`, replace the button body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`. Drop any `px-*` padding utility class on the host (`.btn-split` sets `padding: 0 !important`, so it has no visual effect once applied) - applies to `datepicker-range-filter.html`'s Today and Clear buttons, both currently `px-3`.
- Call-site markup pattern for the toggle-group labels (Input mode: File/Link in `add-torrent/general.html`): keep the `<label class="btn ...">` tag, its `for` attribute, and its literal sibling position immediately after its `<input class="btn-check">` - add `btn-split` to the label's classes, replace the label body with `<bb-btn-content>`. These labels have no count suffix, so `[text]` is simply `'key' | translate`.
- Icon assignments for this phase, all from `@fortawesome/free-solid-svg-icons`:
  - Input mode toggle (add-torrent/general): File -> `faFile`, Link -> `faLink`.
  - `general.button.browse` -> `faFolderOpen` (add-torrent/general's Browse button; settings/server's Browse button, which already imports `faFolderOpen` - no new import needed there, just reuse).
  - `general.button.clear` -> `faEraser` (datepicker-filter's Clear button; datepicker-range-filter's Clear button).
  - `general.button.today` -> `faCalendarDay` (datepicker-range-filter's Today button - new icon decision, not used elsewhere in the app yet).
  - `pages.settings.tab.general.general-settings-form.behavior.check-for-update` -> `faArrowsRotate` (settings/general's Check for Update button - component-specific, new icon decision).
  - `pages.main.status.clear-all` -> `faEraser` (status's Clear All button - same icon as the generic `clear`/`clear-all` keys, reused).
- Translation keys are unchanged - every key used in this phase already exists in `public/i18n/us.json`/`hu.json`. No i18n file edits in this phase.
- **`icons`/`icon` object naming, typing, and access style - preserve each file's own existing convention exactly, do not standardize across files:**
  - `add-torrent/general.ts` has no icon object today - create `public readonly icons = { faFile, faLink, faFolderOpen };` as the first member of the class body (no `inject(...)` block exists in this file to place it after).
  - `datepicker-filter.ts` has no icon object today - create `public readonly icons = { faEraser };` as the first member of the class body (no `inject(...)` block exists in this file either).
  - `datepicker-range-filter.ts` already has `public icons = { faChevronLeft, faChevronRight };` (non-`readonly`) - extend it in place by appending `faCalendarDay, faEraser`, do not add `readonly` or rename it.
  - `settings/general.ts` already has `public icons: Record<string, IconDefinition> = { faTriangleExclamation, faCircleQuestion };` - extend it in place by appending `faArrowsRotate`, keep the explicit `Record<string, IconDefinition>` type annotation.
  - `settings/server.ts` already has `public icons: Record<string, IconDefinition> = { faPlus, faMinus, faTriangleExclamation, faFolderOpen };` - this task needs **no `.ts` icon-object or import change at all**, since `faFolderOpen` is already present; only the `.html` template and the component's `imports` array (for `BbBtnContent`) change.
  - `status.ts` already has `readonly icon = { faCircleDown, faUpload, ..., faArrowsSpin };` (singular `icon`, matching the same isolated singular-naming wart Phase 4 found in 6 unrelated files) - extend it in place by appending `faEraser` at the end, do not rename it to `icons`.
- Import path for `BbBtnContent`:
  - `add-torrent/general.ts` lives at `packages/app/src/app/components/add-torrent/general/general.ts` (two levels up from `components/`) -> `'../../bb-btn-content/bb-btn-content'`.
  - `datepicker-filter.ts` and `datepicker-range-filter.ts` live at `packages/app/src/app/components/<name>/<name>.ts` (one level up from `components/`) -> `'../bb-btn-content/bb-btn-content'`.
  - `settings/general.ts` and `settings/server.ts` live at `packages/app/src/app/pages/settings/<name>/<name>.ts` (three levels up from `app/`) -> `'../../../components/bb-btn-content/bb-btn-content'`.
  - `status.ts` lives at `packages/app/src/app/pages/main/status/status.ts` (three levels up from `app/`) -> `'../../../components/bb-btn-content/bb-btn-content'`.
- `FontAwesomeModule`/`FaIconComponent` stay imported and stay in every file's `imports` array where already present (`datepicker-range-filter.ts`, `settings/general.ts`, `settings/server.ts`, `status.ts`) - each of those templates uses `<fa-icon>` directly elsewhere for icon-only buttons/indicators that are out of scope (see below). `add-torrent/general.ts` and `datepicker-filter.ts` have no `FontAwesomeModule` import today and don't need one - `bb-btn-content` owns that import internally.
- Out of scope - do not touch, in any of the 6 files:
  - `datepicker-range-filter.html`'s prev/next month nav buttons (`btn btn-link bb-dp-nav-btn`, bare `<fa-icon [icon]="icons.faChevronLeft"|icons.faChevronRight">`, no visible text) - icon-only, no text segment to split.
  - `settings/server.html`'s 3 icon-only path-mapping buttons (test-mapping `btn btn-lg btn-link` with tooltip only; remove `btn btn-lg btn-link text-danger`; add `btn btn-lg btn-link text-success`) - explicitly excluded by the design spec's scope section ("import-torrents/server path-mapping buttons").
  - `status.html`'s `<app-filter-group>` usages and the underlying `filter-group.html`/`.ts` (verified by inspection to contain zero Bootstrap `.btn`-classed elements - it uses `list-group-item-action`-style markup, already out of scope per the design spec's "no btn class" exclusion).
  - Any `.btn-close` (header X) button.
  - `add-torrent/general.html`'s `bb-popover` usages, file/rename input fields, and category/save-path/tag-select nested components.
  - `settings/general.html`'s automatic-update `form-switch` checkbox and all other settings-form controls outside the Check for Update button.
  - `settings/server.html`'s polling-interval inputs and `app-save-path-select` usage.
  - `status.html`'s `<app-filter-group>` selection/active-key bindings - only the Clear All button's markup changes.
- No spec file in this phase asserts on the in-scope button/toggle markup (verified by inspection of all 6 spec files: `add-torrent/general.spec.ts` only queries `#inputMode_link`, `.btn-group`, `#file_browser`, `#rename`, `input[type="file"]`, and `fieldset.bb-fieldset > legend` - none of which are affected by changing a `<label>`'s or `<button>`'s inner body; the other 5 spec files have zero button/markup assertions) - no spec file changes in this phase, only regression runs.
- Class names match filenames without suffix; no `standalone: true` flag added/removed beyond what's already present in a file (`datepicker-range-filter.ts`/`status.ts` already have it; the other 4 don't - don't add it).

---

### Task 1: `add-torrent/general` - Input mode toggle and Browse button

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/general/general.ts:1-26`
- Modify: `packages/app/src/app/components/add-torrent/general/general.html:18-20,31-33,70-72`

**Interfaces:**

- Consumes: `BbBtnContent` and `.btn-split`/`.btn-icon`/`.btn-text` from Phase 0 (see Global Constraints).
- Produces: nothing consumed by later tasks in this phase - each task here is independent.

- [ ] **Step 1: Update `general.ts`'s icon import, `imports` array, and add an `icons` object**

Current (full file, lines 1-26):

```ts
import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { BbPopover } from '../../bb-popover/bb-popover';
import { CategorySelect } from '../../category-select/category-select';
import { SavePathSelect } from '../../save-path-select/save-path-select';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-add-torrent-general',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    BbPopover,
    TranslatePipe,
    CategorySelect,
    SavePathSelect,
    TagSelect,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public form = input.required<AddTorrentFormGroup>();
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { faFile, faFolderOpen, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbPopover } from '../../bb-popover/bb-popover';
import { CategorySelect } from '../../category-select/category-select';
import { SavePathSelect } from '../../save-path-select/save-path-select';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-add-torrent-general',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    BbPopover,
    TranslatePipe,
    CategorySelect,
    SavePathSelect,
    TagSelect,
    BbBtnContent,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public readonly icons = { faFile, faLink, faFolderOpen };

  public form = input.required<AddTorrentFormGroup>();
```

- [ ] **Step 2: Update `general.html`'s Input mode toggle group**

Current (lines 18-33):

```html
<label class="btn btn-outline-secondary" for="inputMode_file">
  {{ 'components.add-torrent.input-mode.file' | translate }}
</label>

<input
  type="radio"
  class="btn-check"
  name="inputMode"
  id="inputMode_link"
  autocomplete="off"
  [checked]="inputMode() === 'link'"
  (change)="inputModeChange.emit('link')"
/>
<label class="btn btn-outline-secondary" for="inputMode_link">
  {{ 'components.add-torrent.input-mode.link' | translate }}
</label>
```

Replace with:

```html
<label class="btn btn-outline-secondary btn-split" for="inputMode_file">
  <bb-btn-content
    [icon]="icons.faFile"
    [text]="'components.add-torrent.input-mode.file' | translate"
  ></bb-btn-content>
</label>

<input
  type="radio"
  class="btn-check"
  name="inputMode"
  id="inputMode_link"
  autocomplete="off"
  [checked]="inputMode() === 'link'"
  (change)="inputModeChange.emit('link')"
/>
<label class="btn btn-outline-secondary btn-split" for="inputMode_link">
  <bb-btn-content
    [icon]="icons.faLink"
    [text]="'components.add-torrent.input-mode.link' | translate"
  ></bb-btn-content>
</label>
```

- [ ] **Step 3: Update `general.html`'s Browse button**

Current (lines 70-72):

```html
<button type="button" class="btn btn-outline-primary" (click)="fileInput.click()">
  {{ 'general.button.browse' | translate }}
</button>
```

Replace with:

```html
<button type="button" class="btn btn-outline-primary btn-split" (click)="fileInput.click()">
  <bb-btn-content
    [icon]="icons.faFolderOpen"
    [text]="'general.button.browse' | translate"
  ></bb-btn-content>
</button>
```

- [ ] **Step 4: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/add-torrent/general/general.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 13 passed (13)`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/add-torrent/general/general.ts packages/app/src/app/components/add-torrent/general/general.html
git commit -m "#180: retrofit add-torrent general input-mode toggle and browse button to split-button style"
```

---

### Task 2: `datepicker-filter` - Clear button

**Files:**

- Modify: `packages/app/src/app/components/datepicker-filter/datepicker-filter.ts:1-15`
- Modify: `packages/app/src/app/components/datepicker-filter/datepicker-filter.html:10-12`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `datepicker-filter.ts`'s icon import, `imports` array, and add an `icons` object**

Current (lines 1-15):

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDate, NgbDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IFilterParams } from 'ag-grid-community';

@Component({
  selector: 'app-datepicker-filter',
  imports: [FormsModule, NgbDatepicker, TranslatePipe],
  templateUrl: './datepicker-filter.html',
  styleUrl: './datepicker-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatepickerFilter implements IFilterAngularComp {
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { faEraser } from '@fortawesome/free-solid-svg-icons';
import { NgbDate, NgbDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IFilterParams } from 'ag-grid-community';
import { BbBtnContent } from '../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-datepicker-filter',
  imports: [FormsModule, NgbDatepicker, TranslatePipe, BbBtnContent],
  templateUrl: './datepicker-filter.html',
  styleUrl: './datepicker-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatepickerFilter implements IFilterAngularComp {
  public readonly icons = { faEraser };

```

- [ ] **Step 2: Update `datepicker-filter.html`'s Clear button**

Current (lines 10-12):

```html
<button class="btn btn-sm btn-outline-secondary" (click)="clear()">
  {{ 'general.button.clear' | translate }}
</button>
```

Replace with:

```html
<button class="btn btn-sm btn-outline-secondary btn-split" (click)="clear()">
  <bb-btn-content
    [icon]="icons.faEraser"
    [text]="'general.button.clear' | translate"
  ></bb-btn-content>
</button>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/datepicker-filter.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 12 passed (12)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/datepicker-filter/datepicker-filter.ts packages/app/src/app/components/datepicker-filter/datepicker-filter.html
git commit -m "#180: retrofit datepicker-filter clear button to split-button style"
```

---

### Task 3: `datepicker-range-filter` - Today and Clear buttons

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts:1-30`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html:86-95`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-2.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `datepicker-range-filter.ts`'s icon import, `imports` array, and extend the existing `icons` object**

Current (lines 1-30):

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import {
  NgbCalendar,
  NgbDate,
  NgbDatepickerI18n,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { CustomDatepickerI18n } from '../../services/custom-datepicker-i18n.service';

@Component({
  selector: 'app-datepicker-range-filter',
  standalone: true,
  imports: [FormsModule, NgbDatepickerModule, TranslateModule, NgSelectModule, FontAwesomeModule],
  providers: [{ provide: NgbDatepickerI18n, useClass: CustomDatepickerI18n }],
  templateUrl: './datepicker-range-filter.html',
  styleUrl: './datepicker-range-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatepickerRangeFilter implements IFilterAngularComp, OnInit {
  readonly calendarService = inject(NgbCalendar);
  private readonly i18n = inject(NgbDatepickerI18n);
  private params!: IFilterParams;
  public icons = { faChevronLeft, faChevronRight };
  fromDate: NgbDate | null = null;
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCalendarDay,
  faChevronLeft,
  faChevronRight,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgbCalendar,
  NgbDate,
  NgbDatepickerI18n,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { CustomDatepickerI18n } from '../../services/custom-datepicker-i18n.service';
import { BbBtnContent } from '../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-datepicker-range-filter',
  standalone: true,
  imports: [
    FormsModule,
    NgbDatepickerModule,
    TranslateModule,
    NgSelectModule,
    FontAwesomeModule,
    BbBtnContent,
  ],
  providers: [{ provide: NgbDatepickerI18n, useClass: CustomDatepickerI18n }],
  templateUrl: './datepicker-range-filter.html',
  styleUrl: './datepicker-range-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatepickerRangeFilter implements IFilterAngularComp, OnInit {
  readonly calendarService = inject(NgbCalendar);
  private readonly i18n = inject(NgbDatepickerI18n);
  private params!: IFilterParams;
  public icons = { faChevronLeft, faChevronRight, faCalendarDay, faEraser };
  fromDate: NgbDate | null = null;
```

- [ ] **Step 2: Update `datepicker-range-filter.html`'s Today and Clear buttons**

Current (lines 86-95):

```html
<button class="btn btn-sm btn-outline-secondary px-3" type="button" (click)="dp.navigateTo(today)">
  {{ 'general.button.today' | translate }}
</button>
<button class="btn btn-sm btn-outline-secondary px-3" type="button" (click)="clear()">
  {{ 'general.button.clear' | translate }}
</button>
```

Replace with:

```html
<button
  class="btn btn-sm btn-outline-secondary btn-split"
  type="button"
  (click)="dp.navigateTo(today)"
>
  <bb-btn-content
    [icon]="icons.faCalendarDay"
    [text]="'general.button.today' | translate"
  ></bb-btn-content>
</button>
<button class="btn btn-sm btn-outline-secondary btn-split" type="button" (click)="clear()">
  <bb-btn-content
    [icon]="icons.faEraser"
    [text]="'general.button.clear' | translate"
  ></bb-btn-content>
</button>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/datepicker-range-filter.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 18 passed (18)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html
git commit -m "#180: retrofit datepicker-range-filter today and clear buttons to split-button style"
```

---

### Task 4: `settings/general` - Check for Update button

**Files:**

- Modify: `packages/app/src/app/pages/settings/general/general.ts:12-17,25,53-65,149-155`
- Modify: `packages/app/src/app/pages/settings/general/general.html:129-134`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-3.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `general.ts`'s icon import, `imports` array, and extend the existing `icons` object**

Current solid-icon import and relative imports (lines 12-27):

```ts
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faCircleQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, from, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

Replace with:

```ts
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faArrowsRotate,
  faCircleQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, from, tap } from 'rxjs';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

Current `imports` array (lines 53-65):

```ts
  imports: [
    CommonModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    NgOptimizedImage,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    BbPopover,
    TranslatePipe,
    SavePathSelect,
  ],
```

Replace with:

```ts
  imports: [
    CommonModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    NgOptimizedImage,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    BbPopover,
    TranslatePipe,
    SavePathSelect,
    BbBtnContent,
  ],
```

Current `icons` object (lines 149-152):

```ts
  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
  };
```

Replace with:

```ts
  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
    faArrowsRotate,
  };
```

- [ ] **Step 2: Update `general.html`'s Check for Update button**

Current (lines 129-134):

```html
<button type="button" class="btn btn-sm btn-link" (click)="checkUpdates()">
  {{ 'pages.settings.tab.general.general-settings-form.behavior.check-for-update' | translate }}
</button>
```

Replace with:

```html
<button type="button" class="btn btn-sm btn-link btn-split" (click)="checkUpdates()">
  <bb-btn-content
    [icon]="icons.faArrowsRotate"
    [text]="
                    'pages.settings.tab.general.general-settings-form.behavior.check-for-update'
                      | translate
                  "
  ></bb-btn-content>
</button>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/settings/general/general.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 15 passed (15)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/settings/general/general.ts packages/app/src/app/pages/settings/general/general.html
git commit -m "#180: retrofit settings general check-for-update button to split-button style"
```

---

### Task 5: `settings/server` - Browse button

**Files:**

- Modify: `packages/app/src/app/pages/settings/server/server.ts:15-18,29-38`
- Modify: `packages/app/src/app/pages/settings/server/server.html:185-192`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-4.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `server.ts`'s `imports` array (no icon import or `icons` object change needed - `faFolderOpen` is already imported)**

Current relative imports and `imports` array (lines 15-18, 29-38):

```ts
import { from, switchMap, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

```ts
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    NgbTooltip,
    BbSpinner,
    BbPopover,
    TranslatePipe,
    SavePathSelect,
  ],
```

Replace with:

```ts
import { from, switchMap, tap } from 'rxjs';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

```ts
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
```

- [ ] **Step 2: Update `server.html`'s Browse button**

Current (lines 185-192):

```html
<button
  type="button"
  class="btn btn-outline-primary"
  (click)="onBrowse(i)"
  [disabled]="group.disabled"
>
  {{ 'general.button.browse' | translate }}
</button>
```

Replace with:

```html
<button
  type="button"
  class="btn btn-outline-primary btn-split"
  (click)="onBrowse(i)"
  [disabled]="group.disabled"
>
  <bb-btn-content
    [icon]="icons['faFolderOpen']"
    [text]="'general.button.browse' | translate"
  ></bb-btn-content>
</button>
```

Note: this file's template already accesses its `icons` object with bracket notation elsewhere (`icons['faMinus']`, `icons['faPlus']`, both on the out-of-scope path-mapping buttons) - use `icons['faFolderOpen']` here too, matching that established local style, rather than switching to dot notation.

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/settings/server/server.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 9 passed (9)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/settings/server/server.ts packages/app/src/app/pages/settings/server/server.html
git commit -m "#180: retrofit settings server browse button to split-button style"
```

---

### Task 6: `status` - Clear All button

**Files:**

- Modify: `packages/app/src/app/pages/main/status/status.ts:5-20,22,43,71-87`
- Modify: `packages/app/src/app/pages/main/status/status.html:48-54`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-5. This is the last task of Phase 6, and of the whole split-buttons rollout.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update `status.ts`'s icon import, `imports` array, and extend the existing `icon` object**

Current icon import and relative imports (lines 5-26):

```ts
import {
  faArrowsSpin,
  faCircleCheck,
  faCircleDown,
  faCircleExclamation,
  faCircleMinus,
  faCirclePlay,
  faCircleStop,
  faFolderOpen,
  faFolderTree,
  faHourglassHalf,
  faLink,
  faPlay,
  faTags,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TorrentState } from '../../../models/torrent.model';
import { FilterService } from '../../../services/filter.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { getTrackers, normalizeTracker } from '../tracker.utils';
import { FilterGroupComponent, FilterItem } from './filter-group/filter-group';
```

Replace with:

```ts
import {
  faArrowsSpin,
  faCircleCheck,
  faCircleDown,
  faCircleExclamation,
  faCircleMinus,
  faCirclePlay,
  faCircleStop,
  faEraser,
  faFolderOpen,
  faFolderTree,
  faHourglassHalf,
  faLink,
  faPlay,
  faTags,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { TorrentState } from '../../../models/torrent.model';
import { FilterService } from '../../../services/filter.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { getTrackers, normalizeTracker } from '../tracker.utils';
import { FilterGroupComponent, FilterItem } from './filter-group/filter-group';
```

Current `imports` array (line 43):

```ts
  imports: [CommonModule, FontAwesomeModule, FilterGroupComponent, TranslatePipe],
```

Replace with:

```ts
  imports: [CommonModule, FontAwesomeModule, FilterGroupComponent, TranslatePipe, BbBtnContent],
```

Current `icon` object (lines 71-86):

```ts
  readonly icon = {
    faCircleDown,
    faUpload,
    faCircleCheck,
    faPlay,
    faCircleStop,
    faCirclePlay,
    faCircleMinus,
    faHourglassHalf,
    faCircleExclamation,
    faLink,
    faFolderOpen,
    faFolderTree,
    faTags,
    faArrowsSpin,
  };
```

Replace with:

```ts
  readonly icon = {
    faCircleDown,
    faUpload,
    faCircleCheck,
    faPlay,
    faCircleStop,
    faCirclePlay,
    faCircleMinus,
    faHourglassHalf,
    faCircleExclamation,
    faLink,
    faFolderOpen,
    faFolderTree,
    faTags,
    faArrowsSpin,
    faEraser,
  };
```

- [ ] **Step 2: Update `status.html`'s Clear All button**

Current (lines 48-54):

```html
@if (hasAnyFilter()) {
<div class="clear-all-bar">
  <button class="btn btn-clear-all w-100" type="button" (click)="clearAll()">
    {{ 'pages.main.status.clear-all' | translate }}
  </button>
</div>
}
```

Replace with:

```html
@if (hasAnyFilter()) {
<div class="clear-all-bar">
  <button class="btn btn-clear-all w-100 btn-split" type="button" (click)="clearAll()">
    <bb-btn-content
      [icon]="icon.faEraser"
      [text]="'pages.main.status.clear-all' | translate"
    ></bb-btn-content>
  </button>
</div>
}
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/main/status/status.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 17 passed (17)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/main/status/status.ts packages/app/src/app/pages/main/status/status.html
git commit -m "#180: retrofit status clear-all button to split-button style"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Phase 6 row of the design spec's rollout table in full (`add-torrent/general` toggle, `datepicker-filter`, `datepicker-range-filter`, `settings/general`, `settings/server`, `status` - 7 regular buttons + 1 toggle group of 2 labels = 9 elements total, close to the spec's "~8 + 1 toggle group" estimate). This is also the design's **last** remaining toggle group (Input mode: File/Link) - cross-referenced against the design spec's full toggle-groups table (5 rows total: `add-torrent/general` here in Phase 6, the other 4 already done in Phase 5) to confirm none were missed or duplicated across phases.
- **Placeholder scan:** none - all six tasks contain complete before/after code for every file/section they touch.
- **Formatting verified, not guessed:** every `.ts` and `.html` snippet in this plan was produced by actually applying the edit to a copy of the real file inside the project tree and running this repo's own `npx prettier --write` (picking up `package.json`'s `@trivago/prettier-plugin-sort-imports` config and the `*.html` -> Angular parser override) - every import re-ordering and line-wrap shown is the tool's actual output.
- **Per-file convention preserved, not standardized:** this phase touches the widest variety of pre-existing icon-object conventions yet seen in one phase - two fresh `icons` (plural, `add-torrent/general`, `datepicker-filter`), one existing non-`readonly` `icons` (`datepicker-range-filter`), two existing `Record<string, IconDefinition>`-typed `icons` (`settings/general`, `settings/server`), and one existing singular `icon` (`status`, matching Phase 4's isolated wart). Every task extends or creates the object under its own file's exact existing name/type/modifier - none are renamed or "fixed" toward a single house style.
- **Zero-new-import task flagged:** Task 5 (`settings/server`) is the only task in the entire 7-phase rollout that needs no icon import or `icons`-object change at all - `faFolderOpen` was already imported and already in the object from that file's existing icon-only path-mapping buttons. Called out explicitly so neither implementer nor reviewer adds a redundant duplicate import.
- **Bracket-vs-dot access style preserved:** `settings/server.html` already uses `icons['faFolderOpen']`/`icons['faMinus']`/`icons['faPlus']` (bracket notation) for its existing icon-only buttons - Task 5's new `bb-btn-content` binding uses the same bracket form for consistency within that one file, even though every other file in this 7-phase rollout uses dot notation. This is an intentional per-file consistency choice, not an inconsistency to "fix."
- **`px-*` cleanup applied where relevant:** `datepicker-range-filter.html`'s Today and Clear buttons both drop their existing `px-3` utility class per the established Phase 1 convention (`.btn-split` sets `padding: 0 !important`, making `px-3` a no-op).
- **Out-of-scope verification:** confirmed `datepicker-range-filter.html`'s 2 icon-only month-nav buttons, `settings/server.html`'s 3 icon-only path-mapping buttons, every `.btn-close` header button, and `status.html`'s `filter-group.html`/`.ts` (independently grepped - zero `.btn`-classed elements found) are all left untouched by every task.
- **Test counts:** all 6 expected counts (13, 12, 18, 15, 9, 17 = 84 total) were captured by running each spec file against the current `HEAD` (commit `5fb667a`, end of Phase 5) before writing this plan - they reflect actual current state, not estimates.
- **Final-phase note:** once this plan's plan-scoped review passes, the design's entire Bootstrap `.btn` rollout (per the design spec's Scope section, minus the explicitly-listed exclusions) is complete - the next step after this phase is a whole-branch review (`merge-base main HEAD`..`HEAD`) covering all 7 phases together, then the CLAUDE.md-mandated removal of the `docs/superpowers` folder in its own commit before opening the PR.
