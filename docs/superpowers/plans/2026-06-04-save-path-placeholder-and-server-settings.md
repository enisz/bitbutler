# Save Path Placeholder & Server Settings Remote Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop pre-filling the add-torrent save path with the qBittorrent default; make the server settings remote path clearable and resolve empty remote to the default on save.

**Architecture:** Two isolated changes. Task 1 is a single deletion in `add-torrent.ts ngOnInit()`. Task 2 injects `QbService` into the `Server` component, fetches the default path alongside the existing settings reload, and maps empty remote values to that default inside `save()`. No changes to `save-path-select` itself.

**Tech Stack:** Angular 20 (zoneless, signals), Reactive Forms, Vitest

---

### Task 1: Add Torrent - remove default path pre-fill

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts:181-207`

---

- [ ] **Step 1: Write the failing test**

  Open `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`.

  Add this `describe` block after the existing `describe('tryRenameContentAfterAdd', ...)` block (before the closing `}` of the outer `describe`):

  ```typescript
  describe('ngOnInit savepath behaviour', () => {
    it('should leave savepath null when AddTorrentSettings returns no savepath', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({});

      await component.ngOnInit();

      expect(component.addForm.controls.savepath.value).toBeNull();
    });
  });
  ```

  The existing mock for `QbService.getAppPreferences` returns `{ save_path: '/downloads' }`. With the current code, `ngOnInit` will pre-fill `savepath` with `'/downloads'`, so this test will **fail**.

- [ ] **Step 2: Run the test to confirm it fails**

  ```
  npm test
  ```

  Expected: the new test fails with something like `expected '/downloads' to be null`.

- [ ] **Step 3: Remove the pre-fill block**

  In `packages/app/src/app/components/add-torrent/add-torrent.ts`, find `ngOnInit()` (around line 181) and delete the entire block that fetches the default when `savepath` is missing. After the edit the method should look like this:

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
  ```

  The deleted lines were:

  ```typescript
  const serverId = this.serverStoreService.currentServerId();

  if (!settings.savepath && serverId) {
    try {
      const prefs = await this.qbService.getAppPreferences(serverId);
      settings.savepath = prefs.save_path;
    } catch (err) {
      console.error(AddTorrent.name, `ngOnInit`, `Failed to get app preferences`, err);
    }
  }
  ```

- [ ] **Step 4: Run the tests to confirm they pass**

  ```
  npm test
  ```

  Expected: all tests pass, including the new `should leave savepath null...` test.

- [ ] **Step 5: Commit**

  ```
  git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.spec.ts
  git commit -m "#125: remove default savepath pre-fill in add-torrent ngOnInit"
  ```

---

### Task 2: Server Settings - clearable remote path with default fallback

**Files:**

- Modify: `packages/app/src/app/pages/settings/server/server.spec.ts`
- Modify: `packages/app/src/app/pages/settings/server/server.ts`
- Modify: `packages/app/src/app/pages/settings/server/server.html:153-161`

---

- [ ] **Step 1: Write the failing tests**

  Open `packages/app/src/app/pages/settings/server/server.spec.ts`.

  **Update the `beforeEach` providers** to add `QbService` and a `save` method on `ServerSettingsService`:

  ```typescript
  import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
  import { ComponentFixture, TestBed } from '@angular/core/testing';
  import { ElectronService } from '../../../services/electron.service';
  import { QbService } from '../../../services/qb.service';
  import { ServerSettingsService } from '../../../services/server-settings.service';
  import { ServerStoreService } from '../../../services/server-store.service';
  import { SettingsStateService } from '../settings-state.service';
  import { Server } from './server';

  describe('Server', () => {
    let component: Server;
    let fixture: ComponentFixture<Server>;

    let electronMock: {
      openPath: ReturnType<typeof vi.fn>;
      showOpenDialog: ReturnType<typeof vi.fn>;
    };
    let stateServiceMock: {
      registerSave: ReturnType<typeof vi.fn>;
      markDirty: ReturnType<typeof vi.fn>;
    };
    let serverSettingsMock: {
      reload: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
    };
    let qbMock: {
      getAppPreferences: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
      electronMock = {
        openPath: vi.fn(),
        showOpenDialog: vi.fn().mockResolvedValue(null),
      };
      stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
      serverSettingsMock = {
        reload: vi.fn().mockResolvedValue({
          pathMappings: [],
          polling: { foreground: 2000, background: 5000 },
        }),
        save: vi.fn().mockResolvedValue(undefined),
      };
      qbMock = {
        getAppPreferences: vi.fn().mockResolvedValue({ save_path: '/default/downloads' }),
      };

      await TestBed.configureTestingModule({
        imports: [Server],
        providers: [
          { provide: ElectronService, useValue: electronMock },
          { provide: SettingsStateService, useValue: stateServiceMock },
          { provide: ServerStoreService, useValue: { currentServerId: signal(null) } },
          { provide: ServerSettingsService, useValue: serverSettingsMock },
          { provide: QbService, useValue: qbMock },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      fixture = TestBed.createComponent(Server);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });
  ```

  Then **add a new `describe` block** for the `save()` behaviour after the existing `describe('testMapping', ...)` block (before the final closing `}`):

  ```typescript
    describe('save', () => {
      it('should replace empty remote with defaultRemotePath', async () => {
        (component as any).defaultRemotePath = '/default/downloads';
        component.pathMappings.at(0).patchValue({ remote: '', local: '/local/path' });

        await (component as any).save();

        expect(serverSettingsMock.save).toHaveBeenCalledWith(
          expect.objectContaining({
            pathMappings: [{ remote: '/default/downloads', local: '/local/path' }],
          }),
        );
      });

      it('should keep a non-empty remote unchanged', async () => {
        (component as any).defaultRemotePath = '/default/downloads';
        component.pathMappings.at(0).patchValue({ remote: '/custom/remote', local: '/local/path' });

        await (component as any).save();

        expect(serverSettingsMock.save).toHaveBeenCalledWith(
          expect.objectContaining({
            pathMappings: [{ remote: '/custom/remote', local: '/local/path' }],
          }),
        );
      });
    });
  });
  ```

  These tests access the private `defaultRemotePath` property directly via `(component as any)`. They will **fail** because:
  - `QbService` is not yet injected into `Server`
  - `defaultRemotePath` does not exist
  - `save()` does not resolve empty remotes

- [ ] **Step 2: Run the tests to confirm they fail**

  ```
  npm test
  ```

  Expected: the two new `save` tests fail (likely with a DI error about `QbService` or property-not-found errors).

- [ ] **Step 3: Update server.ts - inject QbService, store defaultRemotePath, resolve on save**

  Replace the full contents of `packages/app/src/app/pages/settings/server/server.ts` with:

  ```typescript
  import { CommonModule } from '@angular/common';
  import { ChangeDetectionStrategy, Component, DestroyRef, NgZone, inject } from '@angular/core';
  import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
  import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
  import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
  import {
    IconDefinition,
    faFolderOpen,
    faMinus,
    faPlus,
    faTriangleExclamation,
  } from '@fortawesome/free-solid-svg-icons';
  import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
  import { TranslatePipe } from '@ngx-translate/core';
  import { from, switchMap, tap } from 'rxjs';
  import { BbPopover } from '../../../components/bb-popover/bb-popover';
  import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
  import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
  import { ServerSettings } from '../../../models/server-settings.model';
  import { ElectronService } from '../../../services/electron.service';
  import { QbService } from '../../../services/qb.service';
  import { ServerSettingsService } from '../../../services/server-settings.service';
  import { ServerStoreService } from '../../../services/server-store.service';
  import { SettingsStateService } from '../settings-state.service';
  import { SettingsTabComponent } from '../settings.interface';

  @Component({
    selector: 'app-server',
    imports: [
      CommonModule,
      ReactiveFormsModule,
      FontAwesomeModule,
      NgbTooltip,
      BbSpinner,
      BbPopover,
      TranslatePipe,
      SavePathSelect,
    ],
    templateUrl: './server.html',
    styleUrl: './server.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  export class Server implements SettingsTabComponent {
    private readonly electronService = inject(ElectronService);
    private readonly zone = inject(NgZone);
    private readonly serverSettingsService = inject(ServerSettingsService);
    private readonly destoryRef = inject(DestroyRef);
    private readonly serverStoreService = inject(ServerStoreService);
    private readonly stateService = inject(SettingsStateService);
    private readonly qbService = inject(QbService);

    private defaultRemotePath = '';

    public icons: Record<string, IconDefinition> = {
      faPlus,
      faMinus,
      faTriangleExclamation,
      faFolderOpen,
    };

    private settings$ = toObservable(this.serverStoreService.currentServerId).pipe(
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

        const serverId = this.serverStoreService.currentServerId();
        if (serverId) {
          this.qbService
            .getAppPreferences(serverId)
            .then((prefs) => {
              if (prefs.save_path) this.defaultRemotePath = prefs.save_path;
            })
            .catch(() => {});
        }
      }),
    );

    public readonly settingsLoaded = toSignal(this.settings$, { initialValue: null });

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

    constructor() {
      this.stateService.registerSave('server', () => this.save());

      this.serverSettingsForm.valueChanges
        .pipe(takeUntilDestroyed(this.destoryRef))
        .subscribe(() => this.stateService.markDirty('server', true));
    }

    private async save(): Promise<void> {
      const raw = this.serverSettingsForm.getRawValue() as ServerSettings;
      const settings: ServerSettings = {
        ...raw,
        pathMappings: raw.pathMappings.map((m) => ({
          remote: m.remote || this.defaultRemotePath,
          local: m.local,
        })),
      };
      await this.serverSettingsService.save(settings);
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

- [ ] **Step 4: Add `[clearable]="true"` to the remote path in server.html**

  In `packages/app/src/app/pages/settings/server/server.html`, find the `app-save-path-select` for the remote field (around line 153) and add `[clearable]="true"`:

  ```html
  <app-save-path-select
    [showPopover]="false"
    [clearable]="true"
    [label]="
      'pages.settings.tab.server.server-settings-form.path-mapping.remote-path'
        | translate
    "
    appendTo="ngb-modal-window"
    formControlName="remote"
  ></app-save-path-select>
  ```

- [ ] **Step 5: Run the tests to confirm they pass**

  ```
  npm test
  ```

  Expected: all tests pass, including the three new `save` describe tests.

- [ ] **Step 6: Commit**

  ```
  git add packages/app/src/app/pages/settings/server/server.ts packages/app/src/app/pages/settings/server/server.html packages/app/src/app/pages/settings/server/server.spec.ts
  git commit -m "#125: clearable remote path in server settings with default fallback on save"
  ```
