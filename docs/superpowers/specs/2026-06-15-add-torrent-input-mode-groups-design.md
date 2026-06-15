# Add Torrent modal: grouped file/link input state

## Goal

Fix buggy file/link input-mode switching on the Add Torrent modal's General tab
(`packages/app/src/app/components/add-torrent/`).

The mode-switch flow added in
`docs/superpowers/specs/2026-06-14-add-torrent-tabs-refinements-design.md` (Section D) shows a
confirm dialog whenever `addForm.dirty` is `true` - for _any_ field, not just file/link/rename -
and then calls `resetToSavedSettings()`, which reverts **all** `AddTorrentSettings` fields
(savepath, category, tags, root_folder, limits, etc.) back to their last-saved values. On top of
that, `switchInputMode()` never restores file-mode state when switching back: `selectedTorrentFile`
is nulled going to link mode and never restored, and `file`/`rename` text isn't cleared or
restored either. File -> link -> file leaves stale text in the UI with Add disabled.

This design replaces that flow with two `FormGroup`s - `fileGroup` (`file` + `rename`) and
`linkGroup` (`magnetLinks` + `rename`) - so each input mode keeps its own state natively.
Switching modes becomes a pure UI toggle: nothing is lost, so the confirm dialog and
`resetToSavedSettings()` are removed entirely.

## A. Form model: `fileGroup` / `linkGroup`

`packages/app/src/app/models/add-torrent.model.ts`:

```typescript
export type AddTorrentFormGroup = FormGroup<{
  fileGroup: FormGroup<{
    file: FormControl<string>;
    rename: FormControl<string | null>;
  }>;
  linkGroup: FormGroup<{
    magnetLinks: FormControl<string>;
    rename: FormControl<string | null>;
  }>;
  savepath: FormControl<string | null>;
  paused: FormControl<boolean>;
  category: FormControl<string | null>;
  root_folder: FormControl<RootFolderMode>;
  tags: FormControl<string[] | null>;
  skip_checking: FormControl<boolean>;
  sequentialDownload: FormControl<boolean>;
  firstLastPiecePrio: FormControl<boolean>;
  transferRateLimits: FormControl<TransferLimitValue | null>;
  shareLimits: FormControl<ShareLimitValue | null>;
  autoTMM: FormControl<boolean>;
}>;
```

`packages/app/src/app/components/add-torrent/add-torrent.ts` - `addForm` construction:

```typescript
public addForm: AddTorrentFormGroup = new FormGroup({
  fileGroup: new FormGroup({
    file: new FormControl<string>('', { nonNullable: true }),
    rename: new FormControl<string | null>(null, [
      Validators.required,
      Validators.pattern(INVALID_FILENAME_CHARS),
    ]),
  }),
  linkGroup: new FormGroup({
    magnetLinks: new FormControl<string>('', { nonNullable: true }),
    rename: new FormControl<string | null>(null, [Validators.pattern(INVALID_FILENAME_CHARS)]),
  }),
  savepath: new FormControl<string | null>(null),
  paused: new FormControl<boolean>(false, { nonNullable: true }),
  category: new FormControl<string | null>(null),
  root_folder: new FormControl<RootFolderMode>('unset', { nonNullable: true }),
  tags: new FormControl<string[] | null>(null),
  skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
  sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
  firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
  transferRateLimits: new FormControl<TransferLimitValue | null>(null),
  shareLimits: new FormControl<ShareLimitValue | null>(null),
  autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
});
```

Each `rename` control's validators are now fixed at construction - `fileGroup.rename` is always
`required` + pattern, `linkGroup.rename` is pattern-only. No more
`addValidators`/`removeValidators`/`updateValueAndValidity` calls anywhere.

`savepath`/`category`/`tags`/etc. stay top-level and untouched - `ngOnInit`'s
`AddTorrentSettings` patch loop (`this.addForm.get(k)` for keys like `savepath`, `category`, ...)
keeps working as-is since none of those keys moved.

## B. `general.html`: nested `formGroupName`

The "Input" fieldset's file/link block and the "Torrent" fieldset's rename block each wrap their
markup in the matching `formGroupName`, nested inside the existing top-level
`[formGroup]="form()"`:

```html
<!-- Input fieldset, col-11 source row -->
@if (inputMode() === 'file') {
<div formGroupName="fileGroup">
  <div class="form-floating mb-3">
    <!-- existing file-browser input, formControlName="file" -->
  </div>
</div>
} @else {
<div formGroupName="linkGroup">
  <div class="form-floating mb-3">
    <!-- existing magnet-links textarea, unchanged, formControlName="magnetLinks" -->
  </div>
</div>
}
```

The file-browser input's `[class.is-invalid]` binding reads `form().controls.file.invalid` /
`.touched` / `.dirty` today; once `file` moves under `fileGroup` these become
`form().controls.fileGroup.controls.file.invalid` etc. (otherwise it's a template type error
against the new `AddTorrentFormGroup`). `file` has no validators, so this binding remains a
permanent no-op as it already is today - only the path changes, not the behavior.

```html
<!-- Torrent fieldset, col-11 rename row -->
@if (inputMode() === 'file') {
<div formGroupName="fileGroup" class="form-floating mb-3">
  <input
    type="text"
    class="form-control"
    id="rename"
    formControlName="rename"
    [class.is-invalid]="
        form().controls.fileGroup.controls.rename.invalid &&
        (form().controls.fileGroup.controls.rename.touched ||
          form().controls.fileGroup.controls.rename.dirty)
      "
  />
  <label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
  @if ( form().controls.fileGroup.controls.rename.invalid &&
  (form().controls.fileGroup.controls.rename.touched ||
  form().controls.fileGroup.controls.rename.dirty) ) { @if
  (form().controls.fileGroup.controls.rename.hasError('required')) {
  <div class="invalid-feedback px-2">{{ 'general.form.feedback.required' | translate }}</div>
  } @else if (form().controls.fileGroup.controls.rename.hasError('pattern')) {
  <div class="invalid-feedback px-2">{{ 'general.form.feedback.pattern' | translate }}</div>
  } }
</div>
} @else {
<div formGroupName="linkGroup" class="form-floating mb-3">
  <input
    type="text"
    class="form-control"
    id="rename"
    formControlName="rename"
    [class.is-invalid]="
        form().controls.linkGroup.controls.rename.invalid &&
        (form().controls.linkGroup.controls.rename.touched ||
          form().controls.linkGroup.controls.rename.dirty)
      "
  />
  <label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
  @if ( form().controls.linkGroup.controls.rename.invalid &&
  (form().controls.linkGroup.controls.rename.touched ||
  form().controls.linkGroup.controls.rename.dirty) &&
  form().controls.linkGroup.controls.rename.hasError('pattern') ) {
  <div class="invalid-feedback px-2">{{ 'general.form.feedback.pattern' | translate }}</div>
  }
</div>
}
```

`savepath`/`category`/`tags` rows below stay under the top-level `[formGroup]="form()"`,
unchanged.

## C. `switchInputMode` / `handleInputModeChange`

`packages/app/src/app/components/add-torrent/add-torrent.ts`:

```typescript
public switchInputMode(mode: 'file' | 'link'): void {
  this.inputMode.set(mode);
  if (this.treeInEditMode()) {
    this.treeInEditMode.set(false);
  }
}

public handleInputModeChange(mode: 'file' | 'link'): void {
  if (mode === this.inputMode()) return;
  this.switchInputMode(mode);
}
```

Both `fileGroup` and `linkGroup` retain their own `file`/`rename`/`magnetLinks` values across
switches automatically - no manual capture/restore needed. `ConfirmService` is no longer injected
into `AddTorrent`.

The `treeInEditMode` reset fixes a real (separate) bug: `tabIssues()` flags
`issues.files = '...edit-in-progress'` whenever `treeInEditMode()` is `true`, **regardless of
`inputMode()`** - so a stuck `true` from a prior file-mode session would wrongly disable Add even
in link mode. Resetting it on every switch away from file mode avoids that; the Files tab is
hidden in link mode anyway (`filesTabDisabledReason()` returns the link-mode reason first).

## D. Mode-aware validity

### `canSubmit()`

```typescript
public canSubmit(): boolean {
  if (this.hasActiveWarnings() || this.isSubmitting() || this.addForm.errors) return false;

  return this.inputMode() === 'link'
    ? this.addForm.controls.linkGroup.valid && this.getMagnetLinks().length > 0
    : this.addForm.controls.fileGroup.valid && this.selectedTorrentFile() !== null;
}
```

Only the _active_ group's validity gates submission - the inactive group (e.g. an empty,
`required` `fileGroup.rename` while in link mode) no longer blocks `addForm.valid` as a whole from
mattering, because we stop checking `addForm.valid` wholesale and check `addForm.errors`
(`noServerSelected` / `addFailed`, set via `setErrors`) plus the active group directly.

### `tabIssues()`

```typescript
public readonly tabIssues = computed<Partial<Record<AddTorrentTabId, string>>>(() => {
  this.formStatus(); // re-run when addForm validity changes

  const issues: Partial<Record<AddTorrentTabId, string>> = {};

  const activeRename =
    this.inputMode() === 'file'
      ? this.addForm.controls.fileGroup.controls.rename
      : this.addForm.controls.linkGroup.controls.rename;
  const renameErrors = activeRename.errors;
  const formErrors = this.addForm.errors;

  if (renameErrors?.['required'] || renameErrors?.['pattern']) {
    issues.general = this.translateService.instant(
      'components.add-torrent.tab.general.issue.invalid-fields',
    );
  } else if (formErrors?.['noServerSelected']) {
    issues.general = this.translateService.instant(
      'components.add-torrent.feedback.no-server-selected',
    );
  } else if (formErrors?.['addFailed']) {
    issues.general = this.translateService.instant('components.add-torrent.feedback.add-failed');
  }

  if (this.treeInEditMode()) {
    issues.files = this.translateService.instant(
      'components.add-torrent.tab.files.issue.edit-in-progress',
    );
  }

  return issues;
});
```

### Eager-touch effect

```typescript
effect(() => {
  this.formStatus(); // re-run when addForm validity changes
  const activeRename =
    this.inputMode() === 'file'
      ? this.addForm.controls.fileGroup.controls.rename
      : this.addForm.controls.linkGroup.controls.rename;
  if (activeRename.invalid) {
    activeRename.markAsTouched();
  }
});
```

Reading `this.inputMode()` makes this effect re-run on mode switches too, so switching into a
mode whose `rename` is currently invalid (e.g. empty `fileGroup.rename`) immediately shows the
validation message, matching the existing "eager rename validation" behavior.

## E. `handleSubmit` / `getMagnetLinks` / `loadDraft`

```typescript
private getMagnetLinks(): string[] {
  return (this.addForm.controls.linkGroup.controls.magnetLinks.value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
```

In `handleSubmit`, `raw = this.addForm.getRawValue()` now has the shape
`{ fileGroup: { file, rename }, linkGroup: { magnetLinks, rename }, savepath, ... }`. Pick `rename`
from the active group for `sharedOptions`:

```typescript
const raw = this.addForm.getRawValue();
const rename = this.inputMode() === 'file' ? raw.fileGroup.rename : raw.linkGroup.rename;

const sharedOptions = {
  savepath: raw.savepath?.trim() || undefined,
  rename: rename?.trim() || undefined,
  // ...category/tags/paused/etc. unchanged
};
```

`loadDraft` (only ever runs while `inputMode() === 'file'`, guarded by the existing
`if (this.inputMode() === 'link') return;` in the queue effect) updates its control references:

```typescript
const renameCtrl = this.addForm.controls.fileGroup.controls.rename;
// ...
this.addForm.controls.fileGroup.controls.file.setValue(pending.selected.name, { emitEvent: false });
// ...
this.addForm.controls.fileGroup.controls.file.setErrors(null);
```

`add-torrent.html`'s footer autofocus condition:

```html
[autofocus]="addForm.controls.fileGroup.controls.file.value.length === 0"
```

## F. Files-tab state (`savedFileState`, `selectedTorrentFile`, `showTree`)

These remain plain component fields/signals, untouched by `switchInputMode()`. Tracing every
read confirms they're already inert while `inputMode() === 'link'`:

- `selectedTorrentFile` and `savedFileState` are only read in `handleSubmit`'s file-mode branch
  and `canSubmit`'s file-mode check.
- `showTree` only matters inside `filesTabDisabledReason()`, which returns the link-mode reason
  _before_ checking `showTree` whenever `inputMode() === 'link'`.

So leaving them as-is across a switch gives lossless restore "for free": switch to link mode,
edit file-tree priorities are preserved in `savedFileState`; switch back to file mode and they're
still there, ready for `tryRenameContentAfterAdd` on submit. `loadDraft` continues to be the only
place that clears/replaces them (when a genuinely new draft loads).

## Cleanup / Removed

- `ConfirmService` import + injection removed from `add-torrent.ts` (still used elsewhere in the
  app - this only drops its use here).
- `resetToSavedSettings()` removed entirely (its only caller was the mode-switch confirm flow).
- `addValidators`/`removeValidators`/`updateValueAndValidity` calls on `rename` removed.
- `.disable()`/`.enable()` toggling on the `file` control removed - `file` has no validators and
  is only rendered in file mode, so disabling it had no effect on form validity or submission.
- `magnetLinks.setValue('', { emitEvent: false })` clearing-on-switch removed - `linkGroup` keeps
  its own value across switches.
- i18n keys `components.add-torrent.confirm.switch-mode.title` /
  `components.add-torrent.confirm.switch-mode.message` (added in the 2026-06-14 spec) are
  removed from both locales. The i18n source files weren't found under
  `packages/app/public/i18n/` in this checkout (only generated copies exist under
  `packages/app/dist/test-out/**`) - locate the actual source location at implementation time
  and remove the keys there.

## Unchanged

- `AddTorrentSettings` / `AddTorrentSettingsService` and `ngOnInit`'s settings-patch loop.
- Queue handling (`OpenFilesService`, `pending`/`pendingDrafts`, `loadedDraftIdentifier`,
  `initialQueueCount`) - switching modes mid-queue doesn't disturb `pending()`, and
  `loadedDraftIdentifier` already prevents `loadDraft` from re-firing for the same draft, so the
  restored `fileGroup`/`selectedTorrentFile`/`savedFileState` line back up correctly with the
  current queue head.
- `filesTabDisabled()` / `filesTabDisabledReason()`.
- Modal stays `size: 'lg', scrollable: true`.

## Testing

**`add-torrent.spec.ts`**

- `handleInputModeChange`:
  - no-op when mode is unchanged (existing test, kept).
  - file -> link -> file round trip: `fileGroup.controls.file`, `fileGroup.controls.rename`,
    `selectedTorrentFile()`, `savedFileState`, and `showTree()` are all unchanged after the round
    trip.
  - link -> file -> link round trip: `linkGroup.controls.magnetLinks` and
    `linkGroup.controls.rename` are unchanged after the round trip.
  - switching mode while `treeInEditMode()` is `true` resets it to `false` and clears
    `tabIssues().files`.
  - remove all `ConfirmService`/`confirmService.confirm` expectations from this describe block.
- Remove `describe('resetToSavedSettings', ...)` entirely.
- `canSubmit`: update `magnetLinks`/`rename` references to `linkGroup.controls.*`.
- `rename validator (via form)`: target `fileGroup.controls.rename` (default mode is `'file'`).
- `tabIssues / hasActiveWarnings`: target `fileGroup.controls.rename` for file-mode cases; add a
  link-mode case asserting `linkGroup.controls.rename` pattern errors surface the same
  `invalid-fields` issue.
- `eager rename validation`: unchanged in spirit, asserts
  `fileGroup.controls.rename.touched === true` on init.
- `handleSubmit category creation`: update `addForm.controls.rename` ->
  `addForm.controls.fileGroup.controls.rename`.

**`general.spec.ts`**

- Update `form().controls.rename` references to `form().controls.fileGroup.controls.rename`
  (file-mode tests) and add link-mode coverage via `form().controls.linkGroup.controls.rename`.

**Manual UI pass**

- File -> link -> file: selected file, rename, and any file-tree priority/rename customizations
  are all preserved; no confirm dialog appears.
- Link -> file -> link: magnet links and that mode's rename are preserved.
- Add button reflects the active group's validity in both modes (disabled with no file / no
  magnet links / invalid rename for that mode).
- Customize the file tree, switch to link mode, switch back: customizations still present; no
  stale "edit in progress" warning blocks Add after switching to link mode mid-edit.
