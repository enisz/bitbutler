# Add Torrent Tabbed Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the "Add Torrent" modal into a 4-tab layout (General, Options, Limits, Files) matching the Settings modal's tab pattern, and consolidate the toolbar's "Add Torrent" file/link actions into a single entry.

**Architecture:** The existing monolithic `AddTorrent` component is split into a thin tab-shell parent (`add-torrent.ts`/`.html`) plus four new presentational child components (`AddTorrentGeneral`, `AddTorrentOptions`, `AddTorrentLimits`, `AddTorrentFiles`), each receiving the shared `AddTorrentFormGroup` reactive form via `input.required()`. The parent owns all state/signals/effects (tab selection, warning computation, submit handling) and renders all four tab panels using the CSS-based `.bb-tab-panels`/`.bb-tab-panel--active` overlay pattern (moved from `settings.scss`/`qb-settings.scss` into global `styles.scss`), mirroring `settings.html`'s `NgbTooltipModule`-based tab navigation.

**Tech Stack:** Angular 20 (zoneless, signals, standalone components, `input.required()`/`output()`), Reactive Forms, `@ng-bootstrap/ng-bootstrap` (`NgbTooltipModule`), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest + Angular TestBed.

---

## File Structure

```
packages/app/src/
├── styles.scss                                         [MODIFY: add .bb-tab-panels/.bb-tab-panel CSS]
├── app/
│   ├── app.const.ts                                    [MODIFY: add INVALID_FILENAME_CHARS]
│   ├── models/
│   │   ├── add-torrent.model.ts                        [MODIFY: add AddTorrentFormGroup type]
│   │   └── command.model.ts                            [MODIFY: remove UI_ADD_TORRENT.mode]
│   ├── services/
│   │   └── ui-command-handler.service.ts               [MODIFY: remove mode-based switchInputMode call]
│   ├── components/
│   │   ├── bb-file-tree/
│   │   │   └── bb-file-tree.ts                         [MODIFY: import INVALID_FILENAME_CHARS from app.const]
│   │   └── add-torrent/
│   │       ├── add-torrent.ts                          [MODIFY: tab shell, signals, submit logic]
│   │       ├── add-torrent.html                        [MODIFY: tab nav + 4 tab panels]
│   │       ├── add-torrent.spec.ts                     [MODIFY: new/updated tests]
│   │       ├── add-torrent.scss                        [unchanged - stays empty]
│   │       ├── general/
│   │       │   ├── general.ts                          [CREATE]
│   │       │   ├── general.html                        [CREATE]
│   │       │   └── general.spec.ts                     [CREATE]
│   │       ├── options/
│   │       │   ├── options.ts                          [CREATE]
│   │       │   ├── options.html                        [CREATE]
│   │       │   └── options.spec.ts                     [CREATE]
│   │       ├── limits/
│   │       │   ├── limits.ts                           [CREATE]
│   │       │   ├── limits.html                         [CREATE]
│   │       │   └── limits.spec.ts                      [CREATE]
│   │       └── files/
│   │           ├── files.ts                            [CREATE]
│   │           ├── files.html                          [CREATE]
│   │           └── files.spec.ts                       [CREATE]
│   └── pages/
│       ├── settings/settings.scss                      [MODIFY: emptied]
│       ├── qb-settings/qb-settings.scss                [MODIFY: emptied]
│       └── main/button-bar/
│           ├── button-bar.ts                           [MODIFY: consolidate "new" entry to single action]
│           └── button-bar.spec.ts                      [MODIFY: update renamed test case]
└── public/i18n/
    ├── us.json                                         [MODIFY: add/remove keys]
    └── hu.json                                         [MODIFY: add/remove keys]
```

---

### Task 1: Relocate `INVALID_FILENAME_CHARS` to `app.const.ts`

**Files:**

- Modify: `packages/app/src/app/app.const.ts`
- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`

- [ ] **Step 1: Add `INVALID_FILENAME_CHARS` to `app.const.ts`**

Edit `packages/app/src/app/app.const.ts`:

```typescript
export const API_URL = '/api/v2';

export const INVALID_FILENAME_CHARS = /^[^<>:"/\\|?*\x00-\x1f]+$/;

const GRID_PARAMS_SHARED = {
```

(insert the new export between the existing `API_URL` export and `GRID_PARAMS_SHARED`)

- [ ] **Step 2: Import the constant in `bb-file-tree.ts` instead of defining it locally**

In `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`, remove the local definition right before `@Component` and add an import (alphabetically ordered - `'../../app.const'` sorts before `'../../directives/tooltip-overflow'`):

Replace:

```typescript
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ConfirmService } from '../../services/confirm.service';
import { BbProgress } from '../bb-progress/bb-progress';
import { getFileIcon } from './file-icon';

export type BbFileTreeNode = {
  name: string;
  fullPath: string;
  kind: 'dir' | 'file';
  children?: BbFileTreeNode[];
  file?: TorrentFileEntry;
};

export type FileTreeSaveEvent = {
  files: TorrentFileEntry[];
  renames: { oldPath: string; newPath: string }[];
};

const INVALID_FILENAME_CHARS = /^[^<>:"/\\|?*\x00-\x1f]+$/;

@Component({
```

with:

```typescript
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { INVALID_FILENAME_CHARS } from '../../app.const';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ConfirmService } from '../../services/confirm.service';
import { BbProgress } from '../bb-progress/bb-progress';
import { getFileIcon } from './file-icon';

export type BbFileTreeNode = {
  name: string;
  fullPath: string;
  kind: 'dir' | 'file';
  children?: BbFileTreeNode[];
  file?: TorrentFileEntry;
};

export type FileTreeSaveEvent = {
  files: TorrentFileEntry[];
  renames: { oldPath: string; newPath: string }[];
};

@Component({
```

- [ ] **Step 3: Verify lint and the existing file-tree test still pass**

Run: `npm run lint -w @bitbutler/app`
Expected: no errors (max-warnings=0)

Run: `npm test -w @bitbutler/app -- bb-file-tree`
Expected: all tests PASS - the rename-validation test using `Validators.pattern(INVALID_FILENAME_CHARS)` is unaffected since the regex value is identical.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/app.const.ts packages/app/src/app/components/bb-file-tree/bb-file-tree.ts
git commit -m "#159: relocate INVALID_FILENAME_CHARS to app.const"
```

---

### Task 2: Move `.bb-tab-panels`/`.bb-tab-panel` CSS to global styles

**Files:**

- Modify: `packages/app/src/styles.scss`
- Modify: `packages/app/src/app/pages/settings/settings.scss`
- Modify: `packages/app/src/app/pages/qb-settings/qb-settings.scss`

- [ ] **Step 1: Add the `.bb-tab-panels`/`.bb-tab-panel` block to `styles.scss`, right after `.bb-modal-tabs`**

In `packages/app/src/styles.scss`, replace:

```scss
.bb-modal-tabs {
  margin-top: 15px;
  margin-bottom: -17px;
  font-size: 0.8rem;
}

.bb-modal-header {
```

with:

```scss
.bb-modal-tabs {
  margin-top: 15px;
  margin-bottom: -17px;
  font-size: 0.8rem;
}

.bb-tab-panels {
  position: relative;
  min-height: 200px;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.2s ease;

  &--active {
    position: relative;
    overflow: visible;
    opacity: 1;
    pointer-events: auto;
  }
}

.bb-modal-header {
```

- [ ] **Step 2: Empty `settings.scss`**

`packages/app/src/app/pages/settings/settings.scss` currently contains only the `.bb-tab-panels`/`.bb-tab-panel` block (now duplicated globally). Overwrite it with an empty file (matching the existing empty `add-torrent.scss` pattern - the `styleUrl: './settings.scss'` reference in `settings.ts` stays unchanged and still resolves).

- [ ] **Step 3: Empty `qb-settings.scss`**

`packages/app/src/app/pages/qb-settings/qb-settings.scss` currently contains the identical block. Overwrite it with an empty file as well.

- [ ] **Step 4: Verify the build still succeeds**

Run: `npm run build -w @bitbutler/app`
Expected: build succeeds with no Sass errors; Settings and QbSettings tab panels still render correctly (now styled by the global rule).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/styles.scss packages/app/src/app/pages/settings/settings.scss packages/app/src/app/pages/qb-settings/qb-settings.scss
git commit -m "#159: move tab panel CSS to global styles"
```

---

### Task 3: Add `AddTorrentFormGroup` type

**Files:**

- Modify: `packages/app/src/app/models/add-torrent.model.ts`

- [ ] **Step 1: Add `FormControl, FormGroup` import**

Replace:

```typescript
import { ShareLimitValue } from '../components/share-limit/share-limit';
import { TransferLimitValue } from '../components/transfer-limit/transfer-limit';
```

with:

```typescript
import { FormControl, FormGroup } from '@angular/forms';
import { ShareLimitValue } from '../components/share-limit/share-limit';
import { TransferLimitValue } from '../components/transfer-limit/transfer-limit';
```

- [ ] **Step 2: Append the `AddTorrentFormGroup` type at the end of the file**

Append after the existing `DEFAULT_ADD_TORRENT_SETTINGS` constant:

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

The full resulting file:

```typescript
import { FormControl, FormGroup } from '@angular/forms';
import { ShareLimitValue } from '../components/share-limit/share-limit';
import { TransferLimitValue } from '../components/transfer-limit/transfer-limit';

export type RootFolderMode = 'unset' | 'true' | 'false';

export type AddTorrentSettings = {
  savepath: string | null;
  paused: boolean;
  category: string | null;
  tags: string | null;
  root_folder: RootFolderMode;
  skip_checking: boolean;
  sequentialDownload: boolean;
  firstLastPiecePrio: boolean;
  autoTMM: boolean;
  transferRateLimits: TransferLimitValue | null;
  shareLimits: ShareLimitValue | null;
};

export const DEFAULT_ADD_TORRENT_SETTINGS: AddTorrentSettings = {
  savepath: null,
  paused: false,
  category: null,
  tags: null,
  root_folder: 'unset',
  skip_checking: false,
  sequentialDownload: false,
  firstLastPiecePrio: false,
  autoTMM: false,
  transferRateLimits: null,
  shareLimits: { ratioLimit: -2, seedingTimeLimit: -2, inactiveSeedingTimeLimit: -2 },
};

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

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint -w @bitbutler/app`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/models/add-torrent.model.ts
git commit -m "#159: add AddTorrentFormGroup type"
```

---

### Task 4: Add new i18n keys (additive only)

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

This task only **adds** keys. The old `components.add-torrent.label.{input,general,settings,limits,files}` and `general.form.feedback.no-slash` keys are removed later, in Task 9, once nothing references them.

- [ ] **Step 1: `us.json` - add 2 keys to `components.add-torrent.label`**

Replace:

```json
      "label": {
        "input": "Input",
        "general": "General",
        "settings": "Settings",
        "limits": "Limits",
        "files": "Files"
      },
```

with:

```json
      "label": {
        "input": "Input",
        "general": "General",
        "settings": "Settings",
        "limits": "Limits",
        "files": "Files",
        "transfer-rate-limits": "Transfer Rate Limits",
        "share-limits": "Share Limits"
      },
```

- [ ] **Step 2: `us.json` - add `tab`, `input-mode`, `feedback` objects as siblings of `popover` inside `components.add-torrent`**

Replace:

```json
        "links": {
          "title": "Links",
          "description": {
            "line1": "Paste one or more magnet links or direct .torrent URLs here, one per line.",
            "line2": "Magnet links start with magnet:?xt=urn:btih:… - direct .torrent URLs point to a remote file that qBittorrent will fetch automatically."
          }
        }
      }
    },
    "app-loader": {
```

with:

```json
        "links": {
          "title": "Links",
          "description": {
            "line1": "Paste one or more magnet links or direct .torrent URLs here, one per line.",
            "line2": "Magnet links start with magnet:?xt=urn:btih:… - direct .torrent URLs point to a remote file that qBittorrent will fetch automatically."
          }
        }
      },
      "tab": {
        "general": {
          "title": "General"
        },
        "options": {
          "title": "Options"
        },
        "limits": {
          "title": "Limits"
        },
        "files": {
          "title": "Files",
          "disabled": {
            "link-mode": "Not available when adding by magnet link.",
            "no-files": "No file list available yet."
          },
          "issue": {
            "edit-in-progress": "Finish editing the file list before adding the torrent."
          }
        }
      },
      "input-mode": {
        "file": "File",
        "link": "Link"
      },
      "feedback": {
        "no-server-selected": "No server is selected. Choose a server before adding this torrent.",
        "add-failed": "Adding the torrent failed. Please try again."
      }
    },
    "app-loader": {
```

- [ ] **Step 3: `us.json` - add `pattern` key to `general.form.feedback`**

Replace:

```json
    "form": {
      "feedback": {
        "required": "This field is required.",
        "no-slash": "The name must not contain slashes."
      },
```

with:

```json
    "form": {
      "feedback": {
        "required": "This field is required.",
        "no-slash": "The name must not contain slashes.",
        "pattern": "Name contains invalid characters (< > : \" / \\ | ? *)"
      },
```

- [ ] **Step 4: `hu.json` - add 2 keys to `components.add-torrent.label`**

Replace:

```json
      "label": {
        "input": "Bemenet",
        "general": "Általános",
        "settings": "Beállítások",
        "limits": "Korlátok",
        "files": "Fájlok"
      },
```

with:

```json
      "label": {
        "input": "Bemenet",
        "general": "Általános",
        "settings": "Beállítások",
        "limits": "Korlátok",
        "files": "Fájlok",
        "transfer-rate-limits": "Átviteli sebesség korlátok",
        "share-limits": "Megosztási korlátok"
      },
```

- [ ] **Step 5: `hu.json` - add `tab`, `input-mode`, `feedback` objects as siblings of `popover` inside `components.add-torrent`**

Replace:

```json
        "links": {
          "title": "Linkek",
          "description": {
            "line1": "Illessz be egy vagy több mágneslinket vagy közvetlen .torrent URL-t ide, soronként egyet.",
            "line2": "A mágneslinkkek magnet:?xt=urn:btih:… kezdetűek - a közvetlen .torrent URL-ekről a qBittorrent automatikusan letölti a fájlt."
          }
        }
      }
    },
    "app-loader": {
```

with:

```json
        "links": {
          "title": "Linkek",
          "description": {
            "line1": "Illessz be egy vagy több mágneslinket vagy közvetlen .torrent URL-t ide, soronként egyet.",
            "line2": "A mágneslinkkek magnet:?xt=urn:btih:… kezdetűek - a közvetlen .torrent URL-ekről a qBittorrent automatikusan letölti a fájlt."
          }
        }
      },
      "tab": {
        "general": {
          "title": "Általános"
        },
        "options": {
          "title": "Beállítások"
        },
        "limits": {
          "title": "Korlátok"
        },
        "files": {
          "title": "Fájlok",
          "disabled": {
            "link-mode": "Mágneslink hozzáadásakor nem elérhető.",
            "no-files": "Még nem érhető el fájllista."
          },
          "issue": {
            "edit-in-progress": "Fejezd be a fájllista szerkesztését, mielőtt hozzáadod a torrentet."
          }
        }
      },
      "input-mode": {
        "file": "Fájl",
        "link": "Link"
      },
      "feedback": {
        "no-server-selected": "Nincs kiválasztva szerver. Válassz szervert a torrent hozzáadása előtt.",
        "add-failed": "A torrent hozzáadása sikertelen. Próbáld újra."
      }
    },
    "app-loader": {
```

- [ ] **Step 6: `hu.json` - add `pattern` key to `general.form.feedback`**

Replace:

```json
    "form": {
      "feedback": {
        "required": "Ez a mező kötelező.",
        "no-slash": "A név nem tartalmazhat perjelet (/)."
      },
```

with:

```json
    "form": {
      "feedback": {
        "required": "Ez a mező kötelező.",
        "no-slash": "A név nem tartalmazhat perjelet (/).",
        "pattern": "A név érvénytelen karaktereket tartalmaz (< > : \" / \\ | ? *)"
      },
```

- [ ] **Step 7: Verify lint passes (JSON formatting via Prettier/lint-staged)**

Run: `npm run lint -w @bitbutler/app`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#159: add i18n keys for add-torrent tabs"
```

---

### Task 5: Create `AddTorrentGeneral` component

**Files:**

- Create: `packages/app/src/app/components/add-torrent/general/general.spec.ts`
- Create: `packages/app/src/app/components/add-torrent/general/general.ts`
- Create: `packages/app/src/app/components/add-torrent/general/general.html`

This tab combines the old "Input" (file/link picker) and "General" (rename, save path, category, tags) fieldsets. It also adds a new file/link toggle (`btn-check` group) so the user can switch input mode from inside the modal - this replaces the toolbar-level `new.addTorrentLink` action removed in Task 10.

- [ ] **Step 1: Write the spec (will fail - `./general` doesn't exist yet)**

Create `packages/app/src/app/components/add-torrent/general/general.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ShareLimitValue } from '../../share-limit/share-limit';
import { TransferLimitValue } from '../../transfer-limit/transfer-limit';
import { AddTorrentGeneral } from './general';

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

describe('AddTorrentGeneral', () => {
  let component: AddTorrentGeneral;
  let fixture: ComponentFixture<AddTorrentGeneral>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentGeneral],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
        {
          provide: GeneralSettingsService,
          useValue: { load: vi.fn().mockResolvedValue({}), asObservable: vi.fn() },
        },
        {
          provide: QbService,
          useValue: {
            getAppPreferences: vi.fn().mockResolvedValue({ save_path: '/downloads' }),
            getAllCategories: vi.fn().mockResolvedValue({}),
            addCategory: vi.fn().mockResolvedValue(undefined),
            getAllTags: vi.fn().mockResolvedValue([]),
            createTags: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentGeneral);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', createForm());
    fixture.componentRef.setInput('inputMode', 'file');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the file picker in file mode', () => {
    expect(fixture.nativeElement.querySelector('#file_browser')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#magnet_links')).toBeFalsy();
  });

  it('should show the magnet links textarea in link mode', () => {
    fixture.componentRef.setInput('inputMode', 'link');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#magnet_links')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#file_browser')).toBeFalsy();
  });

  it('should emit inputModeChange when the link toggle is selected', () => {
    const emitSpy = vi.spyOn(component.inputModeChange, 'emit');

    const linkRadio: HTMLInputElement = fixture.nativeElement.querySelector('#inputMode_link');
    linkRadio.dispatchEvent(new Event('change'));

    expect(emitSpy).toHaveBeenCalledWith('link');
  });

  it('should emit fileSelected when the file input changes', () => {
    const emitSpy = vi.spyOn(component.fileSelected, 'emit');

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    const event = new Event('change');
    fileInput.dispatchEvent(event);

    expect(emitSpy).toHaveBeenCalledWith(event);
  });

  it('should bind the rename field to the form', () => {
    const renameInput: HTMLInputElement = fixture.nativeElement.querySelector('#rename');
    renameInput.value = 'my-torrent';
    renameInput.dispatchEvent(new Event('input'));

    expect(component.form().controls.rename.value).toBe('my-torrent');
  });

  describe('ensureCategoryExists', () => {
    it('should delegate to the nested CategorySelect and return true for an empty category', async () => {
      expect(await component.ensureCategoryExists()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

Run: `npm test -w @bitbutler/app -- add-torrent/general`
Expected: FAIL - `Cannot find module './general'` (or similar resolution error)

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/add-torrent/general/general.ts`:

```typescript
import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFile, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { BbPopover } from '../../bb-popover/bb-popover';
import { CategorySelect } from '../../category-select/category-select';
import { SavePathSelect } from '../../save-path-select/save-path-select';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-add-torrent-general',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    FontAwesomeModule,
    BbPopover,
    TranslatePipe,
    CategorySelect,
    SavePathSelect,
    TagSelect,
  ],
  templateUrl: './general.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public form = input.required<AddTorrentFormGroup>();
  public inputMode = input.required<'file' | 'link'>();
  public inputModeChange = output<'file' | 'link'>();
  public fileSelected = output<Event>();

  private readonly categorySelect = viewChild(CategorySelect);

  public icons = { faFile, faLink };

  public ensureCategoryExists(): Promise<boolean> | undefined {
    return this.categorySelect()?.ensureCategoryExists();
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/add-torrent/general/general.html`:

```html
<div [formGroup]="form()">
  <div class="container-fluid px-0">
    <div class="row">
      <div class="col-12 mb-3">
        <div class="btn-group" role="group">
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

      <div class="col-12"><hr class="mt-0" /></div>

      <div class="col-11">
        <div class="form-floating mb-3">
          <input
            type="text"
            class="form-control"
            id="rename"
            [placeholder]="'components.add-torrent.add-form.rename' | translate"
            formControlName="rename"
            [class.is-invalid]="form().controls.rename.invalid && form().controls.rename.dirty"
          />
          <label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
          @if (form().controls.rename.invalid && form().controls.rename.dirty) { @if
          (form().controls.rename.hasError('required')) {
          <div class="invalid-feedback px-2">
            {{ 'general.form.feedback.required' | translate }}
          </div>
          } @else if (form().controls.rename.hasError('pattern')) {
          <div class="invalid-feedback px-2">{{ 'general.form.feedback.pattern' | translate }}</div>
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
```

- [ ] **Step 5: Run the spec again to confirm it passes**

Run: `npm test -w @bitbutler/app -- add-torrent/general`
Expected: PASS (all tests in `general.spec.ts`)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/add-torrent/general
git commit -m "#159: add AddTorrentGeneral tab component"
```

---

### Task 6: Create `AddTorrentOptions` component

**Files:**

- Create: `packages/app/src/app/components/add-torrent/options/options.spec.ts`
- Create: `packages/app/src/app/components/add-torrent/options/options.ts`
- Create: `packages/app/src/app/components/add-torrent/options/options.html`

This tab holds the old "Settings" fieldset content (root folder, skip-hash-checking, paused, auto TMM, sequential download, first/last piece priority), including `rootFolderOptions` and the `faExclamationTriangle` icon (both moved out of the parent).

- [ ] **Step 1: Write the spec (will fail - `./options` doesn't exist yet)**

Create `packages/app/src/app/components/add-torrent/options/options.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { ShareLimitValue } from '../../share-limit/share-limit';
import { TransferLimitValue } from '../../transfer-limit/transfer-limit';
import { AddTorrentOptions } from './options';

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

describe('AddTorrentOptions', () => {
  let component: AddTorrentOptions;
  let fixture: ComponentFixture<AddTorrentOptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentOptions],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentOptions);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', createForm());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose three root folder options', () => {
    expect(component.rootFolderOptions.map((option) => option.value)).toEqual([
      'unset',
      'true',
      'false',
    ]);
  });

  it('should toggle skip_checking via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#skip_checking');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.skip_checking.value).toBe(true);
  });

  it('should toggle paused via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#paused');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.paused.value).toBe(true);
  });

  it('should toggle autoTMM via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#autoTMM');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.autoTMM.value).toBe(true);
  });

  it('should toggle sequentialDownload via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#sequentialDownload');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.sequentialDownload.value).toBe(true);
  });

  it('should toggle firstLastPiecePrio via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#firstLastPiecePrio');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.firstLastPiecePrio.value).toBe(true);
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

Run: `npm test -w @bitbutler/app -- add-torrent/options`
Expected: FAIL - `Cannot find module './options'` (or similar resolution error)

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/add-torrent/options/options.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { BbPopover } from '../../bb-popover/bb-popover';

@Component({
  selector: 'app-add-torrent-options',
  imports: [ReactiveFormsModule, NgSelectModule, FontAwesomeModule, BbPopover, TranslatePipe],
  templateUrl: './options.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentOptions {
  private readonly translateService = inject(TranslateService);

  public form = input.required<AddTorrentFormGroup>();

  public faExclamationTriangle = faExclamationTriangle;

  public rootFolderOptions = [
    {
      value: 'unset',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.default',
      ),
    },
    {
      value: 'true',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.create-root-folder',
      ),
    },
    {
      value: 'false',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.do-not-create-root-folder',
      ),
    },
  ];
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/add-torrent/options/options.html`:

```html
<div [formGroup]="form()">
  <div class="container-fluid px-0">
    <div class="row">
      <div class="col-11">
        <div class="form-floating mb-3">
          <ng-select
            id="root_folder"
            formControlName="root_folder"
            [items]="rootFolderOptions"
            bindValue="value"
            bindLabel="label"
            [clearable]="false"
            [searchable]="false"
          ></ng-select>
          <label for="root_folder"
            >{{ 'components.add-torrent.add-form.root-folder.title' | translate }}</label
          >
        </div>
      </div>

      <div class="col-1 d-flex align-items-center mb-3">
        <bb-popover
          class="mt-2"
          [subject]="'components.add-torrent.popover.root-folder.title' | translate"
          [description]="rootFolder"
          placement="left"
        ></bb-popover>
      </div>

      <div class="col-12">
        <div class="form-check form-switch mb-3">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="skip_checking"
            formControlName="skip_checking"
          />
          <label class="form-check-label" for="skip_checking"
            >{{ 'components.add-torrent.add-form.skip-hash-checking' | translate }}</label
          >
          <bb-popover
            [subject]="'components.add-torrent.popover.skip-hash-checking.title' | translate"
            [description]="skipChecking"
            placement="right"
          ></bb-popover>
        </div>
      </div>

      <div class="col-12">
        <div class="form-check form-switch mb-3">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="paused"
            formControlName="paused"
          />
          <label class="form-check-label" for="paused"
            >{{ 'components.add-torrent.add-form.paused' | translate }}</label
          >
          <bb-popover
            [subject]="'components.add-torrent.popover.paused-state.title' | translate"
            [description]="pausedState"
            placement="right"
          ></bb-popover>
        </div>
      </div>

      <div class="col-12">
        <div class="form-check form-switch mb-3">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="autoTMM"
            formControlName="autoTMM"
          />
          <label class="form-check-label" for="autoTMM"
            >{{ 'components.add-torrent.add-form.auto-tmm' | translate }}</label
          >
          <bb-popover
            [subject]="'components.add-torrent.popover.auto-tmm.title' | translate"
            [description]="autoTMM"
            placement="right"
          ></bb-popover>
        </div>
      </div>

      <div class="col-12">
        <div class="form-check form-switch mb-3">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="sequentialDownload"
            formControlName="sequentialDownload"
          />
          <label class="form-check-label" for="sequentialDownload"
            >{{ 'components.add-torrent.add-form.sequential-download' | translate }}</label
          >
          <bb-popover
            [subject]="'components.add-torrent.popover.sequential-download.title' | translate"
            [description]="sequentialDownload"
            placement="right"
          ></bb-popover>
        </div>
      </div>

      <div class="col-12">
        <div class="form-check form-switch mb-3">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="firstLastPiecePrio"
            formControlName="firstLastPiecePrio"
          />
          <label class="form-check-label" for="firstLastPiecePrio"
            >{{ 'components.add-torrent.add-form.first-last-piece-prio' | translate }}</label
          >
          <bb-popover
            [subject]="'components.add-torrent.popover.first-last-piece-prio.title' | translate"
            [description]="firstLastPiece"
            placement="right"
          ></bb-popover>
        </div>
      </div>
    </div>
  </div>
</div>

<ng-template #rootFolder>
  <p>{{ 'components.add-torrent.popover.root-folder.description.line1' | translate }}</p>
  <ul class="mb-0">
    <li
      [innerHTML]="'components.add-torrent.popover.root-folder.description.line2' | translate"
    ></li>
    <li
      [innerHTML]="'components.add-torrent.popover.root-folder.description.line3' | translate"
    ></li>
    <li
      [innerHTML]="'components.add-torrent.popover.root-folder.description.line4' | translate"
    ></li>
  </ul>
</ng-template>

<ng-template #skipChecking>
  <p>{{ 'components.add-torrent.popover.skip-hash-checking.description.line1' | translate }}</p>
  <p class="text-warning">
    <fa-icon [icon]="faExclamationTriangle" class="me-1"></fa-icon>
    {{ 'components.add-torrent.popover.skip-hash-checking.description.line2' | translate }}
  </p>
</ng-template>

<ng-template #pausedState>
  <p>{{ 'components.add-torrent.popover.paused-state.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.paused-state.description.line2' | translate }}</p>
</ng-template>

<ng-template #autoTMM>
  <p>{{ 'components.add-torrent.popover.auto-tmm.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.auto-tmm.description.line2' | translate }}</p>
</ng-template>

<ng-template #sequentialDownload>
  <p>{{ 'components.add-torrent.popover.sequential-download.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.sequential-download.description.line2' | translate }}</p>
</ng-template>

<ng-template #firstLastPiece>
  <p>{{ 'components.add-torrent.popover.first-last-piece-prio.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.first-last-piece-prio.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 5: Run the spec again to confirm it passes**

Run: `npm test -w @bitbutler/app -- add-torrent/options`
Expected: PASS (all tests in `options.spec.ts`)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/add-torrent/options
git commit -m "#159: add AddTorrentOptions tab component"
```

---

### Task 7: Create `AddTorrentLimits` component

**Files:**

- Create: `packages/app/src/app/components/add-torrent/limits/limits.spec.ts`
- Create: `packages/app/src/app/components/add-torrent/limits/limits.ts`
- Create: `packages/app/src/app/components/add-torrent/limits/limits.html`

This tab holds the old "Limits" fieldset content (transfer rate limits + share limits). Both nested components implement `ControlValueAccessor` and already have their own field labels, so no extra section headers are needed.

- [ ] **Step 1: Write the spec (will fail - `./limits` doesn't exist yet)**

Create `packages/app/src/app/components/add-torrent/limits/limits.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { ShareLimitValue } from '../../share-limit/share-limit';
import { TransferLimitValue } from '../../transfer-limit/transfer-limit';
import { AddTorrentLimits } from './limits';

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

describe('AddTorrentLimits', () => {
  let component: AddTorrentLimits;
  let fixture: ComponentFixture<AddTorrentLimits>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentLimits],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentLimits);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', createForm());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the transfer rate limit control', () => {
    expect(fixture.nativeElement.querySelector('app-transfer-limit')).toBeTruthy();
  });

  it('should render the share limit control', () => {
    expect(fixture.nativeElement.querySelector('app-share-limit')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

Run: `npm test -w @bitbutler/app -- add-torrent/limits`
Expected: FAIL - `Cannot find module './limits'` (or similar resolution error)

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/add-torrent/limits/limits.ts`:

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { ShareLimit } from '../../share-limit/share-limit';
import { TransferLimit } from '../../transfer-limit/transfer-limit';

@Component({
  selector: 'app-add-torrent-limits',
  imports: [ReactiveFormsModule, TranslatePipe, TransferLimit, ShareLimit],
  templateUrl: './limits.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentLimits {
  public form = input.required<AddTorrentFormGroup>();
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/add-torrent/limits/limits.html`:

```html
<div [formGroup]="form()">
  <div class="container px-0">
    <div class="row">
      <div class="col-12">
        <h6>{{ 'components.add-torrent.label.transfer-rate-limits' | translate }}</h6>
        <app-transfer-limit formControlName="transferRateLimits"></app-transfer-limit>
      </div>

      <div class="col-12 mt-3">
        <h6>{{ 'components.add-torrent.label.share-limits' | translate }}</h6>
        <app-share-limit formControlName="shareLimits"></app-share-limit>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run the spec again to confirm it passes**

Run: `npm test -w @bitbutler/app -- add-torrent/limits`
Expected: PASS (all tests in `limits.spec.ts`)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/add-torrent/limits
git commit -m "#159: add AddTorrentLimits tab component"
```

---

### Task 8: Create `AddTorrentFiles` component

**Files:**

- Create: `packages/app/src/app/components/add-torrent/files/files.spec.ts`
- Create: `packages/app/src/app/components/add-torrent/files/files.ts`
- Create: `packages/app/src/app/components/add-torrent/files/files.html`

This tab wraps `app-bb-file-tree`. The parent only renders this component when there's a draft with files (Task 9), but it defends against a `null` draft itself so it stays self-contained.

- [ ] **Step 1: Write the spec (will fail - `./files` doesn't exist yet)**

Create `packages/app/src/app/components/add-torrent/files/files.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { TorrentDraft } from '@bitbutler/shared';
import { ConfirmService } from '../../../services/confirm.service';
import { BbFileTree, FileTreeSaveEvent } from '../../bb-file-tree/bb-file-tree';
import { AddTorrentFiles } from './files';

const draft: TorrentDraft = {
  source: 'manual',
  receivedAt: Date.now(),
  torrent: {
    name: 'test-torrent',
    totalSize: 100,
    files: [{ path: 'file1.txt', length: 100 }],
  },
};

describe('AddTorrentFiles', () => {
  let component: AddTorrentFiles;
  let fixture: ComponentFixture<AddTorrentFiles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentFiles],
      providers: [
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentFiles);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should not render the file tree when draft is null', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-bb-file-tree')).toBeFalsy();
  });

  it('should render the file tree with the draft files', () => {
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();

    const fileTree = fixture.debugElement.query(By.directive(BbFileTree))
      .componentInstance as BbFileTree;
    expect(fileTree.files()).toEqual(draft.torrent!.files);
  });

  it('should re-emit saved from the nested file tree', () => {
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();

    const saveEvent: FileTreeSaveEvent = { files: draft.torrent!.files, renames: [] };
    let emitted: FileTreeSaveEvent | undefined;
    component.saved.subscribe((event) => (emitted = event));

    const fileTree = fixture.debugElement.query(By.directive(BbFileTree))
      .componentInstance as BbFileTree;
    fileTree.saved.emit(saveEvent);

    expect(emitted).toEqual(saveEvent);
  });

  it('should re-emit editModeChange from the nested file tree', () => {
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();

    let emitted: boolean | undefined;
    component.editModeChange.subscribe((value) => (emitted = value));

    const fileTree = fixture.debugElement.query(By.directive(BbFileTree))
      .componentInstance as BbFileTree;
    fileTree.editModeChange.emit(true);

    expect(emitted).toBe(true);
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails**

Run: `npm test -w @bitbutler/app -- add-torrent/files`
Expected: FAIL - `Cannot find module './files'` (or similar resolution error)

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/add-torrent/files/files.ts`:

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TorrentDraft } from '@bitbutler/shared';
import { BbFileTree, FileTreeSaveEvent } from '../../bb-file-tree/bb-file-tree';

@Component({
  selector: 'app-add-torrent-files',
  imports: [BbFileTree],
  templateUrl: './files.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFiles {
  public draft = input<TorrentDraft | null>(null);
  public saved = output<FileTreeSaveEvent>();
  public editModeChange = output<boolean>();
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/add-torrent/files/files.html`:

```html
@if (draft()) {
<app-bb-file-tree
  [files]="draft()!.torrent!.files"
  [expandAll]="true"
  [showMeta]="true"
  [allowEdit]="true"
  [hideProgress]="true"
  (saved)="saved.emit($event)"
  (editModeChange)="editModeChange.emit($event)"
>
</app-bb-file-tree>
}
```

- [ ] **Step 5: Run the spec again to confirm it passes**

Run: `npm test -w @bitbutler/app -- add-torrent/files`
Expected: PASS (all tests in `files.spec.ts`)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/add-torrent/files
git commit -m "#159: add AddTorrentFiles tab component"
```

---

### Task 9: Rebuild `AddTorrent` parent as a tab shell

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

This task rewrites the parent `AddTorrent` component to own the shared `addForm`, tab
selection, per-tab warning aggregation, and the simplified `canSubmit()`, while rendering
the four new tab child components (`AddTorrentGeneral`/`Options`/`Limits`/`Files`) created
in Tasks 5-8. The old `noSlashValidator()` is replaced by
`Validators.pattern(INVALID_FILENAME_CHARS)` (from Task 1), and `categorySelect` becomes
`generalTab` (delegating to `AddTorrentGeneral.ensureCategoryExists()`).

- [ ] **Step 1: Update the spec file (will fail - new members don't exist yet, old `noSlash` errors are gone)**

Replace the entire contents of `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { TorrentDraft } from '@bitbutler/shared';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { OpenFilesService } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { AddTorrent } from './add-torrent';

const draftWithFiles: TorrentDraft = {
  source: 'manual',
  receivedAt: Date.now(),
  torrent: {
    name: 'test-torrent',
    totalSize: 100,
    files: [{ path: 'file1.txt', length: 100 }],
  },
};

describe('AddTorrent', () => {
  let component: AddTorrent;
  let fixture: ComponentFixture<AddTorrent>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockOpenFilesService: any;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockOpenFilesService = {
      pendingDrafts: signal([]),
      consumeCurrentDraft: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AddTorrent],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: NgbModal, useValue: { open: vi.fn() } },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
        { provide: OpenFilesService, useValue: mockOpenFilesService },
        {
          provide: AddTorrentSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({}),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ behavior: { deleteTorrentFile: false } }),
            asObservable: vi.fn().mockReturnValue(of(DEFAULT_GENERAL_SETTINGS)),
          },
        },
        {
          provide: QbService,
          useValue: {
            getAppPreferences: vi.fn().mockResolvedValue({ save_path: '/downloads' }),
            torrentsAdd: vi.fn().mockResolvedValue(undefined),
            torrentContents: vi.fn().mockResolvedValue([]),
            renameTorrentFile: vi.fn(),
            renameTorrentFolder: vi.fn(),
            setFilePriority: vi.fn(),
            setShareLimits: vi.fn().mockResolvedValue(undefined),
            getAllCategories: vi.fn().mockResolvedValue({}),
            addCategory: vi.fn().mockResolvedValue(undefined),
            getAllTags: vi.fn().mockResolvedValue([]),
            createTags: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with isSubmitting = false', () => {
    expect(component.isSubmitting()).toBe(false);
  });

  it('should start with showTree = false', () => {
    expect(component.showTree()).toBe(false);
  });

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
      component.addForm.controls.rename.setValue('valid-name');
      component.addForm.setErrors({ noServerSelected: true });

      expect(component.tabIssues().general).toContain(
        'components.add-torrent.feedback.no-server-selected',
      );
    });

    it('should report an addFailed issue on the general tab', () => {
      component.addForm.controls.rename.setValue('valid-name');
      component.addForm.setErrors({ addFailed: true });

      expect(component.tabIssues().general).toContain('components.add-torrent.feedback.add-failed');
    });

    it('should report a files tab issue while the file tree is in edit mode', () => {
      component.treeInEditMode.set(true);

      expect(component.tabIssues().files).toContain(
        'components.add-torrent.tab.files.issue.edit-in-progress',
      );
      expect(component.hasActiveWarnings()).toBe(true);
    });
  });

  describe('filesTabDisabled / filesTabDisabledReason', () => {
    it('should be disabled with a no-files reason by default', () => {
      expect(component.filesTabDisabledReason()).toBe(
        'components.add-torrent.tab.files.disabled.no-files',
      );
      expect(component.filesTabDisabled()).toBe(true);
    });

    it('should be disabled with a link-mode reason when input mode is link', () => {
      component.switchInputMode('link');

      expect(component.filesTabDisabledReason()).toBe(
        'components.add-torrent.tab.files.disabled.link-mode',
      );
      expect(component.filesTabDisabled()).toBe(true);
    });

    it('should be enabled when a draft with files is loaded and the tree is shown', () => {
      component.manualDraft.set(draftWithFiles);
      component.showTree.set(true);

      expect(component.filesTabDisabledReason()).toBeNull();
      expect(component.filesTabDisabled()).toBe(false);
    });
  });

  describe('selectTab / activeTabId', () => {
    it('should default to the general tab', () => {
      expect(component.activeTabId()).toBe('general');
    });

    it('should switch tabs via selectTab', () => {
      component.selectTab('options');
      expect(component.activeTabId()).toBe('options');
    });

    it('should switch away from the files tab once it becomes disabled', () => {
      component.manualDraft.set(draftWithFiles);
      component.showTree.set(true);
      fixture.detectChanges();

      component.selectTab('files');
      fixture.detectChanges();
      expect(component.activeTabId()).toBe('files');

      component.switchInputMode('link');
      fixture.detectChanges();

      expect(component.activeTabId()).toBe('general');
    });
  });

  describe('handleCancel', () => {
    it('should dismiss the modal when no pending drafts', () => {
      mockOpenFilesService.pendingDrafts.set([]);
      component.handleCancel();
      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });

    it('should consume the current draft when queue is non-empty', () => {
      mockOpenFilesService.pendingDrafts.set([{ draft: {}, selected: {} } as any]);
      component.handleCancel();
      expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
    });
  });

  describe('ngOnInit savepath behaviour', () => {
    it('should leave savepath null when AddTorrentSettings returns no savepath', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({});

      await component.ngOnInit();

      expect(component.addForm.controls.savepath.value).toBeNull();
    });
  });

  describe('tryRenameContentAfterAdd', () => {
    let mockQbService: any;
    const hash = 'abcdef1234567890';
    const draft: Partial<TorrentDraft> = { torrent: { infoHashV1: hash } as any };

    beforeEach(() => {
      mockQbService = TestBed.inject(QbService) as any;
      component.manualDraft.set(draft as TorrentDraft);
      mockQbService.torrentContents.mockResolvedValue([{ name: 'file.mkv', index: 0 }]);
    });

    it('should call setShareLimits when inactiveSeedingTimeLimit is no-limit (-1)', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: -2,
        seedingTimeLimit: -2,
        inactiveSeedingTimeLimit: -1,
      });
      expect(mockQbService.setShareLimits).toHaveBeenCalledWith('server-1', [hash], -2, -2, -1);
    });

    it('should call setShareLimits when inactiveSeedingTimeLimit is a custom value', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: 2,
        seedingTimeLimit: 120,
        inactiveSeedingTimeLimit: 60,
      });
      expect(mockQbService.setShareLimits).toHaveBeenCalledWith('server-1', [hash], 2, 120, 60);
    });

    it('should not call setShareLimits when inactiveSeedingTimeLimit is global (-2)', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: -2,
        seedingTimeLimit: -2,
        inactiveSeedingTimeLimit: -2,
      });
      expect(mockQbService.setShareLimits).not.toHaveBeenCalled();
    });

    it('should not call setShareLimits when shareLimits is null', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', null);
      expect(mockQbService.setShareLimits).not.toHaveBeenCalled();
    });
  });

  describe('handleSubmit category creation', () => {
    let mockQbService: any;
    let torrentsAddSpy: any;

    beforeEach(() => {
      mockQbService = TestBed.inject(QbService) as any;
      torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });
      component.addForm.controls.rename.setValue('test-torrent');
    });

    it('should create a typed category before adding the torrent', async () => {
      component.addForm.controls.category.setValue('new-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'new-category', '');
      expect(torrentsAddSpy).toHaveBeenCalled();
    });

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

- [ ] **Step 2: Run the spec to confirm it fails**

Run: `npm test -w @bitbutler/app -- add-torrent/add-torrent`
Expected: FAIL - `component.tabIssues`, `component.filesTabDisabled`, `component.filesTabDisabledReason`, `component.selectTab`, `component.activeTabId` are not functions (current `AddTorrent` doesn't define them yet), and the `pattern` error assertions fail because the current validator still produces `noSlash`.

- [ ] **Step 3: Replace `add-torrent.ts`**

Replace the entire contents of `packages/app/src/app/components/add-torrent/add-torrent.ts`:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TorrentDraft } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faCircleQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal, NgbPopover } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { INVALID_FILENAME_CHARS } from '../../app.const';
import { AutofocusDirective } from '../../directives/autofocus';
import { AddTorrentFormGroup, RootFolderMode } from '../../models/add-torrent.model';
import type { SelectedTorrentInput } from '../../models/command.model';
import { HttpError } from '../../models/http.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { OpenFilesService, PendingAddTorrent } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { setModalInput } from '../../utils/modal-input';
import { FileTreeSaveEvent } from '../bb-file-tree/bb-file-tree';
import { TorrentExists } from '../modals/torrent-exists/torrent-exists';
import { ShareLimitValue } from '../share-limit/share-limit';
import { TransferLimitValue } from '../transfer-limit/transfer-limit';
import { AddTorrentFiles } from './files/files';
import { AddTorrentGeneral } from './general/general';
import { AddTorrentLimits } from './limits/limits';
import { AddTorrentOptions } from './options/options';

export type AddTorrentTabId = 'general' | 'options' | 'limits' | 'files';

interface AddTorrentTab {
  id: AddTorrentTabId;
  label: string;
}

@Component({
  selector: 'app-add-torrent',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    FontAwesomeModule,
    NgbPopover,
    TranslatePipe,
    AddTorrentFiles,
    AddTorrentGeneral,
    AddTorrentLimits,
    AddTorrentOptions,
  ],
  templateUrl: './add-torrent.html',
  styleUrl: './add-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrent implements OnInit {
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.handleCancel();
  }
  public readonly activeModal = inject(NgbActiveModal);
  private readonly modalService = inject(NgbModal);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly addTorrentSettings = inject(AddTorrentSettingsService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly qbService = inject(QbService);
  private readonly openFilesService = inject(OpenFilesService);
  private readonly translateService = inject(TranslateService);

  private readonly generalTab = viewChild(AddTorrentGeneral);

  public pending = this.openFilesService.pendingDrafts;
  public queueCount = computed(() => this.pending().length);
  public currentDraftNumber = computed(() => this.initialQueueCount() - this.queueCount() + 1);

  public manualDraft = signal<TorrentDraft | null>(null);
  public inputMode = signal<'file' | 'link'>('file');
  public showTree = signal(false);
  public treeInEditMode = signal(false);
  private savedFileState: FileTreeSaveEvent | null = null;

  private selectedTorrentFile = signal<SelectedTorrentInput | null>(null);
  public initialQueueCount = signal(0);
  public isSubmitting = signal(false);
  private loadedDraftIdentifier = signal<string | null>(null);

  public icons: Record<string, IconDefinition> = { faTriangleExclamation, faCircleQuestion };

  public activeTabId = signal<AddTorrentTabId>('general');

  public tabs: AddTorrentTab[] = [
    { id: 'general', label: 'components.add-torrent.tab.general.title' },
    { id: 'options', label: 'components.add-torrent.tab.options.title' },
    { id: 'limits', label: 'components.add-torrent.tab.limits.title' },
    { id: 'files', label: 'components.add-torrent.tab.files.title' },
  ];

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

  private readonly formStatus = toSignal(this.addForm.statusChanges, {
    initialValue: this.addForm.status,
  });

  public effectiveDraft = computed(() => this.manualDraft() ?? this.pending()?.[0]?.draft);

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
      general.push(
        this.translateService.instant('components.add-torrent.feedback.no-server-selected'),
      );
    }
    if (formErrors?.['addFailed']) {
      general.push(this.translateService.instant('components.add-torrent.feedback.add-failed'));
    }
    if (general.length) issues.general = general;

    if (this.treeInEditMode()) {
      issues.files = [
        this.translateService.instant('components.add-torrent.tab.files.issue.edit-in-progress'),
      ];
    }

    return issues;
  });

  public readonly hasActiveWarnings = computed(() =>
    Object.values(this.tabIssues()).some((list) => (list?.length ?? 0) > 0),
  );

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

  constructor() {
    effect(() => {
      if (this.inputMode() === 'link') return;

      const pending = this.pending();
      if (pending.length > this.initialQueueCount()) {
        this.initialQueueCount.set(pending.length);
      }

      const first = pending[0];
      if (!first) {
        if (this.initialQueueCount() > 0) this.activeModal.close(true);
        return;
      }
      this.loadDraft(first, 'input');
    });

    effect(() => {
      if (this.activeTabId() === 'files' && this.filesTabDisabled()) {
        this.activeTabId.set('general');
      }
    });
  }

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
    if (this.queueCount() > 0) {
      this.openFilesService.consumeCurrentDraft();
    } else {
      this.activeModal.dismiss();
    }
  }

  public onTreeSaved(event: FileTreeSaveEvent): void {
    this.savedFileState = event;
  }

  public selectTab(tabId: AddTorrentTabId): void {
    this.activeTabId.set(tabId);
  }

  public async handleSubmit(event: SubmitEvent | PointerEvent): Promise<void> {
    event.preventDefault();

    if (!this.canSubmit()) return;

    const serverId = this.serverStoreService.currentServerId();

    if (!serverId) {
      this.addForm.setErrors({ noServerSelected: true });
      return;
    }

    if (!(await this.generalTab()?.ensureCategoryExists())) {
      return;
    }

    const raw = this.addForm.getRawValue();

    const sharedOptions = {
      savepath: raw.savepath?.trim() || undefined,
      rename: raw.rename?.trim() || undefined,
      category: raw.category?.trim() || undefined,
      tags: raw.tags?.join(',') || undefined,
      paused: raw.paused ? 'true' : 'false',
      skip_checking: raw.skip_checking ? 'true' : 'false',
      sequentialDownload: raw.sequentialDownload ? 'true' : 'false',
      firstLastPiecePrio: raw.firstLastPiecePrio ? 'true' : 'false',
      autoTMM: raw.autoTMM ? 'true' : 'false',
      root_folder: raw.root_folder === 'unset' ? undefined : raw.root_folder,
      upLimit:
        raw.transferRateLimits?.uploadLimit != null
          ? String(Math.round(raw.transferRateLimits.uploadLimit * 1024))
          : undefined,
      dlLimit:
        raw.transferRateLimits?.downloadLimit != null
          ? String(Math.round(raw.transferRateLimits.downloadLimit * 1024))
          : undefined,
      ratioLimit:
        raw.shareLimits?.ratioLimit != null ? String(raw.shareLimits.ratioLimit) : undefined,
      seedingTimeLimit:
        raw.shareLimits?.seedingTimeLimit != null
          ? String(raw.shareLimits.seedingTimeLimit)
          : undefined,
    };

    this.isSubmitting.set(true);
    try {
      if (this.inputMode() === 'link') {
        await window.bitbutler.qb.torrentsAdd({
          id: serverId,
          urls: this.getMagnetLinks(),
          torrents: [],
          options: sharedOptions,
        });
      } else {
        const selectedFile = this.selectedTorrentFile()!;
        await window.bitbutler.qb.torrentsAdd({
          id: serverId,
          torrents: [selectedFile],
          options: sharedOptions,
        });

        const state = this.savedFileState;
        const hasTreeCustomizations =
          state != null &&
          (state.renames.length > 0 || state.files.some((f) => (f.priority ?? 1) !== 1));
        const inactiveLimit = raw.shareLimits?.inactiveSeedingTimeLimit ?? null;
        const needsInactivePost = inactiveLimit !== null && inactiveLimit !== -2;
        if (hasTreeCustomizations || needsInactivePost) {
          await this.tryRenameContentAfterAdd(serverId, raw.shareLimits);
        }
      }

      await this.addTorrentSettings.save({
        savepath: raw.savepath,
        paused: raw.paused,
        category: raw.category,
        tags: raw.tags?.join(',') || null,
        root_folder: raw.root_folder,
        skip_checking: raw.skip_checking,
        sequentialDownload: raw.sequentialDownload,
        firstLastPiecePrio: raw.firstLastPiecePrio,
        autoTMM: raw.autoTMM,
        transferRateLimits: raw.transferRateLimits,
        shareLimits: raw.shareLimits,
      });

      if (this.inputMode() === 'link') {
        this.activeModal.close(true);
      } else {
        const originalPath = this.effectiveDraft()?.originalPath;
        if (originalPath) {
          const generalSettings = await this.generalSettingsService.load();
          if (generalSettings.behavior.deleteTorrentFile) {
            await window.bitbutler.torrent.deleteFile({ path: originalPath });
          }
        }
        this.openFilesService.consumeCurrentDraft();
      }
    } catch (e) {
      let parsed: { name?: string; status?: number } = {};
      try {
        const msg = String((e as Error)?.message ?? e);
        const idx = msg.indexOf('{');
        if (idx !== -1) parsed = JSON.parse(msg.slice(idx));
      } catch {}

      if (parsed.name === 'QbHttpError' && parsed.status === 409) {
        const hash = this.effectiveDraft()?.torrent?.infoHashV1?.toLowerCase() ?? null;
        const modalRef = this.modalService.open(TorrentExists, { centered: true });
        setModalInput(modalRef, 'hash', hash);
        this.openFilesService.consumeCurrentDraft();
      } else {
        console.error(AddTorrent.name, 'handleSubmit', '[AddTorrent] qb add failed', e);
        this.addForm.setErrors({ addFailed: true });
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  public canSubmit(): boolean {
    if (!this.addForm.valid || this.hasActiveWarnings() || this.isSubmitting()) return false;
    return this.inputMode() === 'link'
      ? this.getMagnetLinks().length > 0
      : this.selectedTorrentFile() !== null;
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

  public async handleFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const fileList = input.files;
    if (!fileList || fileList.length === 0) return;

    this.initialQueueCount.set(0);
    this.loadedDraftIdentifier.set(null);

    const file = fileList[0];
    const filePath = ((file as any).path as string | undefined)?.trim();

    let torrent: SelectedTorrentInput;
    if (filePath) {
      torrent = { name: file.name, path: filePath };
    } else {
      const buf = await file.arrayBuffer();
      torrent = { name: file.name, bytes: Array.from(new Uint8Array(buf)) };
    }

    try {
      const draft =
        'path' in torrent
          ? await window.bitbutler.torrent.parse({ source: 'manual', path: torrent.path })
          : await window.bitbutler.torrent.parse({
              source: 'manual',
              originalName: torrent.name,
              bytes: torrent.bytes,
            });
      this.openFilesService.pendingDrafts.set([{ draft, selected: torrent }]);
    } catch (e) {
      console.error(AddTorrent.name, 'handleFileSelected', 'manual parse failed:', e);
    } finally {
      input.value = '';
    }
  }

  private isAlreadyInList(draft: TorrentDraft): boolean {
    const hash = draft?.torrent?.infoHashV1?.toLowerCase();
    if (!hash) return false;

    return this.torrentStoreService.torrentsArray().some((t) => t.hash?.toLowerCase() === hash);
  }

  private loadDraft(pending: PendingAddTorrent, _source: 'input' | 'manual'): void {
    const draft = pending.draft;
    const identifier = draft.torrent?.infoHashV1 ?? draft.originalPath;

    if (identifier && this.loadedDraftIdentifier() === identifier) {
      return;
    }
    this.loadedDraftIdentifier.set(identifier ?? null);

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
  }

  private async tryRenameContentAfterAdd(
    serverId: string,
    shareLimits?: ShareLimitValue | null,
  ): Promise<void> {
    const hash = this.effectiveDraft()?.torrent?.infoHashV1?.trim();
    if (!hash) return;

    const pollForTorrent = async (): Promise<void> => {
      const maxRetries = 10;
      const delay = 500;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const contents = await this.qbService.torrentContents(serverId, hash, {
            suppressErrors: true,
          });
          if (contents && contents.length > 0) return;
        } catch (e) {
          if (!(e instanceof HttpError && e.status === 404)) throw e;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      throw new Error(`Torrent ${hash} not found after ${maxRetries * delay}ms`);
    };

    try {
      await pollForTorrent();

      for (const item of this.savedFileState?.renames ?? []) {
        await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
      }

      const savedFiles = this.savedFileState?.files ?? null;
      if (savedFiles) {
        const nonDefault = savedFiles.filter((f) => (f.priority ?? 1) !== 1);
        if (nonDefault.length > 0) {
          const contents = await this.qbService.torrentContents(serverId, hash);
          const pathToIndex = new Map(contents.map((c) => [c.name, c.index]));
          for (const f of nonDefault) {
            const index = pathToIndex.get(f.path);
            if (index !== undefined) {
              await this.qbService.setFilePriority(serverId, hash, [index], f.priority ?? 0);
            }
          }
        }
      }

      if (shareLimits != null) {
        const inactiveLimit = shareLimits.inactiveSeedingTimeLimit;
        if (inactiveLimit !== null && inactiveLimit !== -2) {
          await this.qbService.setShareLimits(
            serverId,
            [hash],
            shareLimits.ratioLimit ?? -2,
            shareLimits.seedingTimeLimit ?? -2,
            inactiveLimit,
          );
        }
      }
    } catch (error) {
      console.error(AddTorrent.name, 'tryRenameContentAfterAdd', error);
    }
  }
}
```

- [ ] **Step 4: Replace `add-torrent.html`**

Replace the entire contents of `packages/app/src/app/components/add-torrent/add-torrent.html`:

```html
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5 class="modal-title bb-title-clamp">{{ 'components.add-torrent.title' | translate }}</h5>

    @if (initialQueueCount() > 1) {
    <div class="small text-body-secondary mt-1 bb-hash-clamp">
      ({{ currentDraftNumber() }} / {{ initialQueueCount() }})
    </div>
    }

    <ul class="nav nav-tabs bb-modal-tabs">
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
    </ul>
  </div>

  <button type="button" class="btn-close" aria-label="Close" (click)="handleCancel()"></button>
</div>

<div class="modal-body">
  <form [formGroup]="addForm" (submit)="handleSubmit($event)">
    <div class="bb-tab-panels">
      <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === 'general'">
        <app-add-torrent-general
          [form]="addForm"
          [inputMode]="inputMode()"
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
          [draft]="effectiveDraft() ?? null"
          (saved)="onTreeSaved($event)"
          (editModeChange)="treeInEditMode.set($event)"
        ></app-add-torrent-files>
        }
      </div>
    </div>

    <button type="submit" hidden></button>
  </form>
</div>

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

<ng-template #tabIssuesPopover let-issues>
  <ul class="mb-0 ps-3">
    @for (issue of issues; track issue) {
    <li>{{ issue }}</li>
    }
  </ul>
</ng-template>
```

- [ ] **Step 5: Run the spec again to confirm it passes**

Run: `npm test -w @bitbutler/app -- add-torrent/add-torrent`
Expected: PASS (all tests in `add-torrent.spec.ts`)

- [ ] **Step 6: Remove now-unused i18n keys from `us.json`**

The old "Settings"/"Limits"/"Files"/"Input"/"General" fieldset legends and the `no-slash`
feedback message are no longer referenced by any template.

In `public/i18n/us.json`, replace:

```json
      "label": {
        "input": "Input",
        "general": "General",
        "settings": "Settings",
        "limits": "Limits",
        "files": "Files",
        "transfer-rate-limits": "Transfer Rate Limits",
        "share-limits": "Share Limits"
      },
```

with:

```json
      "label": {
        "transfer-rate-limits": "Transfer Rate Limits",
        "share-limits": "Share Limits"
      },
```

Then, in the same file, replace:

```json
      "feedback": {
        "required": "This field is required.",
        "no-slash": "The name must not contain slashes.",
        "pattern": "Name contains invalid characters (< > : \" / \\ | ? *)"
      },
```

with:

```json
      "feedback": {
        "required": "This field is required.",
        "pattern": "Name contains invalid characters (< > : \" / \\ | ? *)"
      },
```

- [ ] **Step 7: Remove the same now-unused i18n keys from `hu.json`**

In `public/i18n/hu.json`, replace:

```json
      "label": {
        "input": "Bemenet",
        "general": "Általános",
        "settings": "Beállítások",
        "limits": "Korlátok",
        "files": "Fájlok",
        "transfer-rate-limits": "Átviteli sebesség korlátok",
        "share-limits": "Megosztási korlátok"
      },
```

with:

```json
      "label": {
        "transfer-rate-limits": "Átviteli sebesség korlátok",
        "share-limits": "Megosztási korlátok"
      },
```

Then, in the same file, replace:

```json
      "feedback": {
        "required": "Ez a mező kötelező.",
        "no-slash": "A név nem tartalmazhat perjelet (/).",
        "pattern": "A név érvénytelen karaktereket tartalmaz (< > : \" / \\ | ? *)"
      },
```

with:

```json
      "feedback": {
        "required": "Ez a mező kötelező.",
        "pattern": "A név érvénytelen karaktereket tartalmaz (< > : \" / \\ | ? *)"
      },
```

- [ ] **Step 8: Verify lint, tests, and build all pass**

Run: `npm run lint -w @bitbutler/app`
Expected: no errors (max-warnings=0)

Run: `npm test -w @bitbutler/app -- add-torrent`
Expected: all `add-torrent` specs (parent + 4 tab children) PASS

Run: `npm run build -w @bitbutler/app`
Expected: build succeeds

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.html packages/app/src/app/components/add-torrent/add-torrent.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#159: refactor add-torrent into tabbed layout"
```

---

<!-- PLAN-CONTINUE -->
