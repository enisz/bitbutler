# Add Torrent modal: tabbed layout

## Goal

Split the single-column "Add Torrent" modal (`packages/app/src/app/components/add-torrent/`)
into a tabbed layout matching the visual pattern used by Settings/QbSettings
(`<ul class="nav nav-tabs bb-modal-tabs">` + `.bb-tab-panels`/`.bb-tab-panel--active`),
while keeping a single shared form and a single "Add" action - unlike Settings,
there is no per-tab dirty/save state.

Along the way: a long-standing `noSlash`-only rename validator gets replaced with the
file-tree's full invalid-character check, the modal gains a way to surface
validation/state issues regardless of which tab the user is on, and the
file/magnet-link mode toggle moves from the top button bar into the modal itself.

## Tab structure

Four tabs, eagerly imported (no lazy `loadComponent()`/spinner - the modal must open
instantly):

| Tab         | Contents                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------- |
| **General** | Input-mode toggle (file/magnet) + source input, rename, save path, category, tags                  |
| **Options** | Root folder mode, skip hash checking, paused, Auto TMM, sequential download, first/last piece prio |
| **Limits**  | Transfer rate limits, share limits                                                                 |
| **Files**   | File tree (disabled when not applicable)                                                           |

This consolidates the current 5 `bb-fieldset` sections (Input, General, Settings, Limits,
Files) into 4 tabs - "Input" and "General" merge into the **General** tab, and "Settings"
becomes **Options**.

## Component & file structure

```
packages/app/src/app/components/add-torrent/
  add-torrent.ts / .html / .scss     (parent - owns addForm, tab nav, business logic)
  general/general.ts / .html         (selector: app-add-torrent-general)
  options/options.ts / .html         (selector: app-add-torrent-options)
  limits/limits.ts / .html           (selector: app-add-torrent-limits)
  files/files.ts / .html             (selector: app-add-torrent-files)
```

(`app-general` etc. are already used by Settings pages, hence the `app-add-torrent-*` prefix.)

A new `AddTorrentFormGroup` type is added to `models/add-torrent.model.ts`, matching the
shape of today's `addForm`. Each child component takes
`@Input({ required: true }) form!: AddTorrentFormGroup` and binds `[formGroup]="form"` on
its root element. This avoids a circular import between the parent and its children.

All `addForm` state, `handleSubmit`, `canSubmit`, queue logic, draft loading, etc. stay on
the parent `AddTorrent` component - only template markup moves into the children.

### Tab definitions on the parent

```typescript
export type AddTorrentTabId = 'general' | 'options' | 'limits' | 'files';

interface AddTorrentTab {
  id: AddTorrentTabId;
  label: string; // i18n key
}

public tabs: AddTorrentTab[] = [
  { id: 'general', label: 'components.add-torrent.tab.general.title' },
  { id: 'options', label: 'components.add-torrent.tab.options.title' },
  { id: 'limits', label: 'components.add-torrent.tab.limits.title' },
  { id: 'files', label: 'components.add-torrent.tab.files.title' },
];

public activeTabId = signal<AddTorrentTabId>('general');
public selectTab(tabId: AddTorrentTabId): void { this.activeTabId.set(tabId); }
```

### Tab panels

All four panels render at once, using the existing `.bb-tab-panels`/`.bb-tab-panel`/
`.bb-tab-panel--active` overlay pattern (CSS show/hide, not `@if`/`*ngIf`). This matters
because `general`, `options`, and `limits` each declare `[formGroup]="form"` against the
_same_ `addForm` instance as the parent's `<form>` - keeping all of them mounted for the
modal's lifetime avoids repeatedly attaching/detaching `FormGroupDirective` on a shared
FormGroup.

```html
<form [formGroup]="addForm" (submit)="handleSubmit($event)">
  <div class="bb-tab-panels">
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === 'general'">
      <app-add-torrent-general
        [form]="addForm"
        [inputMode]="inputMode"
        (inputModeChange)="switchInputMode($event)"
        (fileSelected)="handleFileSelected($event)"
      ></app-add-torrent-general>
    </div>
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === 'options'">
      <app-add-torrent-options [form]="addForm"></app-add-torrent-options>
    </div>
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === 'limits'">
      <app-add-torrent-limits [form]="addForm"></app-add-torrent-limits>
    </div>
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === 'files'">
      @if (!filesTabDisabled()) {
      <app-add-torrent-files
        [draft]="effectiveDraft"
        (saved)="onTreeSaved($event)"
        (editModeChange)="treeInEditMode.set($event)"
      ></app-add-torrent-files>
      }
    </div>
  </div>
  <button type="submit" hidden></button>
</form>
```

## Per-tab content layout (fieldsets vs. flat)

Precedent (Bandwidth tab, Status Bar tab): `bb-fieldset` + `<legend>` is used for grouping
_specific_ sub-concerns, and a legend never just repeats the tab's own title.

- **General**: keep the two existing `bb-fieldset` blocks, "Input" and "General"
  (`components.add-torrent.label.input` / `.general`), unchanged. Their legends already
  name distinct sub-concerns (source input vs. naming/destination/categorization).
- **Options**: drop the fieldset wrapper entirely (the old "Settings" legend would now
  duplicate the tab's own title, and the six controls don't subdivide further). The
  root-folder dropdown + 5 toggle switches go directly into a `container-fluid`/`row` div,
  same inner markup as today minus `<fieldset>`/`<legend>`.
- **Limits**: keep two fieldsets, but rename/split into **"Transfer Rate Limits"** (wrapping
  `app-transfer-limit`) and **"Share Limits"** (wrapping `app-share-limit`) - new legend
  keys `components.add-torrent.label.transfer-rate-limits` / `.share-limits`. Neither
  embedded component self-labels, so the fieldset+legend is what distinguishes the two
  blocks (mirrors Bandwidth's "Global Rate Limits"/"Alternative Rate Limits" split).
- **Files**: drop the fieldset wrapper. `app-bb-file-tree` already renders its own header
  (file/folder counts, total size, expand-all/collapse-all/filter toolbar), so a "Files"
  legend would be redundant. The tab content is just the file tree component.

`<ng-template>`s currently at the bottom of `add-torrent.html` move with their fieldset:
`filePopover`/`linksPopover`/`namePopover` → General; `rootFolder`/`skipChecking`/
`pausedState`/`autoTMM`/`sequentialDownload`/`firstLastPiece` (plus the
`faExclamationTriangle` icon import they use) → Options.

## General tab: input-mode toggle

A `btn-check`/`btn-group` toggle (same pattern as `export-torrents.html`'s scope toggle)
replaces the implicit `inputMode` switch, placed at the top of the "Input" fieldset:

```html
<div class="btn-group w-100 mb-3" role="group">
  <input
    type="radio"
    class="btn-check"
    id="inputMode-file"
    name="inputMode"
    [checked]="inputMode() === 'file'"
    (change)="inputModeChange.emit('file')"
  />
  <label class="btn btn-outline-secondary" for="inputMode-file">
    <fa-icon [icon]="icons.faFile" class="me-1"></fa-icon>
    {{ 'components.add-torrent.add-form.input-mode.file' | translate }}
  </label>

  <input
    type="radio"
    class="btn-check"
    id="inputMode-link"
    name="inputMode"
    [checked]="inputMode() === 'link'"
    (change)="inputModeChange.emit('link')"
  />
  <label class="btn btn-outline-secondary" for="inputMode-link">
    <fa-icon [icon]="icons.faLink" class="me-1"></fa-icon>
    {{ 'components.add-torrent.add-form.input-mode.link' | translate }}
  </label>
</div>
```

`AddTorrentGeneral` takes `@Input({ required: true }) inputMode!: () => 'file' | 'link'`
(the parent's signal, passed by reference) and `@Output() inputModeChange`/
`@Output() fileSelected`, which the parent wires to its existing `switchInputMode()`/
`handleFileSelected()`. `faFile`/`faLink` icons move here from the button bar.

### Button bar simplification

Since the modal now has its own toggle, the "new" dropdown group in
`pages/main/button-bar/button-bar.ts` (currently `kind: 'group'` with
`new.addTorrentFile` + `new.addTorrentLink` sub-items) collapses to a single
`kind: 'action'` entry:

```typescript
{ id: 'new.addTorrent', label: 'pages.main.button-bar.button.add', icon: faPlus, variant: 'default' }
```

emitting plain `UI_ADD_TORRENT` (no `mode`). Cleanup:

- Remove the `new.addTorrentFile`/`new.addTorrentLink` cases from `onClick()` and the
  now-unused `faFile`/`faLink` imports in `button-bar.ts`.
- Remove the `mode?: 'file' | 'link'` field from the `UI_ADD_TORRENT` command
  (`models/command.model.ts`) and the corresponding
  `if (command.mode === 'link') { switchInputMode('link') }` branch in
  `ui-command-handler.service.ts`.
- Remove the now-unused `pages.main.button-bar.button.add-file` / `.add-link` i18n keys
  (keep `...button.add` for the single button's tooltip).

## Tab warning icons, disabled Files tab, and Add-button gating

### Per-tab issues

A single computed signal aggregates per-tab issues, re-evaluated whenever `addForm`'s
status changes (via `toSignal(addForm.statusChanges, { initialValue: addForm.status })`)
or `treeInEditMode` changes:

```typescript
public readonly tabIssues = computed<Partial<Record<AddTorrentTabId, string[]>>>(() => {
  this.formStatus(); // re-run when addForm validity changes
  const issues: Partial<Record<AddTorrentTabId, string[]>> = {};

  const general: string[] = [];
  const renameErrors = this.addForm.controls.rename.errors;
  if (renameErrors?.['required']) {
    general.push(this.translateService.instant('general.form.feedback.required'));
  }
  if (renameErrors?.['pattern']) {
    general.push(this.translateService.instant('general.form.feedback.pattern'));
  }

  const formErrors = this.addForm.errors;
  if (formErrors?.['noServerSelected']) {
    general.push(this.translateService.instant('components.add-torrent.feedback.no-server-selected'));
  }
  if (formErrors?.['addFailed']) {
    general.push(this.translateService.instant('components.add-torrent.feedback.add-failed'));
  }
  if (general.length) issues.general = general;

  if (this.treeInEditMode()) {
    issues.files = [this.translateService.instant('components.add-torrent.tab.files.issue.edit-in-progress')];
  }

  return issues;
});

public readonly hasActiveWarnings = computed(() =>
  Object.values(this.tabIssues()).some((list) => (list?.length ?? 0) > 0),
);
```

### Add-button gating

`canSubmit()` simplifies to one shared check plus the per-mode source check:

```typescript
public canSubmit(): boolean {
  if (!this.addForm.valid || this.hasActiveWarnings() || this.isSubmitting()) return false;
  return this.inputMode() === 'link'
    ? this.getMagnetLinks().length > 0
    : this.selectedTorrentFile() !== null;
}
```

`addForm.valid` remains the correctness guard for all current/future field validators.
`hasActiveWarnings()` adds `treeInEditMode` (which lives outside the form) and ensures any
condition that lights up a tab warning also disables "Add" - some overlap with
`addForm.valid` for the rename/form-level errors is intentional: two signals, two purposes.

### Tab header rendering

For each tab, if `tabIssues()[tab.id]` is non-empty, show `faTriangleExclamation`
(`text-warning`) with an `ngbPopover` listing the messages via a shared
`<ng-template #tabIssuesPopover let-issues>`:

```html
@for (tab of tabs; track tab.id) {
<li class="nav-item">
  <button
    class="nav-link"
    [class.active]="activeTabId() === tab.id"
    [class.disabled]="tab.id === 'files' && filesTabDisabled()"
    (click)="!(tab.id === 'files' && filesTabDisabled()) && selectTab(tab.id)"
  >
    {{ tab.label | translate }} @if (tab.id === 'files' && filesTabDisabled()) {
    <fa-icon
      [icon]="icons.faCircleQuestion"
      class="ms-2 text-secondary"
      [ngbPopover]="filesTabDisabledReason()"
      triggers="mouseenter:mouseleave"
      container="body"
      placement="bottom"
    ></fa-icon>
    } @else if ((tabIssues()[tab.id] ?? []).length > 0) {
    <fa-icon
      [icon]="icons.faTriangleExclamation"
      class="ms-2 text-warning"
      [ngbPopover]="tabIssuesPopover"
      [popoverContext]="{ $implicit: tabIssues()[tab.id] }"
      triggers="mouseenter:mouseleave"
      container="body"
      placement="bottom"
    ></fa-icon>
    }
  </button>
</li>
}

<ng-template #tabIssuesPopover let-issues>
  <ul class="mb-0 ps-3">
    @for (issue of issues; track issue) {
    <li>{{ issue }}</li>
    }
  </ul>
</ng-template>
```

### Files tab disabled state

Separate mechanism from "issues" - disabled means the tab can't be navigated to at all.

```typescript
public readonly filesTabDisabledReason = computed<string | null>(() => {
  if (this.inputMode() === 'link') {
    return this.translateService.instant('components.add-torrent.tab.files.disabled.link-mode');
  }
  const draft = this.effectiveDraft();
  if (!this.showTree() || !draft?.torrent?.files?.length) {
    return this.translateService.instant('components.add-torrent.tab.files.disabled.no-files');
  }
  return null;
});

public readonly filesTabDisabled = computed(() => this.filesTabDisabledReason() !== null);
```

The nav button gets the Bootstrap `.disabled` _class_ (not the `disabled` attribute, so
hover/popover still work), the click handler is guarded, and `faCircleQuestion` shows the
reason via popover. An `effect()` switches `activeTabId` back to `'general'` if Files is
the active tab and becomes disabled (e.g. switching to link mode mid-session).

## Rename validator

Replace the ad-hoc `noSlashValidator()` with the file tree's full invalid-character check.
`INVALID_FILENAME_CHARS` (currently a private const in `bb-file-tree.ts`) moves to
`packages/app/src/app/app.const.ts` as a shared exported constant, imported by both
`bb-file-tree.ts` and `add-torrent.ts`:

```typescript
// app.const.ts
export const INVALID_FILENAME_CHARS = /^[^<>:"/\\|?*\x00-\x1f]+$/;
```

```typescript
// add-torrent.ts
rename: new FormControl<string | null>(null, [Validators.required, Validators.pattern(INVALID_FILENAME_CHARS)]),
```

The private `noSlashValidator()` method is deleted. In the template, the
`hasError('noSlash')` branch becomes `hasError('pattern')`, using the same new
`general.form.feedback.pattern` key as the tab-warning popover.

## CSS dedup

`.bb-tab-panels` / `.bb-tab-panel` / `.bb-tab-panel--active` are currently duplicated
identically in `settings.scss` and `qb-settings.scss`. Move this block to global
`styles.scss` (next to `.bb-modal-tabs`) and delete both duplicates - `add-torrent.scss`
(currently empty) then needs nothing extra, and all three modals share one definition.

## i18n changes

Additions (both `us.json` and `hu.json`):

- `components.add-torrent.tab.{general,options,limits,files}.title` - new tab-title keys,
  mirroring `pages.settings.tab.<id>.title`. Text: "General" / "Options" / "Limits" /
  "Files".
- `components.add-torrent.label.transfer-rate-limits` / `.share-limits` - new fieldset
  legends for the Limits tab.
- `components.add-torrent.add-form.input-mode.file` / `.link` - labels for the new toggle
  ("Torrent File" / "Magnet Link").
- `general.form.feedback.pattern` - new shared message "Name contains invalid characters
  (< > : \" / \\ | ? \*)" (mirrors `components.bb-file-tree.validation.pattern`'s wording),
  used by the rename field's new `pattern` error.
- `components.add-torrent.feedback.no-server-selected` / `.add-failed` - messages for the
  two form-level errors, now surfaced via the General tab's warning icon.
- `components.add-torrent.tab.files.issue.edit-in-progress` - Files tab warning text.
- `components.add-torrent.tab.files.disabled.link-mode` / `.no-files` - Files tab
  disabled-popover reasons.

Removals (now unused):

- `components.add-torrent.label.settings` / `.limits` / `.files` (old fieldset legends,
  replaced by tab titles / new Limits legends / nothing).
- `general.form.feedback.no-slash` (replaced by `.pattern`).
- `pages.main.button-bar.button.add-file` / `.add-link`.

## Unchanged

- Modal stays `size: 'lg', scrollable: true`.
- The queue indicator (`(currentDraftNumber()/initialQueueCount())`) stays in
  `.bb-modal-header__text`, above the tab nav.
- All business logic (`handleSubmit`, draft loading, queue handling,
  `tryRenameContentAfterAdd`, etc.) stays on the parent `AddTorrent` component.

## Testing

- **`add-torrent.spec.ts`** (existing): update rename-validator tests from `noSlash` to
  `pattern` (covering both slash and other invalid characters like `<>:"|?*`). Add
  coverage for `tabIssues()`/`hasActiveWarnings()` (general-tab issues for
  required/pattern/noServerSelected/addFailed; files-tab issue for `treeInEditMode`), the
  simplified `canSubmit()`, `filesTabDisabledReason()`/`filesTabDisabled()` for link-mode
  vs. no-files, the auto-switch-away effect, and `selectTab`/`activeTabId`.
- **New child components** (`AddTorrentGeneral`/`Options`/`Limits`/`Files`): one lightweight
  spec each, mirroring `pages/settings/general/general.spec.ts` - create with a mock `form`
  input, assert the expected `formControlName`s render, and that `@Output()`s
  (`inputModeChange`, `fileSelected`, `saved`, `editModeChange`) fire correctly.
- **`button-bar.spec.ts`**: replace the `addTorrentFile`/`addTorrentLink` click tests with
  one test asserting `UI_ADD_TORRENT` (no `mode`) is emitted for the single "new" action.
- **`ui-command-handler.service.spec.ts`**: remove the `command.mode === 'link'` /
  `switchInputMode('link')` test.
- **Manual UI pass**: open Add Torrent in both file and link mode via the new General-tab
  toggle; trigger each warning (no server selected, invalid rename, add failure, file-tree
  edit-in-progress) and confirm the tab icon + popover + disabled Add button; confirm Files
  tab disabled popovers in link mode and for a torrent with no file list; switch language
  (en/hu) to confirm new keys render.
