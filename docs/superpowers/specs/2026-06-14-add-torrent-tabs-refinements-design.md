# Add Torrent modal: tab refinements

## Goal

Follow-up refinements to the tabbed Add Torrent modal
(`packages/app/src/app/components/add-torrent/`, see
`docs/superpowers/specs/2026-06-13-add-torrent-tabs-design.md`):

- A footer "Reset" action that reverts the form to the user's saved add-torrent preferences.
- A less confusing tab-warning popover, with the rename field's own validation now visible
  inline as soon as the modal opens.
- A CSS fix so the Files tab's "why is this disabled" popover actually appears on hover.
- A General tab restructure into "Input"/"Storage" `bb-fieldset`s, with a new popover
  explaining the file/link toggle and a confirm-before-reset when switching modes.
- Limits tab restructured into two `bb-fieldset`s (Transfer Rate Limits / Share Limits).

## A. Footer Reset button

`add-torrent.html` modal footer gains a new button between Add and Cancel (DOM order: Add,
Reset, Cancel - `.modal-footer` stays the default Bootstrap right-aligned layout):

```html
<button
  type="button"
  class="btn btn-dashed-secondary"
  (click)="resetToSavedSettings()"
  [disabled]="!formDirty()"
>
  {{ 'general.button.reset' | translate }}
</button>
```

`btn-dashed-secondary` already exists via the `bb-dashed-button` mixin
(`packages/app/src/styles.scss` installs it for the `secondary` variant).

### `formDirty` signal

`addForm.dirty` is a plain getter, not reactive on its own. Add a computed signal next to
`formStatus` so the template can bind to it directly:

```typescript
public readonly formDirty = computed(() => {
  this.formStatus(); // re-run when addForm dirty/value state changes
  return this.addForm.dirty;
});
```

### `resetToSavedSettings()`

A new shared private-ish method re-applies the persisted `AddTorrentSettings` fields - the
same fields `ngOnInit` applies on load - and marks those controls pristine. `file`,
`magnetLinks`, and `rename` are **not** touched (they come from the loaded torrent draft, not
saved preferences). If the user separately edited `rename`, `addForm.dirty` (and therefore the
Reset button) stays enabled after a reset - there's nothing left for Reset to revert there,
but the form genuinely still differs from its initial state.

```typescript
public async resetToSavedSettings(): Promise<void> {
  const settings = (await this.addTorrentSettings.load()) as any;

  for (const [k, v] of Object.entries(settings)) {
    const ctrl = this.addForm.get(k);
    if (!ctrl) continue;

    if (k === 'tags' && typeof v === 'string') {
      ctrl.patchValue(v.split(',').map((t) => t.trim()));
    } else {
      ctrl.patchValue(v as any);
    }
    ctrl.markAsPristine();
  }
}
```

Unlike `ngOnInit`'s loading loop (which uses `{ emitEvent: false }`), these `patchValue` calls
emit normally - `formStatus` is the only `valueChanges`/`statusChanges` subscriber, and its
recompute is exactly what makes `formDirty()` (and `tabIssues()`) refresh so the Reset button
reflects the new pristine state immediately.

`AddTorrentSettingsService.load()` is memoized (`BaseSettingsService`), so calling it again
here is cheap.

New i18n key: `general.button.reset` = "Reset".

## B. Tab-warning popover & eager rename validation

### Eager validation on load

Add an `effect()` (alongside the existing two in the constructor) that marks `rename` as
touched whenever it's invalid, re-evaluated via the existing `formStatus` signal:

```typescript
effect(() => {
  this.formStatus(); // re-run when addForm validity changes
  if (this.addForm.controls.rename.invalid) {
    this.addForm.controls.rename.markAsTouched();
  }
});
```

This runs once on initial load (showing the red border + "required" message immediately if
the name is empty) and again any time `rename` becomes invalid later (e.g. the user clears
it). `markAsTouched()` does not affect `dirty`, so this has no effect on `formDirty()`/Reset.

`general/general.html` updates both the `is-invalid` class binding and the `invalid-feedback`
block conditions from:

```html
form().controls.rename.invalid && form().controls.rename.dirty
```

to:

```html
form().controls.rename.invalid && (form().controls.rename.touched || form().controls.rename.dirty)
```

### Generic vs. specific tab-issue messages

In `tabIssues()`, the rename-validation pushes collapse into one generic message - the actual
detail is now visible inline on the field itself:

```typescript
const renameErrors = this.addForm.controls.rename.errors;
if (renameErrors?.['required'] || renameErrors?.['pattern']) {
  general.push(
    this.translateService.instant('components.add-torrent.tab.general.issue.invalid-fields'),
  );
}
```

`noServerSelected` / `addFailed` (general tab) and `edit-in-progress` (files tab) keep their
existing specific messages from `components.add-torrent.feedback.*` /
`components.add-torrent.tab.files.issue.edit-in-progress` - the tab-issue popover is their only
surface, so they stay descriptive.

New i18n key: `components.add-torrent.tab.general.issue.invalid-fields` = "Some fields need
attention."

## C. Files tab disabled-popover CSS fix

Bootstrap's `.nav-link.disabled` sets `pointer-events: none`, which (via inheritance) also
blocks hover on the `faCircleQuestion` icon inside it, so the
`filesTabDisabledReason()` popover never appears. Fix in `add-torrent.scss`:

```scss
.bb-modal-tabs .nav-link.disabled {
  pointer-events: auto;
}
```

The existing `(click)="!(tab.id === 'files' && filesTabDisabled()) && selectTab(tab.id)"` guard
continues to block navigation; only hover/popover behavior changes. No template/TS changes.

## D. General tab restructure

### Fieldsets

Replace the `<hr class="mt-0" />` divider with two `bb-fieldset`s:

- **Input** (`components.add-torrent.label.input` = "Input"): the input-mode toggle row + the
  source input row (file browser / magnet textarea + its existing file/links popover).
- **Storage** (`components.add-torrent.label.storage` = "Storage"): the rename row (+ existing
  name popover) + save path + category + tags.

### Input-mode toggle row

The toggle's wrapper changes from `col-12 mb-3` to a `col-11`/`col-1` row, matching the source
input row below it:

```html
<div class="row">
  <div class="col-11">
    <div class="btn-group w-100" role="group">
      <!-- existing file/link radio + label pair, unchanged -->
    </div>
  </div>
  <div class="col-1 d-flex align-items-center">
    <bb-popover
      [subject]="'components.add-torrent.popover.input-mode.title' | translate"
      [description]="inputModePopover"
      placement="left"
    ></bb-popover>
  </div>
</div>

<ng-template #inputModePopover>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line2' | translate }}</p>
</ng-template>
```

New i18n keys:

- `components.add-torrent.popover.input-mode.title` = "Input Mode"
- `components.add-torrent.popover.input-mode.description.line1` = "Choose whether you're
  adding this torrent from a local .torrent file or from a magnet link / URL."
- `components.add-torrent.popover.input-mode.description.line2` = "Switching modes resets save
  path, category, tags, and other options back to your saved defaults."

### Mode-switch reset + confirm

`AddTorrentGeneral`'s `(inputModeChange)` binding moves from `switchInputMode($event)` to a new
parent method `handleInputModeChange($event)`:

```typescript
public async handleInputModeChange(mode: 'file' | 'link'): Promise<void> {
  if (mode === this.inputMode()) return;

  if (this.addForm.dirty) {
    const confirmed = await this.confirmService.confirm(
      'components.add-torrent.confirm.switch-mode.title',
      'components.add-torrent.confirm.switch-mode.message',
    );
    if (!confirmed) return;
  }

  this.switchInputMode(mode);
  await this.resetToSavedSettings();
}
```

If the user cancels, nothing changes - the radio reflects `inputMode()`, which was never
updated. `ConfirmService` is newly injected into `AddTorrent`.

New i18n keys:

- `components.add-torrent.confirm.switch-mode.title` = "Switch input mode"
- `components.add-torrent.confirm.switch-mode.message` = "Switching input mode will reset your
  changes back to the saved defaults. Continue?"

## E. Limits tab fieldsets

`limits.html` replaces its two `<h6>` headers with `bb-fieldset`/`<legend>` wrappers, reusing
the existing labels (no new i18n keys):

```html
<fieldset class="bb-fieldset">
  <legend>{{ 'components.add-torrent.label.transfer-rate-limits' | translate }}</legend>
  <app-transfer-limit formControlName="transferRateLimits"></app-transfer-limit>
</fieldset>

<fieldset class="bb-fieldset">
  <legend>{{ 'components.add-torrent.label.share-limits' | translate }}</legend>
  <app-share-limit formControlName="shareLimits"></app-share-limit>
</fieldset>
```

## i18n changes (both `us.json` and `hu.json`)

New keys:

| Key                                                           | English text                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `general.button.reset`                                        | "Reset"                                                                                             |
| `components.add-torrent.tab.general.issue.invalid-fields`     | "Some fields need attention."                                                                       |
| `components.add-torrent.label.input`                          | "Input"                                                                                             |
| `components.add-torrent.label.storage`                        | "Storage"                                                                                           |
| `components.add-torrent.popover.input-mode.title`             | "Input Mode"                                                                                        |
| `components.add-torrent.popover.input-mode.description.line1` | "Choose whether you're adding this torrent from a local .torrent file or from a magnet link / URL." |
| `components.add-torrent.popover.input-mode.description.line2` | "Switching modes resets save path, category, tags, and other options back to your saved defaults."  |
| `components.add-torrent.confirm.switch-mode.title`            | "Switch input mode"                                                                                 |
| `components.add-torrent.confirm.switch-mode.message`          | "Switching input mode will reset your changes back to the saved defaults. Continue?"                |

`general.form.feedback.required` / `.pattern` remain in use (inline field feedback) -
unchanged.

## Unchanged

- `AddTorrentFormGroup`, queue handling, `handleSubmit`, `canSubmit()`, draft loading,
  `filesTabDisabled()`/`filesTabDisabledReason()`, and the rest of the tab-issue mechanism from
  the prior tabs design.
- Modal stays `size: 'lg', scrollable: true`.

## Testing

- **`add-torrent.spec.ts`**:
  - `resetToSavedSettings()` re-applies `AddTorrentSettings` fields and marks them pristine;
    leaves `file`/`magnetLinks`/`rename` untouched.
  - `formDirty()` reflects `addForm.dirty` and drives the Reset button's `[disabled]`.
  - The eager-validation effect marks `rename` touched on init when invalid (and after it
    becomes invalid later).
  - `tabIssues().general` uses `invalid-fields` for required/pattern rename errors, and keeps
    `no-server-selected`/`add-failed` as their specific messages.
  - `handleInputModeChange()`: no-op when mode unchanged; confirm shown only when
    `addForm.dirty`; cancel leaves mode/form untouched; confirm (or non-dirty) calls
    `switchInputMode` + `resetToSavedSettings`.
- **`general.spec.ts`**: updated toggle row markup (`col-11`/`col-1` + `bb-popover`); `is-invalid`
  / `invalid-feedback` conditions check `touched || dirty`.
- **`limits.spec.ts`**: fieldset/legend wrapping renders both labels.
- **Manual UI pass**: confirm the rename field shows red + "required" immediately on opening
  the modal with no name yet; confirm the General tab warning icon shows the short generic
  message while `no-server-selected`/`add-failed`/files `edit-in-progress` stay specific;
  hover the disabled Files tab and confirm the reason popover now appears; exercise the Reset
  button (enabled only when dirty, reverts saved-setting fields); switch input mode with a
  dirty form (confirm dialog appears, cancel keeps state, confirm resets); switch with a clean
  form (no dialog); verify General/Limits tab fieldset layout in both languages (en/hu).
