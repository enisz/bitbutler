# Auto-delete torrent file when torrent already exists in the list — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual "Delete Torrent File" button in the Torrent Exists modal with an
automatic deletion driven by a new, opt-in general setting.

**Architecture:** Add `behavior.deleteTorrentFileOnDuplicate` to `GeneralSettings`. Wire a new
switch into the General settings page's `behavior` `FormGroup`, coupled to the existing
`deleteTorrentFile` control exactly the way `startMinimized` is coupled to `openAtLogin` (disabled

- forced off when the parent is off, re-enabled when the parent turns on). In the `TorrentExists`
  modal, replace the manual button + click handler with a constructor `effect()` that fires the same
  delete-and-toast logic automatically, once, as soon as `originalPath` and the loaded settings are
  available and the new switch is on.

**Tech Stack:** Angular 20 (zoneless, signals), Angular Reactive Forms, `@ngx-translate/core`,
Vitest (`ng test`, runner: vitest).

## Global Constraints

- Toast title = short Title-Case outcome description; message = variable detail or one
  sentence-case confirmation ending in a period. Never restate the title. (`CLAUDE.md` → Toasts)
- Use `-` not `—` in all written output, including commit messages and i18n copy. (`CLAUDE.md` →
  Writing style)
- Commit format: `#243: short description`. (`CLAUDE.md` → Commit & PR conventions)
- `npm run lint` must pass with zero warnings before any commit that touches `.ts`/`.html` files.
- All new/changed English copy needs a matching Hungarian translation in `public/i18n/hu.json`.

---

### Task 1: Add `deleteTorrentFileOnDuplicate` to the general settings model

**Files:**

- Modify: `packages/app/src/app/models/general-settings.model.ts:27-32` (interface),
  `packages/app/src/app/models/general-settings.model.ts:55-59` (defaults)
- Test: `packages/app/src/app/models/general-settings.model.spec.ts:101-109`

**Interfaces:**

- Produces: `GeneralSettings.behavior.deleteTorrentFileOnDuplicate: boolean`, defaulting to
  `false` in `DEFAULT_GENERAL_SETTINGS`. Every later task reads/writes this exact path.

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/models/general-settings.model.spec.ts`, add a new test inside the
existing `describe('DEFAULT_GENERAL_SETTINGS', ...)` block (after the `dateFormat` test):

```ts
it('defaults deleteTorrentFileOnDuplicate to false', () => {
  expect(DEFAULT_GENERAL_SETTINGS.behavior.deleteTorrentFileOnDuplicate).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - TypeScript error / `undefined` is not `false` for
`deleteTorrentFileOnDuplicate`.

- [ ] **Step 3: Implement**

In `packages/app/src/app/models/general-settings.model.ts`, update the `behavior` block of the
`GeneralSettings` interface:

```ts
behavior: {
  deleteTorrentFile: boolean;
  deleteTorrentFileOnDuplicate: boolean;
  automaticUpdate: boolean;
  toastPosition: ToastPosition;
}
```

And the `behavior` block of `DEFAULT_GENERAL_SETTINGS`:

```ts
  behavior: {
    deleteTorrentFile: true,
    deleteTorrentFileOnDuplicate: false,
    automaticUpdate: true,
    toastPosition: 'bottom-right',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS. Also confirm the existing
`GeneralSettingsService` test `'should return default settings when nothing is stored'`
(`packages/app/src/app/services/general-settings.service.spec.ts:26-29`) still passes - it does a
deep `toEqual` against `DEFAULT_GENERAL_SETTINGS`, so it passes automatically once both sides
include the new field.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/models/general-settings.model.ts packages/app/src/app/models/general-settings.model.spec.ts
git commit -m "#243: add deleteTorrentFileOnDuplicate to general settings model"
```

---

### Task 2: Add i18n strings, remove the now-unused delete-button string

**Files:**

- Modify: `public/i18n/us.json:760-784` (torrent-exists), `public/i18n/us.json:1471-1477`
  (behavior form labels), `public/i18n/us.json:1564-1581` (popovers)
- Modify: `public/i18n/hu.json` (same key paths, Hungarian copy)

**Interfaces:**

- Produces the translation keys consumed by Task 3 and Task 4:
  - `pages.settings.tab.general.general-settings-form.behavior.delete-torrent-on-duplicate`
  - `pages.settings.tab.general.popover.delete-torrent-on-duplicate.title`
  - `pages.settings.tab.general.popover.delete-torrent-on-duplicate.description`
- Removes: `components.modals.torrent-exists.button.delete-file` (and the now-empty `button`
  object it lived in).

This task is copy-only (JSON), so there's no unit test to drive it - the deliverable is verified
by JSON validity and by Task 3/4's template tests resolving these exact key paths.

- [ ] **Step 1: Remove the unused button string**

In `public/i18n/us.json`, inside `components.modals.torrent-exists` (around line 760), delete the
whole `"button"` object:

```diff
-        "button": {
-          "delete-file": "Delete Torrent File"
-        },
         "toast": {
```

Do the same in `public/i18n/hu.json` at the matching path (same line numbers - the two files are
kept in lockstep).

- [ ] **Step 2: Add the new switch label**

In `public/i18n/us.json`, inside
`pages.settings.tab.general.general-settings-form.behavior` (around line 1472-1477), add a new
key right after `delete-torrent-after-added`:

```diff
             "behavior": {
               "delete-torrent-after-added": "Delete torrent files after adding them to the list.",
+              "delete-torrent-on-duplicate": "Delete torrent files when the torrent already exists in the list.",
               "automatic-update": "Automatic updates",
```

In `public/i18n/hu.json` at the same path:

```diff
             "behavior": {
               "delete-torrent-after-added": "Torrent fájlok törlése a listához adás után.",
+              "delete-torrent-on-duplicate": "A torrent fájlok törlése, ha a torrent már szerepel a listában.",
               "automatic-update": "Automatikus frissítés",
```

- [ ] **Step 3: Add the new popover**

In `public/i18n/us.json`, inside `pages.settings.tab.general.popover` (around line 1564-1568),
add a new entry right after `deleting-torrent-file`:

```diff
           "popover": {
             "deleting-torrent-file": {
               "title": "Deleting Torrent File",
               "description": "Allowing the client to delete the .torrent file from your disk if it got added to the download list succesfully."
             },
+            "delete-torrent-on-duplicate": {
+              "title": "Delete Torrent File on Duplicate",
+              "description": "Automatically delete the .torrent file from your disk when it was already added to the download list. Requires \"Deleting Torrent File\" to be enabled."
+            },
             "open-at-login": {
```

In `public/i18n/hu.json` at the same path:

```diff
           "popover": {
             "deleting-torrent-file": {
               "title": "Torrent fájl törlése",
               "description": "Engedélyezi a kliensnek a .torrent fájl törlését a lemezről, ha az sikeresen bekerült a letöltési listába."
             },
+            "delete-torrent-on-duplicate": {
+              "title": "Torrent fájl törlése duplikátum esetén",
+              "description": "A .torrent fájl automatikus törlése a lemezről, ha az már hozzá lett adva a letöltési listához. A \"Torrent fájl törlése\" beállítást igényli."
+            },
             "open-at-login": {
```

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json','utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json','utf8')); console.log('ok')"`
Expected: prints `ok` with no error.

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#243: add i18n strings for delete-on-duplicate setting"
```

---

### Task 3: Add the new switch to the General settings page

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts:301-389`
- Modify: `packages/app/src/app/modals/settings/general/general.html:79-111`
- Test: `packages/app/src/app/modals/settings/general/general.spec.ts`

**Interfaces:**

- Consumes: `GeneralSettings.behavior.deleteTorrentFileOnDuplicate` (Task 1); translation keys
  `...behavior.delete-torrent-on-duplicate` and `...popover.delete-torrent-on-duplicate.*`
  (Task 2).
- Produces:
  `generalSettingsForm.controls.behavior.controls.deleteTorrentFileOnDuplicate: FormControl<boolean>`,
  which Task 4 does not touch but which must exist under this exact path for `save()`'s
  `getRawValue()` to serialize it.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/modals/settings/general/general.spec.ts`, add a new `describe` block
right after the existing `describe('startup form controls', ...)` block (after line 119):

```ts
describe('behavior form controls', () => {
  it('deleteTorrentFileOnDuplicate is enabled by default because deleteTorrentFile defaults to true', () => {
    expect(
      component.generalSettingsForm.controls.behavior.controls.deleteTorrentFileOnDuplicate.enabled,
    ).toBe(true);
  });

  it('deleteTorrentFileOnDuplicate is disabled and forced to false when deleteTorrentFile is turned off', () => {
    const behaviorGroup = component.generalSettingsForm.controls.behavior;
    behaviorGroup.controls.deleteTorrentFileOnDuplicate.setValue(true);

    behaviorGroup.controls.deleteTorrentFile.setValue(false);

    expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.value).toBe(false);
    expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.disabled).toBe(true);
  });

  it('deleteTorrentFileOnDuplicate is re-enabled, staying false, when deleteTorrentFile is turned back on', () => {
    const behaviorGroup = component.generalSettingsForm.controls.behavior;
    behaviorGroup.controls.deleteTorrentFile.setValue(false);

    behaviorGroup.controls.deleteTorrentFile.setValue(true);

    expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.enabled).toBe(true);
    expect(behaviorGroup.controls.deleteTorrentFileOnDuplicate.value).toBe(false);
  });
});

describe('behavior fieldset template', () => {
  it('renders the delete-on-duplicate switch, enabled because deleteTorrentFile defaults to true', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '#delete-torrent-on-duplicate',
    );

    expect(input).not.toBeNull();
    expect(input.disabled).toBe(false);
  });

  it('disables the delete-on-duplicate checkbox in the DOM when deleteTorrentFile is off', () => {
    component.generalSettingsForm.controls.behavior.controls.deleteTorrentFile.setValue(false);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '#delete-torrent-on-duplicate',
    );

    expect(input.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `deleteTorrentFileOnDuplicate` does not exist on the `behavior` control group,
and `#delete-torrent-on-duplicate` is not found in the DOM.

- [ ] **Step 3: Add the form control**

In `packages/app/src/app/modals/settings/general/general.ts`, update the `behavior` `FormGroup`
inside `generalSettingsForm` (currently lines 302-306):

```ts
    behavior: new FormGroup({
      deleteTorrentFile: new FormControl(true, { nonNullable: true }),
      deleteTorrentFileOnDuplicate: new FormControl(
        { value: false, disabled: true },
        { nonNullable: true },
      ),
      automaticUpdate: new FormControl(true, { nonNullable: true }),
      toastPosition: new FormControl<ToastPosition>('bottom-right', { nonNullable: true }),
    }),
```

- [ ] **Step 4: Wire the enable/disable coupling in the constructor**

In the `constructor()` (currently lines 330-354), add a second coupling subscription right after
the existing `startupGroup` one, before `this.stateService.registerSave(...)`:

```ts
const behaviorGroup = this.generalSettingsForm.controls.behavior;

behaviorGroup.controls.deleteTorrentFile.valueChanges
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((value) => {
    const ctrl = behaviorGroup.controls.deleteTorrentFileOnDuplicate;
    if (value) {
      ctrl.enable({ emitEvent: false });
    } else {
      ctrl.setValue(false, { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    }
  });
```

- [ ] **Step 5: Enable-on-load and force-off-on-save**

In the `settingsLoaded` pipeline (currently lines 356-370), add the enable-on-load branch right
after the existing `startMinimized` enable-on-load block, still inside the same `tap(...)`
callback:

```ts
const deleteTorrentFile = settings.behavior?.deleteTorrentFile ?? false;
if (deleteTorrentFile) {
  this.generalSettingsForm.controls.behavior.controls.deleteTorrentFileOnDuplicate.enable({
    emitEvent: false,
  });
}
```

In `save()` (currently lines 372-389), add the force-off guard right after the existing
`startMinimized` guard:

```ts
if (!settings.startup.openAtLogin) settings.startup.startMinimized = false;
if (!settings.behavior.deleteTorrentFile) settings.behavior.deleteTorrentFileOnDuplicate = false;
```

- [ ] **Step 6: Add the template switch**

In `packages/app/src/app/modals/settings/general/general.html`, inside the `behavior` fieldset
(currently lines 79-111), insert a new switch block right after the existing
`delete-torrent-file` switch's closing `</div>` (after line 111) and before the
`automatic-update` row (line 112):

```html
<div class="row mt-2 mb-3">
  <div class="col-12">
    <div class="form-check form-switch">
      <input
        class="form-check-input"
        type="checkbox"
        role="switch"
        id="delete-torrent-on-duplicate"
        formControlName="deleteTorrentFileOnDuplicate"
      />
      <label class="form-check-label" for="delete-torrent-on-duplicate"
        >{{ 'pages.settings.tab.general.general-settings-form.behavior.delete-torrent-on-duplicate'
        | translate }}

        <bb-popover
          [subject]="
                      'pages.settings.tab.general.popover.delete-torrent-on-duplicate.title'
                        | translate
                    "
          [description]="
                      'pages.settings.tab.general.popover.delete-torrent-on-duplicate.description'
                        | translate
                    "
        ></bb-popover>
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all new tests green, no regression in the existing `startup form controls` /
`save` suites.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: zero warnings.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.ts packages/app/src/app/modals/settings/general/general.html packages/app/src/app/modals/settings/general/general.spec.ts
git commit -m "#243: add delete-on-duplicate switch to general settings"
```

---

### Task 4: Auto-delete in the Torrent Exists modal, remove the manual button

**Files:**

- Modify: `packages/app/src/app/modals/torrent-exists/torrent-exists.ts`
- Modify: `packages/app/src/app/modals/torrent-exists/torrent-exists.html:108-122`
- Test: `packages/app/src/app/modals/torrent-exists/torrent-exists.spec.ts`

**Interfaces:**

- Consumes: `GeneralSettings.behavior.deleteTorrentFileOnDuplicate` (Task 1).
- No public interface produced for other tasks - this is the terminal consumer.

- [ ] **Step 1: Rewrite the test file's setup-dependent sections**

In `packages/app/src/app/modals/torrent-exists/torrent-exists.spec.ts`:

Remove the `describe('showDeleteButton', ...)` block (lines 151-161).

Remove the `describe('deleteTorrentFile', ...)` block (lines 163-209) and replace it with:

```ts
describe('auto-delete on duplicate', () => {
  it('does not call deleteFile when deleteTorrentFileOnDuplicate is off (the default in this suite)', async () => {
    const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile');

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).not.toHaveBeenCalled();
  });
});
```

Remove the `describe('delete button rendering', ...)` block (lines 281-348).

Remove the trailing
`describe('TorrentExists - showDeleteButton with deleteTorrentFile disabled', ...)` block
(lines 351-392).

Add a new top-level `describe` block at the end of the file (after the closing `});` of the main
`describe('TorrentExists', ...)` block), covering the enabled case:

```ts
describe('TorrentExists - auto-delete enabled', () => {
  let comp: TorrentExists;
  let fixture: ComponentFixture<TorrentExists>;
  let mockToastService: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockToastService = { success: vi.fn(), danger: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TorrentExists],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) as any } },
        { provide: SelectionStoreService, useValue: { setByHashes: vi.fn() } },
        { provide: FilterService, useValue: { filtered: signal([{ hash: 'abc123' } as Torrent]) } },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            asObservable: vi.fn().mockReturnValue(
              of({
                ...DEFAULT_GENERAL_SETTINGS,
                behavior: {
                  ...DEFAULT_GENERAL_SETTINGS.behavior,
                  deleteTorrentFile: true,
                  deleteTorrentFileOnDuplicate: true,
                },
              }),
            ),
          },
        },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentExists);
    comp = fixture.componentInstance;
  });

  it('automatically deletes the torrent file once originalPath is set', async () => {
    const deleteFileSpy = vi
      .spyOn(window.bitbutler.torrent, 'deleteFile')
      .mockResolvedValue({ ok: true });

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).toHaveBeenCalledWith({ path: '/tmp/test.torrent' });
    expect(comp.fileDeleted()).toBe(true);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('does not delete when originalPath is null', async () => {
    const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile');

    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).not.toHaveBeenCalled();
  });

  it('only attempts the delete once even if unrelated inputs change afterwards', async () => {
    const deleteFileSpy = vi
      .spyOn(window.bitbutler.torrent, 'deleteFile')
      .mockResolvedValue({ ok: true });

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('hash', 'abc123');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(deleteFileSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a danger toast with the raw error when deleteFile fails, and does not mark fileDeleted', async () => {
    vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockRejectedValue(new Error('disk error'));

    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(comp.fileDeleted()).toBe(false);
    expect(mockToastService.danger).toHaveBeenCalledWith(
      'disk error',
      'components.modals.torrent-exists.toast.delete-failed-title',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `deleteTorrentFileOnDuplicate` auto-delete never fires (component doesn't have
the effect yet), so `deleteFileSpy` is never called in the enabled-suite tests.

- [ ] **Step 3: Implement the component change**

Replace the full contents of `packages/app/src/app/modals/torrent-exists/torrent-exists.ts` with:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbProgress } from '../../components/bb-progress/bb-progress';
import { AutofocusDirective } from '../../directives/autofocus';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { RatioPipe } from '../../pipes/ratio-pipe';
import { CommandBusService } from '../../services/command-bus.service';
import { FilterService } from '../../services/filter.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { SelectionStoreService } from '../../services/selection-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

@Component({
  selector: 'app-torrent-exists',
  standalone: true,
  imports: [
    LocalTimestampPipe,
    FilesizePipe,
    RatioPipe,
    AutofocusDirective,
    TooltipOverflow,
    TimeagoPipe,
    NgbTooltip,
    TranslatePipe,
    BbProgress,
    BbBtnContent,
    FontAwesomeModule,
  ],
  styleUrls: ['./torrent-exists.scss'],
  templateUrl: './torrent-exists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentExists {
  readonly hash = input<string | null>(null);
  readonly originalPath = input<string | null>(null);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: null,
  });

  public icons = { faCircleInfo, faXmark };

  public readonly fileDeleted = signal(false);

  private hasAttemptedDelete = false;

  public readonly torrent = computed(() => {
    const h = this.hash();
    return h ? this.torrentStoreService.torrentsMap().get(h) : undefined;
  });

  constructor() {
    effect(() => {
      const h = this.hash();
      if (!h) return;

      const isVisible = this.filterService.filtered().some((t) => t.hash === h);
      if (!isVisible) return;

      this.selectionStoreService.setByHashes([h]);
      this.commandBusService.emit({ type: 'UI_SCROLL_TO_TORRENT', hash: h });
    });

    effect(() => {
      const settings = this.generalSettings();
      const path = this.originalPath();
      if (!settings || !path || this.hasAttemptedDelete) return;
      if (!settings.behavior.deleteTorrentFileOnDuplicate) return;

      this.hasAttemptedDelete = true;
      void this.deleteTorrentFile(path);
    });
  }

  private async deleteTorrentFile(path: string): Promise<void> {
    try {
      await window.bitbutler.torrent.deleteFile({ path });
      this.fileDeleted.set(true);
      this.toastService.success(
        this.translateService.instant('components.modals.torrent-exists.toast.deleted'),
        this.translateService.instant('components.modals.torrent-exists.toast.deleted-title'),
      );
    } catch (err: any) {
      console.error(TorrentExists.name, 'deleteTorrentFile', 'Failed to delete torrent file', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant('components.modals.torrent-exists.toast.delete-failed-title'),
      );
    }
  }

  public openDetails(): void {
    const h = this.hash();
    if (h) {
      this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: h });
    }
    this.closeModal();
  }

  public closeModal(): void {
    this.activeModal.close();
  }
}
```

- [ ] **Step 4: Remove the button from the template**

In `packages/app/src/app/modals/torrent-exists/torrent-exists.html`, delete the
`@if (showDeleteButton()) { ... }` block from the modal footer (currently lines 109-121), leaving:

```html
<div class="modal-footer d-flex flex-row">
  <button
    type="button"
    class="btn btn-dashed-info btn-sm btn-split ms-auto"
    (click)="openDetails()"
    autofocus
  >
    <bb-btn-content
      [icon]="icons.faCircleInfo"
      [text]="'general.button.open-details' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-sm btn-split" (click)="closeModal()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
      position="end"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS for both `TorrentExists` describe blocks.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: zero warnings (confirms `faTrashCan` and `showDeleteButton` are fully gone with no
dangling references).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/torrent-exists/torrent-exists.ts packages/app/src/app/modals/torrent-exists/torrent-exists.html packages/app/src/app/modals/torrent-exists/torrent-exists.spec.ts
git commit -m "#243: auto-delete torrent file on duplicate, remove manual button"
```

---

## Final verification

- [ ] Run the full suite once more: `npm run test --workspace=@bitbutler/app`
- [ ] Run `npm run lint` from the repo root (all workspaces)
- [ ] Manually exercise in the running app (see `run` skill / `npm start`): toggle "Delete torrent
      files after adding them to the list" off - the new switch should turn off and grey out; toggle
      it back on - the new switch should be selectable again; turn the new switch on, then trigger a
      duplicate-torrent add (add a `.torrent` file for a torrent already in the list) - the file
      should disappear from disk and a "Torrent File Deleted" toast should appear, with no delete
      button visible in the modal.
