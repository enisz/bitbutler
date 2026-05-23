# Share Limit & Transfer Limit - Store-Based Population Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix share-limit and transfer-limit modals to populate from TorrentStoreService using explicitly passed hashes, add a global share limit entry point on the status bar ratio widget, and remove stale SelectionStoreService dependencies from both modals.

**Architecture:** Commands carry `target` and `hashes` explicitly so modals never rely on ambient SelectionStoreService state. The `torrent` target path is fully synchronous (store lookup, no spinner); the `global` target path keeps the existing async API call pattern. The ratio widget in server-state mirrors the existing dl/ul global transfer limit widget.

**Tech Stack:** Angular 20 (zoneless, signals), NgRx-free signal store, TypeScript, Vitest, ng-bootstrap modals.

---

## File Map

| File                                                                           | Action                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `packages/app/src/app/models/command.model.ts`                                 | Modify - extend `UI_LIMIT_SHARE` and `UI_LIMIT_TRANSFER` types                         |
| `packages/app/src/app/components/modals/share-limit/share-limit.ts`            | Modify - add inputs, torrent/global paths, remove SelectionStoreService                |
| `packages/app/src/app/components/modals/share-limit/share-limit.html`          | Modify - add global subtitle branch                                                    |
| `packages/app/src/app/components/modals/share-limit/share-limit.spec.ts`       | Modify - update tests to new API                                                       |
| `packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts`      | Modify - add hashes input, store lookup for torrent path, remove SelectionStoreService |
| `packages/app/src/app/components/modals/transfer-limit/transfer-limit.spec.ts` | Modify - update tests to new API                                                       |
| `packages/app/src/app/services/ui-command-handler.service.ts`                  | Modify - resolve and pass target + hashes to both modals                               |
| `packages/app/src/app/components/modals/torrent-details/general/general.ts`    | Modify - emit with `target: 'torrent'` and `hashes: [this.hash]`                       |
| `packages/app/src/app/pages/main/server-state/server-state.ts`                 | Modify - add `setGlobalShareLimit()`                                                   |
| `packages/app/src/app/pages/main/server-state/server-state.html`               | Modify - wire ratio widget click                                                       |
| `public/i18n/us.json`                                                          | Modify - add `components.modals.share-limit.global` key                                |
| `public/i18n/hu.json`                                                          | Modify - add `components.modals.share-limit.global` key                                |

---

### Task 1: Create feature branch

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout -b 104-share-limit-store-population
```

Expected: `Switched to a new branch '104-share-limit-store-population'`

---

### Task 2: Extend command model types

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`

- [ ] **Step 1: Add `target` and `hashes` to `UI_LIMIT_SHARE`; add `hashes` to `UI_LIMIT_TRANSFER`**

In `command.model.ts`, replace:

```typescript
| { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType }
| { type: 'UI_LIMIT_SHARE' }
```

with:

```typescript
| { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType; hashes?: string[] }
| { type: 'UI_LIMIT_SHARE'; target?: LimitTargetType; hashes?: string[] }
```

Both additions are optional fields, so all existing callers remain valid without changes.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npm run build:electron 2>&1 | tail -5
```

Expected: exit 0, no type errors. (The Angular build is not needed yet - we are only changing a shared type.)

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/models/command.model.ts
git commit -m "#104: extend UI_LIMIT_SHARE and UI_LIMIT_TRANSFER commands with target and hashes"
```

---

### Task 3: Rewrite share-limit modal tests

**Files:**

- Modify: `packages/app/src/app/components/modals/share-limit/share-limit.spec.ts`

- [ ] **Step 1: Replace the entire spec file**

The current spec provides `SelectionStoreService` and relies on the async QbService mock for all cases. The new spec removes that provider, adds a `TorrentStoreService` mock, and covers both `torrent` and `global` target paths.

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ShareLimit } from './share-limit';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({
    name: 'My Torrent',
    hash: 'abc123',
    ratio_limit: -1,
    seeding_time_limit: -1,
    inactive_seeding_time_limit: -1,
    ...overrides,
  }) as Torrent;

const makeStore = (torrents: Torrent[] = []) => signal(new Map(torrents.map((t) => [t.hash, t])));

describe('ShareLimit', () => {
  let component: ShareLimit;
  let fixture: ComponentFixture<ShareLimit>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: any;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      getAppPreferences: vi.fn().mockResolvedValue({
        max_ratio_enabled: true,
        max_ratio: 2.0,
        max_seeding_time_enabled: false,
        max_seeding_time: 0,
        max_inactive_seeding_time_enabled: false,
        max_inactive_seeding_time: null,
      }),
      setShareLimits: vi.fn().mockResolvedValue(undefined),
      setAppPreferences: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ShareLimit],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: makeStore([makeTorrent()]) },
        },
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareLimit);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('torrent target - single hash with negative limits (use global)', () => {
    beforeEach(async () => {
      component.target = 'torrent';
      component.hashes = ['abc123'];
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('leaves all form fields null when ratio_limit and time limits are -1', () => {
      const v = component.form.controls.shareLimits.value;
      expect(v?.ratioLimit).toBeNull();
      expect(v?.seedingTimeLimit).toBeNull();
      expect(v?.inactiveSeedingTimeLimit).toBeNull();
    });

    it('does not call getAppPreferences', () => {
      expect(mockQbService.getAppPreferences).not.toHaveBeenCalled();
    });

    it('loading stays false', () => {
      expect(component.loading()).toBe(false);
    });
  });

  describe('torrent target - single hash with explicit limits', () => {
    beforeEach(async () => {
      TestBed.overrideProvider(TorrentStoreService, {
        useValue: {
          torrentsMap: makeStore([
            makeTorrent({
              ratio_limit: 1.5,
              seeding_time_limit: 120,
              inactive_seeding_time_limit: 30,
            }),
          ]),
        },
      });
      component.target = 'torrent';
      component.hashes = ['abc123'];
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('populates ratioLimit from ratio_limit', () => {
      expect(component.form.controls.shareLimits.value?.ratioLimit).toBe(1.5);
    });

    it('populates seedingTimeLimit from seeding_time_limit', () => {
      expect(component.form.controls.shareLimits.value?.seedingTimeLimit).toBe(120);
    });

    it('populates inactiveSeedingTimeLimit from inactive_seeding_time_limit', () => {
      expect(component.form.controls.shareLimits.value?.inactiveSeedingTimeLimit).toBe(30);
    });
  });

  describe('torrent target - multiple hashes', () => {
    beforeEach(async () => {
      component.target = 'torrent';
      component.hashes = ['abc123', 'def456'];
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('leaves all form fields null for multi-selection', () => {
      const v = component.form.controls.shareLimits.value;
      expect(v?.ratioLimit).toBeNull();
      expect(v?.seedingTimeLimit).toBeNull();
      expect(v?.inactiveSeedingTimeLimit).toBeNull();
    });

    it('does not call getAppPreferences', () => {
      expect(mockQbService.getAppPreferences).not.toHaveBeenCalled();
    });
  });

  describe('global target', () => {
    beforeEach(async () => {
      component.target = 'global';
      component.hashes = [];
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('calls getAppPreferences', () => {
      expect(mockQbService.getAppPreferences).toHaveBeenCalledWith('server-1');
    });

    it('populates ratioLimit when max_ratio_enabled is true', () => {
      expect(component.form.controls.shareLimits.value?.ratioLimit).toBe(2.0);
    });

    it('leaves seedingTimeLimit null when max_seeding_time_enabled is false', () => {
      expect(component.form.controls.shareLimits.value?.seedingTimeLimit).toBeNull();
    });

    it('loading ends as false after init', () => {
      expect(component.loading()).toBe(false);
    });
  });

  describe('selectionName', () => {
    it('returns torrent name for single hash', () => {
      component.hashes = ['abc123'];
      expect(component.selectionName()).toBe('My Torrent');
    });

    it('returns count for multiple hashes', () => {
      component.hashes = ['abc123', 'def456'];
      expect(component.selectionName()).toBe(2);
    });
  });

  describe('tooltipText', () => {
    it('returns null for global target', () => {
      component.target = 'global';
      component.hashes = [];
      expect(component.tooltipText()).toBeNull();
    });

    it('returns string for torrent target', () => {
      component.target = 'torrent';
      component.hashes = ['abc123'];
      expect(component.tooltipText()).toBe('My Torrent');
    });
  });

  describe('canSave', () => {
    it('returns true when not saving', () => {
      expect(component.canSave()).toBe(true);
    });

    it('returns false while saving', () => {
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('hasClearableValues', () => {
    it('returns false when all limits are null', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: null,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(false);
    });

    it('returns true when ratioLimit is set', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: 2.0,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });

    it('returns true when seedingTimeLimit is set', () => {
      component.form.controls.shareLimits.setValue({
        ratioLimit: null,
        seedingTimeLimit: 60,
        inactiveSeedingTimeLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });
  });

  describe('handleSubmit - torrent target', () => {
    it('calls setShareLimits with component hashes', async () => {
      component.target = 'torrent';
      component.hashes = ['abc123'];
      component.form.controls.shareLimits.setValue({
        ratioLimit: 1.5,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      await component.handleSubmit();
      expect(mockQbService.setShareLimits).toHaveBeenCalledWith(
        'server-1',
        ['abc123'],
        1.5,
        -1,
        -1,
      );
    });
  });

  describe('handleSubmit - global target', () => {
    it('calls setAppPreferences with enabled flags', async () => {
      component.target = 'global';
      component.hashes = [];
      component.form.controls.shareLimits.setValue({
        ratioLimit: 2.0,
        seedingTimeLimit: null,
        inactiveSeedingTimeLimit: null,
      });
      await component.handleSubmit();
      expect(mockQbService.setAppPreferences).toHaveBeenCalledWith('server-1', {
        max_ratio_enabled: true,
        max_ratio: 2.0,
        max_seeding_time_enabled: false,
        max_seeding_time: 0,
        max_inactive_seeding_time_enabled: false,
        max_inactive_seeding_time: null,
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (component not yet updated)**

```bash
npm test -- --run --reporter=verbose 2>&1 | grep -A3 "ShareLimit"
```

Expected: multiple FAIL lines - providers for SelectionStoreService missing, hashes input not found, etc.

---

### Task 4: Implement the refactored share-limit modal

**Files:**

- Modify: `packages/app/src/app/components/modals/share-limit/share-limit.ts`

- [ ] **Step 1: Replace the entire component implementation**

```typescript
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { ShareLimit as ShareLimitForm, ShareLimitValue } from '../../share-limit/share-limit';

@Component({
  selector: 'app-share-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ShareLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
  ],
  templateUrl: './share-limit.html',
  styleUrl: './share-limit.scss',
})
export class ShareLimit implements OnInit {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() public target: LimitTargetType = 'torrent';
  @Input() public hashes: string[] = [];

  public loading = signal(false);
  public saving = signal(false);

  public readonly selected = computed(() => this.hashes.length);

  public readonly selectionName = computed(() => {
    if (this.hashes.length === 1) {
      return this.torrentStoreService.torrentsMap().get(this.hashes[0])?.name ?? this.hashes[0];
    }
    return this.hashes.length;
  });

  public readonly tooltipText = computed(() => {
    if (this.target === 'global') return null;
    return String(this.selectionName());
  });

  public form = new FormGroup({
    shareLimits: new FormControl<ShareLimitValue | null>(null),
  });

  public async ngOnInit(): Promise<void> {
    if (this.target === 'global') {
      this.loading.set(true);
      const serverId = this.serverStoreService.currentServerId() ?? '';
      const prefs = await this.qbService.getAppPreferences(serverId);
      this.form.controls.shareLimits.setValue(
        {
          ratioLimit: prefs.max_ratio_enabled ? prefs.max_ratio : null,
          seedingTimeLimit: prefs.max_seeding_time_enabled ? prefs.max_seeding_time : null,
          inactiveSeedingTimeLimit:
            prefs.max_inactive_seeding_time_enabled && prefs.max_inactive_seeding_time != null
              ? prefs.max_inactive_seeding_time
              : null,
        },
        { emitEvent: false },
      );
      this.loading.set(false);
      this.cdr.markForCheck();
      return;
    }

    if (this.hashes.length === 1) {
      const t = this.torrentStoreService.torrentsMap().get(this.hashes[0]);
      if (t) {
        this.form.controls.shareLimits.setValue(
          {
            ratioLimit: t.ratio_limit >= 0 ? t.ratio_limit : null,
            seedingTimeLimit: t.seeding_time_limit >= 0 ? t.seeding_time_limit : null,
            inactiveSeedingTimeLimit:
              t.inactive_seeding_time_limit >= 0 ? t.inactive_seeding_time_limit : null,
          },
          { emitEvent: false },
        );
      }
    }
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const value = this.form.getRawValue().shareLimits;

    try {
      if (this.target === 'global') {
        await this.qbService.setAppPreferences(serverId, {
          max_ratio_enabled: value?.ratioLimit != null,
          max_ratio: value?.ratioLimit ?? 0,
          max_seeding_time_enabled: value?.seedingTimeLimit != null,
          max_seeding_time: value?.seedingTimeLimit ?? 0,
          max_inactive_seeding_time_enabled: value?.inactiveSeedingTimeLimit != null,
          max_inactive_seeding_time: value?.inactiveSeedingTimeLimit ?? null,
        });
      } else {
        await this.qbService.setShareLimits(
          serverId,
          this.hashes,
          value?.ratioLimit ?? -1,
          value?.seedingTimeLimit ?? -1,
          value?.inactiveSeedingTimeLimit ?? -1,
        );
      }
      this.activeModal.close();
    } catch (error) {
      console.error(ShareLimit.name, 'handleSubmit', 'Failed to set share limits!', error);
    } finally {
      this.saving.set(false);
    }
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.shareLimits.value;
    return (
      v !== null &&
      (v.ratioLimit !== null || v.seedingTimeLimit !== null || v.inactiveSeedingTimeLimit !== null)
    );
  }

  public clearAll(): void {
    this.form.controls.shareLimits.setValue({
      ratioLimit: null,
      seedingTimeLimit: null,
      inactiveSeedingTimeLimit: null,
    });
    this.handleSubmit();
  }

  public canSave(): boolean {
    return !this.saving();
  }
}
```

- [ ] **Step 2: Run the share-limit tests and verify they pass**

```bash
npm test -- --run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|share-limit)"
```

Expected: all share-limit tests PASS.

---

### Task 5: Update share-limit modal HTML for the global target subtitle

**Files:**

- Modify: `packages/app/src/app/components/modals/share-limit/share-limit.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add the global subtitle branch to the modal header**

In `share-limit.html`, replace the subtitle `div` content (lines 13-19):

```html
<div
  class="small text-body-secondary mt-1 bb-hash-clamp"
  [ngbTooltip]="tooltipText()"
  bbTooltipOverflow
  tooltipClass="single-line-tooltip"
  placement="bottom"
>
  @if (selected() === 1) { {{ selectionName() }} } @else { {{ 'general.label.torrent-selected' |
  translate: { count: selected() } }} }
</div>
```

with:

```html
<div
  class="small text-body-secondary mt-1 bb-hash-clamp"
  [ngbTooltip]="tooltipText()"
  bbTooltipOverflow
  tooltipClass="single-line-tooltip"
  placement="bottom"
>
  @if (target === 'global') { {{ 'components.modals.share-limit.global' | translate }} } @else if
  (selected() === 1) { {{ selectionName() }} } @else { {{ 'general.label.torrent-selected' |
  translate: { count: selected() } }} }
</div>
```

- [ ] **Step 2: Add the `global` key to the English translation**

In `public/i18n/us.json`, find the `share-limit` section under `components.modals` (around line 580) and add the `global` key:

```json
"share-limit": {
  "title": "Share Limit",
  "global": "Global Share Limit",
  "loading": "Loading Share Limits..."
},
```

- [ ] **Step 3: Add the `global` key to the Hungarian translation**

In `public/i18n/hu.json`, find the `share-limit` section under `components.modals` and add:

```json
"share-limit": {
  "title": "Megosztási korlát",
  "global": "Globális megosztási korlát",
  "loading": "Megosztási korlátok betöltése..."
},
```

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/share-limit/ public/i18n/
git commit -m "#104: refactor share-limit modal to use torrent store and support global target"
```

---

### Task 6: Rewrite transfer-limit modal tests

**Files:**

- Modify: `packages/app/src/app/components/modals/transfer-limit/transfer-limit.spec.ts`

- [ ] **Step 1: Replace the entire spec file**

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TransferLimit } from './transfer-limit';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({ name: 'My Torrent', hash: 'abc123', up_limit: 0, dl_limit: 0, ...overrides }) as Torrent;

const makeStore = (torrents: Torrent[] = []) => signal(new Map(torrents.map((t) => [t.hash, t])));

describe('TransferLimit', () => {
  let component: TransferLimit;
  let fixture: ComponentFixture<TransferLimit>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: any;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      getUploadLimit: vi.fn().mockResolvedValue(0),
      getDownloadLimit: vi.fn().mockResolvedValue(0),
      setUploadLimit: vi.fn().mockResolvedValue(undefined),
      setDownloadLimit: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TransferLimit],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: makeStore([makeTorrent()]) },
        },
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferLimit);
    component = fixture.componentInstance;
    component.target = 'torrent';
    component.hashes = ['abc123'];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('torrent target - zero limits', () => {
    it('leaves uploadLimit null when up_limit is 0', async () => {
      await fixture.whenStable();
      expect(component.form.controls.transferRateLimits.value?.uploadLimit).toBeNull();
    });

    it('leaves downloadLimit null when dl_limit is 0', async () => {
      await fixture.whenStable();
      expect(component.form.controls.transferRateLimits.value?.downloadLimit).toBeNull();
    });

    it('does not call getUploadLimit or getDownloadLimit', () => {
      expect(mockQbService.getUploadLimit).not.toHaveBeenCalled();
      expect(mockQbService.getDownloadLimit).not.toHaveBeenCalled();
    });
  });

  describe('torrent target - set limits', () => {
    beforeEach(async () => {
      TestBed.overrideProvider(TorrentStoreService, {
        useValue: {
          torrentsMap: makeStore([makeTorrent({ up_limit: 512 * 1024, dl_limit: 1024 * 1024 })]),
        },
      });
      const f = TestBed.createComponent(TransferLimit);
      component = f.componentInstance;
      component.target = 'torrent';
      component.hashes = ['abc123'];
      f.detectChanges();
      await f.whenStable();
    });

    it('converts up_limit bytes to KiB for uploadLimit', () => {
      expect(component.form.controls.transferRateLimits.value?.uploadLimit).toBe(512);
    });

    it('converts dl_limit bytes to KiB for downloadLimit', () => {
      expect(component.form.controls.transferRateLimits.value?.downloadLimit).toBe(1024);
    });
  });

  describe('canSave', () => {
    it('returns true when form is valid and not saving', () => {
      expect(component.canSave()).toBe(true);
    });

    it('returns false while saving', () => {
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('hasClearableValues', () => {
    it('returns false when both limits are null', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: null,
        downloadLimit: null,
      });
      expect(component.hasClearableValues()).toBe(false);
    });

    it('returns true when uploadLimit is set', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });

    it('returns true when downloadLimit is set', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: null,
        downloadLimit: 1024,
      });
      expect(component.hasClearableValues()).toBe(true);
    });
  });

  describe('tooltipText', () => {
    it('returns null for global target', () => {
      const f = TestBed.createComponent(TransferLimit);
      const c = f.componentInstance;
      c.target = 'global';
      c.hashes = [];
      f.detectChanges();
      expect(c.tooltipText()).toBeNull();
    });

    it('returns non-null for torrent target with hashes', () => {
      expect(component.tooltipText()).toBeDefined();
    });
  });

  describe('handleSubmit - torrent target', () => {
    it('calls setUploadLimit and setDownloadLimit with component hashes', async () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: 1024,
      });
      await component.handleSubmit();
      expect(mockQbService.setUploadLimit).toHaveBeenCalledWith('server-1', 512 * 1024, ['abc123']);
      expect(mockQbService.setDownloadLimit).toHaveBeenCalledWith('server-1', 1024 * 1024, [
        'abc123',
      ]);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|TransferLimit)"
```

Expected: FAIL - SelectionStoreService provider missing / hashes input not found.

---

### Task 7: Implement the refactored transfer-limit modal

**Files:**

- Modify: `packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts`

- [ ] **Step 1: Replace the entire component implementation**

```typescript
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { LimitTargetType } from '../../../models/command.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import {
  TransferLimit as TransferLimitForm,
  TransferLimitValue,
} from '../../transfer-limit/transfer-limit';

@Component({
  selector: 'app-transfer-limit-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    TransferLimitForm,
    NgbTooltip,
    TooltipOverflow,
    BbSpinner,
    AutofocusDirective,
  ],
  templateUrl: './transfer-limit.html',
  styleUrl: './transfer-limit.scss',
})
export class TransferLimit implements OnInit {
  @Input() public target!: LimitTargetType;
  @Input() public hashes: string[] = [];

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly cdr = inject(ChangeDetectorRef);
  public activeModal = inject(NgbActiveModal);

  public form = new FormGroup({
    transferRateLimits: new FormControl<TransferLimitValue | null>(null),
  });

  public loading = signal<boolean>(false);
  public saving = signal<boolean>(false);

  public readonly selected = computed(() => this.hashes.length);

  public readonly selectionName = computed(() => {
    if (this.hashes.length === 1) {
      return this.torrentStoreService.torrentsMap().get(this.hashes[0])?.name ?? this.hashes[0];
    }
    return this.hashes.length;
  });

  public readonly tooltipText = computed(() => {
    if (this.target === 'global') return null;
    return String(this.selectionName());
  });

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    let uploadBytes = 0;
    let downloadBytes = 0;

    if (this.target === 'global') {
      this.loading.set(true);
      [uploadBytes, downloadBytes] = await Promise.all([
        this.qbService.getUploadLimit(serverId) as Promise<number>,
        this.qbService.getDownloadLimit(serverId) as Promise<number>,
      ]);
      this.loading.set(false);
      this.cdr.markForCheck();
    } else if (this.hashes.length > 0) {
      const torrent = this.torrentStoreService.torrentsMap().get(this.hashes[0]);
      if (torrent) {
        uploadBytes = torrent.up_limit;
        downloadBytes = torrent.dl_limit;
      }
    }

    this.form.controls.transferRateLimits.setValue(
      {
        uploadLimit: uploadBytes > 0 ? Math.floor(uploadBytes / 1024) : null,
        downloadLimit: downloadBytes > 0 ? Math.floor(downloadBytes / 1024) : null,
      },
      { emitEvent: false },
    );
  }

  public async handleSubmit(): Promise<void> {
    this.saving.set(true);
    const serverId = this.serverStoreService.currentServerId() as string;
    const value = this.form.controls.transferRateLimits.value;
    const uploadBytes = (value?.uploadLimit ?? 0) * 1024;
    const downloadBytes = (value?.downloadLimit ?? 0) * 1024;
    const hashes = this.target === 'torrent' ? this.hashes : undefined;

    try {
      await Promise.all([
        this.qbService.setUploadLimit(serverId, uploadBytes, hashes),
        this.qbService.setDownloadLimit(serverId, downloadBytes, hashes),
      ]);
    } catch (error: any) {
      console.error(TransferLimit.name, 'handleSubmit', 'Failed to update limits!');
    } finally {
      this.saving.set(false);
      this.activeModal.close();
    }
  }

  public clearAll(): void {
    this.form.controls.transferRateLimits.setValue({ uploadLimit: null, downloadLimit: null });
    this.handleSubmit();
  }

  public hasClearableValues(): boolean {
    const v = this.form.controls.transferRateLimits.value;
    return v !== null && (v.uploadLimit !== null || v.downloadLimit !== null);
  }

  public canSave(): boolean {
    return this.form.valid && !this.saving();
  }
}
```

- [ ] **Step 2: Run the transfer-limit tests and verify they pass**

```bash
npm test -- --run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|TransferLimit)"
```

Expected: all TransferLimit tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/components/modals/transfer-limit/
git commit -m "#104: refactor transfer-limit modal to use torrent store and hashes input"
```

---

### Task 8: Update ui-command-handler to pass target and hashes to modals

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`

- [ ] **Step 1: Update the `UI_LIMIT_SHARE` handler (around line 183)**

Replace:

```typescript
case 'UI_LIMIT_SHARE':
  if (this.isModalOpen(ShareLimit)) break;

  const limitTorrentShare = this.modalService.open(ShareLimit, { size: 'lg' });

  limitTorrentShare.result.then((res: any) => {}).catch((error: any) => {});
  break;
```

with:

```typescript
case 'UI_LIMIT_SHARE': {
  if (this.isModalOpen(ShareLimit)) break;
  const shareLimitTarget = command.target ?? 'torrent';
  const shareLimitHashes =
    command.hashes ?? (shareLimitTarget === 'torrent' ? this.selectionStoreService.selectedHashes() : []);
  const limitTorrentShare = this.modalService.open(ShareLimit, { size: 'lg' });
  limitTorrentShare.componentInstance.target = shareLimitTarget;
  limitTorrentShare.componentInstance.hashes = shareLimitHashes;
  limitTorrentShare.result.then((res: any) => {}).catch((error: any) => {});
  break;
}
```

- [ ] **Step 2: Update the `UI_LIMIT_TRANSFER` handler (around line 171)**

Replace:

```typescript
case 'UI_LIMIT_TRANSFER':
  if (this.isModalOpen(TransferLimit)) break;
  const limitTransferModalRef = this.modalService.open(TransferLimit, {
    centered: true,
    size: 'lg',
  });

  limitTransferModalRef.componentInstance.target = command.target;

  limitTransferModalRef.result.then((res: any) => {}).catch((error: any) => {});
  break;
```

with:

```typescript
case 'UI_LIMIT_TRANSFER': {
  if (this.isModalOpen(TransferLimit)) break;
  const transferHashes =
    command.hashes ?? (command.target === 'torrent' ? this.selectionStoreService.selectedHashes() : []);
  const limitTransferModalRef = this.modalService.open(TransferLimit, {
    centered: true,
    size: 'lg',
  });
  limitTransferModalRef.componentInstance.target = command.target;
  limitTransferModalRef.componentInstance.hashes = transferHashes;
  limitTransferModalRef.result.then((res: any) => {}).catch((error: any) => {});
  break;
}
```

Note: wrapping each case in `{ }` block avoids the lexical declaration scope issue with `const` inside `switch` cases.

- [ ] **Step 3: Run lint to verify no errors**

```bash
npm run lint 2>&1 | tail -10
```

Expected: `0 problems (0 warnings, 0 errors)`

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts
git commit -m "#104: pass target and hashes to share-limit and transfer-limit modals"
```

---

### Task 9: Update torrent-details general to pass hash on emit

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts`

- [ ] **Step 1: Update `openShareLimitsModal()`**

Find (around line 236):

```typescript
public openShareLimitsModal(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_SHARE' });
}
```

Replace with:

```typescript
public openShareLimitsModal(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_SHARE', target: 'torrent', hashes: [this.hash] });
}
```

- [ ] **Step 2: Update `changeDownloadLimit()` and `changeUploadLimit()`**

Find (around line 186):

```typescript
public changeDownloadLimit(): void {
  this.commandBusService.emit({
    type: 'UI_LIMIT_TRANSFER',
    target: 'torrent',
  });
}

public changeUploadLimit(): void {
  this.commandBusService.emit({
    type: 'UI_LIMIT_TRANSFER',
    target: 'torrent',
  });
}
```

Replace with:

```typescript
public changeDownloadLimit(): void {
  this.commandBusService.emit({
    type: 'UI_LIMIT_TRANSFER',
    target: 'torrent',
    hashes: [this.hash],
  });
}

public changeUploadLimit(): void {
  this.commandBusService.emit({
    type: 'UI_LIMIT_TRANSFER',
    target: 'torrent',
    hashes: [this.hash],
  });
}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: `0 problems`

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts
git commit -m "#104: pass torrent hash when opening share and transfer limit modals from details page"
```

---

### Task 10: Add global share limit to server-state widget

**Files:**

- Modify: `packages/app/src/app/pages/main/server-state/server-state.ts`
- Modify: `packages/app/src/app/pages/main/server-state/server-state.html`

- [ ] **Step 1: Add `setGlobalShareLimit()` to `server-state.ts`**

After the `setGlobalTransferLimit()` method (around line 146):

```typescript
public setGlobalTransferLimit(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_TRANSFER', target: 'global' });
}
```

Add:

```typescript
public setGlobalShareLimit(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_SHARE', target: 'global' });
}
```

- [ ] **Step 2: Wire the ratio widget click in `server-state.html`**

Find the `@case ('ratio')` block (around line 61):

```html
@case ('ratio') {
<div class="bb-widget" [ngbTooltip]="tipRatioGlobal" placement="top" container="body">
  <fa-icon [icon]="icons.faShareAlt" class="text-secondary opacity-75"></fa-icon>
  <span class="bb-value">{{ sessionRatio() }}</span>
</div>
}
```

Replace with:

```html
@case ('ratio') {
<div
  class="bb-widget cursor-pointer"
  [ngbTooltip]="tipRatioGlobal"
  placement="top"
  container="body"
  (click)="setGlobalShareLimit()"
>
  <fa-icon [icon]="icons.faShareAlt" class="text-secondary opacity-75"></fa-icon>
  <span class="bb-value">{{ sessionRatio() }}</span>
</div>
}
```

- [ ] **Step 3: Add a test for `setGlobalShareLimit()` in `server-state.spec.ts`**

In `packages/app/src/app/pages/main/server-state/server-state.spec.ts`, add a new `describe` block after any existing method tests:

```typescript
describe('setGlobalShareLimit', () => {
  it('emits UI_LIMIT_SHARE with global target', () => {
    component.setGlobalShareLimit();
    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_LIMIT_SHARE',
      target: 'global',
    });
  });
});
```

- [ ] **Step 4: Run the server-state tests**

```bash
npm test -- --run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|ServerState)"
```

Expected: all ServerState tests PASS including the new one.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/server-state/
git commit -m "#104: add global share limit widget to status bar ratio indicator"
```

---

### Task 11: Full test suite and lint verification

- [ ] **Step 1: Run all tests**

```bash
npm test -- --run 2>&1 | tail -20
```

Expected: all test suites pass, 0 failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: `0 problems (0 warnings, 0 errors)`

- [ ] **Step 3: Verify the feature branch is ready**

```bash
git log --oneline main..HEAD
```

Expected: 7 commits listed (Tasks 2, 4+5, 7, 8, 9, 10).
