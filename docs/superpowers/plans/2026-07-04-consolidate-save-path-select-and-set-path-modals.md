# Consolidate save-path select and set-path modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the baked-in popover out of `SavePathSelect`, merge the `SetTorrentLocation`/`SetDownloadPath` modals into one `SetPath` modal driven by a `pathType` input, and rename the remaining "location" identifiers to "save path" wording.

**Architecture:** `SavePathSelect` becomes a plain, fully input-driven ng-select/typeahead widget with no popover and no preference-fetching of its own. Every screen that renders it (the new `SetPath` modal, Add Torrent, server path-mapping settings, category manager, settings preview) owns its own popover and its own default-value fetching. `SetPath` mirrors the existing `TransferLimit` modal's `target: 'global' | 'torrent'` pattern via a `pathType: 'save' | 'download'` input.

**Tech Stack:** Angular 20 (zoneless, signals), Reactive Forms, `@ng-select/ng-select`, `@ng-bootstrap/ng-bootstrap`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Toast title = short Title-Case outcome description; toast message = the variable detail or a one-sentence confirmation. (CLAUDE.md)
- Commit format: `#204: short description` (this work is tracked under issue #204).
- Use `-` instead of `—` in all written output (commit messages, comments).
- `npm run lint` must pass with zero warnings before considering the branch done.
- Run `npm run test --workspace=@bitbutler/app` after each task to catch regressions across the whole app workspace (many shared files are touched).
- `qbService.torrents.setLocation()` and `qbService.torrents.setDownloadPath()` (in `packages/app/src/app/services/qb.service.ts`) are NOT renamed - they mirror qBittorrent's real API endpoint names. Both reject an empty/falsy path with an error (`location is required` / `path is required`) - the `SetPath` modal must never call them with an empty value.

---

## Task 1: Strip popover and preference-fetch out of `SavePathSelect`

**Files:**

- Modify: `packages/app/src/app/components/save-path-select/save-path-select.ts`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.html`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`

**Interfaces:**

- Produces: `SavePathSelect` inputs after this task: `autofocus: boolean`, `clearable: boolean`, `label: string | null`, `placeholder: string | null`, `appendTo: string`, `inputType: SavePathInputType | null`. The `showPopover` input no longer exists. `placeholder()` is the sole source of default/hint text (no more internal `defaultPath` fallback).

- [ ] **Step 1: Update the component class**

Replace the full contents of `packages/app/src/app/components/save-path-select/save-path-select.ts` with:

```ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { DEFAULT_GENERAL_SETTINGS, SavePathInputType } from '../../models/general-settings.model';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SavePathTypeaheadService } from './save-path-typeahead.service';

@Component({
  selector: 'app-save-path-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    NgbTypeahead,
    FontAwesomeModule,
    TranslatePipe,
  ],
  templateUrl: './save-path-select.html',
  styleUrls: ['./save-path-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SavePathSelect),
      multi: true,
    },
    SavePathTypeaheadService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavePathSelect implements ControlValueAccessor {
  readonly autofocus = input(false);
  readonly clearable = input(false);
  readonly label = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly appendTo = input('');
  readonly inputType = input<SavePathInputType | null>(null);

  private readonly ngselect = viewChild<NgSelectComponent>('ngselect');
  private readonly typeaheadInput = viewChild<ElementRef<HTMLInputElement>>('typeaheadInput');

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  public readonly typeaheadService = inject(SavePathTypeaheadService);

  public readonly icons = { faXmark };

  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: DEFAULT_GENERAL_SETTINGS,
  });

  public readonly resolvedInputType = computed(
    () => this.inputType() ?? this.generalSettings().savePath.inputType,
  );

  public paths = computed(
    () => {
      const uniquePaths = new Set<string>();
      for (const t of this.torrentStoreService.torrentsArray()) {
        const path = t.save_path?.trim();
        if (path) uniquePaths.add(path);
      }
      return Array.from(uniquePaths).sort();
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );

  public selectControl = new FormControl<string | null>(null);

  public readonly controlValue = toSignal(this.selectControl.valueChanges, {
    initialValue: this.selectControl.value,
  });

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });

    afterNextRender(() => {
      if (this.autofocus()) {
        this.ngselect()?.focus();
        this.typeaheadInput()?.nativeElement.focus();
      }
    });
  }

  writeValue(value: string | null): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term;

  public clearValue(): void {
    this.selectControl.setValue(null);
  }

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }
}
```

- [ ] **Step 2: Update the template**

Replace the full contents of `packages/app/src/app/components/save-path-select/save-path-select.html` with:

```html
@let resolvedLabel = label() ?? ('components.save-path-select.label' | translate); @if
(resolvedInputType() === 'typeahead') {
<div class="form-floating bb-filter-input">
  <input
    type="text"
    class="form-control"
    [placeholder]="placeholder() || ' '"
    [formControl]="selectControl"
    [ngbTypeahead]="typeaheadService.searchSavePaths"
    [editable]="true"
    [focusFirst]="false"
    autocomplete="off"
    #typeaheadInput
  />
  <label>{{ resolvedLabel }}</label>
  @if (controlValue()) {
  <button type="button" class="bb-filter-clear" (click)="clearValue()" aria-label="Clear">
    <fa-icon [icon]="icons.faXmark"></fa-icon>
  </button>
  }
</div>
} @else {
<div class="form-floating">
  <ng-select
    [items]="paths()"
    [addTag]="addTag"
    [searchable]="true"
    [clearable]="clearable()"
    [clearOnBackspace]="false"
    [editableSearchTerm]="true"
    [formControl]="selectControl"
    [keyDownFn]="keyDownFn"
    [openOnEnter]="false"
    [appendTo]="appendTo()"
    [placeholder]="placeholder() ?? ''"
    [fixedPlaceholder]="false"
    #ngselect
  >
  </ng-select>
  <label>{{ resolvedLabel }}</label>
</div>
}
```

- [ ] **Step 3: Remove the obsolete tests from the spec**

In `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`, delete the `it('should have showPopover true by default', ...)` test and the four `bb-popover`/`container-fluid` tests inside `describe('inputs', ...)`, leaving:

```ts
describe('inputs', () => {
  it('should have clearable false by default', () => {
    expect(component.clearable()).toBe(false);
  });

  it('should have label null by default', () => {
    expect(component.label()).toBeNull();
  });

  it('should have appendTo empty string by default', () => {
    expect(component.appendTo()).toBe('');
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All `SavePathSelect` tests pass. This will also break other specs that reference `showPopover` - that's expected and fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/save-path-select/save-path-select.ts packages/app/src/app/components/save-path-select/save-path-select.html packages/app/src/app/components/save-path-select/save-path-select.spec.ts
git commit -m "#204: strip popover and preference-fetch out of SavePathSelect"
```

---

## Task 2: Remove obsolete `showPopover` bindings from settings/general and manage-categories

These two screens never rendered a popover (they always passed `[showPopover]="false"`), so removing the binding is a pure cleanup with no behavior change.

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.html`
- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.html`

- [ ] **Step 1: Edit `settings/general.html`**

Change:

```html
<div class="col-6">
  <app-save-path-select [inputType]="'select'" [showPopover]="false" [clearable]="true" />
</div>
```

to:

```html
<div class="col-6">
  <app-save-path-select [inputType]="'select'" [clearable]="true" />
</div>
```

Change:

```html
<div class="col-6">
  <app-save-path-select [inputType]="'typeahead'" [showPopover]="false" />
</div>
```

to:

```html
<div class="col-6">
  <app-save-path-select [inputType]="'typeahead'" />
</div>
```

- [ ] **Step 2: Edit `manage-categories.html`**

Change:

```html
<app-save-path-select
  [showPopover]="false"
  [clearable]="true"
  [placeholder]="''"
  formControlName="savePath"
></app-save-path-select>
```

to:

```html
<app-save-path-select
  [clearable]="true"
  [placeholder]="''"
  formControlName="savePath"
></app-save-path-select>
```

Change:

```html
<app-save-path-select
  class="flex-grow-1"
  [showPopover]="false"
  [clearable]="true"
  [placeholder]="''"
  [label]="item.name"
  [formControl]="editSavePathControl"
  appendTo="body"
></app-save-path-select>
```

to:

```html
<app-save-path-select
  class="flex-grow-1"
  [clearable]="true"
  [placeholder]="''"
  [label]="item.name"
  [formControl]="editSavePathControl"
  appendTo="body"
></app-save-path-select>
```

- [ ] **Step 3: Run the tests**

Run: `npm run test --workspace=@bitbutler/app`
Expected: `general.spec.ts` (settings) and `manage-categories.spec.ts` pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/modals/settings/general/general.html packages/app/src/app/modals/manage-categories/manage-categories.html
git commit -m "#204: remove obsolete showPopover bindings from settings and manage-categories"
```

---

## Task 3: Give `AddTorrentGeneral` its own default-save-path fetch and popover

Previously `SavePathSelect` fetched the global `save_path` preference itself and used it as a placeholder fallback. Now that fetch moves to the consumer. `AddTorrentGeneral`'s test module already provides `QbService`/`ServerStoreService` (it was previously needed by the nested `SavePathSelect`), so no new test providers are required.

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/general.ts`
- Modify: `packages/app/src/app/modals/add-torrent/general/general.html`
- Modify: `packages/app/src/app/modals/add-torrent/general/general.spec.ts`

**Interfaces:**

- Produces: `AddTorrentGeneral.defaultSavePath: Signal<string>` - the fetched global `save_path` preference (empty string if unavailable).

- [ ] **Step 1: Add a failing test for the default-save-path fetch**

In `packages/app/src/app/modals/add-torrent/general/general.spec.ts`, add inside the top-level `describe('AddTorrentGeneral', ...)` block (after the `ensureCategoryExists` describe block):

```ts
describe('defaultSavePath', () => {
  it('should resolve to the preferences save_path after construction', async () => {
    await fixture.whenStable();
    expect(component.defaultSavePath()).toBe('/downloads');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=**/add-torrent/general/general.spec.ts`
Expected: FAIL - `component.defaultSavePath is not a function`

(If `--include` isn't supported by the configured runner, run the full suite instead: `npm run test --workspace=@bitbutler/app` and confirm this specific test fails.)

- [ ] **Step 3: Implement the fetch in the component**

Replace the full contents of `packages/app/src/app/modals/add-torrent/general/general.ts` with:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { faFile, faFolderOpen, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { CategorySelect } from '../../../components/category-select/category-select';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { TagSelect } from '../../../components/tag-select/tag-select';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

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
  public inputMode = input.required<'file' | 'link'>();
  public inputModeChange = output<'file' | 'link'>();
  public fileSelected = output<Event>();

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly categorySelect = viewChild(CategorySelect);

  public readonly defaultSavePath = signal<string>('');

  constructor() {
    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      this.qbService.app
        .preferences(serverId)
        .then((prefs) => {
          if (prefs.save_path) this.defaultSavePath.set(prefs.save_path);
        })
        .catch(() => {});
    }
  }

  public ensureCategoryExists(): Promise<boolean> | undefined {
    return this.categorySelect()?.ensureCategoryExists();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: The new `defaultSavePath` test passes.

- [ ] **Step 5: Add the popover and placeholder binding to the template**

In `packages/app/src/app/modals/add-torrent/general/general.html`, replace:

```html
<div class="col-12">
  <div class="mb-3">
    <app-save-path-select
      formControlName="savepath"
      appendTo="body"
      [autofocus]="true"
      [clearable]="true"
    ></app-save-path-select>
  </div>
</div>
```

with:

```html
<div class="col-11">
  <div class="mb-3">
    <app-save-path-select
      formControlName="savepath"
      appendTo="body"
      [autofocus]="true"
      [clearable]="true"
      [placeholder]="defaultSavePath()"
    ></app-save-path-select>
  </div>
</div>

<div class="col-1 d-flex align-items-center mb-3">
  <bb-popover
    class="mt-2"
    [subject]="'components.save-path-select.popover.title' | translate"
    [description]="savePathPopover"
    placement="left"
  ></bb-popover>
</div>
```

Then add a new `ng-template` alongside the existing ones at the bottom of the same file (after `#inputModePopover`'s closing tag):

```html
<ng-template #savePathPopover>
  <p>{{ 'components.save-path-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.save-path-select.popover.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 6: Update the popover-count test comment**

In `general.spec.ts`, the existing test still passes with the same total (one popover moved from being nested-only to being both direct-and-nested elsewhere, net count unchanged: 4 direct in `general.html` - input-mode, file/links, name, save-path - plus 2 nested from `CategorySelect`/`TagSelect` = 6). Update the stale comment so it doesn't reference the now-removed internal `SavePathSelect` popover:

```ts
it('should make the input-mode toggle full width and show a popover beside it', () => {
  const toggle: HTMLElement = fixture.nativeElement.querySelector('.btn-group');

  expect(toggle.classList.contains('w-100')).toBe(true);

  // 4 popovers defined directly in general.html (input-mode, file/links, name, save-path)
  // plus 1 each from the nested category/tag select components.
  expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(6);
});
```

- [ ] **Step 7: Run all tests**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All `AddTorrentGeneral` tests pass, popover count still 6.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general/general.ts packages/app/src/app/modals/add-torrent/general/general.html packages/app/src/app/modals/add-torrent/general/general.spec.ts
git commit -m "#204: give AddTorrentGeneral its own default save path and popover"
```

---

## Task 4: Make `Server`'s default remote path reactive and bind it as a placeholder

**Files:**

- Modify: `packages/app/src/app/modals/settings/server/server.ts`
- Modify: `packages/app/src/app/modals/settings/server/server.html`
- Modify: `packages/app/src/app/modals/settings/server/server.spec.ts`

**Interfaces:**

- Produces: `Server.defaultRemotePath: Signal<string>` (previously a plain private field, now a signal so it can be bound in the template).

- [ ] **Step 1: Convert the field to a signal**

In `packages/app/src/app/modals/settings/server/server.ts`, change the import line:

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, NgZone, inject } from '@angular/core';
```

to:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  inject,
  signal,
} from '@angular/core';
```

Change:

```ts
  private defaultRemotePath = '';
```

to:

```ts
  private readonly defaultRemotePath = signal('');
```

Change:

```ts
const serverId = this.serverStoreService.currentServerId();
if (serverId) {
  this.qbService.app
    .preferences(serverId)
    .then((prefs) => {
      if (prefs.save_path) this.defaultRemotePath = prefs.save_path;
    })
    .catch(() => {});
}
```

to:

```ts
const serverId = this.serverStoreService.currentServerId();
if (serverId) {
  this.qbService.app
    .preferences(serverId)
    .then((prefs) => {
      if (prefs.save_path) this.defaultRemotePath.set(prefs.save_path);
    })
    .catch(() => {});
}
```

Change:

```ts
      pathMappings: raw.pathMappings.map((m) => ({
        remote: m.remote || this.defaultRemotePath,
        local: m.local,
      })),
```

to:

```ts
      pathMappings: raw.pathMappings.map((m) => ({
        remote: m.remote || this.defaultRemotePath(),
        local: m.local,
      })),
```

- [ ] **Step 2: Bind the placeholder and drop the obsolete `showPopover` binding in the template**

In `packages/app/src/app/modals/settings/server/server.html`, change:

```html
<app-save-path-select
  [showPopover]="false"
  [clearable]="true"
  [label]="
                    'pages.settings.tab.server.server-settings-form.path-mapping.remote-path'
                      | translate
                  "
  formControlName="remote"
></app-save-path-select>
```

to:

```html
<app-save-path-select
  [clearable]="true"
  [label]="
                    'pages.settings.tab.server.server-settings-form.path-mapping.remote-path'
                      | translate
                  "
  [placeholder]="defaultRemotePath()"
  formControlName="remote"
></app-save-path-select>
```

- [ ] **Step 3: Update the spec to use the signal API**

In `packages/app/src/app/modals/settings/server/server.spec.ts`, change both occurrences of:

```ts
(component as any).defaultRemotePath = '/default/downloads';
```

to:

```ts
(component as any).defaultRemotePath.set('/default/downloads');
```

- [ ] **Step 4: Run the tests**

Run: `npm run test --workspace=@bitbutler/app`
Expected: `server.spec.ts` passes, including the two `save` describe-block tests.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/settings/server/server.ts packages/app/src/app/modals/settings/server/server.html packages/app/src/app/modals/settings/server/server.spec.ts
git commit -m "#204: make Server's default remote path reactive and bind it as a placeholder"
```

---

## Task 5: Rename "location" identifiers to "save path"

Renames the command type, context-menu item id, and torrent-details action method to match the already-renamed "Set Save Path" user-facing label. `qbService.torrents.setLocation()` itself is untouched (mirrors qBittorrent's real API name).

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.html`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Produces: `UiCommand` union member renamed from `{ type: 'UI_SET_TORRENT_LOCATION'; torrent: Torrent; hashes?: string[] }` to `{ type: 'UI_SET_SAVE_PATH'; torrent: Torrent; hashes?: string[] }`. `TorrentDetailsActionsService.setLocation()` renamed to `TorrentDetailsActionsService.setSavePath()`.

- [ ] **Step 1: Rename the command type**

In `packages/app/src/app/models/command.model.ts`, change:

```ts
  | { type: 'UI_SET_TORRENT_LOCATION'; torrent: Torrent; hashes?: string[] }
```

to:

```ts
  | { type: 'UI_SET_SAVE_PATH'; torrent: Torrent; hashes?: string[] }
```

- [ ] **Step 2: Rename the context-menu item id, label key, and emitted type**

In `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`, change:

```ts
          {
            kind: 'item',
            id: 'files.setLocation',
            label: 'pages.main.grid.context-menu.item.set-location',
            icon: faFolder,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_LOCATION',
                torrent: data.row,
                hashes,
              }),
          },
```

to:

```ts
          {
            kind: 'item',
            id: 'files.setSavePath',
            label: 'pages.main.grid.context-menu.item.set-save-path',
            icon: faFolder,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_SAVE_PATH',
                torrent: data.row,
                hashes,
              }),
          },
```

- [ ] **Step 3: Update the context-menu spec**

In `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`, change:

```ts
it('files.setLocation action emits UI_SET_TORRENT_LOCATION with the torrent and selected hashes', async () => {
  const row = makeRow();
  const entries = await service.buildTorrentMenu(makeData({ row }));
  (findItem(entries, 'files.setLocation')!.action as () => void)();
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'UI_SET_TORRENT_LOCATION',
    torrent: row,
    hashes: [row.hash],
  });
});
```

to:

```ts
it('files.setSavePath action emits UI_SET_SAVE_PATH with the torrent and selected hashes', async () => {
  const row = makeRow();
  const entries = await service.buildTorrentMenu(makeData({ row }));
  (findItem(entries, 'files.setSavePath')!.action as () => void)();
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'UI_SET_SAVE_PATH',
    torrent: row,
    hashes: [row.hash],
  });
});
```

- [ ] **Step 4: Rename the torrent-details action method**

In `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts`, change:

```ts
  public setLocation(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_LOCATION',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }
```

to:

```ts
  public setSavePath(): void {
    this.commandBusService.emit({
      type: 'UI_SET_SAVE_PATH',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }
```

- [ ] **Step 5: Update the torrent-details-actions spec**

In `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts`, change:

```ts
describe('setLocation', () => {
  it('emits UI_SET_TORRENT_LOCATION with the current torrent and hash', () => {
    service.setLocation();
    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_SET_TORRENT_LOCATION',
      torrent: mockDataService.torrent()!.data,
      hashes: ['abc123'],
    });
  });
});
```

to:

```ts
describe('setSavePath', () => {
  it('emits UI_SET_SAVE_PATH with the current torrent and hash', () => {
    service.setSavePath();
    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_SET_SAVE_PATH',
      torrent: mockDataService.torrent()!.data,
      hashes: ['abc123'],
    });
  });
});
```

- [ ] **Step 6: Update the torrent-details dropdown button and its mock**

In `packages/app/src/app/modals/torrent-details/torrent-details.html`, change:

```html
<button ngbDropdownItem type="button" (click)="actionsService.setLocation()">
  <span class="bb-dropdown-icon" aria-hidden="true"
    ><fa-icon [icon]="icon.faFolder"></fa-icon
  ></span>
  {{ 'components.modals.torrent-details.general.relocate' | translate }}
</button>
```

to:

```html
<button ngbDropdownItem type="button" (click)="actionsService.setSavePath()">
  <span class="bb-dropdown-icon" aria-hidden="true"
    ><fa-icon [icon]="icon.faFolder"></fa-icon
  ></span>
  {{ 'components.modals.torrent-details.general.set-save-path' | translate }}
</button>
```

In `packages/app/src/app/modals/torrent-details/torrent-details.spec.ts`, change:

```ts
      setLocation: vi.fn(),
```

to:

```ts
      setSavePath: vi.fn(),
```

- [ ] **Step 7: Rename the i18n keys in both locale files**

In `public/i18n/us.json`:

- Line 1085: change `"set-location": "Set Save Path",` to `"set-save-path": "Set Save Path",`
- Line 328: change `"relocate": "Set Save Path",` to `"set-save-path": "Set Save Path",`

In `public/i18n/hu.json`:

- Line 1085: change `"set-location": "Mentési útvonal beállítása",` to `"set-save-path": "Mentési útvonal beállítása",`
- Line 328: change `"relocate": "Mentési útvonal beállítása",` to `"set-save-path": "Mentési útvonal beállítása",`

(Do not touch the unrelated `tmm-behavior.relocate` key near line 1608 in either file - it's a different feature, "Relocate torrents" for Auto TMM behavior.)

- [ ] **Step 8: Run the tests**

Run: `npm run test --workspace=@bitbutler/app`
Expected: `grid-context-menu.service.spec.ts`, `torrent-details-actions.service.spec.ts`, and `torrent-details.spec.ts` pass.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/models/command.model.ts packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts packages/app/src/app/modals/torrent-details/torrent-details.html packages/app/src/app/modals/torrent-details/torrent-details.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#204: rename location identifiers to save path"
```

Note: this commit intentionally leaves `UiCommandHandlerService`'s `case 'UI_SET_TORRENT_LOCATION':` referencing the now-renamed type - TypeScript will flag it as an unreachable/invalid case. That's fixed in Task 6 when the handler is rewired to the new `SetPath` modal. If your editor/build blocks the intermediate state, that's expected until Task 6 lands; the plan is still safe to execute sequentially since each task's tests are scoped to the files it touches.

---

## Task 6: Create the merged `SetPath` modal and wire it into `UiCommandHandlerService`

Replaces `SetTorrentLocation` and `SetDownloadPath` with one modal driven by `pathType: 'save' | 'download'`, matching the `TransferLimit` modal's `target` pattern. Fixes the download-path modal's size (now `lg`/`centered` like the save-path flow) and the empty-download-path bug (`qbService.torrents.setDownloadPath()` rejects an empty path, so an empty value now closes the modal without calling the API instead of silently doing nothing). Creating the modal and rewiring the handler are combined into one task because deleting the old modals leaves `UiCommandHandlerService` referencing dead imports until it's rewired - splitting them would leave a commit that doesn't compile.

**Files:**

- Create: `packages/app/src/app/modals/set-path/set-path.ts`
- Create: `packages/app/src/app/modals/set-path/set-path.html`
- Create: `packages/app/src/app/modals/set-path/set-path.scss`
- Create: `packages/app/src/app/modals/set-path/set-path.spec.ts`
- Delete: `packages/app/src/app/modals/set-torrent-location/set-torrent-location.ts`
- Delete: `packages/app/src/app/modals/set-torrent-location/set-torrent-location.html`
- Delete: `packages/app/src/app/modals/set-torrent-location/set-torrent-location.scss`
- Delete: `packages/app/src/app/modals/set-torrent-location/set-torrent-location.spec.ts`
- Delete: `packages/app/src/app/modals/set-download-path/set-download-path.ts`
- Delete: `packages/app/src/app/modals/set-download-path/set-download-path.html`
- Delete: `packages/app/src/app/modals/set-download-path/set-download-path.scss`
- Delete: `packages/app/src/app/modals/set-download-path/set-download-path.spec.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Produces: `SetPath` component, selector `app-set-path`, inputs `torrent: Torrent` (required), `hashes: string[]` (default `[]`), `pathType: 'save' | 'download'` (required). Exported type `SetPathType = 'save' | 'download'`, consumed by `UiCommandHandlerService` later in this same task.
- Consumes: `SavePathSelect` (Task 1's popover-free version), `BbPopover`, `BbBtnContent`, `TooltipOverflow` (all existing, unchanged).

- [ ] **Step 1: Write the failing spec first**

Create `packages/app/src/app/modals/set-path/set-path.spec.ts`:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../models/torrent.model';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SetPath } from './set-path';

describe('SetPath', () => {
  let component: SetPath;
  let fixture: ComponentFixture<SetPath>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: {
    torrents: {
      setLocation: ReturnType<typeof vi.fn>;
      setDownloadPath: ReturnType<typeof vi.fn>;
    };
    app: { preferences: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      torrents: {
        setLocation: vi.fn().mockResolvedValue(undefined),
        setDownloadPath: vi.fn().mockResolvedValue(undefined),
      },
      app: { preferences: vi.fn().mockResolvedValue({}) },
    };

    await TestBed.configureTestingModule({
      imports: [SetPath],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetPath);
    component = fixture.componentInstance;
  });

  function setup(pathType: 'save' | 'download', torrent: Partial<Torrent>, hashes = ['hash-1']) {
    fixture.componentRef.setInput('torrent', torrent as Torrent);
    fixture.componentRef.setInput('hashes', hashes);
    fixture.componentRef.setInput('pathType', pathType);
    fixture.detectChanges();
  }

  it('should create', () => {
    setup('save', { save_path: '/downloads' });
    expect(component).toBeTruthy();
  });

  describe('pathType: save', () => {
    beforeEach(() => {
      setup('save', { save_path: '/downloads' });
    });

    it('should pre-fill the path field with the torrent save path', () => {
      expect(component.form.get('path')?.value).toBe('/downloads');
    });

    it('should use the form path when it has a value', async () => {
      component.form.get('path')?.setValue('/custom/path');
      await component.handleSubmit();
      expect(mockQbService.torrents.setLocation).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/custom/path',
      );
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('should fall back to torrent.save_path when form path is cleared and no default', async () => {
      component.form.get('path')?.setValue(null);
      await component.handleSubmit();
      expect(mockQbService.torrents.setLocation).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/downloads',
      );
    });
  });

  describe('pathType: download', () => {
    beforeEach(() => {
      setup('download', { download_path: '/tmp/downloads' });
    });

    it('should pre-fill the path field with the torrent download path', () => {
      expect(component.form.get('path')?.value).toBe('/tmp/downloads');
    });

    it('should not fetch a global default save path', () => {
      expect(mockQbService.app.preferences).not.toHaveBeenCalled();
    });

    it('calls setDownloadPath with the form path and closes the modal', async () => {
      component.form.get('path')?.setValue('/new/download/path');
      await component.handleSubmit();
      expect(mockQbService.torrents.setDownloadPath).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/new/download/path',
      );
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('closes the modal without calling the API when the path is cleared', async () => {
      component.form.get('path')?.setValue(null);
      await component.handleSubmit();
      expect(mockQbService.torrents.setDownloadPath).not.toHaveBeenCalled();
      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });

  describe('canSave', () => {
    it('should always return true', () => {
      setup('save', { save_path: '/downloads' });
      expect(component.canSave()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `Cannot find module './set-path'` (the component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `packages/app/src/app/modals/set-path/set-path.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../components/bb-popover/bb-popover';
import { SavePathSelect } from '../../components/save-path-select/save-path-select';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { Torrent } from '../../models/torrent.model';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';

export type SetPathType = 'save' | 'download';

@Component({
  selector: 'app-set-path',
  imports: [
    ReactiveFormsModule,
    SavePathSelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
    BbPopover,
  ],
  templateUrl: './set-path.html',
  styleUrl: './set-path.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPath implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);
  readonly pathType = input.required<SetPathType>();

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  public icons = { faFloppyDisk, faXmark };

  public form = new FormGroup({
    path: new FormControl<string | null>(null),
  });

  public readonly selected = computed(() => this.hashes().length);
  public readonly defaultSavePath = signal<string>('');

  public async ngOnInit(): Promise<void> {
    const initialPath =
      this.pathType() === 'save' ? this.torrent().save_path : this.torrent().download_path;
    this.form.get('path')?.patchValue(initialPath || null);

    if (this.pathType() === 'save') {
      const serverId = this.serverStoreService.currentServerId();
      if (serverId) {
        try {
          const prefs = await this.qbService.app.preferences(serverId);
          if (prefs.save_path) this.defaultSavePath.set(prefs.save_path);
        } catch {}
      }
    }
  }

  public async handleSubmit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';

    if (!serverId) {
      console.error(SetPath.name, 'handleSubmit', 'Failed to get server id');
      return;
    }

    if (this.pathType() === 'save') {
      const newPath =
        this.form.get('path')?.value || this.defaultSavePath() || this.torrent().save_path;

      if (!newPath) {
        console.error(SetPath.name, 'handleSubmit', 'New path is invalid!');
        return;
      }

      try {
        await this.qbService.torrents.setLocation(serverId, this.hashes(), newPath);
        this.activeModal.close();
      } catch (error: any) {
        console.error(SetPath.name, 'handleSubmit', 'Failed to set save path!', error);
        this.toastService.danger(
          error.message,
          this.translateService.instant('components.modals.set-path.error.save-failed'),
        );
      }
      return;
    }

    const newPath = this.form.get('path')?.value;

    if (!newPath) {
      this.activeModal.close();
      return;
    }

    try {
      await this.qbService.torrents.setDownloadPath(serverId, this.hashes(), newPath);
      this.activeModal.close();
    } catch (error: any) {
      console.error(SetPath.name, 'handleSubmit', 'Failed to set download path!', error);
      this.toastService.danger(
        error.message,
        this.translateService.instant('components.modals.set-path.error.download-failed'),
      );
    }
  }

  public canSave(): boolean {
    return true;
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/modals/set-path/set-path.html`:

```html
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5 class="modal-title bb-title-clamp">
      {{ (pathType() === 'save' ? 'components.modals.set-path.title.save' :
      'components.modals.set-path.title.download' ) | translate }}
    </h5>

    <div
      #element
      class="small text-body-secondary mt-1 bb-hash-clamp"
      [ngbTooltip]="selected() === 1 ? torrent().name : null"
      bbTooltipOverflow
      tooltipClass="single-line-tooltip"
      placement="bottom"
    >
      @if (selected() > 1) { {{ 'general.label.torrent-selected' | translate: { count: selected() }
      }} } @else { {{ torrent().name }} }
    </div>
  </div>

  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>
<div class="modal-body">
  <form [formGroup]="form" (submit)="handleSubmit()">
    <div class="container-fluid">
      <div class="row">
        <div class="col-11">
          <app-save-path-select
            formControlName="path"
            [autofocus]="true"
            [clearable]="true"
            [placeholder]="pathType() === 'save' ? defaultSavePath() : ''"
          ></app-save-path-select>
        </div>

        <div class="col-1 d-flex align-items-center">
          @if (pathType() === 'save') {
          <bb-popover
            [subject]="'components.save-path-select.popover.title' | translate"
            [description]="savePathPopover"
            placement="left"
          ></bb-popover>
          } @else {
          <bb-popover
            [subject]="'components.modals.set-path.popover.download-path.title' | translate"
            [description]="downloadPathPopover"
            placement="left"
          ></bb-popover>
          }
        </div>
      </div>
    </div>
    <button type="submit" hidden [disabled]="!canSave()"></button>
  </form>
</div>
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-sm btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-sm btn-split" (click)="activeModal.close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
      position="end"
    ></bb-btn-content>
  </button>
</div>

<ng-template #savePathPopover>
  <p>{{ 'components.save-path-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.save-path-select.popover.description.line2' | translate }}</p>
</ng-template>

<ng-template #downloadPathPopover>
  <p>{{ 'components.modals.set-path.popover.download-path.description.line1' | translate }}</p>
  <p>{{ 'components.modals.set-path.popover.download-path.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 5: Create the empty stylesheet**

Create `packages/app/src/app/modals/set-path/set-path.scss` with empty content (matching the style of the deleted `set-torrent-location.scss`/`set-download-path.scss`).

- [ ] **Step 6: Add the i18n entries**

In `public/i18n/us.json`, replace the `"set-torrent-location": { ... }` block (lines 292-300) with:

```json
      "set-path": {
        "title": {
          "save": "Set Save Path",
          "download": "Set Download Path"
        },
        "error": {
          "save-failed": "Failed to Set Save Path",
          "download-failed": "Failed to Set Download Path"
        },
        "popover": {
          "download-path": {
            "title": "Download Path",
            "description": {
              "line1": "A temporary location used only while the torrent is downloading.",
              "line2": "Leave blank if you don't want to override the default download location for this torrent."
            }
          }
        }
      },
```

Then delete the now-redundant `"set-download-path": { ... }` block (originally lines 307-312, title/error already covered by the new `set-path` node above).

Apply the equivalent change in `public/i18n/hu.json`, replacing the `"set-torrent-location": { ... }` block with:

```json
      "set-path": {
        "title": {
          "save": "Mentési útvonal beállítása",
          "download": "Letöltési útvonal beállítása"
        },
        "error": {
          "save-failed": "Nem sikerült beállítani a mentési útvonalat",
          "download-failed": "Nem sikerült beállítani a letöltési útvonalat"
        },
        "popover": {
          "download-path": {
            "title": "Letöltési útvonal",
            "description": {
              "line1": "Egy ideiglenes hely, amelyet csak a torrent letöltése közben használ a rendszer.",
              "line2": "Hagyja üresen, ha nem szeretné felülírni ennél a torrentnél az alapértelmezett letöltési helyet."
            }
          }
        }
      },
```

and deleting the `"set-download-path": { ... }` block there too.

- [ ] **Step 7: Delete the old modal directories**

```bash
git rm -r packages/app/src/app/modals/set-torrent-location packages/app/src/app/modals/set-download-path
```

- [ ] **Step 8: Run the tests**

Run: `npm run test --workspace=@bitbutler/app`
Expected: `set-path.spec.ts` passes. `ui-command-handler.service.spec.ts` will fail to compile because it still imports the deleted `set-torrent-location` module and references the old command type/modal - continue directly to the next steps in this same task to fix that before committing.

- [ ] **Step 9: Update the pre-warmed import list in `ui-command-handler.service.spec.ts`**

In `packages/app/src/app/services/ui-command-handler.service.spec.ts`, change:

```ts
      import('../modals/set-torrent-location/set-torrent-location'),
```

to:

```ts
      import('../modals/set-path/set-path'),
```

- [ ] **Step 10: Add failing tests for both path-type flows**

In the same file, add these two tests after `it('should open ServerEditor modal for UI_SERVER_EDITOR_OPEN', ...)`:

```ts
it('should open SetPath modal with pathType "save" for UI_SET_SAVE_PATH', async () => {
  commands$.next({ type: 'UI_SET_SAVE_PATH', torrent: { hash: 'abc' } });
  await flushPromises();
  expect(mockModalService.open).toHaveBeenCalled();
  expect(setInputSpy).toHaveBeenCalledWith('pathType', 'save');
});

it('should open SetPath modal with pathType "download" for UI_SET_DOWNLOAD_PATH', async () => {
  commands$.next({ type: 'UI_SET_DOWNLOAD_PATH', torrent: { hash: 'abc' } });
  await flushPromises();
  expect(mockModalService.open).toHaveBeenCalled();
  expect(setInputSpy).toHaveBeenCalledWith('pathType', 'download');
});
```

- [ ] **Step 11: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - the two new tests fail (and the file fails to compile) because the handler still imports the deleted `set-torrent-location` module and there is no `UI_SET_SAVE_PATH` case.

- [ ] **Step 12: Replace the two modal-opening cases**

In `packages/app/src/app/services/ui-command-handler.service.ts`, replace:

```ts
          case 'UI_SET_TORRENT_LOCATION': {
            if (!command.torrent) return;
            const { SetTorrentLocation } =
              await import('../modals/set-torrent-location/set-torrent-location');
            if (this.isModalOpen(SetTorrentLocation)) break;

            const setLocationModalRef = this.modalService.open(SetTorrentLocation, {
              size: 'lg',
              centered: true,
            });

            setModalInput(setLocationModalRef, 'torrent', command.torrent);
            setModalInput(
              setLocationModalRef,
              'hashes',
              command.hashes ?? this.selectionStoreService.selectedHashes(),
            );
            setLocationModalRef.result.catch(() => {});
            break;
          }

          case 'UI_SET_DOWNLOAD_PATH': {
            const setDownloadPathModalRef = this.modalService.open(
              (await import('../modals/set-download-path/set-download-path')).SetDownloadPath,
              { size: 'md' },
            );
            setModalInput(setDownloadPathModalRef, 'torrent', command.torrent);
            setModalInput(
              setDownloadPathModalRef,
              'hashes',
              command.hashes ?? [command.torrent.hash],
            );
            setDownloadPathModalRef.result.catch(() => {});
            break;
          }
```

with:

```ts
          case 'UI_SET_SAVE_PATH': {
            if (!command.torrent) return;
            const { SetPath } = await import('../modals/set-path/set-path');
            if (this.isModalOpen(SetPath)) break;

            const setPathModalRef = this.modalService.open(SetPath, {
              size: 'lg',
              centered: true,
            });

            setModalInput(setPathModalRef, 'torrent', command.torrent);
            setModalInput(
              setPathModalRef,
              'hashes',
              command.hashes ?? this.selectionStoreService.selectedHashes(),
            );
            setModalInput(setPathModalRef, 'pathType', 'save');
            setPathModalRef.result.catch(() => {});
            break;
          }

          case 'UI_SET_DOWNLOAD_PATH': {
            const { SetPath } = await import('../modals/set-path/set-path');
            if (this.isModalOpen(SetPath)) break;

            const setPathModalRef = this.modalService.open(SetPath, {
              size: 'lg',
              centered: true,
            });

            setModalInput(setPathModalRef, 'torrent', command.torrent);
            setModalInput(setPathModalRef, 'hashes', command.hashes ?? [command.torrent.hash]);
            setModalInput(setPathModalRef, 'pathType', 'download');
            setPathModalRef.result.catch(() => {});
            break;
          }
```

- [ ] **Step 13: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: All tests pass, including the two new ones from Step 10.

- [ ] **Step 14: Commit**

```bash
git add packages/app/src/app/modals/set-path packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/ui-command-handler.service.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#204: merge set-torrent-location and set-download-path into SetPath modal"
```

---

## Task 7: Full verification pass

**Files:** None (verification only).

- [ ] **Step 1: Run the full lint check**

Run: `npm run lint`
Expected: No errors, zero warnings (per `max-warnings=0`).

- [ ] **Step 2: Run the full test suite across all workspaces**

Run: `npm test`
Expected: All tests pass in `@bitbutler/app`, `@bitbutler/electron`, and `@bitbutler/shared`.

- [ ] **Step 3: Manual smoke test in the running app**

Run: `npm start`

In the app:

1. Right-click a torrent in the grid -> Files -> "Set Save Path". Confirm the modal is `lg`-sized and centered, the field pre-fills with the torrent's current save path, the popover appears at the right of the field (col-11/col-1 split), and saving with a new path succeeds (check the row's save path updates).
2. Right-click a torrent -> Files -> "Set Download Path". Confirm the modal is now the same `lg` size as "Set Save Path" (previously `md`), the field pre-fills with the torrent's download path (may be empty), the popover describes the temporary download path concept, and:
   - Entering a path and saving succeeds.
   - Clearing the field (if it had a value) and saving closes the modal without an error toast (the empty-value fix).
3. Open the same two flows from the Torrent Details modal's dropdown menu (top-right actions) - confirm identical behavior and that the button label reads "Set Save Path" (not "Set Location").
4. Open "Add Torrent" - confirm the save-path field still shows the same widget with autofocus, a placeholder hinting the global default save path, and its own popover to the right (col-11/col-1).
5. Open Settings -> Server tab -> Path Mappings - confirm the remote-path field still placeholders the global default save path and has no popover directly on the field (fieldset-level popover remains as before).
6. Open Settings -> General tab -> Save Path Input section - confirm both the "select" and "typeahead" preview widgets still render with no popover.
7. Open Manage Categories - confirm the save-path fields (add form and inline edit) still work with no popover.

Expected: All flows work as described, no console errors, no regressions in any of the six original `SavePathSelect` consumers.

- [ ] **Step 4: Report completion**

If all checks pass, the branch is ready for `superpowers:finishing-a-development-branch` (removing the `docs/superpowers` folder before opening the PR, per this repo's convention).
