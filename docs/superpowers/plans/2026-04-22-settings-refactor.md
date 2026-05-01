# Settings & TorrentDetails Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Settings and TorrentDetails modals to pre-load all tabs in parallel, keep them alive in the DOM with CSS animation, add an explicit Save button with unsaved-change guard to Settings, and delay theme changes until Save.

**Architecture:** A new `SettingsStateService` (provided at the `Settings` component level) tracks per-tab dirty state and holds save callbacks registered by each tab on init. Both modals pre-load all tab components in parallel on `ngOnInit`, store them in a `Map` signal, and render all panels simultaneously — hiding inactive ones with CSS opacity transitions rather than destroying them.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-bootstrap/ng-bootstrap` modals, `@ngx-translate/core`, Reactive Forms, `ngx-translate`

---

## File Map

| Action | Path                                                             |
| ------ | ---------------------------------------------------------------- |
| Create | `src/app/models/guardable-modal.interface.ts`                    |
| Create | `src/app/services/modal-guard.service.ts`                        |
| Create | `src/app/pages/settings/settings-state.service.ts`               |
| Modify | `public/i18n/us.json`                                            |
| Modify | `public/i18n/hu.json`                                            |
| Modify | `src/app/services/theme.service.ts`                              |
| Modify | `src/app/pages/settings/settings.ts`                             |
| Modify | `src/app/pages/settings/settings.html`                           |
| Modify | `src/app/pages/settings/settings.scss`                           |
| Modify | `src/app/pages/settings/general/general.ts`                      |
| Modify | `src/app/pages/settings/general/general.html`                    |
| Modify | `src/app/pages/settings/server/server.ts`                        |
| Modify | `src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts`  |
| Modify | `src/app/pages/settings/status-bar/status-bar.ts`                |
| Modify | `src/app/components/modals/torrent-details/torrent-details.ts`   |
| Modify | `src/app/components/modals/torrent-details/torrent-details.html` |
| Modify | `src/app/components/modals/torrent-details/torrent-details.scss` |
| Modify | `src/app/components/modals/torrent-details/content/content.ts`   |

---

## Task 1: Restore prerequisites — GuardableModal, ModalGuardService, translation keys

These files were built in earlier branch work but are not in the current working tree.

**Files:**

- Create: `src/app/models/guardable-modal.interface.ts`
- Create: `src/app/services/modal-guard.service.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Create `guardable-modal.interface.ts`**

```typescript
// src/app/models/guardable-modal.interface.ts
export interface GuardableModal {
  canDeactivate(): Promise<boolean>;
}
```

- [ ] **Step 2: Create `modal-guard.service.ts`**

```typescript
// src/app/services/modal-guard.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable()
export class ModalGuardService {
  isDirty = signal(false);
}
```

- [ ] **Step 3: Add guard translation keys to `us.json`**

The file already has a `"components"` → `"modals"` section. Add a `"guard"` key inside `components.modals`:

```json
"guard": {
  "unsaved-title": "Unsaved changes",
  "unsaved-message": "You have unsaved changes. Leave anyway?",
  "btn-leave": "Leave",
  "btn-stay": "Stay"
}
```

- [ ] **Step 4: Add guard translation keys to `hu.json`**

Same location in `components.modals`:

```json
"guard": {
  "unsaved-title": "Mentetlen változtatások",
  "unsaved-message": "Mentetlen változtatásaid vannak. Biztosan elhagyod?",
  "btn-leave": "Elhagyás",
  "btn-stay": "Maradás"
}
```

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/models/guardable-modal.interface.ts \
        src/app/services/modal-guard.service.ts \
        public/i18n/us.json \
        public/i18n/hu.json
git commit -m "#35: restore GuardableModal, ModalGuardService and guard i18n keys"
```

---

## Task 2: Add `applyFromSettings` to ThemeService

Allows the save flow to apply a new theme to the DOM without writing to storage (storage is handled by `GeneralSettingsService.save()`).

**Files:**

- Modify: `src/app/services/theme.service.ts`

- [ ] **Step 1: Add the method**

Open `src/app/services/theme.service.ts`. After the `setMode` method, add:

```typescript
public applyFromSettings(family: ThemeFamily, mode: ThemeMode): void {
  this._family.set(family);
  this._mode.set(mode);
}
```

The existing `effect()` in the constructor already reacts to `_family` and `_mode` changes and writes `data-bb-theme` / `data-bs-theme` to `document.documentElement`, so no further wiring is needed.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/services/theme.service.ts
git commit -m "#35: add ThemeService.applyFromSettings for deferred theme application"
```

---

## Task 3: Create `SettingsStateService`

A component-scoped service that tracks dirty state and save callbacks for all four settings tabs.

**Files:**

- Create: `src/app/pages/settings/settings-state.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/pages/settings/settings-state.service.ts
import { Injectable, computed, signal } from '@angular/core';
import { SettingsTabId } from './settings.interface';

type DirtyMap = Record<SettingsTabId, boolean>;

const INITIAL_DIRTY: DirtyMap = {
  general: false,
  server: false,
  'torrent-list-grid': false,
  'status-bar': false,
};

@Injectable()
export class SettingsStateService {
  private readonly dirtyTabs = signal<DirtyMap>({ ...INITIAL_DIRTY });
  private readonly saveFns = new Map<SettingsTabId, () => Promise<void>>();

  public readonly isDirty = computed(() => Object.values(this.dirtyTabs()).some(Boolean));
  public readonly isDirtyMap = computed(() => this.dirtyTabs());

  public markDirty(id: SettingsTabId, dirty: boolean): void {
    this.dirtyTabs.update((tabs) => ({ ...tabs, [id]: dirty }));
  }

  public registerSave(id: SettingsTabId, fn: () => Promise<void>): void {
    this.saveFns.set(id, fn);
  }

  public resetDirty(): void {
    this.dirtyTabs.set({ ...INITIAL_DIRTY });
  }

  public async saveAll(): Promise<void> {
    const dirty = this.dirtyTabs();
    await Promise.all(
      (Object.keys(dirty) as SettingsTabId[])
        .filter((id) => dirty[id])
        .map((id) => this.saveFns.get(id)?.() ?? Promise.resolve()),
    );
    this.resetDirty();
  }
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/settings-state.service.ts
git commit -m "#35: add SettingsStateService for centralised settings dirty tracking"
```

---

## Task 4: Refactor `Settings` component

Replace single `loadedComponent` with parallel loading into a `Map`, implement `GuardableModal`, add Save button, render all panels with CSS keep-alive.

**Files:**

- Modify: `src/app/pages/settings/settings.ts`
- Modify: `src/app/pages/settings/settings.html`
- Modify: `src/app/pages/settings/settings.scss`

- [ ] **Step 1: Replace `settings.ts`**

```typescript
// src/app/pages/settings/settings.ts
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Type, inject, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { SettingsStateService } from './settings-state.service';
import { SettingsTabComponent, SettingsTabId, Tab } from './settings.interface';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, AutofocusDirective, TranslatePipe],
  providers: [SettingsStateService],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit, GuardableModal {
  @Input() public tabToOpen: SettingsTabId = 'general';

  public readonly activeModal = inject(NgbActiveModal);
  public readonly stateService = inject(SettingsStateService);
  private readonly confirmService = inject(ConfirmService);

  public activeTabId = signal<SettingsTabId>('general');
  public loadedComponents = signal<Map<SettingsTabId, Type<SettingsTabComponent>>>(new Map());

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'pages.settings.tab.general.title',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'server',
      label: 'pages.settings.tab.server.title',
      loadComponent: () => import('./server/server').then((m) => m.Server),
    },
    {
      id: 'torrent-list-grid',
      label: 'pages.settings.tab.torrent-list-grid.title',
      loadComponent: () =>
        import('./torrent-list-grid/torrent-list-grid').then((m) => m.TorrentListGrid),
    },
    {
      id: 'status-bar',
      label: 'pages.settings.tab.status-bar.title',
      loadComponent: () => import('./status-bar/status-bar').then((m) => m.StatusBar),
    },
  ];

  public async ngOnInit(): Promise<void> {
    this.activeTabId.set(this.tabToOpen);
    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(new Map(results) as Map<SettingsTabId, Type<SettingsTabComponent>>);
  }

  public selectTab(tabId: SettingsTabId): void {
    this.activeTabId.set(tabId);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.stateService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) this.stateService.resetDirty();

    return confirmed;
  }

  public async onDismiss(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.dismiss();
  }

  public async onClose(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.close();
  }

  public async onSave(): Promise<void> {
    await this.stateService.saveAll();
  }
}
```

- [ ] **Step 2: Replace `settings.html`**

```html
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5 class="modal-title bb-title-clamp">{{ 'pages.settings.title' | translate }}</h5>

    <ul class="nav nav-tabs bb-modal-tabs">
      @for (tab of tabs; track tab.id) {
      <li class="nav-item">
        <button
          class="nav-link"
          [class.active]="activeTabId() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label | translate }}{{ stateService.isDirtyMap()[tab.id] ? ' *' : '' }}
        </button>
      </li>
      }
    </ul>
  </div>

  <button type="button" class="btn-close" aria-label="Close" (click)="onDismiss()"></button>
</div>

<div class="modal-body">
  @if (loadedComponents().size > 0) {
  <div class="bb-tab-panels">
    @for (tab of tabs; track tab.id) { @if (loadedComponents().has(tab.id)) {
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === tab.id">
      <ng-container *ngComponentOutlet="loadedComponents().get(tab.id)!"></ng-container>
    </div>
    } }
  </div>
  } @else {
  <app-bb-spinner></app-bb-spinner>
  }
</div>

<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    [disabled]="!stateService.isDirty()"
    (click)="onSave()"
  >
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="onClose()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 3: Replace `settings.scss`**

```scss
.bb-tab-panels {
  position: relative;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;

  &--active {
    position: relative;
    opacity: 1;
    pointer-events: auto;
  }
}
```

- [ ] **Step 4: Add `BbSpinner` to imports**

The template uses `<app-bb-spinner>`. Add it to the `imports` array in `settings.ts`:

```typescript
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';

// inside @Component:
imports: [CommonModule, AutofocusDirective, TranslatePipe, BbSpinner],
```

- [ ] **Step 5: Lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/settings/settings.ts \
        src/app/pages/settings/settings.html \
        src/app/pages/settings/settings.scss
git commit -m "#35: refactor Settings to parallel tab loading, keep-alive panels and save button"
```

---

## Task 5: Refactor General tab

Remove auto-save and `onThemeChange`. Register with `SettingsStateService`. Theme is applied only when save is triggered.

**Files:**

- Modify: `src/app/pages/settings/general/general.ts`
- Modify: `src/app/pages/settings/general/general.html`

- [ ] **Step 1: Update `general.ts`**

Replace the entire file:

```typescript
// src/app/pages/settings/general/general.ts
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
import { filter, firstValueFrom, from, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { GeneralSettings, ToastPosition } from '../../../models/general-settings.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { ThemeFamily, ThemeMode, ThemeService } from '../../../services/theme.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

interface NgSelectItem {
  value: string;
  label: string;
}

@Component({
  selector: 'app-general',
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
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
})
export class General implements SettingsTabComponent, OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly toastService = inject(ToastService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);

  private languageChanged = toSignal(this.translateService.onLangChange);

  public languages = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'us',
        label: this.translateService.instant('language.us'),
      },
      {
        value: 'hu',
        label: this.translateService.instant('language.hu'),
      },
    ].sort((a, b) => a.label.localeCompare(b.label));
  });

  public toastPositions = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'top-left',
        label: this.translateService.instant('pages.settings.tab.general.position.top-left'),
      },
      {
        value: 'top-right',
        label: this.translateService.instant('pages.settings.tab.general.position.top-right'),
      },
      {
        value: 'bottom-right',
        label: this.translateService.instant('pages.settings.tab.general.position.bottom-right'),
      },
      {
        value: 'bottom-left',
        label: this.translateService.instant('pages.settings.tab.general.position.bottom-left'),
      },
    ];
  });

  public families: NgSelectItem[] = [
    { value: 'bitbutler', label: 'BitButler' },
    { value: 'aurora', label: 'Aurora' },
    { value: 'mint-green', label: 'Mint Green' },
    { value: 'purple-haze', label: 'Purple Haze' },
    { value: 'ocean-breeze', label: 'Ocean Breeze' },
    { value: 'pumpkin-spice', label: 'Pumpkin Spice' },
    { value: 'deep-sea', label: 'Deep Sea' },
    { value: 'crimson-ember', label: 'Crimson Ember' },
  ];

  public modes = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'light',
        label: this.translateService.instant('pages.settings.tab.general.mode.light'),
      },
      {
        value: 'dark',
        label: this.translateService.instant('pages.settings.tab.general.mode.dark'),
      },
      {
        value: 'system',
        label: this.translateService.instant('pages.settings.tab.general.mode.system'),
      },
    ];
  });

  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
  };

  public getFamilyLogo(family: string): string {
    return `assets/images/bitbutler-logo-${family}.png`;
  }

  public generalSettingsForm = new FormGroup({
    behavior: new FormGroup({
      deleteTorrentFile: new FormControl(true, { nonNullable: true }),
      automaticUpdate: new FormControl(true, { nonNullable: true }),
      toastPosition: new FormControl<ToastPosition>('bottom-right', { nonNullable: true }),
    }),
    language: new FormGroup({
      language: new FormControl('us', { nonNullable: true }),
    }),
    appearance: new FormGroup({
      family: new FormControl<ThemeFamily>('bitbutler', { nonNullable: true }),
      mode: new FormControl<ThemeMode>('system', { nonNullable: true }),
    }),
  });

  public settings$ = from(this.generalSettingsService.load()).pipe(
    tap((settings: GeneralSettings) =>
      this.generalSettingsForm.patchValue(settings, { emitEvent: false }),
    ),
  );

  public async ngOnInit(): Promise<void> {
    this.stateService.registerSave('general', () => this.save());

    this.generalSettingsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('general', true));
  }

  private async save(): Promise<void> {
    const settings = this.generalSettingsForm.getRawValue();
    const newLang = settings.language.language;
    const currentLang = this.translateService.getCurrentLang();

    await this.generalSettingsService.save(settings);

    if (newLang !== currentLang) {
      await firstValueFrom(
        this.translateService.onLangChange.pipe(filter((event) => event.lang === newLang)),
      );
    }

    this.themeService.applyFromSettings(settings.appearance.family, settings.appearance.mode);

    const message = await firstValueFrom(
      this.translateService.get('pages.settings.tab.general.success.saved'),
    );

    this.toastService.success(message);
  }

  public checkUpdates(): void {
    this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE' });
  }
}
```

- [ ] **Step 2: Remove `(change)` bindings from `general.html`**

In `src/app/pages/settings/general/general.html`, find the family `ng-select` (line ~157) and remove `(change)="onThemeChange('family', $event)"`. Find the mode `ng-select` (line ~199) and remove `(change)="onThemeChange('mode', $event)"`.

The family ng-select opening tag should look like:

```html
<ng-select
  [items]="families"
  [clearable]="false"
  [openOnEnter]="false"
  [clearSearchOnAdd]="true"
  [searchable]="false"
  [hideSelected]="true"
  bindLabel="label"
  bindValue="value"
  formControlName="family"
  appendTo="ngb-modal-window"
></ng-select>
```

The mode ng-select opening tag should look like:

```html
<ng-select
  [items]="modes()"
  [clearable]="false"
  [openOnEnter]="false"
  [clearSearchOnAdd]="true"
  [searchable]="false"
  [hideSelected]="true"
  bindLabel="label"
  bindValue="value"
  formControlName="mode"
  appendTo="ngb-modal-window"
></ng-select>
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/settings/general/general.ts \
        src/app/pages/settings/general/general.html
git commit -m "#35: refactor General tab to use SettingsStateService, remove auto-save"
```

---

## Task 6: Refactor Server tab

Remove auto-save subscription. Register with `SettingsStateService`.

**Files:**

- Modify: `src/app/pages/settings/server/server.ts`

- [ ] **Step 1: Update `server.ts`**

Add `SettingsStateService` import and injection. Replace `ngOnInit` body. Rename `saveSettings` to `save` and make it `async`:

```typescript
// src/app/pages/settings/server/server.ts
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, NgZone, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faFolderOpen,
  faMinus,
  faPlus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { from, switchMap, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { ServerSettings } from '../../../models/server-settings.model';
import { ElectronService } from '../../../services/electron.service';
import { ServerSettingsService } from '../../../services/server-settings.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TypeaheadService } from '../../../services/typeahead.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-server',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbTypeahead,
    FontAwesomeModule,
    NgbTooltip,
    BbSpinner,
    BbPopover,
    TranslatePipe,
  ],
  templateUrl: './server.html',
  styleUrl: './server.scss',
})
export class Server implements SettingsTabComponent, OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly zone = inject(NgZone);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly toastService = inject(ToastService);
  private readonly typeaheadService = inject(TypeaheadService);
  private readonly destoryRef = inject(DestroyRef);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly stateService = inject(SettingsStateService);

  public icons: Record<string, IconDefinition> = {
    faPlus,
    faMinus,
    faTriangleExclamation,
    faFolderOpen,
  };

  public settings$ = toObservable(this.serverStoreService.currentServerId).pipe(
    switchMap(() => from(this.serverSettingsService.reload() as Promise<ServerSettings>)),

    tap((settings: ServerSettings) => {
      const { pathMappings, ...rest } = settings;

      this.serverSettingsForm.patchValue(rest, { emitEvent: false });

      this.pathMappings.clear({ emitEvent: false });

      const mappings = pathMappings?.length ? pathMappings : [{ remote: '', local: '' }];

      mappings.forEach((m) => {
        this.pathMappings.push(
          new FormGroup({
            remote: new FormControl(m.remote, { nonNullable: true }),
            local: new FormControl(m.local, { nonNullable: true }),
          }),
          { emitEvent: false },
        );
      });
    }),
  );

  public readonly searchSavePaths = this.typeaheadService.searchSavePaths;

  public serverSettingsForm = new FormGroup({
    polling: new FormGroup({
      foreground: new FormControl(2000, { nonNullable: true }),
      background: new FormControl(5000, { nonNullable: true }),
    }),
    pathMappings: new FormArray([
      new FormGroup({
        remote: new FormControl('', { nonNullable: true }),
        local: new FormControl('', { nonNullable: true }),
      }),
    ]),
  });

  public ngOnInit(): void {
    this.stateService.registerSave('server', () => this.save());

    this.serverSettingsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destoryRef))
      .subscribe(() => this.stateService.markDirty('server', true));
  }

  private async save(): Promise<void> {
    const settings: ServerSettings = this.serverSettingsForm.getRawValue();
    await this.serverSettingsService.save(settings);
    this.toastService.success('Server Settings Saved!');
  }

  get pathMappings(): FormArray {
    return this.serverSettingsForm.controls.pathMappings;
  }

  public addPathMapping(): void {
    this.pathMappings.push(
      new FormGroup({
        remote: new FormControl('', { nonNullable: true }),
        local: new FormControl('', { nonNullable: true }),
      }),
      { emitEvent: false },
    );
  }

  public testMapping(path: string): void {
    this.electronService.openPath(path);
  }

  public removePathMapping(index: number): void {
    if (this.pathMappings.length === 1) {
      this.pathMappings.at(index).reset({ remote: '', local: '' });
    } else {
      this.pathMappings.removeAt(index);
    }
  }

  public async onBrowse(index: number): Promise<void> {
    const path = await this.electronService.showOpenDialog();
    if (path) {
      this.zone.run(() => {
        const localControl = this.pathMappings.at(index).get('local');
        if (localControl) {
          localControl.setValue(path);
          localControl.markAsDirty();
        }
      });
    }
  }
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/server/server.ts
git commit -m "#35: refactor Server tab to use SettingsStateService, remove auto-save"
```

---

## Task 7: Refactor TorrentListGrid tab

Remove auto-save from `valueChanges` and `drop()`. Register with `SettingsStateService`. Convert `save()` to async using `firstValueFrom`.

**Files:**

- Modify: `src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts`

- [ ] **Step 1: Update `torrent-list-grid.ts`**

```typescript
// src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGripVertical, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { type ColDef, type ColumnState } from 'ag-grid-community';
import { firstValueFrom, take, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import {
  RowDoubleClickAction,
  TorrentListGridSettings,
} from '../../../models/torrent-list-grid.model';
import { getGridColDefs } from '../../../pages/main/grid/grid.lib';
import { ToastService } from '../../../services/toast.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

export interface NgSelectColumnItem {
  value: string;
  label: string;
}

@Component({
  selector: 'app-torrent-list-grid',
  standalone: true,
  imports: [
    BbSpinner,
    ReactiveFormsModule,
    NgSelectComponent,
    DragDropModule,
    FaIconComponent,
    BbPopover,
    FontAwesomeModule,
    TranslatePipe,
  ],
  templateUrl: './torrent-list-grid.html',
  styleUrl: './torrent-list-grid.scss',
})
export class TorrentListGrid implements SettingsTabComponent, OnInit {
  private readonly toastService = inject(ToastService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);

  faTriangleExclamation = faTriangleExclamation;

  public settings$ = this.torrentListGridSettingsService.asObservable().pipe(
    take(1),
    tap((settings: TorrentListGridSettings) => {
      const allDefs = getGridColDefs(this.uiFormatService, this.translateService);
      this.initializeForm(settings, allDefs);
      this.loaded.set(true);
    }),
  );

  public torrentListGridForm = new FormGroup({
    columns: new FormControl<string[]>([]),
    pagination: new FormControl(false),
    animateRows: new FormControl(false),
    rowDoubleClickAction: new FormControl<RowDoubleClickAction>('DETAILS'),
  });

  public columns = signal<NgSelectColumnItem[]>([]);
  public orderedColumns = signal<NgSelectColumnItem[]>([]);
  public faGripVertical = faGripVertical;
  public loaded = signal(false);

  public ngOnInit(): void {
    const allDefs: ColDef[] = getGridColDefs(this.uiFormatService, this.translateService);
    this.columns.set(
      allDefs
        .map((c) => ({ value: c.colId!, label: c.headerName ?? c.colId! }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    );

    this.torrentListGridSettingsService
      .asObservable()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.initializeForm(settings, allDefs);
        this.loaded.set(true);
      });

    this.stateService.registerSave('torrent-list-grid', () => this.save());

    this.torrentListGridForm
      .get('columns')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedColIds) => {
        const current = this.orderedColumns();
        const ids = selectedColIds || [];
        const updated = current.filter((c) => ids.includes(c.value));
        ids.forEach((id) => {
          if (!updated.find((u) => u.value === id)) {
            const col = this.columns().find((c) => c.value === id);
            if (col) updated.push(col);
          }
        });
        this.orderedColumns.set(updated);
      });

    this.torrentListGridForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('torrent-list-grid', true));
  }

  private initializeForm(settings: TorrentListGridSettings, allDefs: ColDef[]) {
    const currentState = (settings.columnState || []) as ColumnState[];

    const visibleColIds = currentState.filter((c) => !c.hide).map((c) => c.colId!);
    this.torrentListGridForm.patchValue(
      {
        columns: visibleColIds,
        pagination: settings.pagination,
        animateRows: settings.animateRows,
        rowDoubleClickAction: settings.rowDoubleClickAction,
      },
      { emitEvent: false },
    );

    this.orderedColumns.set(
      currentState
        .filter((c) => !c.hide)
        .map((c) => ({
          value: c.colId!,
          label: allDefs.find((d) => d.colId === c.colId)?.headerName ?? c.colId!,
        })),
    );
  }

  public drop(event: CdkDragDrop<NgSelectColumnItem[]>): void {
    const columns = [...this.orderedColumns()];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
  }

  private async save(): Promise<void> {
    const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
    const formValue = this.torrentListGridForm.getRawValue();
    const allDefs = getGridColDefs(this.uiFormatService, this.translateService);

    const resolvedColumnState = (settings.columnState || []) as ColumnState[];
    const existingStateMap = new Map(resolvedColumnState.map((c) => [c.colId!, c]));
    const defsMap = new Map(allDefs.map((d) => [d.colId, d]));

    const orderedVisible = this.orderedColumns();
    const visibleIds = new Set(orderedVisible.map((c) => c.value));

    const newColumnState: ColumnState[] = orderedVisible.map((col) => {
      const existing = existingStateMap.get(col.value);
      const def = defsMap.get(col.value);
      return {
        colId: col.value,
        hide: false,
        width: existing?.width ?? (typeof def?.width === 'number' ? def.width : undefined),
        flex:
          existing?.flex ?? (def as any)?.flex ?? (typeof def?.width === 'number' ? undefined : 1),
        sort: existing?.sort ?? null,
        pinned: existing?.pinned ?? null,
      };
    });

    allDefs.forEach((def) => {
      if (!visibleIds.has(def.colId!)) {
        const existing = existingStateMap.get(def.colId!);
        newColumnState.push({
          colId: def.colId!,
          hide: true,
          width: existing?.width ?? (typeof def.width === 'number' ? def.width : undefined),
          flex:
            existing?.flex ?? (def as any)?.flex ?? (typeof def.width === 'number' ? undefined : 1),
          sort: existing?.sort ?? null,
          pinned: existing?.pinned ?? null,
        });
      }
    });

    await this.torrentListGridSettingsService.save({
      ...settings,
      pagination: formValue.pagination ?? settings.pagination,
      animateRows: formValue.animateRows ?? settings.animateRows,
      rowDoubleClickAction: formValue.rowDoubleClickAction ?? settings.rowDoubleClickAction,
      columnState: newColumnState,
    });

    this.toastService.success('Torrent List Grid Settings Saved!', 'Success');
  }
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts
git commit -m "#35: refactor TorrentListGrid tab to use SettingsStateService, remove auto-save"
```

---

## Task 8: Refactor StatusBar tab

Stop saving on drag-drop. Register with `SettingsStateService`. Add `ngOnInit`.

**Files:**

- Modify: `src/app/pages/settings/status-bar/status-bar.ts`

- [ ] **Step 1: Update `status-bar.ts`**

```typescript
// src/app/pages/settings/status-bar/status-bar.ts
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { switchMap, tap } from 'rxjs';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { StatusBarSettings } from '../../../models/status-bar-settings.model';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

interface Widget {
  id: string;
  label: string;
}

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    FaIconComponent,
    BbSpinner,
    AsyncPipe,
    TranslatePipe,
  ],
  templateUrl: './status-bar.html',
  styleUrl: './status-bar.scss',
})
export class StatusBar implements SettingsTabComponent, OnInit {
  private statusBarService = inject(StatusBarSettingsService);
  private toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);

  public faGripVertical = faGripVertical;

  private readonly MASTER_WIDGET_KEYS = [
    'connection-status',
    'nodes',
    'ratio',
    'global-down',
    'global-up',
    'download-speed',
    'upload-speed',
    'free-space',
    'session-stats',
    'selection',
    'polling-indicator',
  ];

  private MASTER_WIDGETS: Record<string, string> = {};

  public available: Widget[] = [];
  public left: Widget[] = [];
  public right: Widget[] = [];

  public settings$ = this.translateService
    .get(this.MASTER_WIDGET_KEYS.map((key) => `pages.settings.tab.status-bar.widget.${key}`))
    .pipe(
      tap((translations) => {
        this.MASTER_WIDGET_KEYS.forEach((key) => {
          this.MASTER_WIDGETS[key] = translations[`pages.settings.tab.status-bar.widget.${key}`];
        });
      }),
      switchMap(() => this.statusBarService.asObservable()),
      tap((settings: StatusBarSettings) => {
        this.available = this.mapIdsToWidgets(settings.available);
        this.left = this.mapIdsToWidgets(settings.left);
        this.right = this.mapIdsToWidgets(settings.right);
      }),
    );

  public ngOnInit(): void {
    this.stateService.registerSave('status-bar', () => this.save());
  }

  private mapIdsToWidgets(ids: string[]): Widget[] {
    return (ids ?? [])
      .filter((id) => !!this.MASTER_WIDGETS[id])
      .map((id) => ({ id, label: this.MASTER_WIDGETS[id] }));
  }

  public drop(event: CdkDragDrop<Widget[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    this.stateService.markDirty('status-bar', true);
  }

  private async save(): Promise<void> {
    await this.statusBarService.save({
      available: this.available.map((w) => w.id),
      left: this.left.map((w) => w.id),
      right: this.right.map((w) => w.id),
    });

    this.toastService.success(
      this.translateService.instant('pages.settings.tab.status-bar.success.save'),
      'Success',
    );
  }
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/settings/status-bar/status-bar.ts
git commit -m "#35: refactor StatusBar tab to use SettingsStateService, remove auto-save on drop"
```

---

## Task 9: Refactor TorrentDetails modal

Parallel loading, keep-alive panels, synchronous `selectTab`, GuardableModal with `onDismiss`/`onClose`, dirty indicator on Content tab.

**Files:**

- Modify: `src/app/components/modals/torrent-details/torrent-details.ts`
- Modify: `src/app/components/modals/torrent-details/torrent-details.html`
- Modify: `src/app/components/modals/torrent-details/torrent-details.scss`

- [ ] **Step 1: Replace `torrent-details.ts`**

```typescript
// src/app/components/modals/torrent-details/torrent-details.ts
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, Input, OnInit, Type, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AppCommand, TorrentCommand } from '../../../models/command.model';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';

@Component({
  selector: 'app-torrent-details',
  standalone: true,
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
  ],
  providers: [ModalGuardService],
  templateUrl: './torrent-details.html',
  styleUrl: './torrent-details.scss',
})
export class TorrentDetails implements OnInit, GuardableModal {
  @Input() hash: string | null = null;
  @Input() public tabToOpen: TorrentDetailTabId = 'general';
  @Input() public context: Record<string, any> = {};

  public readonly activeModal = inject(NgbActiveModal);
  public readonly guardService = inject(ModalGuardService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly confirmService = inject(ConfirmService);

  public activeTabId = signal<TorrentDetailTabId>('general');
  public loadedComponents = signal<Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>>(
    new Map(),
  );

  public torrent = computed<Torrent | null>(() => {
    if (!this.hash) return null;
    return this.torrentStoreService.torrentsMap().get(this.hash) as Torrent;
  });

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'General',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'trackers',
      label: 'Trackers',
      loadComponent: () => import('./trackers/trackers').then((m) => m.Trackers),
    },
    {
      id: 'peers',
      label: 'Peers',
      loadComponent: () => import('./peers/peers').then((m) => m.Peers),
    },
    {
      id: 'content',
      label: 'Content',
      loadComponent: () => import('./content/content').then((m) => m.Content),
    },
  ];

  constructor() {
    this.commandBusService.commands$
      .pipe(
        filter(
          (command: AppCommand): command is { type: 'TORRENT_DELETED'; hash: string } =>
            command.type === 'TORRENT_DELETED',
        ),
        filter(
          (command: TorrentCommand) =>
            command.type === 'TORRENT_DELETED' && command.hash === this.hash,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.activeModal.close());
  }

  public async ngOnInit(): Promise<void> {
    this.activeTabId.set(this.tabToOpen);
    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(
      new Map(results) as Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>,
    );
  }

  public selectTab(tabId: TorrentDetailTabId): void {
    this.activeTabId.set(tabId);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.guardService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) this.guardService.isDirty.set(false);

    return confirmed;
  }

  public async onDismiss(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.dismiss();
  }

  public async onClose(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.close();
  }
}
```

- [ ] **Step 2: Replace `torrent-details.html`**

```html
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5
      #titleElement
      class="modal-title bb-title-clamp"
      [ngbTooltip]="titleElement.offsetWidth < titleElement.scrollWidth ? torrent()?.name : null"
      placement="bottom"
      tooltipClass="single-line-tooltip"
    >
      {{ torrent()?.name }}
    </h5>

    <div class="small text-body-secondary mt-1 bb-hash-clamp">
      {{ 'components.modals.torrent-details.hash' | translate }}: <code>{{ torrent()?.hash }}</code>
    </div>

    <ul class="nav nav-tabs bb-modal-tabs">
      @for (tab of tabs; track tab.id) {
      <li class="nav-item">
        <button
          class="nav-link"
          [class.active]="activeTabId() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label }}{{ tab.id === 'content' && guardService.isDirty() ? ' *' : '' }}
        </button>
      </li>
      }
    </ul>
  </div>

  <button type="button" class="btn-close" aria-label="Close" (click)="onDismiss()"></button>
</div>

<div class="modal-body">
  @if (loadedComponents().size > 0) {
  <div class="bb-tab-panels">
    @for (tab of tabs; track tab.id) { @if (loadedComponents().has(tab.id)) {
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === tab.id">
      <ng-container
        *ngComponentOutlet="loadedComponents().get(tab.id)!; inputs: { hash: torrent()?.hash, context }"
      ></ng-container>
    </div>
    } }
  </div>
  } @else {
  <app-bb-spinner></app-bb-spinner>
  }
</div>

<div class="modal-footer">
  <button type="button" class="btn btn-link" (click)="onClose()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 3: Replace `torrent-details.scss`**

```scss
.bb-tab-panels {
  position: relative;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;

  &--active {
    position: relative;
    opacity: 1;
    pointer-events: auto;
  }
}
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/modals/torrent-details/torrent-details.ts \
        src/app/components/modals/torrent-details/torrent-details.html \
        src/app/components/modals/torrent-details/torrent-details.scss
git commit -m "#35: refactor TorrentDetails to parallel tab loading, keep-alive panels and guard"
```

---

## Task 10: Wire Content tab to ModalGuardService

The Content tab needs to inject `ModalGuardService` and call `isDirty.set(isEditing)` when the file-tree edit mode changes.

**Files:**

- Modify: `src/app/components/modals/torrent-details/content/content.ts`

- [ ] **Step 1: Add `ModalGuardService` to `content.ts`**

Add the import:

```typescript
import { ModalGuardService } from '../../../../services/modal-guard.service';
```

Add the injection inside the class body (alongside the existing injections):

```typescript
private readonly guardService = inject(ModalGuardService);
```

Add the method at the end of the class:

```typescript
public onEditModeChange(isEditing: boolean): void {
  this.guardService.isDirty.set(isEditing);
}
```

- [ ] **Step 2: Bind `onEditModeChange` in `content.html`**

Open `src/app/components/modals/torrent-details/content/content.html`. Find the `<bb-file-tree>` element and add the output binding:

```html
(editModeChange)="onEditModeChange($event)"
```

**Note:** Check the `BbFileTree` component to confirm the exact output name. Search for `@Output` in `src/app/components/bb-file-tree/bb-file-tree.ts`. If the output is named differently, use that name instead.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/modals/torrent-details/content/content.ts \
        src/app/components/modals/torrent-details/content/content.html
git commit -m "#35: wire Content tab to ModalGuardService for dirty tracking"
```

---

## Task 11: Verify StatusBarSettingsService has an async `save`

The `StatusBar.save()` now awaits `statusBarService.save(...)`. Confirm the service's `save` method returns a `Promise`.

**Files:**

- Read: `src/app/services/status-bar-settings.service.ts`

- [ ] **Step 1: Check `StatusBarSettingsService.save`**

Run:

```bash
grep -n "save" src/app/services/status-bar-settings.service.ts
```

`StatusBarSettingsService` extends `BaseSettingsService<StatusBarSettings>`. `BaseSettingsService.save()` is `async save(settings: T): Promise<void>` (confirmed in the source). No changes needed.

- [ ] **Step 2: Final lint pass**

```bash
npm run lint
```

Expected: zero warnings, zero errors.

- [ ] **Step 3: Final commit if any fixes were needed**

If lint produced auto-fixable issues:

```bash
npm run lint:fix
git add -u
git commit -m "#35: fix lint issues after settings refactor"
```
