# Add Torrent Modal Tab Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five refinements to the Add Torrent modal described in `docs/superpowers/specs/2026-06-14-add-torrent-tabs-refinements-design.md`: a footer Reset button, a simplified tab-warning popover with eager rename validation, a Files-tab popover CSS fix, a General-tab fieldset restructure with a new input-mode popover and reset-on-switch confirm, and Limits-tab fieldsets.

**Architecture:** All changes are confined to `packages/app/src/app/components/add-torrent/` (the `AddTorrent` component and its `general`/`limits` sub-components) plus `public/i18n/{us,hu}.json`. No new components, services, or IPC changes - `ConfirmService` (existing) and `AddTorrentSettingsService` (existing, already injected) are reused.

**Tech Stack:** Angular 20 (zoneless, signals, reactive forms), `@ngx-translate`, Bootstrap 5 (`bb-fieldset`, `btn-dashed-secondary`), Vitest (`ng test --watch=false`).

---

## Task 1: Footer Reset button (`formDirty` + `resetToSavedSettings`)

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`, find the end of the `'handleSubmit category creation'` describe block:

```typescript
    it('should abort without adding the torrent when category creation fails', async () => {
      mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
      component.addForm.controls.category.setValue('bad-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'bad-category', '');
      expect(torrentsAddSpy).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });
  });
});
```

Replace it with (adding two new describe blocks before the final `});`):

```typescript
    it('should abort without adding the torrent when category creation fails', async () => {
      mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
      component.addForm.controls.category.setValue('bad-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'bad-category', '');
      expect(torrentsAddSpy).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('formDirty', () => {
    it('should be false initially', () => {
      expect(component.formDirty()).toBe(false);
    });

    it('should become true once a control is marked dirty', () => {
      component.addForm.controls.savepath.markAsDirty();
      component.addForm.controls.savepath.setValue('/changed');

      expect(component.formDirty()).toBe(true);
    });
  });

  describe('resetToSavedSettings', () => {
    it('should reapply saved AddTorrentSettings fields, mark them pristine, and clear formDirty', async () => {
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
      expect(component.formDirty()).toBe(true);

      await component.resetToSavedSettings();

      expect(component.addForm.controls.savepath.value).toBe('/downloads');
      expect(component.addForm.controls.tags.value).toEqual(['a', 'b']);
      expect(component.addForm.controls.savepath.dirty).toBe(false);
      expect(component.formDirty()).toBe(false);
    });

    it('should leave rename dirty (and the form dirty) when only rename was edited', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({ savepath: '/downloads' });

      component.addForm.controls.rename.markAsDirty();
      component.addForm.controls.rename.setValue('my-name');
      expect(component.formDirty()).toBe(true);

      await component.resetToSavedSettings();

      expect(component.addForm.controls.rename.value).toBe('my-name');
      expect(component.addForm.controls.rename.dirty).toBe(true);
      expect(component.formDirty()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `component.formDirty is not a function` / `component.resetToSavedSettings is not a function`.

- [ ] **Step 3: Implement `formDirty` and `resetToSavedSettings`**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find:

```typescript
  private readonly formStatus = toSignal(
    merge(this.addForm.statusChanges, this.addForm.valueChanges).pipe(
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );

  public effectiveDraft = computed(() => this.manualDraft() ?? this.pending()?.[0]?.draft);
```

Replace with:

```typescript
  private readonly formStatus = toSignal(
    merge(this.addForm.statusChanges, this.addForm.valueChanges).pipe(
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );

  public readonly formDirty = computed(() => {
    this.formStatus(); // re-run when addForm dirty/value state changes
    return this.addForm.dirty;
  });

  public effectiveDraft = computed(() => this.manualDraft() ?? this.pending()?.[0]?.draft);
```

Then find `ngOnInit` and the start of `handleCancel`:

```typescript
  public async ngOnInit(): Promise<void> {
    const settings = (await this.addTorrentSettings.load()) as any;

    for (const [k, v] of Object.entries(settings)) {
      const ctrl = this.addForm.get(k);
      if (ctrl && !ctrl.dirty) {
        if (k === 'tags' && typeof v === 'string') {
          ctrl.patchValue(
            v.split(',').map((t) => t.trim()),
            { emitEvent: false },
          );
        } else {
          ctrl.patchValue(v as any, { emitEvent: false });
        }
      }
    }
  }

  public handleCancel(): void {
```

Replace with:

```typescript
  public async ngOnInit(): Promise<void> {
    const settings = (await this.addTorrentSettings.load()) as any;

    for (const [k, v] of Object.entries(settings)) {
      const ctrl = this.addForm.get(k);
      if (ctrl && !ctrl.dirty) {
        if (k === 'tags' && typeof v === 'string') {
          ctrl.patchValue(
            v.split(',').map((t) => t.trim()),
            { emitEvent: false },
          );
        } else {
          ctrl.patchValue(v as any, { emitEvent: false });
        }
      }
    }
  }

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 5: Add the `general.button.reset` i18n key**

In `public/i18n/us.json`, find:

```json
      "open-details": "Open Details",
      "edit": "Edit"
    },
    "form": {
      "feedback": {
```

Replace with:

```json
      "open-details": "Open Details",
      "edit": "Edit",
      "reset": "Reset"
    },
    "form": {
      "feedback": {
```

In `public/i18n/hu.json`, find:

```json
      "open-details": "Részletek megnyitása",
      "edit": "Szerkesztés"
    },
    "form": {
      "feedback": {
```

Replace with:

```json
      "open-details": "Részletek megnyitása",
      "edit": "Szerkesztés",
      "reset": "Visszaállítás"
    },
    "form": {
      "feedback": {
```

- [ ] **Step 6: Add the Reset button to the modal footer**

In `packages/app/src/app/components/add-torrent/add-torrent.html`, find:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    (click)="handleSubmit($event)"
    [disabled]="!canSubmit()"
    [autofocus]="addForm.controls.file.value.length === 0"
  >
    {{ 'general.button.add' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="handleCancel()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    (click)="handleSubmit($event)"
    [disabled]="!canSubmit()"
    [autofocus]="addForm.controls.file.value.length === 0"
  >
    {{ 'general.button.add' | translate }}
  </button>
  <button
    type="button"
    class="btn btn-dashed-secondary"
    (click)="resetToSavedSettings()"
    [disabled]="!formDirty()"
  >
    {{ 'general.button.reset' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="handleCancel()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.html packages/app/src/app/components/add-torrent/add-torrent.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#159: add footer Reset button to add-torrent modal"
```

---

## Task 2: Eager rename validation + simplified tab-warning message

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/general/general.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`
- Test: `packages/app/src/app/components/add-torrent/general/general.spec.ts`

- [ ] **Step 1: Update the failing tests**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`, find the `'tabIssues / hasActiveWarnings'` describe block:

```typescript
  describe('tabIssues / hasActiveWarnings', () => {
    it('should report a required-rename issue on the general tab by default', () => {
      expect(component.tabIssues().general).toContain('general.form.feedback.required');
      expect(component.hasActiveWarnings()).toBe(true);
    });

    it('should clear the general tab issue once rename is set to a valid value', () => {
      component.addForm.controls.rename.setValue('valid-name');

      expect(component.tabIssues().general).toBeUndefined();
      expect(component.hasActiveWarnings()).toBe(false);
    });

    it('should report a pattern issue on the general tab for invalid characters', () => {
      component.addForm.controls.rename.setValue('bad<name>');

      expect(component.tabIssues().general).toContain('general.form.feedback.pattern');
    });

    it('should report a noServerSelected issue on the general tab', () => {
```

Replace with:

```typescript
  describe('tabIssues / hasActiveWarnings', () => {
    it('should report an invalid-fields issue on the general tab by default', () => {
      expect(component.tabIssues().general).toContain(
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

      expect(component.tabIssues().general).toContain(
        'components.add-torrent.tab.general.issue.invalid-fields',
      );
    });

    it('should report a noServerSelected issue on the general tab', () => {
```

Now add a new describe block for the eager-validation effect. Find:

```typescript
  describe('formDirty', () => {
    it('should be false initially', () => {
      expect(component.formDirty()).toBe(false);
    });
```

Replace with:

```typescript
  describe('eager rename validation', () => {
    it('should mark rename as touched on init when it is invalid', () => {
      fixture.detectChanges();

      expect(component.addForm.controls.rename.touched).toBe(true);
    });
  });

  describe('formDirty', () => {
    it('should be false initially', () => {
      expect(component.formDirty()).toBe(false);
    });
```

In `packages/app/src/app/components/add-torrent/general/general.spec.ts`, find:

```typescript
    it('should not show any validation message when the rename control is valid', () => {
      expect(fixture.nativeElement.querySelectorAll('.invalid-feedback').length).toBe(0);
    });
  });
});
```

Replace with:

```typescript
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `tabIssues().general` still contains `'general.form.feedback.required'`/`.pattern`; `rename.touched` is `false`; the new `general.spec.ts` test finds 0 `.invalid-feedback` elements.

- [ ] **Step 3: Collapse the rename tab-issue messages into one generic message**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find:

```typescript
const general: string[] = [];
const renameErrors = this.addForm.controls.rename.errors;
if (renameErrors?.['required']) {
  general.push(this.translateService.instant('general.form.feedback.required'));
}
if (renameErrors?.['pattern']) {
  general.push(this.translateService.instant('general.form.feedback.pattern'));
}
```

Replace with:

```typescript
const general: string[] = [];
const renameErrors = this.addForm.controls.rename.errors;
if (renameErrors?.['required'] || renameErrors?.['pattern']) {
  general.push(
    this.translateService.instant('components.add-torrent.tab.general.issue.invalid-fields'),
  );
}
```

- [ ] **Step 4: Add the eager-validation effect**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find the end of the constructor:

```typescript
    effect(() => {
      if (this.activeTabId() === 'files' && this.filesTabDisabled()) {
        this.activeTabId.set('general');
      }
    });
  }
```

Replace with:

```typescript
    effect(() => {
      if (this.activeTabId() === 'files' && this.filesTabDisabled()) {
        this.activeTabId.set('general');
      }
    });

    effect(() => {
      this.formStatus(); // re-run when addForm validity changes
      if (this.addForm.controls.rename.invalid) {
        this.addForm.controls.rename.markAsTouched();
      }
    });
  }
```

- [ ] **Step 5: Update `general.html` to treat `touched` like `dirty` for the rename field**

In `packages/app/src/app/components/add-torrent/general/general.html`, find:

```html
[class.is-invalid]="form().controls.rename.invalid && form().controls.rename.dirty" />
<label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
@if (form().controls.rename.invalid && form().controls.rename.dirty) {
```

Replace with:

```html
[class.is-invalid]=" form().controls.rename.invalid && (form().controls.rename.touched ||
form().controls.rename.dirty) " />
<label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
@if ( form().controls.rename.invalid && (form().controls.rename.touched ||
form().controls.rename.dirty) ) {
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 7: Add the `components.add-torrent.tab.general.issue.invalid-fields` i18n key**

In `public/i18n/us.json`, find:

```json
      "tab": {
        "general": {
          "title": "General"
        },
        "options": {
          "title": "Options"
        },
```

Replace with:

```json
      "tab": {
        "general": {
          "title": "General",
          "issue": {
            "invalid-fields": "Some fields need attention."
          }
        },
        "options": {
          "title": "Options"
        },
```

In `public/i18n/hu.json`, find:

```json
      "tab": {
        "general": {
          "title": "Általános"
        },
        "options": {
          "title": "Beállítások"
        },
```

Replace with:

```json
      "tab": {
        "general": {
          "title": "Általános",
          "issue": {
            "invalid-fields": "Néhány mező figyelmet igényel."
          }
        },
        "options": {
          "title": "Beállítások"
        },
```

- [ ] **Step 8: Run the full test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.spec.ts packages/app/src/app/components/add-torrent/general/general.html packages/app/src/app/components/add-torrent/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#159: simplify tab-warning message and validate rename eagerly"
```

---

## Task 3: Files tab disabled-popover CSS fix

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.scss`

- [ ] **Step 1: Add the CSS rule**

`packages/app/src/app/components/add-torrent/add-torrent.scss` is currently empty. Read it, then write:

```scss
.bb-modal-tabs .nav-link.disabled {
  pointer-events: auto;
}
```

This is a pure CSS fix: Bootstrap's `.nav-link.disabled` sets `pointer-events: none`, which also blocks hover on the `faCircleQuestion` icon inside the disabled Files tab, so `filesTabDisabledReason()`'s popover never appears. Re-enabling `pointer-events` on the link lets the icon's own hover/popover work again. The existing `(click)="!(tab.id === 'files' && filesTabDisabled()) && selectTab(tab.id)"` guard still blocks navigation - this rule does not change click behavior. Verification is manual (see Task 7).

- [ ] **Step 2: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.scss
git commit -m "#159: fix disabled Files tab popover not appearing on hover"
```

---

## Task 4: General tab fieldset restructure + input-mode popover

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/general/general.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/components/add-torrent/general/general.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/add-torrent/general/general.spec.ts`, find:

```typescript
describe('ensureCategoryExists', () => {
  it('should delegate to the nested CategorySelect and return true for an empty category', async () => {
    expect(await component.ensureCategoryExists()).toBe(true);
  });
});
```

Replace with:

```typescript
describe('ensureCategoryExists', () => {
  it('should delegate to the nested CategorySelect and return true for an empty category', async () => {
    expect(await component.ensureCategoryExists()).toBe(true);
  });
});

describe('fieldset layout', () => {
  it('should render the Input and Storage fieldsets with their legends', () => {
    const legends: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      'fieldset.bb-fieldset > legend',
    );

    expect(legends.length).toBe(2);
    expect(legends[0].textContent).toContain('components.add-torrent.label.input');
    expect(legends[1].textContent).toContain('components.add-torrent.label.storage');
  });

  it('should make the input-mode toggle full width and show a popover beside it', () => {
    const toggle: HTMLElement = fixture.nativeElement.querySelector('.btn-group');

    expect(toggle.classList.contains('w-100')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - no `fieldset.bb-fieldset` elements found (`legends.length` is 0); `.btn-group` has no `w-100` class; only 2 `bb-popover` elements exist.

- [ ] **Step 3: Restructure `general.html`**

Replace the entire contents of `packages/app/src/app/components/add-torrent/general/general.html` with:

```html
<div [formGroup]="form()">
  <div class="container-fluid px-0">
    <fieldset class="bb-fieldset">
      <legend>{{ 'components.add-torrent.label.input' | translate }}</legend>

      <div class="row">
        <div class="col-11 mb-3">
          <div class="btn-group w-100" role="group">
            <input
              type="radio"
              class="btn-check"
              name="inputMode"
              id="inputMode_file"
              autocomplete="off"
              [checked]="inputMode() === 'file'"
              (change)="inputModeChange.emit('file')"
            />
            <label class="btn btn-outline-primary" for="inputMode_file">
              <fa-icon [icon]="icons.faFile" class="me-1"></fa-icon>
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
            <label class="btn btn-outline-primary" for="inputMode_link">
              <fa-icon [icon]="icons.faLink" class="me-1"></fa-icon>
              {{ 'components.add-torrent.input-mode.link' | translate }}
            </label>
          </div>
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            [subject]="'components.add-torrent.popover.input-mode.title' | translate"
            [description]="inputModePopover"
            placement="left"
          ></bb-popover>
        </div>

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
            <input
              type="file"
              #fileInput
              hidden
              accept=".torrent"
              (change)="fileSelected.emit($event)"
            />
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

        <div class="col-1 d-flex align-items-center mb-3">
          @if (inputMode() === 'file') {
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.file.title' | translate"
            [description]="filePopover"
            placement="left"
          ></bb-popover>
          } @else {
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.links.title' | translate"
            [description]="linksPopover"
            placement="left"
          ></bb-popover>
          }
        </div>
      </div>
    </fieldset>

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.add-torrent.label.storage' | translate }}</legend>

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
            <div class="invalid-feedback px-2">
              {{ 'general.form.feedback.required' | translate }}
            </div>
            } @else if (form().controls.rename.hasError('pattern')) {
            <div class="invalid-feedback px-2">
              {{ 'general.form.feedback.pattern' | translate }}
            </div>
            } }
          </div>
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.name.title' | translate"
            [description]="namePopover"
            placement="left"
          ></bb-popover>
        </div>

        <div class="col-12">
          <div class="mb-3">
            <app-save-path-select
              formControlName="savepath"
              [autofocus]="true"
              [clearable]="true"
            ></app-save-path-select>
          </div>
        </div>

        <div class="col-12">
          <div class="mb-3">
            <app-category-select formControlName="category"></app-category-select>
          </div>
        </div>

        <div class="col-12">
          <div class="mb-3">
            <app-tag-select formControlName="tags"></app-tag-select>
          </div>
        </div>
      </div>
    </fieldset>
  </div>
</div>

<ng-template #filePopover>
  <p>{{ 'components.add-torrent.popover.file.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.file.description.line2' | translate }}</p>
</ng-template>

<ng-template #linksPopover>
  <p>{{ 'components.add-torrent.popover.links.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.links.description.line2' | translate }}</p>
</ng-template>

<ng-template #namePopover>
  <p>{{ 'components.add-torrent.popover.name.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.name.description.line2' | translate }}</p>
</ng-template>

<ng-template #inputModePopover>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 5: Add the `label.input`/`label.storage` and `popover.input-mode.*` i18n keys**

In `public/i18n/us.json`, find:

```json
      "label": {
        "transfer-rate-limits": "Transfer Rate Limits",
        "share-limits": "Share Limits"
      },
```

Replace with:

```json
      "label": {
        "transfer-rate-limits": "Transfer Rate Limits",
        "share-limits": "Share Limits",
        "input": "Input",
        "storage": "Storage"
      },
```

Then find:

```json
        "links": {
          "title": "Links",
          "description": {
            "line1": "Paste one or more magnet links or direct .torrent URLs here, one per line.",
            "line2": "Magnet links start with magnet:?xt=urn:btih:… - direct .torrent URLs point to a remote file that qBittorrent will fetch automatically."
          }
        }
      },
```

Replace with:

```json
        "links": {
          "title": "Links",
          "description": {
            "line1": "Paste one or more magnet links or direct .torrent URLs here, one per line.",
            "line2": "Magnet links start with magnet:?xt=urn:btih:… - direct .torrent URLs point to a remote file that qBittorrent will fetch automatically."
          }
        },
        "input-mode": {
          "title": "Input Mode",
          "description": {
            "line1": "Choose whether you're adding this torrent from a local .torrent file or from a magnet link / URL.",
            "line2": "Switching modes resets save path, category, tags, and other options back to your saved defaults."
          }
        }
      },
```

In `public/i18n/hu.json`, find:

```json
      "label": {
        "transfer-rate-limits": "Átviteli sebesség korlátok",
        "share-limits": "Megosztási korlátok"
      },
```

Replace with:

```json
      "label": {
        "transfer-rate-limits": "Átviteli sebesség korlátok",
        "share-limits": "Megosztási korlátok",
        "input": "Bemenet",
        "storage": "Tárhely"
      },
```

Then find:

```json
        "links": {
          "title": "Linkek",
          "description": {
            "line1": "Illessz be egy vagy több mágneslinket vagy közvetlen .torrent URL-t ide, soronként egyet.",
            "line2": "A mágneslinkkek magnet:?xt=urn:btih:… kezdetűek - a közvetlen .torrent URL-ekről a qBittorrent automatikusan letölti a fájlt."
          }
        }
      },
```

Replace with:

```json
        "links": {
          "title": "Linkek",
          "description": {
            "line1": "Illessz be egy vagy több mágneslinket vagy közvetlen .torrent URL-t ide, soronként egyet.",
            "line2": "A mágneslinkkek magnet:?xt=urn:btih:… kezdetűek - a közvetlen .torrent URL-ekről a qBittorrent automatikusan letölti a fájlt."
          }
        },
        "input-mode": {
          "title": "Bemeneti mód",
          "description": {
            "line1": "Válaszd ki, hogy ezt a torrentet egy helyi .torrent fájlból vagy egy mágneslinkből/URL-ből szeretnéd hozzáadni.",
            "line2": "A mód váltása visszaállítja a mentési útvonalat, a kategóriát, a címkéket és a többi beállítást a mentett alapértékekre."
          }
        }
      },
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/add-torrent/general/general.html packages/app/src/app/components/add-torrent/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#159: restructure General tab into Input/Storage fieldsets"
```

---

## Task 5: Mode-switch confirm + reset

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`, add the import for `ConfirmService` near the top, alongside the other service imports:

```typescript
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { ConfirmService } from '../../services/confirm.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
```

(`AddTorrentSettingsService` and `GeneralSettingsService` are existing imports - insert the `ConfirmService` line between them, keeping alphabetical order.)

Add a mock provider in the `TestBed.configureTestingModule` providers array. Find:

```typescript
        {
          provide: AddTorrentSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({}),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
```

Replace with:

```typescript
        {
          provide: AddTorrentSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({}),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
```

Now add the test cases. Find the `'formDirty'` describe block (added in Task 1):

```typescript
describe('formDirty', () => {
  it('should be false initially', () => {
    expect(component.formDirty()).toBe(false);
  });

  it('should become true once a control is marked dirty', () => {
    component.addForm.controls.savepath.markAsDirty();
    component.addForm.controls.savepath.setValue('/changed');

    expect(component.formDirty()).toBe(true);
  });
});
```

Replace with:

```typescript
describe('formDirty', () => {
  it('should be false initially', () => {
    expect(component.formDirty()).toBe(false);
  });

  it('should become true once a control is marked dirty', () => {
    component.addForm.controls.savepath.markAsDirty();
    component.addForm.controls.savepath.setValue('/changed');

    expect(component.formDirty()).toBe(true);
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `component.handleInputModeChange is not a function`.

- [ ] **Step 3: Inject `ConfirmService` and add `handleInputModeChange`**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find the import block:

```typescript
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
```

Replace with:

```typescript
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { ConfirmService } from '../../services/confirm.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
```

Find the injected services:

```typescript
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
```

Replace with:

```typescript
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
```

Find `switchInputMode` and add `handleInputModeChange` immediately before it:

```typescript
  public switchInputMode(mode: 'file' | 'link'): void {
```

Replace with:

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

  public switchInputMode(mode: 'file' | 'link'): void {
```

- [ ] **Step 4: Wire up the new handler in the template**

In `packages/app/src/app/components/add-torrent/add-torrent.html`, find:

```html
<app-add-torrent-general
  [form]="addForm"
  [inputMode]="inputMode()"
  (inputModeChange)="switchInputMode($event)"
  (fileSelected)="handleFileSelected($event)"
></app-add-torrent-general>
```

Replace with:

```html
<app-add-torrent-general
  [form]="addForm"
  [inputMode]="inputMode()"
  (inputModeChange)="handleInputModeChange($event)"
  (fileSelected)="handleFileSelected($event)"
></app-add-torrent-general>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 6: Add the `components.add-torrent.confirm.switch-mode.*` i18n keys**

In `public/i18n/us.json`, find:

```json
      "feedback": {
        "no-server-selected": "No server is selected. Choose a server before adding this torrent.",
        "add-failed": "Adding the torrent failed. Please try again."
      }
    },
```

Replace with:

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

In `public/i18n/hu.json`, find:

```json
      "feedback": {
        "no-server-selected": "Nincs kiválasztva szerver. Válassz szervert a torrent hozzáadása előtt.",
        "add-failed": "A torrent hozzáadása sikertelen. Próbáld újra."
      }
    },
```

Replace with:

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

- [ ] **Step 7: Run the full test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.html packages/app/src/app/components/add-torrent/add-torrent.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#159: confirm and reset form when switching add-torrent input mode"
```

---

## Task 6: Limits tab fieldsets

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/limits/limits.html`
- Test: `packages/app/src/app/components/add-torrent/limits/limits.spec.ts`

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/components/add-torrent/limits/limits.spec.ts`, find:

```typescript
  it('should render the share limit control', () => {
    expect(fixture.nativeElement.querySelector('app-share-limit')).toBeTruthy();
  });
});
```

Replace with:

```typescript
  it('should render the share limit control', () => {
    expect(fixture.nativeElement.querySelector('app-share-limit')).toBeTruthy();
  });

  it('should wrap each limit control in a bb-fieldset with the correct legend', () => {
    const fieldsets: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('fieldset.bb-fieldset');

    expect(fieldsets.length).toBe(2);
    expect(fieldsets[0].querySelector('legend')?.textContent).toContain(
      'components.add-torrent.label.transfer-rate-limits',
    );
    expect(fieldsets[0].querySelector('app-transfer-limit')).toBeTruthy();
    expect(fieldsets[1].querySelector('legend')?.textContent).toContain(
      'components.add-torrent.label.share-limits',
    );
    expect(fieldsets[1].querySelector('app-share-limit')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `fieldsets.length` is 0.

- [ ] **Step 3: Wrap the limit controls in `bb-fieldset`s**

Replace the entire contents of `packages/app/src/app/components/add-torrent/limits/limits.html` with:

```html
<div [formGroup]="form()">
  <div class="container px-0">
    <div class="row">
      <div class="col-12">
        <fieldset class="bb-fieldset">
          <legend>{{ 'components.add-torrent.label.transfer-rate-limits' | translate }}</legend>
          <app-transfer-limit formControlName="transferRateLimits"></app-transfer-limit>
        </fieldset>
      </div>

      <div class="col-12 mt-3">
        <fieldset class="bb-fieldset">
          <legend>{{ 'components.add-torrent.label.share-limits' | translate }}</legend>
          <app-share-limit formControlName="shareLimits"></app-share-limit>
        </fieldset>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/add-torrent/limits/limits.html packages/app/src/app/components/add-torrent/limits/limits.spec.ts
git commit -m "#159: wrap add-torrent Limits tab sections in bb-fieldsets"
```

---

## Task 7: Final verification

No code changes - this task is a final check before opening the PR.

- [ ] **Step 1: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS (all tests from Tasks 1-6 plus the existing suite).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS with zero warnings.

- [ ] **Step 3: Manual UI pass**

Run `npm start` and open the Add Torrent modal, then verify:

- Opening the modal with no name yet shows the rename field with a red border and "This field is required." immediately, with no interaction.
- The General tab warning icon shows "Some fields need attention." (not the old per-field messages) while the rename field is invalid; selecting a server and a valid name clears it. Trigger `no-server-selected` and `add-failed` (submit without a server / with a forced add failure) and confirm those tab-warning messages remain specific.
- Hover the disabled Files tab (e.g. in link mode) and confirm the "why is this disabled" popover now appears.
- The footer shows Add / Reset / Cancel. Reset is disabled until any field changes; clicking it reverts save path, category, tags, root folder, paused, skip-hash-checking, sequential download, first/last piece priority, Auto TMM, and the rate/share limits back to the saved defaults, and disables itself again.
- The General tab shows "Input" and "Storage" fieldsets. The file/link toggle spans the row with a "?" popover beside it explaining the input mode and that switching resets the form.
- With unsaved changes, switching between File and Link mode shows a confirm dialog; cancelling leaves everything unchanged, confirming switches mode and resets the form to saved defaults. With no unsaved changes, switching mode does not prompt.
- The Limits tab shows "Transfer Rate Limits" and "Share Limits" as separate bordered fieldsets.
- Repeat the General/Limits visual checks with the language switched to Hungarian (`hu`) to confirm the new translations render.

No commit for this task.
