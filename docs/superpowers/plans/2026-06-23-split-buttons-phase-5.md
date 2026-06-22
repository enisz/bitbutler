# Split Buttons - Phase 5: Data-Transfer Modals + Most Toggle Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 16 regular Bootstrap `.btn`s and 4 toggle groups (10 toggle-group `<label>`s total) across `export-torrents`, `import-torrents`, `share-limit`, and `transfer-limit` to the `.btn-split`/`bb-btn-content` pattern shipped in Phase 0 and proven out in Phases 1-4 - the same recipe as before, plus this phase's one new wrinkle: toggle-group `<label class="btn ...">` elements (siblings of `<input class="btn-check">`) get the identical `btn-split`/`bb-btn-content` treatment as regular buttons, with `[text]` built from a translated label concatenated with a live count in parentheses (per the design spec's own worked example). Zero shared-component or CSS changes - this phase only consumes Phase 0's primitives.

**Architecture:** Each task touches one existing component (`.ts` + `.html`) independently. `export-torrents.ts` and `import-torrents.ts`/`share-limit.ts`/`transfer-limit.ts` (the latter two pairs) currently have **no icon imports or icon object at all** - this phase introduces the app's `public readonly icons = { ... };` convention (plural, per `button-bar.ts` - matching the dominant convention; Phase 4's singular `icon` files are an unrelated, isolated pre-existing wart that is not relevant here) freshly into `export-torrents.ts`, `share-limit.ts`, and `transfer-limit.ts`. `import-torrents.ts` already has `readonly icons = { faMinus, faPlus, faTriangleExclamation };` (matching this phase's plural convention already) and gets it extended in place. Toggle-group labels keep their literal `<label>` tag (never wrapped in a component) per the design spec's explicit rejection of a wrapping `<app-split-button>` - Bootstrap's `.btn-check:checked + label.btn` selector requires the `<label>` to remain a literal sibling of its `<input class="btn-check">`.

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Consumes only Phase 0's primitives - no CSS or shared-component changes in this phase: `.btn-split`/`.btn-icon`/`.btn-text` classes (`packages/app/src/styles.scss`) and `BbBtnContent` (`packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`, selector `bb-btn-content`, inputs `icon: IconDefinition` required, `text: string` required, `position: 'start' | 'end' = 'start'`).
- Call-site markup pattern for regular buttons: keep the host element's tag and existing Bootstrap classes, add `btn-split`, and replace the button body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`.
- **Call-site markup pattern for toggle-group labels** (new in this phase): keep the `<label class="btn ...">` tag, its `for` attribute, and its literal sibling position immediately after the `<input class="btn-check">` - add `btn-split` to the label's class list, and replace the label body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`. Where the current text is `{{ 'key' | translate }} ({{ count() }})`, the replacement `[text]` binding is `('key' | translate) + ' (' + count() + ')'` (string concatenation, not nested interpolation) - this is the literal pattern from the design spec's own worked example. Where the current text has no count suffix (import-torrents' After-import mode labels), `[text]` is simply `'key' | translate` with no concatenation.
- Icon assignments for this phase, all from `@fortawesome/free-solid-svg-icons`:
  - Torrents scope toggle (export-torrents): All -> `faLayerGroup`, Filtered -> `faFilter`, Selected -> `faSquareCheck`.
  - Categories scope toggle (export-torrents): All -> `faFolderTree` (reuse from `button-bar.ts`/`status.ts`), Assigned -> `faLink` (reuse from `trackers.ts`/`status.ts`).
  - Tags scope toggle (export-torrents): All -> `faTags` (reuse from `button-bar.ts`/`status.ts`), Assigned -> `faLink` (same icon as Categories scope's Assigned - reused within the same file's `icons` object, not re-imported).
  - After-import mode toggle (import-torrents): Paused -> `faPause` (reuse from `button-bar.ts`), Active -> `faPlay` (reuse from `button-bar.ts`), All -> `faAsterisk`.
  - `general.button.browse` -> `faFolderOpen` (reuse from `bb-file-tree.ts`/`server.ts`) - export-torrents' Browse button.
  - `components.modals.export-torrents.button.show-in-folder` -> `faFolderOpen` (same icon as Browse, reused within export-torrents' own `icons` object).
  - `components.modals.export-torrents.button.export` -> `faFileExport` (component-specific, per design spec).
  - `components.modals.import-torrents.button.import` -> `faFileImport` (component-specific, per design spec).
  - `general.button.save` -> `faFloppyDisk` (already established, Phase 2).
  - `general.button.clear-all` -> `faEraser` (new generic key per design spec's icon table - distinct from delete's `faTrashCan` and the icon-only search-clear `faXmark`).
  - `general.button.cancel`, `general.button.close` -> `faXmark` (already established).
- Translation keys are unchanged - every key used in this phase (`general.button.browse`, `.save`, `.cancel`, `.close`, `.clear-all`, and all the `components.modals.export-torrents.*`/`components.modals.import-torrents.*` keys) already exists in `public/i18n/us.json`/`hu.json`. No i18n file edits in this phase.
- **`icons` object naming and placement:** `export-torrents.ts`, `share-limit.ts`, and `transfer-limit.ts` have no icon object today - create `public readonly icons = { ... };` in each, placed immediately after the file's `inject(...)` block and before its first `input()`/signal/form declaration (matching the position convention visible in `manage-tags.ts` etc.). `import-torrents.ts` already has `readonly icons = { faMinus, faPlus, faTriangleExclamation };` at its existing position - extend it in place by appending the new keys at the end, do not reorder or relocate it.
- Import path for `BbBtnContent` from all 4 files in this phase is `'../../bb-btn-content/bb-btn-content'` (all four live at `packages/app/src/app/components/modals/<name>/<name>.ts`, two levels up from `components/`).
- `share-limit`/`transfer-limit` have **two** same-named directories - the modal wrapper at `packages/app/src/app/components/modals/share-limit/share-limit.ts` (class `ShareLimit`, selector `app-share-limit-modal`) and the inner form component at `packages/app/src/app/components/share-limit/share-limit.ts` (class `ShareLimit`, selector `app-share-limit`, imported into the modal as `ShareLimit as ShareLimitForm`) - same for `transfer-limit`. **This phase touches only the `components/modals/<name>/` wrapper files** (which own the Save/Clear All/Cancel footer buttons). The inner form components (`components/share-limit/share-limit.html`, `components/transfer-limit/transfer-limit.html`) use plain `.form-check`/radio markup with no Bootstrap `.btn` classes anywhere - out of scope, not touched, not even read for this plan beyond confirming that fact.
- Each task's test command must target only the modal-wrapper spec file by its full path (e.g. `--include="**/modals/share-limit/share-limit.spec.ts"`) - a bare `--include="**/share-limit.spec.ts"` pattern matches **both** the wrapper spec and the inner form component's spec (2 files, 36 tests combined for share-limit; 2 files, 26 tests combined for transfer-limit) since both files share the same basename.
- Out of scope - do not touch, in any of the 4 files:
  - Any `.btn-close` (header X) button.
  - import-torrents' 4 icon-only path-mapping add/remove buttons (`btn btn-lg btn-link text-danger`/`text-success`, bare `<fa-icon [icon]="icons.faMinus/faPlus">`, no visible text) - explicitly excluded by the design spec's scope section ("import-torrents/server path-mapping buttons").
  - import-torrents' inline qb-settings link (`btn btn-link btn-sm p-0 align-baseline`, `(click)="openQbSettings()"`) - explicitly named in the design spec's scope exclusions as one of "two ambiguous text links that don't read as icon-bearing actions" that "stay plain `.btn-link` text".
  - import-torrents' `form-check`/`form-switch` checkboxes (restore-options toggles, overwrite-categories) - not Bootstrap `.btn`-classed.
  - export-torrents' read-only `<dl>` server-info rows, `bb-popover`/`app-bb-progress`/`app-bb-spinner` usages, and the `.bbe` `input-group-text` span.
  - The `faMinus`/`faPlus`/`faTriangleExclamation` icons' existing inline `<fa-icon>` usages in `import-torrents.html` (out of scope per the bullet above) - only their _import statement_ changes (new keys appended to the same destructured import and the same `icons` object), not their existing call sites.
- No spec file in this phase asserts on the in-scope button/toggle markup or text (verified by inspection of all 4 spec files - none reference `btn`, `button`, `querySelector`, or `nativeElement`) - no spec file changes in this phase, only regression runs. Each task's test step states the exact current passing-test count to confirm against.
- Class names match filenames without suffix; no `standalone: true` flag added/removed beyond what's already present in a file (`export-torrents.ts`/`import-torrents.ts` already have it; `share-limit.ts`/`transfer-limit.ts` don't - don't add it).

---

### Task 1: `export-torrents` - 3 toggle groups, Browse, Show in Folder, and footer buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/export-torrents/export-torrents.ts:13-45`
- Modify: `packages/app/src/app/components/modals/export-torrents/export-torrents.html:94-291`

**Interfaces:**

- Consumes: `BbBtnContent` and `.btn-split`/`.btn-icon`/`.btn-text` from Phase 0 (see Global Constraints).
- Produces: nothing consumed by later tasks in this phase - each task here is independent.

- [ ] **Step 1: Update `export-torrents.ts`'s icon import, `imports` array, and add an `icons` object**

Current (lines 13-34, the `@bitbutler/shared` type import through the `imports` array):

```ts
import type {
  BbeServerInfo,
  ExportCategoryScope,
  ExportScope,
  ExportStartPayload,
  ExportTagScope,
} from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbPopover } from '../../bb-popover/bb-popover';
import { BbProgress } from '../../bb-progress/bb-progress';
import { BbSpinner } from '../../bb-spinner/bb-spinner';

@Component({
  selector: 'app-export-torrents',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, BbProgress, BbPopover, BbSpinner],
```

Replace with:

```ts
import type {
  BbeServerInfo,
  ExportCategoryScope,
  ExportScope,
  ExportStartPayload,
  ExportTagScope,
} from '@bitbutler/shared';
import {
  faFileExport,
  faFilter,
  faFolderOpen,
  faFolderTree,
  faLayerGroup,
  faLink,
  faSquareCheck,
  faTags,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbPopover } from '../../bb-popover/bb-popover';
import { BbProgress } from '../../bb-progress/bb-progress';
import { BbSpinner } from '../../bb-spinner/bb-spinner';

@Component({
  selector: 'app-export-torrents',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, BbProgress, BbPopover, BbSpinner, BbBtnContent],
```

Current (lines 38-45, the class's inject block):

```ts
export class ExportTorrents implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly serverStore = inject(ServerStoreService);
  private readonly injector = inject(Injector);

  exportForm!: FormGroup;
```

Replace with:

```ts
export class ExportTorrents implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly serverStore = inject(ServerStoreService);
  private readonly injector = inject(Injector);

  public readonly icons = {
    faLayerGroup,
    faFilter,
    faSquareCheck,
    faFolderTree,
    faLink,
    faTags,
    faFolderOpen,
    faFileExport,
    faXmark,
  };

  exportForm!: FormGroup;
```

- [ ] **Step 2: Update `export-torrents.html`'s 3 toggle groups**

Current Torrents scope toggle (lines 94-122):

```html
          <label class="btn btn-outline-secondary" for="scope-all">
            {{ 'components.modals.export-torrents.scope.all' | translate }} ({{ allCount() }})
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="scope"
            id="scope-filtered"
            value="filtered"
            [attr.disabled]="!hasFiltered() || null"
          />
          <label class="btn btn-outline-secondary" for="scope-filtered">
            {{ 'components.modals.export-torrents.scope.filtered' | translate }} ({{
              filteredCount()
            }})
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="scope"
            id="scope-selected"
            value="selected"
            [attr.disabled]="!hasSelection() || null"
          />
          <label class="btn btn-outline-secondary" for="scope-selected">
            {{ 'components.modals.export-torrents.scope.selected' | translate }} ({{
              selectedCount()
            }})
          </label>
        </div>
```

Replace with:

```html
          <label class="btn btn-outline-secondary btn-split" for="scope-all">
            <bb-btn-content
              [icon]="icons.faLayerGroup"
              [text]="('components.modals.export-torrents.scope.all' | translate) + ' (' + allCount() + ')'"
            ></bb-btn-content>
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="scope"
            id="scope-filtered"
            value="filtered"
            [attr.disabled]="!hasFiltered() || null"
          />
          <label class="btn btn-outline-secondary btn-split" for="scope-filtered">
            <bb-btn-content
              [icon]="icons.faFilter"
              [text]="
                ('components.modals.export-torrents.scope.filtered' | translate) +
                ' (' +
                filteredCount() +
                ')'
              "
            ></bb-btn-content>
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="scope"
            id="scope-selected"
            value="selected"
            [attr.disabled]="!hasSelection() || null"
          />
          <label class="btn btn-outline-secondary btn-split" for="scope-selected">
            <bb-btn-content
              [icon]="icons.faSquareCheck"
              [text]="
                ('components.modals.export-torrents.scope.selected' | translate) +
                ' (' +
                selectedCount() +
                ')'
              "
            ></bb-btn-content>
          </label>
        </div>
```

Current Categories scope toggle (lines 136-153):

```html
          <label class="btn btn-outline-secondary" for="category-scope-all">
            {{ 'components.modals.export-torrents.category-scope.all' | translate }} ({{
              allCategoriesCount()
            }})
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="categoryScope"
            id="category-scope-assigned"
            value="assigned"
          />
          <label class="btn btn-outline-secondary" for="category-scope-assigned">
            {{ 'components.modals.export-torrents.category-scope.assigned' | translate }} ({{
              assignedCategoriesCount()
            }})
          </label>
        </div>
```

Replace with:

```html
          <label class="btn btn-outline-secondary btn-split" for="category-scope-all">
            <bb-btn-content
              [icon]="icons.faFolderTree"
              [text]="
                ('components.modals.export-torrents.category-scope.all' | translate) +
                ' (' +
                allCategoriesCount() +
                ')'
              "
            ></bb-btn-content>
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="categoryScope"
            id="category-scope-assigned"
            value="assigned"
          />
          <label class="btn btn-outline-secondary btn-split" for="category-scope-assigned">
            <bb-btn-content
              [icon]="icons.faLink"
              [text]="
                ('components.modals.export-torrents.category-scope.assigned' | translate) +
                ' (' +
                assignedCategoriesCount() +
                ')'
              "
            ></bb-btn-content>
          </label>
        </div>
```

Current Tags scope toggle (lines 167-184):

```html
          <label class="btn btn-outline-secondary" for="tag-scope-all">
            {{ 'components.modals.export-torrents.tag-scope.all' | translate }} ({{
              allTagsCount()
            }})
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="tagScope"
            id="tag-scope-assigned"
            value="assigned"
          />
          <label class="btn btn-outline-secondary" for="tag-scope-assigned">
            {{ 'components.modals.export-torrents.tag-scope.assigned' | translate }} ({{
              assignedTagsCount()
            }})
          </label>
        </div>
```

Replace with:

```html
          <label class="btn btn-outline-secondary btn-split" for="tag-scope-all">
            <bb-btn-content
              [icon]="icons.faTags"
              [text]="
                ('components.modals.export-torrents.tag-scope.all' | translate) +
                ' (' +
                allTagsCount() +
                ')'
              "
            ></bb-btn-content>
          </label>
          <input
            type="radio"
            class="btn-check"
            formControlName="tagScope"
            id="tag-scope-assigned"
            value="assigned"
          />
          <label class="btn btn-outline-secondary btn-split" for="tag-scope-assigned">
            <bb-btn-content
              [icon]="icons.faLink"
              [text]="
                ('components.modals.export-torrents.tag-scope.assigned' | translate) +
                ' (' +
                assignedTagsCount() +
                ')'
              "
            ></bb-btn-content>
          </label>
        </div>
```

- [ ] **Step 3: Update `export-torrents.html`'s Browse, Show in Folder, and footer buttons**

Current Browse button (lines 205-207):

```html
<button type="button" class="btn btn-outline-primary" (click)="browseDestDir()">
  {{ 'general.button.browse' | translate }}
</button>
```

Replace with:

```html
<button type="button" class="btn btn-outline-primary btn-split" (click)="browseDestDir()">
  <bb-btn-content
    [icon]="icons.faFolderOpen"
    [text]="'general.button.browse' | translate"
  ></bb-btn-content>
</button>
```

Current Show in Folder button (lines 256-258):

```html
<button type="button" class="btn btn-sm btn-success" (click)="showInFolder()">
  {{ 'components.modals.export-torrents.button.show-in-folder' | translate }}
</button>
```

Replace with:

```html
<button type="button" class="btn btn-sm btn-success btn-split" (click)="showInFolder()">
  <bb-btn-content
    [icon]="icons.faFolderOpen"
    [text]="'components.modals.export-torrents.button.show-in-folder' | translate"
  ></bb-btn-content>
</button>
```

Current footer (lines 269-291):

```html
<div class="modal-footer">
  @if (isRunning()) {
  <button type="button" class="btn btn-link" (click)="cancelExport()">
    {{ 'general.button.cancel' | translate }}
  </button>
  } @else if (isDone() || isError()) {
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.close' | translate }}
  </button>
  } @else {
  <button
    type="button"
    class="btn btn-primary"
    (click)="startExport()"
    [disabled]="exportForm.invalid"
  >
    {{ 'components.modals.export-torrents.button.export' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.cancel' | translate }}
  </button>
  }
</div>
```

Replace with:

```html
<div class="modal-footer">
  @if (isRunning()) {
  <button type="button" class="btn btn-link btn-split" (click)="cancelExport()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
  } @else if (isDone() || isError()) {
  <button type="button" class="btn btn-link btn-split" (click)="close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
  } @else {
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="startExport()"
    [disabled]="exportForm.invalid"
  >
    <bb-btn-content
      [icon]="icons.faFileExport"
      [text]="'components.modals.export-torrents.button.export' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
  }
</div>
```

- [ ] **Step 4: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/export-torrents.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 3 passed (3)`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/export-torrents/export-torrents.ts packages/app/src/app/components/modals/export-torrents/export-torrents.html
git commit -m "#180: retrofit export-torrents modal buttons and toggle groups to split-button style"
```

---

### Task 2: `import-torrents` - After-import mode toggle and footer buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.ts:19-20,34-42,82`
- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.html:309-389`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `import-torrents.ts`'s icon import, `imports` array, and extend the existing `icons` object**

Current (lines 19-29, icon import through the relative-import block):

```ts
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMinus, faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbSettings } from '../../../pages/qb-settings/qb-settings';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { setModalInput } from '../../../utils/modal-input';
import { BbPopover } from '../../bb-popover/bb-popover';
import { BbProgress } from '../../bb-progress/bb-progress';
```

Replace with:

```ts
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faAsterisk,
  faFileImport,
  faMinus,
  faPause,
  faPlay,
  faPlus,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbSettings } from '../../../pages/qb-settings/qb-settings';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { setModalInput } from '../../../utils/modal-input';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbPopover } from '../../bb-popover/bb-popover';
import { BbProgress } from '../../bb-progress/bb-progress';
```

Current `imports` array (lines 34-42):

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FaIconComponent,
    BbProgress,
    BbPopover,
    LocalTimestampPipe,
    NgbTooltip,
  ],
```

Replace with:

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FaIconComponent,
    BbProgress,
    BbPopover,
    LocalTimestampPipe,
    NgbTooltip,
    BbBtnContent,
  ],
```

Current `icons` object (line 82):

```ts
  readonly icons = { faMinus, faPlus, faTriangleExclamation };
```

Replace with:

```ts
  readonly icons = {
    faMinus,
    faPlus,
    faTriangleExclamation,
    faPause,
    faPlay,
    faAsterisk,
    faFileImport,
    faXmark,
  };
```

- [ ] **Step 2: Update `import-torrents.html`'s After-import mode toggle**

Current (lines 309-331):

```html
<label class="btn btn-outline-secondary" for="sm-paused">
  {{ 'components.modals.import-torrents.start-mode.paused' | translate }}
</label>
<input type="radio" class="btn-check" formControlName="startMode" id="sm-active" value="active" />
<label class="btn btn-outline-secondary" for="sm-active">
  {{ 'components.modals.import-torrents.start-mode.active' | translate }}
</label>
<input type="radio" class="btn-check" formControlName="startMode" id="sm-all" value="all" />
<label class="btn btn-outline-secondary" for="sm-all">
  {{ 'components.modals.import-torrents.start-mode.all' | translate }}
</label>
```

Replace with:

```html
<label class="btn btn-outline-secondary btn-split" for="sm-paused">
  <bb-btn-content
    [icon]="icons.faPause"
    [text]="'components.modals.import-torrents.start-mode.paused' | translate"
  ></bb-btn-content>
</label>
<input type="radio" class="btn-check" formControlName="startMode" id="sm-active" value="active" />
<label class="btn btn-outline-secondary btn-split" for="sm-active">
  <bb-btn-content
    [icon]="icons.faPlay"
    [text]="'components.modals.import-torrents.start-mode.active' | translate"
  ></bb-btn-content>
</label>
<input type="radio" class="btn-check" formControlName="startMode" id="sm-all" value="all" />
<label class="btn btn-outline-secondary btn-split" for="sm-all">
  <bb-btn-content
    [icon]="icons.faAsterisk"
    [text]="'components.modals.import-torrents.start-mode.all' | translate"
  ></bb-btn-content>
</label>
```

- [ ] **Step 3: Update `import-torrents.html`'s footer markup**

Current footer (lines 372-389):

```html
<div class="modal-footer">
  @if (isRunning()) {
  <button type="button" class="btn btn-link" (click)="cancelImport()">
    {{ 'general.button.cancel' | translate }}
  </button>
  } @else if (isDone() || isError()) {
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.close' | translate }}
  </button>
  } @else if (isReady()) {
  <button type="button" class="btn btn-primary" (click)="startImport()">
    {{ 'components.modals.import-torrents.button.import' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.cancel' | translate }}
  </button>
  }
</div>
```

Replace with:

```html
<div class="modal-footer">
  @if (isRunning()) {
  <button type="button" class="btn btn-link btn-split" (click)="cancelImport()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
  } @else if (isDone() || isError()) {
  <button type="button" class="btn btn-link btn-split" (click)="close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
  } @else if (isReady()) {
  <button type="button" class="btn btn-primary btn-split" (click)="startImport()">
    <bb-btn-content
      [icon]="icons.faFileImport"
      [text]="'components.modals.import-torrents.button.import' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
  }
</div>
```

- [ ] **Step 4: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/import-torrents.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/import-torrents/import-torrents.ts packages/app/src/app/components/modals/import-torrents/import-torrents.html
git commit -m "#180: retrofit import-torrents modal buttons and toggle group to split-button style"
```

---

### Task 3: `share-limit` - Save, Clear All, and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/share-limit/share-limit.ts:10-44`
- Modify: `packages/app/src/app/components/modals/share-limit/share-limit.html:46-69`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-2.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `share-limit.ts`'s icon import, `imports` array, and add an `icons` object**

Current (lines 10-44, the `@angular/forms` import through the inject block):

```ts
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { ShareLimit as ShareLimitForm, ShareLimitValue } from '../../share-limit/share-limit';

@Component({
  selector: 'app-share-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ShareLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
  ],
  templateUrl: './share-limit.html',
  styleUrl: './share-limit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLimit implements OnInit {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  readonly target = input<LimitTargetType>('torrent');
```

Replace with:

```ts
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faEraser, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { ShareLimit as ShareLimitForm, ShareLimitValue } from '../../share-limit/share-limit';

@Component({
  selector: 'app-share-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ShareLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
    BbBtnContent,
  ],
  templateUrl: './share-limit.html',
  styleUrl: './share-limit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLimit implements OnInit {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly icons = { faFloppyDisk, faEraser, faXmark };

  readonly target = input<LimitTargetType>('torrent');
```

- [ ] **Step 2: Update `share-limit.html`'s footer markup**

Current footer (lines 46-69):

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
    autofocus
  >
    {{ 'general.button.save' | translate }}
  </button>
  @if (hasClearableValues()) {
  <button type="button" class="btn btn-dashed-danger" (click)="clearAll()" [disabled]="!canSave()">
    {{ 'general.button.clear-all' | translate }}
  </button>
  }
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
    autofocus
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  @if (hasClearableValues()) {
  <button
    type="button"
    class="btn btn-dashed-danger btn-split"
    (click)="clearAll()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faEraser"
      [text]="'general.button.clear-all' | translate"
    ></bb-btn-content>
  </button>
  }
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/modals/share-limit/share-limit.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 25 passed (25)`.

**Important:** do not use the bare pattern `--include="**/share-limit.spec.ts"` - it also matches `packages/app/src/app/components/share-limit/share-limit.spec.ts` (the unrelated, untouched inner form component's spec), which would report a misleading combined count (36 tests across 2 files) instead of this task's own 25.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/share-limit/share-limit.ts packages/app/src/app/components/modals/share-limit/share-limit.html
git commit -m "#180: retrofit share-limit modal buttons to split-button style"
```

---

### Task 4: `transfer-limit` - Save, Clear All, and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts:10-50`
- Modify: `packages/app/src/app/components/modals/transfer-limit/transfer-limit.html:48-71`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-3. This is the last task of Phase 5.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `transfer-limit.ts`'s icon import, `imports` array, and add an `icons` object**

Current (lines 10-50, the `@angular/forms` import through the inject block):

```ts
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import {
  TransferLimit as TransferLimitForm,
  TransferLimitValue,
} from '../../transfer-limit/transfer-limit';

@Component({
  selector: 'app-transfer-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TransferLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
  ],
  templateUrl: './transfer-limit.html',
  styleUrl: './transfer-limit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferLimit implements OnInit {
  readonly target = input.required<LimitTargetType>();
  readonly hashes = input<string[]>([]);

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public activeModal = inject(NgbActiveModal);
```

Replace with:

```ts
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faEraser, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import {
  TransferLimit as TransferLimitForm,
  TransferLimitValue,
} from '../../transfer-limit/transfer-limit';

@Component({
  selector: 'app-transfer-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TransferLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
    BbBtnContent,
  ],
  templateUrl: './transfer-limit.html',
  styleUrl: './transfer-limit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferLimit implements OnInit {
  readonly target = input.required<LimitTargetType>();
  readonly hashes = input<string[]>([]);

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public activeModal = inject(NgbActiveModal);

  public readonly icons = { faFloppyDisk, faEraser, faXmark };
```

- [ ] **Step 2: Update `transfer-limit.html`'s footer markup**

Current footer (lines 48-71):

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
    autofocus
  >
    {{ 'general.button.save' | translate }}
  </button>
  @if (hasClearableValues()) {
  <button type="button" class="btn btn-dashed-danger" (click)="clearAll()" [disabled]="!canSave()">
    {{ 'general.button.clear-all' | translate }}
  </button>
  }
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
    autofocus
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  @if (hasClearableValues()) {
  <button
    type="button"
    class="btn btn-dashed-danger btn-split"
    (click)="clearAll()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faEraser"
      [text]="'general.button.clear-all' | translate"
    ></bb-btn-content>
  </button>
  }
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/modals/transfer-limit/transfer-limit.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 16 passed (16)`.

**Important:** do not use the bare pattern `--include="**/transfer-limit.spec.ts"` - it also matches `packages/app/src/app/components/transfer-limit/transfer-limit.spec.ts` (the unrelated, untouched inner form component's spec), which would report a misleading combined count (26 tests across 2 files) instead of this task's own 16.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts packages/app/src/app/components/modals/transfer-limit/transfer-limit.html
git commit -m "#180: retrofit transfer-limit modal buttons to split-button style"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Phase 5 row of the design spec's rollout table (`export-torrents`, `import-torrents`, `share-limit`, `transfer-limit`) and all 4 of the design spec's "most toggle groups" (Torrents/Categories/Tags scope in `export-torrents`, After-import mode in `import-torrents`) - the 5th toggle group row in the design spec (`add-torrent/general.html`'s Input mode) belongs to Phase 6 ("Remaining toggle group"), confirmed by cross-referencing the design spec's own phase table, and is correctly excluded here. Verified the exact element count against current source: 16 regular buttons (`export-torrents` 6, `import-torrents` 4, `share-limit` 3, `transfer-limit` 3) + 4 toggle groups totaling 10 `<label>`s (`export-torrents` 7, `import-torrents` 3) = 26 elements total. This exceeds the design spec's own "~12 + 4 toggle groups" estimate for regular buttons (12 vs. actual 16) - an approximate figure in the spec itself, same pattern as every prior phase's estimate; the toggle-group _count_ (4) matches exactly.
- **Placeholder scan:** none - all four tasks contain complete before/after code for every file/section they touch.
- **Formatting verified, not guessed:** every `.ts` and `.html` snippet in this plan was produced by actually applying the edit to a copy of the real file inside the project tree and running this repo's own `npx prettier --write` (picking up `package.json`'s `@trivago/prettier-plugin-sort-imports` config and the `*.html` -> Angular parser override) - including the toggle-group `[text]` concatenation expressions' line-wrapping (e.g. `scope-filtered`'s 4-line wrap vs. `scope-all`'s single-line form, driven purely by each one's printed length against the 100-char `printWidth`).
- **New convention introduced, not invented ad hoc:** `export-torrents.ts`, `share-limit.ts`, and `transfer-limit.ts` had zero icon imports/objects before this phase - each gets a fresh `public readonly icons = { ... };` (plural), matching the dominant `icons` convention (`button-bar.ts`, Phases 1-3's freshly-created files) rather than Phase 4's `icon` singular - that singular form was itself an isolated pre-existing inconsistency in 6 specific files, not the convention to propagate forward.
- **Toggle-group markup pattern verified against the design spec's own example:** the spec's Architecture section shows `[text]="(scopeAllLabel() | translate) + ' (' + allCount() + ')'"` for exactly this `scope-all` label - Task 1's Step 2 replate-with block matches that pattern verbatim (substituting the actual translation key and count signal names), and the 3 labels with no count suffix (import-torrents' After-import mode) correctly drop the concatenation per the Global Constraints' documented exception.
- **Two-directory naming collision documented and verified:** `share-limit`/`transfer-limit` each have a `components/modals/<name>/` wrapper (touched) and an unrelated `components/<name>/` inner form component (not touched, confirmed to contain zero `.btn`-classed elements by direct inspection) - both share a spec-file basename, so each task's test command uses the full nested path to avoid silently running and reporting on both.
- **Type consistency:** `BbBtnContent`'s `icon`/`text` inputs are referenced identically to Phase 0's definition and Phases 1-4's usage. Every import path (`'../../bb-btn-content/bb-btn-content'`) was verified against each file's actual location, all four sitting at the same depth under `components/modals/`.
- **Out-of-scope verification:** confirmed all 4 modals' `.btn-close` header buttons, import-torrents' 4 icon-only path-mapping buttons and its inline qb-settings text link (both explicitly named as excluded in the design spec), and both inner form components' pure-radio/`.form-check` markup are untouched by any task.
- **Test counts:** all 6 expected counts (export-torrents 3, import-torrents 8, share-limit-modal 25, transfer-limit-modal 16 - plus the two inner-form-component counts of 11 and 10 respectively, confirmed unaffected and out of scope) were captured by running each spec file against the current `HEAD` (commit `2dcfce2`, end of Phase 4) before writing this plan - they reflect actual current state, not estimates.
