# Add Torrent Input Mode Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buggy confirm-dialog + `resetToSavedSettings()` mode-switch flow on the Add Torrent modal's General tab with two nested `FormGroup`s - `fileGroup` (`file` + `rename`) and `linkGroup` (`magnetLinks` + `rename`) - so switching between file and link input modes is a lossless, pure UI toggle, and drop `Validators.required` from both `rename` controls since qBittorrent falls back to the torrent's own metadata name when `rename` is empty.

**Architecture:** All changes are confined to `packages/app/src/app/components/add-torrent/` (the form model, the `AddTorrent` component, and its `general` sub-component) plus `public/i18n/{us,hu}.json`. The `AddTorrentFormGroup` type changes shape - `file`, `magnetLinks`, and `rename` move from top-level controls into nested `fileGroup`/`linkGroup` groups. This is a breaking, atomic change: Angular's strict template type-checking means both templates (`general.html`, `add-torrent.html`) and both spec files (`add-torrent.spec.ts`, `general.spec.ts`) must be updated together, or `ng test` fails to even compile. Task 1 covers all six affected files as one task, deliberately going through a red (TS compile errors in the old specs) -> green (specs updated) cycle. Task 2 is an independent i18n cleanup that removes the now-unused confirm-dialog translation keys.

**Tech Stack:** Angular 20 (zoneless, signals, reactive forms, nested `FormGroup`s via `formGroupName`), `@ngx-translate`, Vitest (`ng test --watch=false` via `@angular/build:unit-test`).

---

## Task 1: `fileGroup`/`linkGroup` form refactor

**Files:**

- Modify: `packages/app/src/app/models/add-torrent.model.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/general/general.html`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`
- Test: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`
- Test: `packages/app/src/app/components/add-torrent/general/general.spec.ts`

- [ ] **Step 1: Update the `AddTorrentFormGroup` type**

In `packages/app/src/app/models/add-torrent.model.ts`, find:

```typescript
export type AddTorrentFormGroup = FormGroup<{
  file: FormControl<string>;
  magnetLinks: FormControl<string>;
  savepath: FormControl<string | null>;
  rename: FormControl<string | null>;
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

Replace with:

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

`AddTorrentSettings` and `DEFAULT_ADD_TORRENT_SETTINGS` above this type are unchanged.

- [ ] **Step 2: Remove `ConfirmService` and rebuild `addForm` with `fileGroup`/`linkGroup`**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find the import block:

```typescript
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { ConfirmService } from '../../services/confirm.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
```

Replace with:

```typescript
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
```

Find the injected services:

```typescript
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
```

Replace with:

```typescript
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
```

Find the `addForm` construction:

```typescript
  public addForm: AddTorrentFormGroup = new FormGroup({
    file: new FormControl<string>('', { nonNullable: true }),
    magnetLinks: new FormControl<string>('', { nonNullable: true }),
    savepath: new FormControl<string | null>(null),
    rename: new FormControl<string | null>(null, [
      Validators.required,
      Validators.pattern(INVALID_FILENAME_CHARS),
    ]),
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

Replace with:

```typescript
  public addForm: AddTorrentFormGroup = new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null, [Validators.pattern(INVALID_FILENAME_CHARS)]),
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

`Validators` and `INVALID_FILENAME_CHARS` stay imported - both groups' `rename` controls still use `Validators.pattern(INVALID_FILENAME_CHARS)`.

- [ ] **Step 3: Make `tabIssues` and the eager-touch effect mode-aware**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find:

```typescript
  public readonly tabIssues = computed<Partial<Record<AddTorrentTabId, string>>>(() => {
    this.formStatus(); // re-run when addForm validity changes
    const issues: Partial<Record<AddTorrentTabId, string>> = {};

    const renameErrors = this.addForm.controls.rename.errors;
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

Replace with:

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

    if (renameErrors?.['pattern']) {
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

Find the eager-touch effect inside the constructor:

```typescript
effect(() => {
  this.formStatus(); // re-run when addForm validity changes
  if (this.addForm.controls.rename.invalid) {
    this.addForm.controls.rename.markAsTouched();
  }
});
```

Replace with:

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

- [ ] **Step 4: Remove `resetToSavedSettings()`**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find:

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

  public handleCancel(): void {
```

Replace with:

```typescript
  public handleCancel(): void {
```

- [ ] **Step 5: Rewrite `canSubmit`, `handleInputModeChange`, `switchInputMode`, `getMagnetLinks`**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find:

```typescript
  public canSubmit(): boolean {
    if (!this.addForm.valid || this.hasActiveWarnings() || this.isSubmitting()) return false;
    return this.inputMode() === 'link'
      ? this.getMagnetLinks().length > 0
      : this.selectedTorrentFile() !== null;
  }

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

  public switchInputMode(mode: 'file' | 'link'): void {
    this.inputMode.set(mode);
    if (mode === 'link') {
      this.selectedTorrentFile.set(null);
      this.addForm.controls.file.disable();
      this.addForm.controls.rename.removeValidators(Validators.required);
      this.addForm.controls.rename.updateValueAndValidity();
      this.showTree.set(false);
    } else {
      this.addForm.controls.magnetLinks.setValue('', { emitEvent: false });
      this.addForm.controls.file.enable();
      this.addForm.controls.rename.addValidators(Validators.required);
      this.addForm.controls.rename.updateValueAndValidity();
    }
  }

  private getMagnetLinks(): string[] {
    return (this.addForm.controls.magnetLinks.value ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
```

Replace with:

```typescript
  public canSubmit(): boolean {
    if (this.hasActiveWarnings() || this.isSubmitting() || this.addForm.errors) return false;

    return this.inputMode() === 'link'
      ? this.addForm.controls.linkGroup.valid && this.getMagnetLinks().length > 0
      : this.addForm.controls.fileGroup.valid && this.selectedTorrentFile() !== null;
  }

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

  private getMagnetLinks(): string[] {
    return (this.addForm.controls.linkGroup.controls.magnetLinks.value ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
```

Note the new ordering: `canSubmit`, then `switchInputMode`, then `handleInputModeChange`, then `getMagnetLinks` (matches the order they'll be referenced going forward and avoids `handleInputModeChange` forward-referencing `switchInputMode` awkwardly).

- [ ] **Step 6: Update `handleSubmit`'s rename extraction and `loadDraft`'s control references**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, inside `handleSubmit`, find:

```typescript
    const raw = this.addForm.getRawValue();

    const sharedOptions = {
      savepath: raw.savepath?.trim() || undefined,
      rename: raw.rename?.trim() || undefined,
      category: raw.category?.trim() || undefined,
      tags: raw.tags?.join(',') || undefined,
```

Replace with:

```typescript
    const raw = this.addForm.getRawValue();
    const rename = this.inputMode() === 'file' ? raw.fileGroup.rename : raw.linkGroup.rename;

    const sharedOptions = {
      savepath: raw.savepath?.trim() || undefined,
      rename: rename?.trim() || undefined,
      category: raw.category?.trim() || undefined,
      tags: raw.tags?.join(',') || undefined,
```

Then, inside `loadDraft`, find:

```typescript
const oldSettings = this.addForm.value;
this.addForm.reset();
this.addForm.patchValue(oldSettings);
this.addForm.get('file')?.setErrors(null);
this.manualDraft.set(null);
this.savedFileState = null;

if (!draft || draft.error) {
  this.showTree.set(false);
  return;
}

this.selectedTorrentFile.set(pending.selected);

if (pending.selected.name) {
  this.addForm.controls.file.setValue(pending.selected.name, { emitEvent: false });
} else if (draft.originalName) {
  this.addForm.controls.file.setValue(draft.originalName, { emitEvent: false });
}

if (this.isAlreadyInList(draft)) {
  const modalRef = this.modalService.open(TorrentExists, { centered: true });
  setModalInput(modalRef, 'hash', draft.torrent?.infoHashV1?.toLowerCase() ?? null);
  this.openFilesService.consumeCurrentDraft();
  return;
}

const suggested =
  draft.torrent?.name?.trim() ?? draft.originalName?.replace(/\.torrent$/i, '') ?? '';

const renameCtrl = this.addForm.controls.rename;
if (suggested && !renameCtrl.dirty) {
  renameCtrl.setValue(suggested, { emitEvent: false });
}

this.showTree.set(!!draft.torrent?.files?.length);
```

Replace with:

```typescript
const oldSettings = this.addForm.value;
this.addForm.reset();
this.addForm.patchValue(oldSettings);
this.addForm.controls.fileGroup.controls.file.setErrors(null);
this.manualDraft.set(null);
this.savedFileState = null;

if (!draft || draft.error) {
  this.showTree.set(false);
  return;
}

this.selectedTorrentFile.set(pending.selected);

if (pending.selected.name) {
  this.addForm.controls.fileGroup.controls.file.setValue(pending.selected.name, {
    emitEvent: false,
  });
} else if (draft.originalName) {
  this.addForm.controls.fileGroup.controls.file.setValue(draft.originalName, {
    emitEvent: false,
  });
}

if (this.isAlreadyInList(draft)) {
  const modalRef = this.modalService.open(TorrentExists, { centered: true });
  setModalInput(modalRef, 'hash', draft.torrent?.infoHashV1?.toLowerCase() ?? null);
  this.openFilesService.consumeCurrentDraft();
  return;
}

const suggested =
  draft.torrent?.name?.trim() ?? draft.originalName?.replace(/\.torrent$/i, '') ?? '';

const renameCtrl = this.addForm.controls.fileGroup.controls.rename;
if (suggested && !renameCtrl.dirty) {
  renameCtrl.setValue(suggested, { emitEvent: false });
}

this.showTree.set(!!draft.torrent?.files?.length);
```

`ngOnInit`'s `AddTorrentSettings` patch loop (`this.addForm.get(k)` for `savepath`/`category`/`tags`/etc.) is unchanged - none of those keys moved.

- [ ] **Step 7: Wrap `general.html`'s file/link and rename markup in `formGroupName`**

In `packages/app/src/app/components/add-torrent/general/general.html`, find the Input fieldset's source column:

```html
<div class="col-11">
  @if (inputMode() === 'file') {
  <div class="form-floating mb-3">
    <div class="input-group mb-1">
      <div class="form-floating">
        <input
          type="text"
          class="form-control"
          id="file_browser"
          [placeholder]="'components.add-torrent.add-form.file-browser' | translate"
          formControlName="file"
          [class.is-invalid]="
                      form().controls.file.invalid &&
                      (form().controls.file.touched || form().controls.file.dirty)
                    "
          readonly
          (click)="fileInput.click()"
        />
        <label for="file_browser"
          >{{ 'components.add-torrent.add-form.file-browser' | translate }}</label
        >
      </div>

      <button type="button" class="btn btn-outline-primary" (click)="fileInput.click()">
        {{ 'general.button.browse' | translate }}
      </button>
    </div>
    <input type="file" #fileInput hidden accept=".torrent" (change)="fileSelected.emit($event)" />
  </div>
  } @else {
  <div class="form-floating mb-3">
    <textarea
      class="form-control"
      id="magnet_links"
      style="height: 120px"
      [placeholder]="'components.add-torrent.add-form.magnet-links' | translate"
      formControlName="magnetLinks"
    ></textarea>
    <label for="magnet_links"
      >{{ 'components.add-torrent.add-form.magnet-links' | translate }}</label
    >
  </div>
  }
</div>
```

Replace with:

```html
<div class="col-11">
  @if (inputMode() === 'file') {
  <div formGroupName="fileGroup">
    <div class="form-floating mb-3">
      <div class="input-group mb-1">
        <div class="form-floating">
          <input
            type="text"
            class="form-control"
            id="file_browser"
            [placeholder]="'components.add-torrent.add-form.file-browser' | translate"
            formControlName="file"
            [class.is-invalid]="
                        form().controls.fileGroup.controls.file.invalid &&
                        (form().controls.fileGroup.controls.file.touched ||
                          form().controls.fileGroup.controls.file.dirty)
                      "
            readonly
            (click)="fileInput.click()"
          />
          <label for="file_browser"
            >{{ 'components.add-torrent.add-form.file-browser' | translate }}</label
          >
        </div>

        <button type="button" class="btn btn-outline-primary" (click)="fileInput.click()">
          {{ 'general.button.browse' | translate }}
        </button>
      </div>
      <input type="file" #fileInput hidden accept=".torrent" (change)="fileSelected.emit($event)" />
    </div>
  </div>
  } @else {
  <div formGroupName="linkGroup">
    <div class="form-floating mb-3">
      <textarea
        class="form-control"
        id="magnet_links"
        style="height: 120px"
        [placeholder]="'components.add-torrent.add-form.magnet-links' | translate"
        formControlName="magnetLinks"
      ></textarea>
      <label for="magnet_links"
        >{{ 'components.add-torrent.add-form.magnet-links' | translate }}</label
      >
    </div>
  </div>
  }
</div>
```

`file` has no validators, so the `[class.is-invalid]` binding remains a permanent no-op - only its path changed to satisfy the new `AddTorrentFormGroup` type.

Now find the Torrent fieldset's rename block:

```html
<div class="row">
  <div class="col-11">
    <div class="form-floating mb-3">
      <input
        type="text"
        class="form-control"
        id="rename"
        [placeholder]="'components.add-torrent.add-form.rename' | translate"
        formControlName="rename"
        [class.is-invalid]="
                form().controls.rename.invalid &&
                (form().controls.rename.touched || form().controls.rename.dirty)
              "
      />
      <label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
      @if ( form().controls.rename.invalid && (form().controls.rename.touched ||
      form().controls.rename.dirty) ) { @if (form().controls.rename.hasError('required')) {
      <div class="invalid-feedback px-2">{{ 'general.form.feedback.required' | translate }}</div>
      } @else if (form().controls.rename.hasError('pattern')) {
      <div class="invalid-feedback px-2">{{ 'general.form.feedback.pattern' | translate }}</div>
      } }
    </div>
  </div>
</div>
```

Replace with:

```html
<div class="row">
  <div class="col-11">
    @if (inputMode() === 'file') {
    <div formGroupName="fileGroup" class="form-floating mb-3">
      <input
        type="text"
        class="form-control"
        id="rename"
        [placeholder]="'components.add-torrent.add-form.rename' | translate"
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
      form().controls.fileGroup.controls.rename.dirty) &&
      form().controls.fileGroup.controls.rename.hasError('pattern') ) {
      <div class="invalid-feedback px-2">{{ 'general.form.feedback.pattern' | translate }}</div>
      }
    </div>
    } @else {
    <div formGroupName="linkGroup" class="form-floating mb-3">
      <input
        type="text"
        class="form-control"
        id="rename"
        [placeholder]="'components.add-torrent.add-form.rename' | translate"
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
  </div>
</div>
```

The two branches are structurally identical aside from `formGroupName` and the `fileGroup`/`linkGroup` control paths. Both show only the pattern-error message; the `general.form.feedback.required` message and the `hasError('required')` branch are dropped, since neither `rename` control is `required` anymore. `id="rename"` appears in both branches but only one renders at a time, so there's no duplicate-ID collision in the DOM.

The `savepath`/`category`/`tags` rows below this block stay under the top-level `[formGroup]="form()"`, unchanged.

- [ ] **Step 8: Update `add-torrent.html`'s footer autofocus binding**

In `packages/app/src/app/components/add-torrent/add-torrent.html`, find:

```html
[autofocus]="addForm.controls.file.value.length === 0"
```

Replace with:

```html
[autofocus]="addForm.controls.fileGroup.controls.file.value.length === 0"
```

- [ ] **Step 9: Run the tests to confirm the expected compile failure**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - TypeScript compile errors from `add-torrent.spec.ts` and `general.spec.ts` (e.g. `Property 'file' does not exist on type ...`, `Property 'rename' does not exist on type ...`, `Property 'magnetLinks' does not exist on type ...`), because those spec files still reference the old flat `addForm.controls.file` / `.magnetLinks` / `.rename` shape. The component and templates compile cleanly at this point.

- [ ] **Step 10: Update `add-torrent.spec.ts` for the new form shape**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`, find the three describe blocks `canSubmit`, `rename validator (via form)`, and `tabIssues / hasActiveWarnings`:

```typescript
describe('canSubmit', () => {
  it('should return false when no torrent file is selected', () => {
    expect(component.canSubmit()).toBe(false);
  });

  it('should return false while submitting', () => {
    component.isSubmitting.set(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('should return true in link mode with magnet links and an empty rename', () => {
    component.switchInputMode('link');
    component.addForm.controls.magnetLinks.setValue('magnet:?xt=urn:btih:abcdef');

    expect(component.canSubmit()).toBe(true);
  });

  it('should return false when the file tree is in edit mode even if the form is otherwise valid', () => {
    component.switchInputMode('link');
    component.addForm.controls.magnetLinks.setValue('magnet:?xt=urn:btih:abcdef');
    component.treeInEditMode.set(true);

    expect(component.canSubmit()).toBe(false);
  });
});

describe('rename validator (via form)', () => {
  it('should be invalid when rename contains a forward slash', () => {
    component.addForm.controls.rename.setValue('folder/name');
    expect(component.addForm.controls.rename.errors).toHaveProperty('pattern');
  });

  it('should be invalid when rename contains a backslash', () => {
    component.addForm.controls.rename.setValue('folder\\name');
    expect(component.addForm.controls.rename.errors).toHaveProperty('pattern');
  });

  it('should be invalid when rename contains other reserved characters', () => {
    component.addForm.controls.rename.setValue('bad<name>');
    expect(component.addForm.controls.rename.errors).toHaveProperty('pattern');
  });

  it('should be valid when rename contains no invalid characters', () => {
    component.addForm.controls.rename.setValue('valid-name');
    expect(component.addForm.controls.rename.errors).toBeNull();
  });
});

describe('tabIssues / hasActiveWarnings', () => {
  it('should report an invalid-fields issue on the general tab by default', () => {
    expect(component.tabIssues().general).toBe(
      'components.add-torrent.tab.general.issue.invalid-fields',
    );
    expect(component.hasActiveWarnings()).toBe(true);
  });

  it('should clear the general tab issue once rename is set to a valid value', () => {
    component.addForm.controls.rename.setValue('valid-name');

    expect(component.tabIssues().general).toBeUndefined();
    expect(component.hasActiveWarnings()).toBe(false);
  });

  it('should report an invalid-fields issue on the general tab for invalid characters', () => {
    component.addForm.controls.rename.setValue('bad<name>');

    expect(component.tabIssues().general).toBe(
      'components.add-torrent.tab.general.issue.invalid-fields',
    );
  });

  it('should report a noServerSelected issue on the general tab', () => {
    component.addForm.controls.rename.setValue('valid-name');
    component.addForm.setErrors({ noServerSelected: true });

    expect(component.tabIssues().general).toBe(
      'components.add-torrent.feedback.no-server-selected',
    );
  });

  it('should report an addFailed issue on the general tab', () => {
    component.addForm.controls.rename.setValue('valid-name');
    component.addForm.setErrors({ addFailed: true });

    expect(component.tabIssues().general).toBe('components.add-torrent.feedback.add-failed');
  });

  it('should report a files tab issue while the file tree is in edit mode', () => {
    component.treeInEditMode.set(true);

    expect(component.tabIssues().files).toBe(
      'components.add-torrent.tab.files.issue.edit-in-progress',
    );
    expect(component.hasActiveWarnings()).toBe(true);
  });
});
```

Replace with:

```typescript
describe('canSubmit', () => {
  it('should return false when no torrent file is selected', () => {
    expect(component.canSubmit()).toBe(false);
  });

  it('should return false while submitting', () => {
    component.isSubmitting.set(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('should return true in link mode with magnet links and an empty rename', () => {
    component.switchInputMode('link');
    component.addForm.controls.linkGroup.controls.magnetLinks.setValue(
      'magnet:?xt=urn:btih:abcdef',
    );

    expect(component.canSubmit()).toBe(true);
  });

  it('should return false when the file tree is in edit mode even if the form is otherwise valid', () => {
    component.switchInputMode('link');
    component.addForm.controls.linkGroup.controls.magnetLinks.setValue(
      'magnet:?xt=urn:btih:abcdef',
    );
    component.treeInEditMode.set(true);

    expect(component.canSubmit()).toBe(false);
  });
});

describe('rename validator (via form)', () => {
  it('should be invalid when rename contains a forward slash', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('folder/name');
    expect(component.addForm.controls.fileGroup.controls.rename.errors).toHaveProperty('pattern');
  });

  it('should be invalid when rename contains a backslash', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('folder\\name');
    expect(component.addForm.controls.fileGroup.controls.rename.errors).toHaveProperty('pattern');
  });

  it('should be invalid when rename contains other reserved characters', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('bad<name>');
    expect(component.addForm.controls.fileGroup.controls.rename.errors).toHaveProperty('pattern');
  });

  it('should be valid when rename contains no invalid characters', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');
    expect(component.addForm.controls.fileGroup.controls.rename.errors).toBeNull();
  });

  it('should be valid when fileGroup rename is left empty', () => {
    expect(component.addForm.controls.fileGroup.controls.rename.value).toBeNull();
    expect(component.addForm.controls.fileGroup.controls.rename.errors).toBeNull();
  });

  it('should be valid when linkGroup rename is left empty', () => {
    expect(component.addForm.controls.linkGroup.controls.rename.value).toBeNull();
    expect(component.addForm.controls.linkGroup.controls.rename.errors).toBeNull();
  });
});

describe('tabIssues / hasActiveWarnings', () => {
  it('should report no general tab issue by default', () => {
    expect(component.tabIssues().general).toBeUndefined();
    expect(component.hasActiveWarnings()).toBe(false);
  });

  it('should clear the general tab issue once rename is set to a valid value', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');

    expect(component.tabIssues().general).toBeUndefined();
    expect(component.hasActiveWarnings()).toBe(false);
  });

  it('should report an invalid-fields issue on the general tab for invalid characters', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('bad<name>');

    expect(component.tabIssues().general).toBe(
      'components.add-torrent.tab.general.issue.invalid-fields',
    );
  });

  it('should report an invalid-fields issue on the general tab for invalid characters in link mode', () => {
    component.switchInputMode('link');
    component.addForm.controls.linkGroup.controls.rename.setValue('bad<name>');

    expect(component.tabIssues().general).toBe(
      'components.add-torrent.tab.general.issue.invalid-fields',
    );
  });

  it('should report a noServerSelected issue on the general tab', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');
    component.addForm.setErrors({ noServerSelected: true });

    expect(component.tabIssues().general).toBe(
      'components.add-torrent.feedback.no-server-selected',
    );
  });

  it('should report an addFailed issue on the general tab', () => {
    component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');
    component.addForm.setErrors({ addFailed: true });

    expect(component.tabIssues().general).toBe('components.add-torrent.feedback.add-failed');
  });

  it('should report a files tab issue while the file tree is in edit mode', () => {
    component.treeInEditMode.set(true);

    expect(component.tabIssues().files).toBe(
      'components.add-torrent.tab.files.issue.edit-in-progress',
    );
    expect(component.hasActiveWarnings()).toBe(true);
  });
});
```

Now find the `beforeEach` inside `handleSubmit category creation`:

```typescript
beforeEach(() => {
  mockQbService = TestBed.inject(QbService) as any;
  torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
  (component as any).selectedTorrentFile.set({
    name: 'test.torrent',
    path: '/tmp/test.torrent',
  });
  component.addForm.controls.rename.setValue('test-torrent');
});
```

Replace with:

```typescript
beforeEach(() => {
  mockQbService = TestBed.inject(QbService) as any;
  torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
  (component as any).selectedTorrentFile.set({
    name: 'test.torrent',
    path: '/tmp/test.torrent',
  });
  component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
});
```

Finally, find the `eager rename validation`, `handleInputModeChange`, and `resetToSavedSettings` describe blocks (this is the rest of the file, through the closing braces):

```typescript
  describe('eager rename validation', () => {
    it('should mark rename as touched on init when it is invalid', () => {
      fixture.detectChanges();

      expect(component.addForm.controls.rename.touched).toBe(true);
    });
  });

  describe('handleInputModeChange', () => {
    let confirmService: { confirm: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      confirmService = TestBed.inject(ConfirmService) as any;
      confirmService.confirm.mockReset();
    });

    it('should do nothing when the mode is unchanged', async () => {
      await component.handleInputModeChange('file');

      expect(confirmService.confirm).not.toHaveBeenCalled();
      expect(component.inputMode()).toBe('file');
    });

    it('should switch and reset without confirming when the form is pristine', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({});

      await component.handleInputModeChange('link');

      expect(confirmService.confirm).not.toHaveBeenCalled();
      expect(component.inputMode()).toBe('link');
    });

    it('should ask for confirmation when the form is dirty, and do nothing if cancelled', async () => {
      confirmService.confirm.mockResolvedValue(false);
      component.addForm.controls.savepath.markAsDirty();
      component.addForm.controls.savepath.setValue('/changed');

      await component.handleInputModeChange('link');

      expect(confirmService.confirm).toHaveBeenCalledWith(
        'components.add-torrent.confirm.switch-mode.title',
        'components.add-torrent.confirm.switch-mode.message',
      );
      expect(component.inputMode()).toBe('file');
    });

    it('should switch and reset when the form is dirty and the user confirms', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({ savepath: '/downloads' });
      confirmService.confirm.mockResolvedValue(true);
      component.addForm.controls.savepath.markAsDirty();
      component.addForm.controls.savepath.setValue('/changed');

      await component.handleInputModeChange('link');

      expect(component.inputMode()).toBe('link');
      expect(component.addForm.controls.savepath.value).toBe('/downloads');
    });
  });

  describe('resetToSavedSettings', () => {
    it('should reapply saved AddTorrentSettings fields, mark them pristine, and clear the dirty state', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({
        savepath: '/downloads',
        paused: true,
        category: 'movies',
        tags: 'a, b',
        root_folder: 'true',
        skip_checking: true,
        sequentialDownload: true,
        firstLastPiecePrio: true,
        autoTMM: true,
        transferRateLimits: { uploadLimit: 100, downloadLimit: 200 },
        shareLimits: { ratioLimit: 2, seedingTimeLimit: 60, inactiveSeedingTimeLimit: -1 },
      });

      component.addForm.controls.savepath.markAsDirty();
      component.addForm.controls.savepath.setValue('/changed');
      expect(component.addForm.dirty).toBe(true);

      await component.resetToSavedSettings();

      expect(component.addForm.controls.savepath.value).toBe('/downloads');
      expect(component.addForm.controls.tags.value).toEqual(['a', 'b']);
      expect(component.addForm.controls.savepath.dirty).toBe(false);
      expect(component.addForm.dirty).toBe(false);
    });

    it('should leave rename dirty (and the form dirty) when only rename was edited', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({ savepath: '/downloads' });

      component.addForm.controls.rename.markAsDirty();
      component.addForm.controls.rename.setValue('my-name');
      expect(component.addForm.dirty).toBe(true);

      await component.resetToSavedSettings();

      expect(component.addForm.controls.rename.value).toBe('my-name');
      expect(component.addForm.controls.rename.dirty).toBe(true);
      expect(component.addForm.dirty).toBe(true);
    });
  });
});
```

Replace with:

```typescript
  describe('eager rename validation', () => {
    it('should not mark fileGroup rename as touched on init when it is empty (valid)', () => {
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.rename.touched).toBe(false);
    });

    it('should mark fileGroup rename as touched once it becomes pattern-invalid', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('bad<name>');
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.rename.touched).toBe(true);
    });

    it('should mark linkGroup rename as touched once it becomes pattern-invalid in link mode', () => {
      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.rename.setValue('bad<name>');
      fixture.detectChanges();

      expect(component.addForm.controls.linkGroup.controls.rename.touched).toBe(true);
    });
  });

  describe('handleInputModeChange', () => {
    it('should do nothing when the mode is unchanged', () => {
      component.handleInputModeChange('file');

      expect(component.inputMode()).toBe('file');
    });

    it('should preserve fileGroup state across a file -> link -> file round trip', () => {
      component.addForm.controls.fileGroup.controls.file.setValue('movie.torrent', {
        emitEvent: false,
      });
      component.addForm.controls.fileGroup.controls.rename.setValue('renamed-movie');
      (component as any).selectedTorrentFile.set({
        name: 'movie.torrent',
        path: '/tmp/movie.torrent',
      });
      (component as any).savedFileState = { renames: [], files: [] };
      component.showTree.set(true);

      component.handleInputModeChange('link');
      component.handleInputModeChange('file');

      expect(component.addForm.controls.fileGroup.controls.file.value).toBe('movie.torrent');
      expect(component.addForm.controls.fileGroup.controls.rename.value).toBe('renamed-movie');
      expect((component as any).selectedTorrentFile()).toEqual({
        name: 'movie.torrent',
        path: '/tmp/movie.torrent',
      });
      expect((component as any).savedFileState).toEqual({ renames: [], files: [] });
      expect(component.showTree()).toBe(true);
    });

    it('should preserve linkGroup state across a link -> file -> link round trip', () => {
      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.magnetLinks.setValue(
        'magnet:?xt=urn:btih:abcdef',
      );
      component.addForm.controls.linkGroup.controls.rename.setValue('renamed-magnet');

      component.handleInputModeChange('file');
      component.handleInputModeChange('link');

      expect(component.addForm.controls.linkGroup.controls.magnetLinks.value).toBe(
        'magnet:?xt=urn:btih:abcdef',
      );
      expect(component.addForm.controls.linkGroup.controls.rename.value).toBe('renamed-magnet');
    });

    it('should reset treeInEditMode and clear the files tab issue when switching modes', () => {
      component.treeInEditMode.set(true);
      expect(component.tabIssues().files).toBe(
        'components.add-torrent.tab.files.issue.edit-in-progress',
      );

      component.handleInputModeChange('link');

      expect(component.treeInEditMode()).toBe(false);
      expect(component.tabIssues().files).toBeUndefined();
    });
  });
});
```

`ConfirmService` stays imported and stays in the `TestBed` providers array (`{ provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } }`) - it's harmless, satisfies any nested components that might still inject it, and keeps the import "used" for lint purposes via the DI token reference.

- [ ] **Step 11: Update `general.spec.ts` for the new form shape**

In `packages/app/src/app/components/add-torrent/general/general.spec.ts`, find the `createForm()` helper:

```typescript
function createForm(): AddTorrentFormGroup {
  return new FormGroup({
    file: new FormControl<string>('', { nonNullable: true }),
    magnetLinks: new FormControl<string>('', { nonNullable: true }),
    savepath: new FormControl<string | null>(null),
    rename: new FormControl<string | null>(null),
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
}
```

Replace with:

```typescript
function createForm(): AddTorrentFormGroup {
  return new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    linkGroup: new FormGroup({
      magnetLinks: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
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
}
```

Find the "should bind the rename field to the form" test:

```typescript
it('should bind the rename field to the form', () => {
  const renameInput: HTMLInputElement = fixture.nativeElement.querySelector('#rename');
  renameInput.value = 'my-torrent';
  renameInput.dispatchEvent(new Event('input'));

  expect(component.form().controls.rename.value).toBe('my-torrent');
});
```

Replace with:

```typescript
it('should bind the rename field to the form', () => {
  const renameInput: HTMLInputElement = fixture.nativeElement.querySelector('#rename');
  renameInput.value = 'my-torrent';
  renameInput.dispatchEvent(new Event('input'));

  expect(component.form().controls.fileGroup.controls.rename.value).toBe('my-torrent');
});
```

Find the `rename validation feedback` describe block:

```typescript
describe('rename validation feedback', () => {
  it('should show the required message when the rename control has a required error', () => {
    component.form().controls.rename.setErrors({ required: true });
    component.form().controls.rename.markAsDirty();
    fixture.detectChanges();

    const messages: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.invalid-feedback');

    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('general.form.feedback.required');
    expect(messages[0].textContent).not.toContain('general.form.feedback.pattern');
  });

  it('should show the pattern message when the rename control has a pattern error', () => {
    component.form().controls.rename.setErrors({ pattern: true });
    component.form().controls.rename.markAsDirty();
    fixture.detectChanges();

    const messages: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.invalid-feedback');

    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('general.form.feedback.pattern');
    expect(messages[0].textContent).not.toContain('general.form.feedback.required');
  });

  it('should not show any validation message when the rename control is valid', () => {
    expect(fixture.nativeElement.querySelectorAll('.invalid-feedback').length).toBe(0);
  });

  it('should show the required message when the rename control is touched but not dirty', () => {
    component.form().controls.rename.setErrors({ required: true });
    component.form().controls.rename.markAsTouched();
    fixture.detectChanges();

    const messages: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.invalid-feedback');

    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('general.form.feedback.required');
  });
});
```

Replace with:

```typescript
describe('rename validation feedback', () => {
  it('should show the pattern message when the fileGroup rename control has a pattern error', () => {
    component.form().controls.fileGroup.controls.rename.setErrors({ pattern: true });
    component.form().controls.fileGroup.controls.rename.markAsDirty();
    fixture.detectChanges();

    const messages: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.invalid-feedback');

    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('general.form.feedback.pattern');
  });

  it('should not show any validation message when the fileGroup rename control is valid', () => {
    expect(fixture.nativeElement.querySelectorAll('.invalid-feedback').length).toBe(0);
  });

  it('should show the pattern message when the linkGroup rename control has a pattern error', () => {
    fixture.componentRef.setInput('inputMode', 'link');
    component.form().controls.linkGroup.controls.rename.setErrors({ pattern: true });
    component.form().controls.linkGroup.controls.rename.markAsDirty();
    fixture.detectChanges();

    const messages: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.invalid-feedback');

    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('general.form.feedback.pattern');
  });

  it('should show the pattern message when the rename control is touched but not dirty', () => {
    component.form().controls.fileGroup.controls.rename.setErrors({ pattern: true });
    component.form().controls.fileGroup.controls.rename.markAsTouched();
    fixture.detectChanges();

    const messages: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.invalid-feedback');

    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('general.form.feedback.pattern');
  });
});
```

- [ ] **Step 12: Run the tests to verify everything passes**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS - all suites green, including `add-torrent.spec.ts` and `general.spec.ts`.

- [ ] **Step 13: Commit**

```bash
git add packages/app/src/app/models/add-torrent.model.ts packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.html packages/app/src/app/components/add-torrent/add-torrent.spec.ts packages/app/src/app/components/add-torrent/general/general.html packages/app/src/app/components/add-torrent/general/general.spec.ts
git commit -m "#159: replace add-torrent mode-switch confirm with fileGroup/linkGroup"
```

---

## Task 2: Remove unused switch-mode confirm i18n keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Remove the `confirm.switch-mode` keys from `us.json`**

In `public/i18n/us.json`, find:

```json
      "feedback": {
        "no-server-selected": "No server is selected. Choose a server before adding this torrent.",
        "add-failed": "Adding the torrent failed. Please try again."
      },
      "confirm": {
        "switch-mode": {
          "title": "Switch input mode",
          "message": "Switching input mode will reset your changes back to the saved defaults. Continue?"
        }
      }
    },
```

Replace with:

```json
      "feedback": {
        "no-server-selected": "No server is selected. Choose a server before adding this torrent.",
        "add-failed": "Adding the torrent failed. Please try again."
      }
    },
```

- [ ] **Step 2: Remove the `confirm.switch-mode` keys from `hu.json`**

In `public/i18n/hu.json`, find:

```json
      "feedback": {
        "no-server-selected": "Nincs kiválasztva szerver. Válassz szervert a torrent hozzáadása előtt.",
        "add-failed": "A torrent hozzáadása sikertelen. Próbáld újra."
      },
      "confirm": {
        "switch-mode": {
          "title": "Bemeneti mód váltása",
          "message": "A bemeneti mód váltása visszaállítja a módosításaidat a mentett alapértékekre. Folytatod?"
        }
      }
    },
```

Replace with:

```json
      "feedback": {
        "no-server-selected": "Nincs kiválasztva szerver. Válassz szervert a torrent hozzáadása előtt.",
        "add-failed": "A torrent hozzáadása sikertelen. Próbáld újra."
      }
    },
```

- [ ] **Step 3: Run the tests to confirm nothing broke**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS - same result as Task 1's Step 12 (these JSON files aren't part of the TS build, and no test asserts on the removed keys).

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#159: remove unused switch-mode confirm i18n keys"
```
