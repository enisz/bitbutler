# Split Buttons - Phase 1: Showcase Retrofit (about, update-available, login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 7 Bootstrap `.btn`s in `about.html`, `update-available.html`, and `login.html` to the `.btn-split`/`bb-btn-content` pattern shipped in Phase 0 - validating `btn-lg`, `btn-dashed-secondary`, and a brand icon (`faGithub`), with zero new icon decisions beyond the generic/component-specific keys the design spec already assigns.

**Architecture:** Each task touches one existing component (`.ts` + `.html`) independently: replace each button's inline text/icon body with `<bb-btn-content>`, add `btn-split` to the host's class list, and extend (or, for `about.ts`, replace `FontAwesomeModule` with) each component's existing icon-import/`icons`-object convention. No CSS or shared-component changes in this phase - both already shipped in Phase 0 (commits `a7baf52`, `9e8ffb3`).

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Consumes only Phase 0's primitives - no CSS or shared-component changes in this phase: `.btn-split`/`.btn-icon`/`.btn-text` classes (`packages/app/src/styles.scss`) and `BbBtnContent` (`packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`, selector `bb-btn-content`, inputs `icon: IconDefinition` required, `text: string` required, `position: 'start' | 'end' = 'start'`).
- Call-site markup pattern: keep the host element's tag and existing Bootstrap classes, add `btn-split`, and replace the button body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`. Drop any `px-*` padding utility classes on the host - `.btn-split` sets `padding: 0 !important`, so they have no visual effect once applied.
- Icon assignments for this phase, all from `@fortawesome/free-solid-svg-icons` unless noted:
  - `general.button.close` -> `faXmark`
  - `general.button.connect` -> `faPlug`
  - `general.button.manage-servers` -> `faServer`
  - `components.modals.update-available.button.view-on-github` -> `faGithub` (from `@fortawesome/free-brands-svg-icons`)
  - about.html's GitHub/`@enisz` buttons keep their existing `faGithub`/`faUser` icons unchanged - only the markup changes, no new icon decision.
- Each call site exposes icons via a component-local `icons` object (existing app convention, e.g. `button-bar.ts`) - extend the existing `icons` object where one already exists (`about.ts`, `login.ts`); create one where it doesn't (`update-available.ts`).
- When a component's template no longer uses `<fa-icon>` directly because its only icon usages moved into `bb-btn-content`, remove the now-unused `FontAwesomeModule` import from that component - `bb-btn-content` owns that import now. Applies to `about.ts` in this phase. `update-available.ts` never imported it. `login.ts` keeps it - its three `.bb-quick-setting` icon-only dropdown togglers stay untouched and still use `<fa-icon>` directly.
- Translation keys are unchanged - all four (`general.button.close`, `general.button.connect`, `general.button.manage-servers`, `components.modals.update-available.button.view-on-github`) already exist in `public/i18n/us.json`/`hu.json`. No i18n file edits in this phase.
- Out of scope - do not touch: about.html's version/commit badges (`<span class="badge ...">`, not `.btn`-classed); update-available.html's `.btn-close`, `ngbAccordionButton`, and `list-group-item-action` elements (not `.btn`-classed, or already icon-only); login.html's `v{{version}}` link (kept as plain text per the design spec) and its three `.bb-quick-setting` icon-only dropdown togglers (no text segment to split).
- No new unit tests are added in this phase - it changes markup/icons only, with no new testable behavior. Each task's existing spec file must still pass unchanged (regression check) per the design spec's Testing section, which states the visual split styling itself isn't unit-testable.
- Class names match filenames without suffix, components have no `standalone: true` flag added/removed beyond what's already present (do not "fix" pre-existing `standalone: true` on `UpdateAvailable`/`Login` - out of scope for this phase).

---

### Task 1: `about.html` - GitHub, `@enisz`, and Close buttons

**Files:**

- Modify: `packages/app/src/app/components/about/about.ts:1-36`
- Modify: `packages/app/src/app/components/about/about.html:50-69`

**Interfaces:**

- Consumes: `BbBtnContent` and `.btn-split`/`.btn-icon`/`.btn-text` from Phase 0 (see Global Constraints).
- Produces: nothing consumed by later tasks in this phase - each task here is independent.

- [ ] **Step 1: Update `about.ts`'s icon imports, `icons` object, and component `imports` array**

Current file (relevant lines):

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faCalendarAlt,
  faCodeBranch,
  faExternalLinkAlt,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../directives/autofocus';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-about',
  imports: [LocalTimestampPipe, AutofocusDirective, FontAwesomeModule, TranslatePipe],
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faCalendarAlt,
  faCodeBranch,
  faExternalLinkAlt,
  faUser,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-about',
  imports: [LocalTimestampPipe, AutofocusDirective, BbBtnContent, TranslatePipe],
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {
```

Then update the `icons` property:

```ts
  public icons = {
    faGithub,
    faUser,
    faExternalLinkAlt,
    faCalendarAlt,
    faCodeBranch,
  };
```

Replace with:

```ts
  public icons = {
    faGithub,
    faUser,
    faExternalLinkAlt,
    faCalendarAlt,
    faCodeBranch,
    faXmark,
  };
```

- [ ] **Step 2: Update `about.html`'s button markup**

Current (lines 50-69):

```html
<div class="d-flex justify-content-between align-items-center">
  <div class="d-flex gap-2">
    <button
      class="btn btn-dashed-secondary px-3"
      (click)="openExternalUrl('https://github.com/enisz/bitbutler')"
    >
      <fa-icon [icon]="icons.faGithub" class="me-2"></fa-icon>github@bitbutler
    </button>
    <button
      class="btn btn-dashed-secondary px-3"
      (click)="openExternalUrl('https://github.com/enisz')"
    >
      <fa-icon [icon]="icons.faUser" class="me-2"></fa-icon>@enisz
    </button>
  </div>

  <button type="button" class="btn btn-link px-4" (click)="activeModal.close()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="d-flex justify-content-between align-items-center">
  <div class="d-flex gap-2">
    <button
      class="btn btn-dashed-secondary btn-split"
      (click)="openExternalUrl('https://github.com/enisz/bitbutler')"
    >
      <bb-btn-content [icon]="icons.faGithub" text="github@bitbutler"></bb-btn-content>
    </button>
    <button
      class="btn btn-dashed-secondary btn-split"
      (click)="openExternalUrl('https://github.com/enisz')"
    >
      <bb-btn-content [icon]="icons.faUser" text="@enisz"></bb-btn-content>
    </button>
  </div>

  <button type="button" class="btn btn-link btn-split" (click)="activeModal.close()" autofocus>
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/about.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/about/about.ts packages/app/src/app/components/about/about.html
git commit -m "#180: retrofit about modal buttons to split-button style"
```

---

### Task 2: `update-available.html` - View on GitHub and Close buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/update-available/update-available.ts:1-32`
- Modify: `packages/app/src/app/components/modals/update-available/update-available.html:84-97`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `update-available.ts`'s imports, `imports` array, and add an `icons` object**

Current file (lines 1-32):

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Release, UpdateCheckResponse } from '@bitbutler/shared';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ElectronService } from '../../../services/electron.service';
import { ThemeService } from '../../../services/theme.service';

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
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  private readonly themeService = inject(ThemeService);

  public update = signal<UpdateCheckResponse | null>(null);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
```

Replace with:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Release, UpdateCheckResponse } from '@bitbutler/shared';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ElectronService } from '../../../services/electron.service';
import { ThemeService } from '../../../services/theme.service';

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
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  private readonly themeService = inject(ThemeService);

  public readonly icons = { faGithub, faXmark };
  public update = signal<UpdateCheckResponse | null>(null);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
```

- [ ] **Step 2: Update `update-available.html`'s footer markup**

Current (lines 84-97):

```html
<div class="modal-footer border-0">
  @if (latestRelease; as release) {
  <button type="button" class="btn btn-dashed-secondary" (click)="downloadAsset(release.html_url)">
    {{ 'components.modals.update-available.button.view-on-github' | translate }}
  </button>
  }
  <button type="button" class="btn btn-link" (click)="activeModal.close('ignore')">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer border-0">
  @if (latestRelease; as release) {
  <button
    type="button"
    class="btn btn-dashed-secondary btn-split"
    (click)="downloadAsset(release.html_url)"
  >
    <bb-btn-content
      [icon]="icons.faGithub"
      [text]="'components.modals.update-available.button.view-on-github' | translate"
    ></bb-btn-content>
  </button>
  }
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.close('ignore')">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/update-available.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 16 passed (16)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/update-available/update-available.ts packages/app/src/app/components/modals/update-available/update-available.html
git commit -m "#180: retrofit update-available modal buttons to split-button style"
```

---

### Task 3: `login.html` - Connect and Manage Servers buttons

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts:1-77`
- Modify: `packages/app/src/app/pages/login/login.html:63-75`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `login.ts`'s icon import, add `BbBtnContent` import, extend `imports` array and `icons` object**

`FontAwesomeModule` stays - the quick-setting togglers still use `<fa-icon>` directly and are out of scope for this phase.

Current (icon import line):

```ts
import { faCircleHalfStroke, faLanguage, faPalette } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import {
  faCircleHalfStroke,
  faLanguage,
  faPalette,
  faPlug,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
```

Current (component-import lines, around line 21):

```ts
import { AppLoader } from '../../components/app-loader/app-loader';
import { CredentialPrompt } from '../../components/modals/credential-prompt/credential-prompt';
```

Replace with:

```ts
import { AppLoader } from '../../components/app-loader/app-loader';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { CredentialPrompt } from '../../components/modals/credential-prompt/credential-prompt';
```

Current (`@Component` decorator's `imports` array):

```ts
@Component({
  selector: 'app-login',
  standalone: true,
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
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
```

Replace with:

```ts
@Component({
  selector: 'app-login',
  standalone: true,
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
    BbBtnContent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
```

Current (`icons` property):

```ts
  public readonly icons = { faLanguage, faPalette, faCircleHalfStroke };
```

Replace with:

```ts
  public readonly icons = { faLanguage, faPalette, faCircleHalfStroke, faPlug, faServer };
```

- [ ] **Step 2: Update `login.html`'s button markup**

Current (lines 63-75):

```html
<div class="d-flex flex-column gap-3">
  <button
    type="button"
    class="btn btn-lg btn-primary"
    (click)="connect()"
    [disabled]="!canConnect()"
  >
    {{ 'general.button.connect' | translate }}
  </button>
  <button type="button" class="btn btn-lg btn-dashed-secondary" (click)="openManageServers()">
    {{ 'general.button.manage-servers' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="d-flex flex-column gap-3">
  <button
    type="button"
    class="btn btn-lg btn-primary btn-split"
    (click)="connect()"
    [disabled]="!canConnect()"
  >
    <bb-btn-content
      [icon]="icons.faPlug"
      [text]="'general.button.connect' | translate"
    ></bb-btn-content>
  </button>
  <button
    type="button"
    class="btn btn-lg btn-dashed-secondary btn-split"
    (click)="openManageServers()"
  >
    <bb-btn-content
      [icon]="icons.faServer"
      [text]="'general.button.manage-servers' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/login.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 29 passed (29)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.html
git commit -m "#180: retrofit login page buttons to split-button style"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Phase 1 row of the rollout table in full (about, update-available, login - 7 buttons). Verified the exact button count against current source: about.html (3: GitHub, `@enisz`, Close), update-available.html (2: View on GitHub, Close), login.html (2: Connect, Manage Servers) = 7. No icon decisions beyond the design spec's existing tables - `faGithub`/`faUser` reused as-is on about.html; `faXmark`/`faPlug`/`faServer`/`faGithub` assigned per the generic-key and component-specific tables.
- **Placeholder scan:** none - all three tasks contain complete before/after code for every file touched.
- **Type consistency:** `BbBtnContent`'s `icon`/`text`/`position` inputs are referenced identically to Phase 0's definition (`[icon]`, `[text]`, default `position` left unset everywhere in this phase since all buttons want the icon first). Every import path is relative and was verified against each file's actual location on disk.
- **Out-of-scope verification:** confirmed login.html's `v{{version}}` link, its three `.bb-quick-setting` togglers, and update-available.html's `.btn-close`/`ngbAccordionButton`/`list-group-item-action` elements are untouched by any task, matching the design spec's scope exclusions.
- **Manual follow-up (not a task - no automated check exists for this):** after all three tasks land, run the app and switch through all 8 themes x light/dark to confirm icon-segment contrast/legibility on `btn-primary`, `btn-dashed-secondary`, and `btn-link`, per the design spec's Testing section.
